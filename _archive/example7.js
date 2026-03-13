/**
 * Example 7: Deep backtest — EMA/RSI Scalper on ES 1-min, last 30 days
 *
 * Same as example 6 but uses deep backtesting with a date range.
 * Sweeps Fast EMA Length 5-10 (6 combos) over the last 30 calendar days.
 *
 * Requires a Premium TradingView account.
 */
const tv = require('../index');
const { getClient, close } = require('../lib/ws-client');

const SCRIPT = 'USER;3f778e242a9b42d7992cd31da1320432';
const SYMBOL = 'CME_MINI:ES1!';
const BATCH_SIZE = 6;
const BATCH_PAUSE = 2000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Last 30 days as date range
const now = new Date();
const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
const FROM = thirtyDaysAgo.toISOString().split('T')[0]; // e.g. '2026-01-23'
const TO = now.toISOString().split('T')[0];               // e.g. '2026-02-22'

const combos = [5, 6, 7, 8, 9, 10];
const results = [];
let failed = 0;

async function runOne(fast) {
  const label = `Fast EMA=${fast}`;
  const start = Date.now();

  console.log(`  ${label}: starting backtest...`);
  const r = await tv.backtest(SCRIPT, SYMBOL, {
    timeframe: '1',
    range: { from: FROM, to: TO },
    params: { 'Fast EMA Length': fast },
  });
  console.log(`  ${label}: backtest returned`);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (!r.success) {
    console.log(`[${elapsed}s] ${label}: FAILED — ${r.message} ${r.error || ''}`);
    failed++;
    return;
  }

  const p = r.report.performance.all || {};
  console.log(
    `[${elapsed}s] ${label} (${r.mode}): Trades: ${p.totalTrades} | ` +
    `P&L: ${p.netProfit} | WR: ${((p.percentProfitable || 0) * 100).toFixed(1)}% | ` +
    `PF: ${(p.profitFactor || 0).toFixed(3)} | DD: ${r.report.performance.maxStrategyDrawDown}`
  );

  results.push({
    fast,
    trades: p.totalTrades || 0,
    pnl: p.netProfit || 0,
    winRate: p.percentProfitable || 0,
    pf: p.profitFactor || 0,
    maxDD: r.report.performance.maxStrategyDrawDown || 0,
  });
}

(async () => {
  const totalStart = Date.now();

  try {
    await getClient();
    console.log(`Deep backtest: ${SYMBOL} 1-min, ${FROM} → ${TO}`);
    console.log(`Running ${combos.length} combinations...\n`);

    // Run sequentially — each deep backtest opens its own WS connection
    for (const fast of combos) {
      await runOne(fast);
    }

    // Sort by profit factor descending
    results.sort((a, b) => b.pf - a.pf);

    console.log(`\n=== Results by Profit Factor ===`);
    console.log('Fast EMA | Trades | P&L      | WR     | PF    | Max DD');
    console.log('---------|--------|----------|--------|-------|-------');
    for (const r of results) {
      console.log(
        `${String(r.fast).padStart(8)} | ` +
        `${String(r.trades).padStart(6)} | ${String(r.pnl).padStart(8)} | ` +
        `${(r.winRate * 100).toFixed(1).padStart(5)}% | ${r.pf.toFixed(3)} | ${r.maxDD}`
      );
    }

    const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);
    console.log(`\nTotal: ${results.length} succeeded, ${failed} failed in ${totalElapsed}s`);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await close();
    process.exit(0);
  }
})();
