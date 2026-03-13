/**
 * Compare regular vs deep backtest for VECTOR Pattern Strategy with user defaults
 */
const TradingView = require('../tradingview-api-reference/main');
const { applyParams } = require('../lib/params');

const SCRIPT = 'USER;34ff38db513545229104a7d6b4ceecc5';
const SYMBOL = 'CME_MINI:ES1!';
const SESSION = 'fz0yr0ific7wlzn67mxyfd9w8drwqtfq';
const SIGNATURE = 'v3:0jUqzLW/FX0HgyaDPE/CWa4vaVK3b3YEuBwabrduiQY=';

const now = new Date();
const FROM = Math.floor((now.getTime() - 30 * 86400000) / 1000);
const TO = Math.floor(now.getTime() / 1000);

const DEFAULTS = {
  'EOD Hour': 15, 'Timezone': 'America/New_York', 'BE Enable': true, 'BE Offset': 15,
  'BE Trigger': 75, 'EOD Minute': 50, 'Stop Ticks': 150, 'Allow Longs': true,
  'Cont Enable': true, 'Allow Shorts': true, 'Cross Enable': true, 'DSI Lookback': 10,
  'Lockout Bars': 10, 'MAP Lookback': 10, 'Pattern Mode': 'Expansion', 'Target Ticks': 150,
  'Trail Enable': true, 'Trail Offset': 10, 'Bounce Enable': true, 'Cont Priority': 80,
  'DSI Threshold': 0.65, 'MAP Threshold': 1.4, 'Response Mode': 'Block Longs Only',
  'Trading Hours': '0930-1600', 'Trail Trigger': 110, 'VAR Threshold': 1.4,
  'Cross Priority': 55, 'Exclude Enable': true, 'Session Enable': false,
  'Activation Mode': 'VAR Only', 'Bounce Priority': 40, 'Exclude Hours 1': '1445-1800',
  'Exclude Hours 2': '0600-0630', 'Cont Window Bars': 16, 'Cross Bar Filter': false,
  'EOD Close Enable': true, 'Exclude 2 Enable': true, 'Bounce Bar Filter': false,
  'Cont Slope Filter': true, 'Cross Body Filter': true, 'Cross Close Filter': true,
  'Cross Slope Filter': true, 'Floor Lock (Ticks)': 15, 'Profit Lock Enable': true,
  'Bounce Close Filter': true, 'Bounce Slope Filter': true, 'Cross Min Bar Ticks': 4,
  'Profit Floor Enable': true, 'Bounce Min Bar Ticks': 5, 'Cont Min Slope Ticks': 17,
  'Cross Close Strength': 0.5, 'Cross Min Body Ratio': 0.05, 'Adverse Regime Enable': false,
  'Bounce Close Strength': 0.9, 'Cross Max Penetration': 46, 'Cross Min Penetration': 1,
  'Cross Min Slope Ticks': 19, 'Daily Loss Cap Enable': true, 'Floor Trigger (Ticks)': 65,
  'Squeeze Filter Enable': true, 'Bounce Min Slope Ticks': 26, 'Daily Loss Cap (Ticks)': 160,
  'Bounce Touch Zone Ticks': 2, 'Cont Max Distance Ticks': 17, 'Cont Min Distance Ticks': 1,
  'Min Profit Lock (Ticks)': 15, 'Bounce Min Reversal Ticks': 2, 'MFE Lock Threshold (Ticks)': 65,
};

function printReport(label, report) {
  const p = report.performance.all;
  const wins = p.numberOfWinningTrades || 0;
  const losses = p.numberOfLosingTrades || 0;
  const dd = report.performance.maxStrategyDrawDown || 0;
  console.log(`${label}: ${wins}W/${losses}L (${p.totalTrades}) | P&L: ${p.netProfit} | WR: ${((p.percentProfitable || 0) * 100).toFixed(1)}% | PF: ${(p.profitFactor || 0).toFixed(3)} | DD: ${dd}`);
}

(async () => {
  // --- Test 1: Regular (setMarket, 20000 bars) ---
  console.log('=== Regular backtest (setMarket, range=20000) ===');
  const ind1 = await TradingView.getIndicator(SCRIPT, 'last', SESSION, SIGNATURE);
  ind1.setType('StrategyScript@tv-scripting-101!');
  applyParams(ind1, DEFAULTS);

  const client = new TradingView.Client({ token: SESSION, signature: SIGNATURE, server: 'prodata' });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Login timed out')), 10000);
    client.onLogged(() => { clearTimeout(timeout); resolve(); });
    client.onError((...err) => { clearTimeout(timeout); reject(new Error(err.join(' '))); });
  });

  const regularReport = await new Promise((resolve, reject) => {
    const chart = new client.Session.Chart();
    const start = Date.now();
    let resolved = false;
    const timeout = setTimeout(() => { if (!resolved) { resolved = true; chart.delete(); reject(new Error('Timeout')); } }, 30000);

    chart.onError((...err) => { if (!resolved) { resolved = true; clearTimeout(timeout); chart.delete(); reject(new Error(err.join(' '))); } });
    chart.setMarket(SYMBOL, { timeframe: '1', range: 20000 });
    chart.onSymbolLoaded(() => {
      const study = new chart.Study(ind1);
      study.onError((...err) => { if (!resolved) { resolved = true; clearTimeout(timeout); chart.delete(); reject(new Error(err.join(' '))); } });
      study.onUpdate(() => {
        if (resolved) return;
        const report = study.strategyReport;
        if (report && report.performance && report.performance.all) {
          resolved = true;
          clearTimeout(timeout);
          console.log(`  (took ${((Date.now() - start) / 1000).toFixed(1)}s)`);
          chart.delete();
          resolve(report);
        }
      });
    });
  });
  printReport('Regular', regularReport);
  client.end();

  // --- Test 2: Deep (requestHistoryData, from/to) ---
  console.log('\n=== Deep backtest (requestHistoryData, 30 days) ===');
  const ind2 = await TradingView.getIndicator(SCRIPT, 'last', SESSION, SIGNATURE);
  ind2.setType('StrategyScript@tv-scripting-101!');
  applyParams(ind2, DEFAULTS);

  const historyClient = new TradingView.Client({ token: SESSION, signature: SIGNATURE, server: 'history-data' });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Login timed out')), 10000);
    historyClient.onLogged(() => { clearTimeout(timeout); resolve(); });
    historyClient.onError((...err) => { clearTimeout(timeout); reject(new Error(err.join(' '))); });
  });

  const deepReport = await new Promise((resolve, reject) => {
    const start = Date.now();
    let resolved = false;
    const timeout = setTimeout(() => { if (!resolved) { resolved = true; reject(new Error('Timeout')); } }, 30000);
    const history = new historyClient.Session.History();
    history.onError((...err) => { if (!resolved) { resolved = true; clearTimeout(timeout); history.delete(); reject(new Error(err.join(' '))); } });
    history.onHistoryLoaded(() => {
      if (resolved) return;
      const report = history.strategyReport;
      if (report && report.performance && report.performance.all) {
        resolved = true;
        clearTimeout(timeout);
        console.log(`  (took ${((Date.now() - start) / 1000).toFixed(1)}s)`);
        history.delete();
        resolve(report);
      }
    });
    history.requestHistoryData(SYMBOL, ind2, { timeframe: '1', from: FROM, to: TO });
  });
  printReport('Deep', deepReport);
  historyClient.end();

  process.exit(0);
})();
