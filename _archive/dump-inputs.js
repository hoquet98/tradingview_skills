/**
 * Dump all visible inputs for VECTOR Pattern Strategy to build defaultParams array.
 */
const TradingView = require('../tradingview-api-reference/main');

const SCRIPT = 'USER;34ff38db513545229104a7d6b4ceecc5';
const SESSION = 'fz0yr0ific7wlzn67mxyfd9w8drwqtfq';
const SIGNATURE = 'v3:0jUqzLW/FX0HgyaDPE/CWa4vaVK3b3YEuBwabrduiQY=';

(async () => {
  const ind = await TradingView.getIndicator(SCRIPT, 'last', SESSION, SIGNATURE);
  for (const [id, inp] of Object.entries(ind.inputs)) {
    if (inp.isHidden) continue;
    const num = id.replace('in_', '');
    console.log(JSON.stringify({
      name: (inp.name || '').trim(),
      type: inp.type,
      currentValue: inp.value,
      index: num,
      id,
    }));
  }
})();
