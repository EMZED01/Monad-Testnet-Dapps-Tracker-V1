import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const wallet = req.query.wallet?.trim();
    if (!wallet) return res.status(400).json({ error: 'Wallet address required' });

    const API_KEY = process.env.BLOCKVISION_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: 'API key not set' });

    console.log('Checking wallet:', wallet);
    console.log('API key present:', !!API_KEY);

    // Fetch all transactions of the wallet
    const txRes = await fetch(
      `https://testnet.blockvision.com/api/v1/transactions?address=${wallet}`,
      { headers: { 'x-api-key': API_KEY } }
    );

    if (!txRes.ok) {
      console.error('BlockVision API returned error', txRes.status);
      return res.status(500).json({ error: 'Failed to fetch transactions from BlockVision' });
    }

    const txData = await txRes.json();
    const walletTxs = txData.result || [];
    console.log('Transactions fetched:', walletTxs.length);

    // Fetch all dApps from the registry
    const dappsRes = await fetch('https://raw.githubusercontent.com/nodeinfra/monad-dapp-list/main/dapps.json');
    const dappsData = await dappsRes.json();

    // Determine which dApps are explored (case-insensitive)
    const exploredDapps = [];
    Object.values(dappsData).forEach(dapp => {
      const contracts = dapp.contracts.map(c => c.toLowerCase());       // lowercase for matching
      const interacted = walletTxs.some(tx => contracts.includes(tx.to.toLowerCase())); // lowercase tx.to
      if (interacted) exploredDapps.push(...contracts);
    });

    console.log('Explored contracts:', exploredDapps);

    res.status(200).json({ dapps: exploredDapps });
  } catch (err) {
    console.error('Error in check.js:', err);
    res.status(500).json({ error: 'Error fetching wallet data' });
  }
}