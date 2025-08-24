export default async function handler(req, res) {
  const wallet = req.query.wallet;
  if (!wallet) return res.status(400).json({ error: 'Wallet required' });
  const API_KEY = process.env.BLOCKVISION_API_KEY;
  try {
    const response = await fetch(`https://monad.blockvision.org/v1/${API_KEY}/account/transactions?address=${wallet}`);
    const data = await response.json();
    const usedContracts = new Set(data.result.map(tx => tx.to?.toLowerCase()).filter(Boolean));
    // Fetch dapps list from GitHub
    const dappsData = await fetch('https://raw.githubusercontent.com/nodeinfra/monad-dapp-list/main/dapps.json').then(r => r.json());
    const explored = [];
    Object.values(dappsData).forEach(dapp => {
      if (dapp.contracts.some(c => usedContracts.has(c.toLowerCase()))) explored.push(...dapp.contracts);
    });
    res.status(200).json({ wallet, dapps: explored });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch wallet activity' });
  }
}
