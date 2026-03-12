/**
 * Show all inputs for a strategy, marking the cutoff at "Initial Capital".
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

    let foundCutoff = false;
    for (const [id, inp] of Object.entries(ind.inputs)) {
      if (['text', 'pineId', 'pineVersion', '__profile'].includes(id)) continue;
      if (id === 'pineFeatures') continue;

      const name = (inp.name || '').trim();
      if (name === 'Initial Capital') foundCutoff = true;

      const label = foundCutoff ? '  [PROPERTIES]' : '  [USER INPUT]';
      console.log(`${id.padEnd(8)} | ${name.padEnd(50)} |${label}`);
    }
  }
  process.exit(0);
})();
