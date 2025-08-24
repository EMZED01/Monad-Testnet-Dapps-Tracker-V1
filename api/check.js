// api/check.js

export default async function handler(req, res) {
  try {
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ error: "Missing wallet address" });

    const API_KEY = process.env.BLOCKVISION_API_KEY;
    const REGISTRY_URL = process.env.REGISTRY_URL;
    if (!API_KEY || !REGISTRY_URL) {
      return res.status(500).json({ error: "Missing API key or registry URL" });
    }

    const walletAddr = wallet.toLowerCase();

    // 1) Fetch dApp list
    const regRes = await fetch(REGISTRY_URL);
    if (!regRes.ok) throw new Error("Failed to fetch registry");
    const dapps = await regRes.json();

    // 2) Paginated fetch of account transactions
    let allTxs = [];
    let cursor = "";
    const endpoint = "https://api.blockvision.org/v2/monad/account/transactions";

    do {
      const url = new URL(endpoint);
      url.searchParams.set("address", walletAddr);
      url.searchParams.set("limit", "50");
      if (cursor) url.searchParams.set("cursor", cursor);

      const resp = await fetch(url, {
        headers: { "x-api-key": API_KEY }
      });
      if (!resp.ok) {
        return res.status(500).json({ error: "Error fetching transactions" });
      }

      const json = await resp.json();
      const data = json.result?.data || [];
      allTxs.push(...data);

      cursor = json.result?.nextPageCursor || "";
      // Stop at max 10 pages
    } while (cursor && allTxs.length < 500);

    // 3) Compare with dApp contracts
    const explored = [];
    const txToSet = new Set(allTxs.map(tx => (tx.to || "").toLowerCase()));

    for (const d of dapps) {
      const contracts = (d.contracts || []).map(c => c.toLowerCase());
      if (contracts.some(c => txToSet.has(c))) {
        explored.push(d.name);
      }
    }

    return res.status(200).json({ explored });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error checking wallet" });
  }
}