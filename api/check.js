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
      return res.status(500).json({ error: "Server misconfigured: Missing API key or Registry URL" });
    }

    const walletAddress = wallet.toLowerCase();

    // 1. Fetch all dApps and their contracts from registry
    const registryResponse = await fetch(REGISTRY_URL);
    if (!registryResponse.ok) throw new Error("Failed to fetch registry");
    const dapps = await registryResponse.json();

    // 2. Fetch wallet transaction history (all txs)
    const txUrl = "https://api.blockvision.org/v1/evm/monad-testnet/txs";
    const txBody = {
      address: walletAddress,
      page: 1,
      limit: 1000 // fetch up to 1000 txs in one request
    };

    const txResponse = await fetch(txUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify(txBody)
    });

    if (!txResponse.ok) {
      console.error("❌ BlockVision error:", await txResponse.text());
      return res.status(500).json({ error: "Failed to fetch wallet transactions" });
    }

    const txData = await txResponse.json();
    const txList = (txData.result || []).map(tx => tx.to?.toLowerCase()).filter(Boolean);

    // 3. Compare wallet txs against contracts
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