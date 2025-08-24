const dappGrid = document.getElementById('dappGrid');
const result = document.getElementById('result');

async function loadDapps() {
  const url = 'https://raw.githubusercontent.com/nodeinfra/monad-dapp-list/main/dapps.json';
  const dappsData = await fetch(url).then(r => r.json());
  window.allDapps = dappsData;
  renderDapps(dappsData);
}

function renderDapps(dapps) {
  dappGrid.innerHTML = '';
  Object.values(dapps).forEach(dapp => {
    const card = document.createElement('div');
    card.className = 'dapp-card';
    card.innerHTML = `
      <img src="${dapp.logo}" alt="${dapp.name}" width="80">
      <div>${dapp.name}</div>
      <a href="${dapp.website}" target="_blank">Visit</a>
    `;
    card.dataset.contracts = dapp.contracts.join(',');
    dappGrid.appendChild(card);
  });
}

async function checkWallet() {
  const wallet = document.getElementById('walletInput').value.trim();
  result.classList.remove('explored', 'show');
  result.textContent = 'Checking...';

  try {
    const res = await fetch(`/api/check.js?wallet=${wallet}`);
    const data = await res.json();
    const exploredContracts = data.dapps || [];

    document.querySelectorAll('.dapp-card').forEach(card => {
      const contracts = card.dataset.contracts.split(',');
      card.classList.toggle('explored', contracts.some(c => exploredContracts.includes(c)));
    });

    result.textContent = `Wallet ${wallet} has explored ${exploredContracts.length} dApps.`;
    if (exploredContracts.length > 0) result.classList.add('explored');

    // Trigger fade-in animation
    void result.offsetWidth; 
    result.classList.add('show');
  } catch(e) {
    result.textContent = 'Error checking wallet.';
    console.error(e);
    void result.offsetWidth;
    result.classList.add('show');
  }
}

// Initialize
loadDapps();