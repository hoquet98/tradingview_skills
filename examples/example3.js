/**
 * Example 3: EMA/RSI Scalper on ES 1-min — sequential sweep Fast EMA Length
 */
const tv = require('../index');
const { close } = require('../lib/ws-client');

const SCRIPT = 'USER;3f778e242a9b42d7992cd31da1320432';
const SYMBOL = 'CME_MINI:ES1!';
const LENGTHS = [null, 12, 11, 10, 9, 8]; // null = default

(async () => {
  const totalStart = Date.now();
  try {
    for (const len of LENGTHS) {
      const label = len === null ? 'Default' : `Fast EMA = ${len}`;
      const start = Date.now();

      const opts = { timeframe: '1', range: 'chart' };
      if (len !== null) opts.params = { 'Fast EMA Length': len };

      const r = await tv.backtest(SCRIPT, SYMBOL, opts);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);

      if (!r.success) {
        console.log(`[${elapsed}s] ${label}: FAILED — ${r.message}`);
      } else {
        const p = r.report.performance.all || {};
        console.log(`[${elapsed}s] ${label}: Trades: ${p.totalTrades} | P&L: ${p.netProfit} | WR: ${((p.percentProfitable || 0) * 100).toFixed(1)}% | PF: ${(p.profitFactor || 0).toFixed(3)} | DD: ${r.report.performance.maxStrategyDrawDown}`);
      }
    }

    const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);
    console.log(`\nTotal time: ${totalElapsed}s (${LENGTHS.length} runs, sequential)`);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await close();
  }
})();
