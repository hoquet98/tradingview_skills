/**
 * Example 5: EMA/RSI Scalper on ES 1-min — 3-param grid search (coarse pass)
 *
 * Fast EMA:  5-10  step 1  (6 values)
 * Med EMA:   10-30 step 5  (5 values)
 * Slow EMA:  30-50 step 5  (5 values)
 * Total: 150 combinations, all fired concurrently with 500ms stagger
 */
const tv = require('../index');
const { getClient, close } = require('../lib/ws-client');

const SCRIPT = 'USER;3f778e242a9b42d7992cd31da1320432';
const SYMBOL = 'CME_MINI:ES1!';
const STAGGER_MS = 500;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function range(start, end, step = 1) {
  const arr = [];
  for (let i = start; i <= end; i += step) arr.push(i);
  return arr;
}

// Build all combos
const combos = [];
for (const fast of range(5, 10)) {
  for (const med of range(10, 30, 5)) {
    for (const slow of range(30, 50, 5)) {
      combos.push({ fast, med, slow });
    }
  }
}

async function runOne({ fast, med, slow }) {
  const label = `F=${fast} M=${med} S=${slow}`;
  const start = Date.now();

  const r = await tv.backtest(SCRIPT, SYMBOL, {
    timeframe: '1',
    range: 'chart',
    params: {
      'Fast EMA Length': fast,
      'Medium EMA Length': med,
      'Slow EMA Length': slow,
    },
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (!r.success) {
    console.log(`[${elapsed}s] ${label}: FAILED — ${r.message} ${r.error || ''}`);
    return null;
  }

  const p = r.report.performance.all || {};
  console.log(`[${elapsed}s] ${label}: Trades: ${p.totalTrades} | P&L: ${p.netProfit} | WR: ${((p.percentProfitable || 0) * 100).toFixed(1)}% | PF: ${(p.profitFactor || 0).toFixed(3)} | DD: ${r.report.performance.maxStrategyDrawDown}`);

  return {
    fast, med, slow,
    trades: p.totalTrades || 0,
    pnl: p.netProfit || 0,
    winRate: p.percentProfitable || 0,
    pf: p.profitFactor || 0,
    maxDD: r.report.performance.maxStrategyDrawDown || 0,
  };
}

(async () => {
  const totalStart = Date.now();
  try {
    await getClient();
    console.log(`Running ${combos.length} combinations (${STAGGER_MS}ms stagger)...\n`);

    const promises = [];
    for (const combo of combos) {
      promises.push(runOne(combo));
      await sleep(STAGGER_MS);
    }

    const all = await Promise.all(promises);
    const results = all.filter(r => r !== null);

    // Sort by profit factor descending
    results.sort((a, b) => b.pf - a.pf);

    console.log(`\n=== Top 10 by Profit Factor ===`);
    console.log('Fast | Med | Slow | Trades | P&L      | WR     | PF    | Max DD');
    console.log('-----|-----|------|--------|----------|--------|-------|-------');
    for (const r of results.slice(0, 10)) {
      console.log(
        `${String(r.fast).padStart(4)} | ${String(r.med).padStart(3)} | ${String(r.slow).padStart(4)} | ` +
        `${String(r.trades).padStart(6)} | ${String(r.pnl).padStart(8)} | ` +
        `${(r.winRate * 100).toFixed(1).padStart(5)}% | ${r.pf.toFixed(3)} | ${r.maxDD}`
      );
    }

    const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);
    console.log(`\nTotal: ${results.length} succeeded, ${combos.length - results.length} failed in ${totalElapsed}s`);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await close();
    process.exit(0);
  }
})();
