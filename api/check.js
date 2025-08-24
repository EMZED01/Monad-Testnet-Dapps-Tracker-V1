/**
 * /api/check
 *
 * ENV required on Vercel:
 *  - BLOCKVISION_API_KEY = your BlockVision Monad Testnet API key
 *  - REGISTRY_URL        = raw URL to your dapp registry JSON (GitHub raw is fine)
 *
 * Returns:
 * {
 *   ok: true,
 *   exploredCount: number,
 *   totalDapps: number,
 *   exploredDapps: [dappName, ...],
 *   exploredAddresses: [0x..., ...],        // lowercased unique contract addresses matched
 *   dappStatus: { [dappName]: { explored: bool, matchedContracts: [0x...] } }
 * }
 */

export default async function handler(req, res) {
  // Basic CORS (same-origin frontends won’t need this, but it’s harmless)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { address } = await readJson(req);
    const apiKey = process.env.BLOCKVISION_API_KEY;
    const registryUrl = process.env.REGISTRY_URL;

    if (!apiKey) {
      return res.status(500).json({ ok: false, error: 'Missing BLOCKVISION_API_KEY env var' });
    }
    if (!registryUrl) {
      return res.status(500).json({ ok: false, error: 'Missing REGISTRY_URL env var' });
    }

    const wallet = normalizeAddress(address);
    if (!isValidAddress(wallet)) {
      return res.status(400).json({ ok: false, error: 'Invalid wallet address' });
    }

    // 1) Load the dapp registry (live from GitHub or wherever you host it)
    const dapps = await fetchRegistry(registryUrl);

    // Flatten every possible contracts shape to a clean Set of addresses per dapp
    const dappContracts = dapps.map(d => ({
      name: String(d.name || d.title || 'Unnamed dApp'),
      contracts: flattenContracts(d.contracts)
    }));

    // Global Set of all contracts (for quick membership check)
    const allContracts = new Set();
    for (const d of dappContracts) for (const c of d.contracts) allContracts.add(c);

    // 2) Fetch recent txs for the wallet (paginate a bit for safety)
    const txs = await fetchAllTxs(wallet, apiKey, 4 /* pages */, 50 /* per page */);

    // 3) Match: wallet FROM -> contract TO (direct interactions)
    const matchedAddresses = new Set();
    for (const tx of txs) {
      const from = normalizeAddress(tx.from);
      const to = normalizeAddress(tx.to);
      if (from === wallet && allContracts.has(to)) {
        matchedAddresses.add(to);
      }
    }

    // 4) Aggregate by dapp
    const dappStatus = {};
    const exploredDapps = [];
    for (const d of dappContracts) {
      const hits = d.contracts.filter(c => matchedAddresses.has(c));
      const explored = hits.length > 0;
      dappStatus[d.name] = { explored, matchedContracts: hits };
      if (explored) exploredDapps.push(d.name);
    }

    return res.status(200).json({
      ok: true,
      exploredCount: exploredDapps.length,
      totalDapps: dappContracts.length,
      exploredDapps,
      exploredAddresses: Array.from(matchedAddresses),
      dappStatus
    });

  } catch (err) {
    console.error('[check] error', err);
    return res.status(500).json({ ok: false, error: 'Error checking wallet' });
  }
}

/* ---------------- helpers ---------------- */

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString('utf8') || '{}';
  return JSON.parse(body);
}

function isValidAddress(a) {
  return typeof a === 'string' && /^0x[0-9a-f]{40}$/.test(a);
}
function normalizeAddress(a) {
  return (a || '').toString().trim().toLowerCase();
}

/**
 * Fetch registry JSON and return an array of dapps.
 * Expected fields per dapp (flexible): name, contracts (array OR nested object).
 */
async function fetchRegistry(url) {
  const r = await fetch(url, { method: 'GET' });
  if (!r.ok) throw new Error(`Failed to load registry: ${r.status}`);
  const json = await r.json();
  // tolerate { dapps: [...] } or just [...]
  return Array.isArray(json) ? json : (Array.isArray(json.dapps) ? json.dapps : []);
}

/**
 * Accepts many shapes:
 * - ["0x...", "0x..."]
 * - { monad: ["0x..."], testnet: ["0x..."], routers: { monad: ["0x..."] } }
 * - anything deeply nested containing strings that look like 0x addresses
 */
function flattenContracts(contracts) {
  const out = new Set();
  const walk = (node) => {
    if (!node) return;
    if (typeof node === 'string') {
      const s = normalizeAddress(node);
      if (/^0x[0-9a-f]{40}$/.test(s)) out.add(s);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === 'object') {
      Object.values(node).forEach(walk);
    }
  };
  walk(contracts);
  return Array.from(out);
}

/**
 * Pull multiple pages of account transactions from BlockVision.
 * Uses X-API-Key by default; auto-falls back to Authorization: Bearer if needed.
 */
async function fetchAllTxs(address, apiKey, maxPages = 3, limit = 50) {
  const base = 'https://api.blockvision.org/v2/monad/account/transactions';
  let cursor = '';
  const all = [];

  for (let i = 0; i < maxPages; i++) {
    const url = new URL(base);
    url.searchParams.set('address', address);
    url.searchParams.set('limit', String(limit));
    if (cursor) url.searchParams.set('cursor', cursor);

    // try primary header style
    let r = await fetch(url, {
      headers: { 'X-API-Key': apiKey }
    });

    // fallback to Bearer if unauthorized/forbidden
    if (r.status === 401 || r.status === 403) {
      r = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
    }

    if (!r.ok) throw new Error(`BlockVision HTTP ${r.status}`);
    const data = await r.json();
    if (data.code !== 0) throw new Error(`BlockVision error: ${data.reason || data.message || data.code}`);

    const page = (data.result && Array.isArray(data.result.data)) ? data.result.data : [];
    all.push(...page);

    cursor = (data.result && typeof data.result.nextPageCursor === 'string') ? data.result.nextPageCursor : '';
    if (!cursor) break;
  }

  return all;
}