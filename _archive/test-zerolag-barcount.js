/**
 * Test different bar counts to find the one that matches 150 trades on GC1! 1-min.
 */
const { fetchStrategyReport, getClient, close } = require('../lib/ws-client');

const SCRIPT = 'USER;f3f18d701c0a4c62b4296ec92e8acff4';
const SYMBOL = 'COMEX:GC1!';

const params = {
  'ZLEMA Length': 12, 'ZLEMA Source': 'close', 'Pattern Mode': 'Expansion',
  'Session Enable': false, 'Timezone': 'America/New_York', 'Trading Hours': '0930-1600',
  'Exclude Enable': true, 'Exclude Hours 1': '1545-1800', 'Exclude 2 Enable': false,
  'Exclude Hours 2': '0500-0700', 'EOD Close Enable': true, 'EOD Hour': 15, 'EOD Minute': 50,
  'Stop Ticks': 250, 'Target Ticks': 150, 'Trail Enable': true, 'Trail Trigger': 95,
  'Trail Offset': 1, 'BE Enable': true, 'BE Trigger': 45, 'BE Offset': 3,
  'Profit Lock Enable': true, 'MFE Lock Threshold (Ticks)': 40, 'Min Profit Lock (Ticks)': 20,
  'Profit Floor Enable': true, 'Floor Trigger (Ticks)': 40, 'Floor Lock (Ticks)': 10,
  'Adverse Regime Enable': false, 'Activation Mode': 'Any Two', 'Response Mode': 'Block All',
  'VAR Threshold': 1.4, 'DSI Threshold': 0.65, 'DSI Lookback': 10, 'MAP Threshold': 1.4,
  'MAP Lookback': 10, 'Lockout Bars': 10, 'Allow Longs': true, 'Allow Shorts': true,
  'Squeeze Filter Enable': false, 'Daily Loss Cap Enable': true, 'Daily Loss Cap (Ticks)': 140,
  'Cross Enable': true, 'Cross Priority': 50, 'Cross Min Penetration': 10,
  'Cross Max Penetration': 37.5, 'Cross Bar Filter': true, 'Cross Min Bar Ticks': 4,
  'Cross Body Filter': false, 'Cross Min Body Ratio': 0.3, 'Cross Close Filter': false,
  'Cross Close Strength': 0.6, 'Cross Slope Filter': true, 'Cross Min Slope Ticks': 24,
  'Bounce Enable': true, 'Bounce Priority': 65, 'Bounce Touch Zone Ticks': 2.5,
  'Bounce Min Reversal Ticks': 15, 'Bounce Bar Filter': false, 'Bounce Min Bar Ticks': 5,
  'Bounce Close Filter': false, 'Bounce Close Strength': 0.6, 'Bounce Slope Filter': true,
  'Bounce Min Slope Ticks': 20, 'Cont Enable': true, 'Cont Priority': 80,
  'Cont Window Bars': 19, 'Cont Min Distance Ticks': 0.5, 'Cont Max Distance Ticks': 40,
  'Cont Slope Filter': true, 'Cont Min Slope Ticks': 23,
};

const barCounts = [20000, 18000, 16000, 15000];

(async () => {
  try {
    await getClient();
    for (const bars of barCounts) {
      const report = await fetchStrategyReport(SCRIPT, SYMBOL, {
        timeframe: '1', range: bars, params,
      });
      const p = report.performance.all || {};
      console.log(`${bars} bars: ${p.totalTrades} trades, PnL=${p.netProfit}, DD=${report.performance.maxStrategyDrawDown}, PF=${(p.profitFactor||0).toFixed(3)}`);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await close();
    process.exit(0);
  }
})();
