const TradingView = require('../tradingview-api-reference/main');
const SESSION = 'fz0yr0ific7wlzn67mxyfd9w8drwqtfq';
const SIGNATURE = 'v3:0jUqzLW/FX0HgyaDPE/CWa4vaVK3b3YEuBwabrduiQY=';

(async () => {
  const ind = await TradingView.getIndicator('USER;55a96183655d4abe90f6e9668847b083', 'last', SESSION, SIGNATURE);
  const all = Object.entries(ind.inputs);
  console.log('Total raw inputs:', all.length);

  for (const [id, inp] of all) {
    if (id === 'pineFeatures' || id === '__profile') continue;
    const idx = id.replace('in_', '');
    const flags = [inp.isHidden ? 'H' : '', inp.isFake ? 'F' : ''].filter(Boolean).join(',') || '-';
    console.log(
      idx.padStart(3) + ' | ' + id.padEnd(8) + ' | ' +
      (inp.name || '').trimEnd().padEnd(35) + ' | ' +
      inp.type.padEnd(10) + ' | ' +
      flags.padEnd(4) + ' | ' +
      JSON.stringify(inp.value)
    );
  }
})();
