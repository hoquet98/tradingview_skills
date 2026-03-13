/**
 * Test: Deep backtest with a second user's cookies (passed directly, not from env/file).
 * Simulates how Replit's tv-client.js would handle per-user connections.
 */
const TradingView = require('../tradingview-api-reference/main');
const { applyParams } = require('../lib/params');

const SCRIPT = 'USER;34ff38db513545229104a7d6b4ceecc5';  // VECTOR Pattern Strategy
const SYMBOL = 'COMEX:GC1!';

// User 2 cookies (passed directly like the API would)
const SESSION = 'fz0yr0ific7wlzn67mxyfd9w8drwqtfq';
const SIGNATURE = 'v3:0jUqzLW/FX0HgyaDPE/CWa4vaVK3b3YEuBwabrduiQY=';

const now = new Date();
const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
const FROM = Math.floor(thirtyDaysAgo.getTime() / 1000);
const TO = Math.floor(now.getTime() / 1000);

function runOneOnClient(historyClient, indicator, label) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; reject(new Error(`${label} timed out`)); }
    }, 30000);

    const history = new historyClient.Session.History();

    history.onError((...err) => {
      if (!resolved) { resolved = true; clearTimeout(timeout); history.delete(); reject(new Error(`${label}: ${err.join(' ')}`)); }
    });

    history.onHistoryLoaded(() => {
      if (resolved) return;
      const report = history.strategyReport;
      if (report && report.performance && report.performance.all) {
        resolved = true;
        clearTimeout(timeout);
        history.delete();
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        const p = report.performance.all;
        const wins = p.numberOfWinningTrades || 0;
        const losses = p.numberOfLosingTrades || 0;
        const dd = report.performance.maxStrategyDrawDown || 0;
        console.log(`[${elapsed}s] ${label}: ${wins}W/${losses}L (${p.totalTrades}) | P&L: ${p.netProfit} | WR: ${((p.percentProfitable || 0) * 100).toFixed(1)}% | PF: ${(p.profitFactor || 0).toFixed(3)} | DD: ${dd}`);
        resolve(report);
      }
    });

    history.requestHistoryData(SYMBOL, indicator, {
      timeframe: '1',
      from: FROM,
      to: TO,
    });
  });
}

(async () => {
  // 1. Detect plan
  const user = await TradingView.getUser(SESSION, SIGNATURE);
  let plan = '';
  if (user.authToken) {
    const payload = JSON.parse(
      Buffer.from(user.authToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    );
    plan = payload.plan || '';
  }
  console.log(`User plan: ${plan || 'free'}`);

  if (plan !== 'pro_premium') {
    console.log('Deep backtest requires Premium. Exiting.');
    process.exit(1);
  }

  // 2. Fetch indicator once
  const base = await TradingView.getIndicator(SCRIPT, 'last', SESSION, SIGNATURE);
  const PineIndicator = require('../tradingview-api-reference/src/classes/PineIndicator');

  // Defaults that differ from the saved script values
  const DEFAULTS = {
    'EOD Hour': 15,
    'Timezone': 'America/New_York',
    'BE Enable': true,
    'BE Offset': 15,
    'BE Trigger': 75,
    'EOD Minute': 50,
    'Stop Ticks': 150,
    'Allow Longs': true,
    'Cont Enable': true,
    'Allow Shorts': true,
    'Cross Enable': true,
    'DSI Lookback': 10,
    'Lockout Bars': 10,
    'MAP Lookback': 10,
    'Pattern Mode': 'Expansion',
    'Target Ticks': 150,
    'Trail Enable': true,
    'Trail Offset': 10,
    'Bounce Enable': true,
    'Cont Priority': 80,
    'DSI Threshold': 0.65,
    'MAP Threshold': 1.4,
    'Response Mode': 'Block Longs Only',
    'Trading Hours': '0930-1600',
    'Trail Trigger': 110,
    'VAR Threshold': 1.4,
    'Cross Priority': 55,
    'Exclude Enable': true,
    'Session Enable': false,
    'Activation Mode': 'VAR Only',
    'Bounce Priority': 40,
    'Exclude Hours 1': '1445-1800',
    'Exclude Hours 2': '0600-0630',
    'Cont Window Bars': 16,
    'Cross Bar Filter': false,
    'EOD Close Enable': true,
    'Exclude 2 Enable': true,
    'Bounce Bar Filter': false,
    'Cont Slope Filter': true,
    'Cross Body Filter': true,
    'Cross Close Filter': true,
    'Cross Slope Filter': true,
    'Floor Lock (Ticks)': 15,
    'Profit Lock Enable': true,
    'Bounce Close Filter': true,
    'Bounce Slope Filter': true,
    'Cross Min Bar Ticks': 4,
    'Profit Floor Enable': true,
    'Bounce Min Bar Ticks': 5,
    'Cont Min Slope Ticks': 17,
    'Cross Close Strength': 0.5,
    'Cross Min Body Ratio': 0.05,
    'Adverse Regime Enable': false,
    'Bounce Close Strength': 0.9,
    'Cross Max Penetration': 46,
    'Cross Min Penetration': 1,
    'Cross Min Slope Ticks': 19,
    'Daily Loss Cap Enable': true,
    'Floor Trigger (Ticks)': 65,
    'Squeeze Filter Enable': true,
    'Bounce Min Slope Ticks': 26,
    'Daily Loss Cap (Ticks)': 160,
    'Bounce Touch Zone Ticks': 2,
    'Cont Max Distance Ticks': 17,
    'Cont Min Distance Ticks': 1,
    'Min Profit Lock (Ticks)': 15,
    'Bounce Min Reversal Ticks': 2,
    'MFE Lock Threshold (Ticks)': 65,
  };

  function clone(overrides) {
    const ind = new PineIndicator({
      pineId: base.pineId,
      pineVersion: base.pineVersion,
      description: base.description,
      shortDescription: base.shortDescription,
      inputs: JSON.parse(JSON.stringify(base.inputs)),
      plots: base.plots,
      script: base.script,
    });
    ind.setType('StrategyScript@tv-scripting-101!');
    applyParams(ind, { ...DEFAULTS, ...overrides });
    return ind;
  }

  // 3. Create one historyClient with user's cookies
  const historyClient = new TradingView.Client({ token: SESSION, signature: SIGNATURE, server: 'history-data' });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Login timed out')), 10000);
    historyClient.onLogged(() => { clearTimeout(timeout); resolve(); });
    historyClient.onError((...err) => { clearTimeout(timeout); reject(new Error(err.join(' '))); });
  });

  console.log(`Logged in. Running 6 deep backtests sequentially on one connection...\n`);
  const totalStart = Date.now();

  const combos = [100, 125, 150, 175, 200, 225];  // Stop Ticks sweep

  try {
    for (const stopTicks of combos) {
      const ind = clone({ 'Stop Ticks': stopTicks });
      await runOneOnClient(historyClient, ind, `Stop=${stopTicks}`);
    }
    console.log(`\nTotal: ${((Date.now() - totalStart) / 1000).toFixed(1)}s`);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    historyClient.end();
    process.exit(0);
  }
})();
