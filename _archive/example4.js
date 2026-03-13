/**
 * Example 4: EMA/RSI Scalper on ES 1-min — concurrent sweep with 500ms stagger
 */
const tv = require('../index');
const { getClient, close } = require('../lib/ws-client');

const SCRIPT = 'USER;3f778e242a9b42d7992cd31da1320432';
const SYMBOL = 'CME_MINI:ES1!';
const LENGTHS = [null, 12, 11, 10, 9, 8]; // null = default

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runOne(len) {
  const label = len === null ? 'Default' : `Fast EMA = ${len}`;
  const start = Date.now();

  const opts = { timeframe: '1', range: 'chart' };
  if (len !== null) opts.params = { 'Fast EMA Length': len };

  const r = await tv.backtest(SCRIPT, SYMBOL, opts);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (!r.success) {
    console.log(`[${elapsed}s] ${label}: FAILED — ${r.message} ${r.error || ''}`);
  } else {
    const p = r.report.performance.all || {};
    console.log(`[${elapsed}s] ${label}: Trades: ${p.totalTrades} | P&L: ${p.netProfit} | WR: ${((p.percentProfitable || 0) * 100).toFixed(1)}% | PF: ${(p.profitFactor || 0).toFixed(3)} | DD: ${r.report.performance.maxStrategyDrawDown}`);
  }
}

(async () => {
  const totalStart = Date.now();
  try {
    // Connect once before launching concurrent backtests
    await getClient();

    // Fire all off with 500ms stagger
    const promises = [];
    for (const len of LENGTHS) {
      promises.push(runOne(len));
      await sleep(100);
    }
    await Promise.all(promises);

    const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);
    console.log(`\nTotal time: ${totalElapsed}s (${LENGTHS.length} runs)`);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await close();
    process.exit(0);
  }
})();
