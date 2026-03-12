/**
 * Test: Reuse one historyClient, run History sessions sequentially.
 * Also test: can we run parallel with multiple historyClients?
 */
const TradingView = require('../tradingview-api-reference/main');
const { getCredentials } = require('../lib/ws-client');
const { applyParams } = require('../lib/params');

const SCRIPT = 'USER;3f778e242a9b42d7992cd31da1320432';
const SYMBOL = 'CME_MINI:ES1!';

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
        console.log(`[${elapsed}s] ${label}: Trades: ${p.totalTrades} | P&L: ${p.netProfit} | PF: ${(p.profitFactor || 0).toFixed(3)}`);
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
  const { session, signature } = getCredentials();

  const base = await TradingView.getIndicator(SCRIPT, 'last', session, signature);
  const PineIndicator = require('../tradingview-api-reference/src/classes/PineIndicator');

  function clone(params) {
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
    applyParams(ind, params);
    return ind;
  }

  const combos = [5, 6, 7, 8, 9, 10];

  // --- Test 1: One client, sequential sessions ---
  console.log('=== Test 1: One historyClient, sequential sessions ===\n');
  const historyClient = new TradingView.Client({ token: session, signature, server: 'history-data' });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Login timed out')), 10000);
    historyClient.onLogged(() => { clearTimeout(timeout); resolve(); });
    historyClient.onError((...err) => { clearTimeout(timeout); reject(new Error(err.join(' '))); });
  });

  console.log('Logged in. Running 6 combos sequentially on one connection...\n');
  const start1 = Date.now();

  try {
    for (const fast of combos) {
      const ind = clone({ 'Fast EMA Length': fast });
      await runOneOnClient(historyClient, ind, `Fast EMA=${fast}`);
    }
    console.log(`\nTest 1 total: ${((Date.now() - start1) / 1000).toFixed(1)}s`);
  } catch (e) {
    console.error('Test 1 error:', e.message);
  }

  historyClient.end();

  // --- Test 2: Multiple clients, parallel sessions ---
  console.log('\n=== Test 2: 6 historyClients in parallel ===\n');
  const start2 = Date.now();

  try {
    const promises = combos.map(async (fast) => {
      const client = new TradingView.Client({ token: session, signature, server: 'history-data' });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Login timed out')), 10000);
        client.onLogged(() => { clearTimeout(timeout); resolve(); });
        client.onError((...err) => { clearTimeout(timeout); reject(new Error(err.join(' '))); });
      });

      const ind = clone({ 'Fast EMA Length': fast });
      const result = await runOneOnClient(client, ind, `Fast EMA=${fast}`);
      client.end();
      return result;
    });

    await Promise.all(promises);
    console.log(`\nTest 2 total: ${((Date.now() - start2) / 1000).toFixed(1)}s`);
  } catch (e) {
    console.error('Test 2 error:', e.message);
  }

  process.exit(0);
})();
