// api/check.js (debug version)

export default async function handler(req, res) {
  try {
    const { wallet } = req.query;
    if (!wallet) {
      return res.status(400).json({ error: "Missing wallet address" });
    }

    const API_KEY = process.env.BLOCKVISION_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: "Missing BlockVision API key" });
    }

    const walletAddress = wallet.toLowerCase();

    // Fetch just 5 transactions for debugging
    const txResponse = await fetch("https://api.blockvision.org/v1/evm/monad-testnet/txs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        address: walletAddress,
        page: 1,
        limit: 5
      })
    });

    if (!txResponse.ok) {
      console.error("❌ BlockVision error:", await txResponse.text());
      return res.status(500).json({ error: "Failed to fetch wallet transactions" });
    }

    const txData = await txResponse.json();

    // Return only the first 5 tx objects so we can inspect the fields
    return res.status(200).json({
      debug: txData.result ? txData.result.slice(0, 5) : []
    });

  } catch (err) {
    console.error("❌ Error in check.js:", err);
    return res.status(500).json({ error: "Error checking wallet" });
  }
}