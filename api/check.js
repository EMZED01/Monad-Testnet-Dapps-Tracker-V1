import fetch from 'node-fetch';

export default async function handler(req, res) {
  const wallet = req.query.wallet?.trim();
  if (!wallet) return res.status(400).json({ error: 'Wallet address required' });

  const API_KEY = process.env.BLOCKVISION_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'API key not set' });

  try {
    // Fetch all transactions for the wallet
    const txRes = await fetch(`https://testnet.blockvision.com/api/v1/transactions?address=${wallet}`, {
      headers: { 'x-api-key': API_KEY }
    });
    const txData = await txRes.json();
    const walletTxs = txData.result || [];

    // Fetch dApps list
    const dappsRes = await fetch('https://raw.githubusercontent.com/nodeinfra/monad-dapp-list/main/dapps.json');
    const dappsData = await dappsRes.json();

    // Determine which dApps are explored
    const exploredDapps = [];
    Object.values(dappsData).forEach(dapp => {
      const contracts = dapp.contracts.map(c => c.toLowerCase());
      const interacted = walletTxs.some(tx => contracts.includes(tx.to.toLowerCase()));
      if (interacted) exploredDapps.push(...contracts); // keep contracts for frontend check
    });

    res.status(200).json({ dapps: exploredDapps });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching wallet data' });
  }
}