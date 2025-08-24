// api/check.js

export default async function handler(req, res) {
  try {
    const { wallet } = req.query;
    if (!wallet) {
      return res.status(400).json({ error: "Missing wallet address" });
    }

    const API_KEY = process.env.BLOCKVISION_API_KEY;
    const REGISTRY_URL = process.env.REGISTRY_URL;

    if (!API_KEY) {
      console.error("❌ Missing BlockVision API key!");
      return res.status(500).json({ error: "Server misconfigured: No API key" });
    }

    if (!REGISTRY_URL) {
      console.error("❌ Missing Registry URL!");
      return res.status(500).json({ error: "Server misconfigured: No Registry URL" });
    }

    console.log("✅ BlockVision API key and Registry URL loaded");

    // Fetch dApps list from registry
    const registryResponse = await fetch(REGISTRY_URL);
    if (!registryResponse.ok) {
      throw new Error(`Failed to fetch registry: ${registryResponse.statusText}`);
    }
    const dapps = await registryResponse.json();

    const explored = [];

    for (const dapp of dapps) {
      if (!dapp.contracts || dapp.contracts.length === 0) continue;

      let found = false;
      const walletAddress = wallet.toLowerCase();

      for (const contract of dapp.contracts) {
        const contractAddress = contract.toLowerCase();

        const url = "https://api.blockvision.org/v1/evm/monad-testnet/txs";

        const body = {
          address: walletAddress,
          contract: contractAddress,
          page: 1,
          limit: 1
        };

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${API_KEY}`
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          console.error(`❌ BlockVision error for ${dapp.name}`, await response.text());
          continue;
        }

        const data = await response.json();

        if (data && data.result && data.result.length > 0) {
          found = true;
          break; // At least one contract interacted, mark explored
        }
      }

      if (found) explored.push(dapp.name);
    }

    return res.status(200).json({ explored });
  } catch (err) {
    console.error("❌ Error in check.js:", err);
    return res.status(500).json({ error: "Error checking wallet" });
  }
}