// api/check.js

export default async function handler(req, res) {
  try {
    const { wallet } = req.query;
    if (!wallet) {
      return res.status(400).json({ error: "Missing wallet address" });
    }

    const API_KEY = process.env.BLOCKVISION_API_KEY;
    const REGISTRY_URL = process.env.REGISTRY_URL;

    if (!API_KEY || !REGISTRY_URL) {
      return res.status(500).json({ error: "Missing API key or Registry URL" });
    }

    const walletAddress = wallet.toLowerCase();

    // 1. Fetch dApps + contracts
    const registryResponse = await fetch(REGISTRY_URL);
    if (!registryResponse.ok) throw new Error("Failed to fetch registry");
    const dapps = await registryResponse.json();

    // 2. Fetch ALL wallet txs with pagination
    let page = 1;
    let txList = [];
    let hasMore = true;

    while (hasMore && page <= 10) { // fetch up to 10 pages (10k txs max)
      const txResponse = await fetch("https://api.blockvision.org/v1/evm/monad-testnet/txs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          address: walletAddress,
          page,
          limit: 1000
        })
      });

      if (!txResponse.ok) {
        console.error("❌ BlockVision error:", await txResponse.text());
        return res.status(500).json({ error: "Failed to fetch wallet transactions" });
      }

      const txData = await txResponse.json();
      const current = (txData.result || []).map(tx =>
        (tx.to || tx.to_address || tx.contractAddress || "").toLowerCase()
      ).filter(Boolean);

      txList = [...txList, ...current];
      hasMore = (txData.result || []).length === 1000;
      page++;
    }

    // 3. Compare contracts against txList
    const explored = [];
    for (const dapp of dapps) {
      const contracts = (dapp.contracts || []).map(c => c.toLowerCase());
      const interacted = contracts.some(c => txList.includes(c));
      if (interacted) explored.push(dapp.name);
    }

    return res.status(200).json({ explored });
  } catch (err) {
    console.error("❌ Error in check.js:", err);
    return res.status(500).json({ error: "Error checking wallet" });
  }
}