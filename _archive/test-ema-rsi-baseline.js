/**
 * Baseline test: EMA/RSI Scalper on COMEX:GC1!
 * Regular backtest, range from chart (20000 bars), 1-min timeframe.
 */
const TradingView = require('../tradingview-api-reference/main');
const { applyParams } = require('../lib/params');

const SCRIPT = 'USER;55a96183655d4abe90f6e9668847b083';
const SYMBOL = 'CME_MINI:ES1!';
const SESSION = 'fz0yr0ific7wlzn67mxyfd9w8drwqtfq';
const SIGNATURE = 'v3:0jUqzLW/FX0HgyaDPE/CWa4vaVK3b3YEuBwabrduiQY=';

const USER_DEFAULTS = {
  'Fast EMA Length': 13,
  'Medium EMA Length': 21,
  'Slow EMA Length': 40,
  'RSI Length': 33,
  'RSI Upper Level': 25,
  'RSI Lower Level': 52,
  'Use Volume Confirmation': false,
  'Volume SMA Lookback': 25,
  'Volume Threshold Multiplier': 0.9,
  'Stop Ticks': 210,
  'Target Ticks': 99,
  'Trail Enable': true,
  'Trail Trigger': 55,
  'Trail Offset': 55,
  'BE Enable': true,
  'BE Trigger': 58,
  'BE Offset': 6,
  'Exit on EMA Cross (Stack Break)': false,
  'Restrict to Trading Hours': false,
  'Session Start Hour (CT)': 8,
  'Session End Hour (CT)': 15,
  'Block Lunch Hour (CT)': false,
  'Lunch Start Hour': 11,
  'Lunch Start Minute': 30,
  'Lunch End Hour': 13,
  'Lunch End Minute': 0,
  'Exclude Window 1': false,
  'Window 1 Start Hour': 0,
  'Window 1 Start Minute': 0,
  'Window 1 End Hour': 0,
  'Window 1 End Minute': 0,
  'Exclude Window 2': false,
  'Window 2 Start Hour': 0,
  'Window 2 Start Minute': 0,
  'Window 2 End Hour': 0,
  'Window 2 End Minute': 0,
  'Exclude Window 3': false,
  'Window 3 Start Hour': 0,
  'Window 3 Start Minute': 0,
  'Window 3 End Hour': 0,
  'Window 3 End Minute': 0,
  'Sunday': false,
  'Monday': true,
  'Tuesday': true,
  'Wednesday': true,
  'Thursday': true,
  'Friday': true,
  'Use Higher TF Trend Filter': true,
  'Higher Timeframe': '15',
  'Enable CrossTrade Alerts': false,
};

(async () => {
  console.log('=== Baseline: EMA/RSI Scalper, regular backtest, 1-min, GC1! ===\n');

  const ind = await TradingView.getIndicator(SCRIPT, 'last', SESSION, SIGNATURE);
  ind.setType('StrategyScript@tv-scripting-101!');
  applyParams(ind, USER_DEFAULTS);

  const client = new TradingView.Client({ token: SESSION, signature: SIGNATURE, server: 'prodata' });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Login timed out')), 10000);
    client.onLogged(() => { clearTimeout(timeout); resolve(); });
    client.onError((...err) => { clearTimeout(timeout); reject(new Error(err.join(' '))); });
  });
  console.log('Logged in to prodata server.');

  const report = await new Promise((resolve, reject) => {
    const start = Date.now();
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; chart.delete(); reject(new Error('Timeout (60s)')); }
    }, 60000);

    const chart = new client.Session.Chart();

    chart.onError((...err) => {
      if (!resolved) { resolved = true; clearTimeout(timeout); chart.delete(); reject(new Error(`Chart error: ${err.join(' ')}`)); }
    });

    chart.setMarket(SYMBOL, { timeframe: '1', range: 20000 });

    chart.onSymbolLoaded(() => {
      console.log('Symbol loaded, creating study...');
      const study = new chart.Study(ind);

      study.onError((...err) => {
        if (!resolved) { resolved = true; clearTimeout(timeout); chart.delete(); reject(new Error(`Study error: ${err.join(' ')}`)); }
      });

      study.onUpdate(() => {
        if (resolved) return;
        const report = study.strategyReport;
        if (report && report.performance && report.performance.all) {
          resolved = true;
          clearTimeout(timeout);
          chart.delete();
          const elapsed = ((Date.now() - start) / 1000).toFixed(1);
          const p = report.performance.all;
          console.log(`\nDone in ${elapsed}s`);
          console.log(`Trades:        ${p.totalTrades}`);
          console.log(`Net Profit:    ${p.netProfit}`);
          console.log(`Net Profit %:  ${p.netProfitPercent}`);
          console.log(`Win Rate:      ${((p.percentProfitable || 0) * 100).toFixed(2)}%`);
          console.log(`Profit Factor: ${(p.profitFactor || 0).toFixed(3)}`);
          console.log(`Max DD:        ${report.performance.maxStrategyDrawDown}`);
          console.log(`Max DD %:      ${report.performance.maxStrategyDrawDownPercent}`);
          console.log(`Wins: ${p.numberOfWinningTrades}  Losses: ${p.numberOfLosingTrades}`);
          console.log(`Avg Win: ${p.avgWinTrade}  Avg Loss: ${p.avgLossTrade}`);
          resolve(report);
        }
      });
    });
  });

  client.end();
  process.exit(0);
})();
