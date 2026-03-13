/**
 * Dump ALL inputs (including system/properties) for a strategy.
 */
const TradingView = require('../tradingview-api-reference/main');
const fs = require('fs');
const path = require('path');

const SCRIPT = process.argv[2] || 'USER;3f778e242a9b42d7992cd31da1320432';
const cookiesPath = path.join(__dirname, '..', 'www.tradingview.com_cookies.json');
const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
const session = cookies.find(c => c.name === 'sessionid').value;
const sig = (cookies.find(c => c.name === 'sessionid_sign') || {}).value || '';

(async () => {
  const ind = await TradingView.getIndicator(SCRIPT, 'last', session, sig);
  for (const [id, inp] of Object.entries(ind.inputs)) {
    if (['text', 'pineId', 'pineVersion'].includes(id)) continue;
    console.log(JSON.stringify({
      id,
      name: (inp.name || '').trim(),
      type: inp.type,
      defval: inp.value,
      isFake: inp.isFake === true,
      isHidden: inp.isHidden === true,
      hasOptions: Array.isArray(inp.options),
      options: inp.options || undefined,
    }));
  }
  process.exit(0);
})();
