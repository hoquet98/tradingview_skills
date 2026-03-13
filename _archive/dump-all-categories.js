/**
 * Show ALL inputs categorized: user inputs, hidden, properties, system.
 */
const TradingView = require('../tradingview-api-reference/main');
const fs = require('fs');
const path = require('path');

const scripts = [
  { name: 'EMA/RSI Scalper', id: 'USER;3f778e242a9b42d7992cd31da1320432', cookieFile: 'www.tradingview.com_cookies.json' },
  { name: 'VECTOR Pattern', id: 'USER;34ff38db513545229104a7d6b4ceecc5', cookieFile: 'www.tradingview.com_cookies_QTP.json' },
];

(async () => {
  for (const s of scripts) {
    const cookiesPath = path.join(__dirname, '..', s.cookieFile);
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
    const session = cookies.find(c => c.name === 'sessionid').value;
    const sig = (cookies.find(c => c.name === 'sessionid_sign') || {}).value || '';

    console.log(`\n=== ${s.name} ===`);
    const ind = await TradingView.getIndicator(s.id, 'last', session, sig);

    let totalCount = 0;
    let hiddenCount = 0;
    let systemIds = ['text', 'pineId', 'pineVersion', '__profile', 'pineFeatures'];

    for (const [id, inp] of Object.entries(ind.inputs)) {
      totalCount++;
      const name = (inp.name || '').trim();
      const hidden = inp.isHidden === true;
      const fake = inp.isFake === true;

      let category;
      if (systemIds.includes(id)) {
        category = 'SYSTEM-INTERNAL';
      } else if (hidden) {
        category = 'HIDDEN';
        hiddenCount++;
      } else {
        category = 'VISIBLE';
      }

      console.log(`${id.padEnd(12)} | ${name.padEnd(55)} | hidden=${String(hidden).padEnd(5)} | isFake=${String(fake).padEnd(5)} | ${category}`);
    }
    console.log(`\nTotal: ${totalCount}, Hidden: ${hiddenCount}`);
  }
  process.exit(0);
})();
