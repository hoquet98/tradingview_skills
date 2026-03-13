/**
 * Baseline test: VECTOR Pattern Strategy on COMEX:GC1!
 * Regular backtest, range from chart (20000 bars), 1-min timeframe.
 * All 68 user defaults applied.
 */
const TradingView = require('../tradingview-api-reference/main');
const { applyParams } = require('../lib/params');

const SCRIPT = 'USER;34ff38db513545229104a7d6b4ceecc5';
const SYMBOL = 'COMEX:GC1!';
const SESSION = 'fz0yr0ific7wlzn67mxyfd9w8drwqtfq';
const SIGNATURE = 'v3:0jUqzLW/FX0HgyaDPE/CWa4vaVK3b3YEuBwabrduiQY=';

const USER_DEFAULTS = {
  'Pattern Mode': 'Expansion', 'Session Enable': false,
  'Timezone': 'America/New_York', 'Trading Hours': '0930-1600',
  'Exclude Enable': true, 'Exclude Hours 1': '1445-1800',
  'Exclude 2 Enable': true, 'Exclude Hours 2': '0600-0630',
  'EOD Close Enable': true, 'EOD Hour': 15, 'EOD Minute': 50,
  'Stop Ticks': 150, 'Target Ticks': 150,
  'Trail Enable': true, 'Trail Trigger': 110, 'Trail Offset': 10,
  'BE Enable': true, 'BE Trigger': 75, 'BE Offset': 15,
  'Profit Lock Enable': true, 'MFE Lock Threshold (Ticks)': 65, 'Min Profit Lock (Ticks)': 15,
  'Profit Floor Enable': true, 'Floor Trigger (Ticks)': 65, 'Floor Lock (Ticks)': 15,
  'Adverse Regime Enable': false, 'Activation Mode': 'VAR Only', 'Response Mode': 'Block Longs Only',
  'VAR Threshold': 1.4, 'DSI Threshold': 0.65, 'DSI Lookback': 10,
  'MAP Threshold': 1.4, 'MAP Lookback': 10, 'Lockout Bars': 10,
  'Allow Longs': true, 'Allow Shorts': true,
  'Squeeze Filter Enable': true, 'Daily Loss Cap Enable': true, 'Daily Loss Cap (Ticks)': 160,
  'Cross Enable': true, 'Cross Priority': 55, 'Cross Min Penetration': 1, 'Cross Max Penetration': 46,
  'Cross Bar Filter': false, 'Cross Min Bar Ticks': 4,
  'Cross Body Filter': true, 'Cross Min Body Ratio': 0.05,
  'Cross Close Filter': true, 'Cross Close Strength': 0.5,
  'Cross Slope Filter': true, 'Cross Min Slope Ticks': 19,
  'Bounce Enable': true, 'Bounce Priority': 40, 'Bounce Touch Zone Ticks': 2, 'Bounce Min Reversal Ticks': 2,
  'Bounce Bar Filter': false, 'Bounce Min Bar Ticks': 5,
  'Bounce Close Filter': true, 'Bounce Close Strength': 0.9,
  'Bounce Slope Filter': true, 'Bounce Min Slope Ticks': 26,
  'Cont Enable': true, 'Cont Priority': 80, 'Cont Window Bars': 16,
  'Cont Min Distance Ticks': 1, 'Cont Max Distance Ticks': 17,
  'Cont Slope Filter': true, 'Cont Min Slope Ticks': 17,
};

(async () => {
  console.log('=== Baseline: Regular backtest, range from chart, 1-min, GC1! ===\n');

  const ind = await TradingView.getIndicator(SCRIPT, 'last', SESSION, SIGNATURE);
  ind.setType('StrategyScript@tv-scripting-101!');
  applyParams(ind, USER_DEFAULTS);

  // Use prodata server (premium account)
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

    // Range from chart = 20000 bars for premium
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
