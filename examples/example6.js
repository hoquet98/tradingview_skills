/**
 * Example 6: EMA/RSI Scalper on ES 1-min — batched grid search
 *
 * Fast EMA:  5-8  step 1  (4 values)
 * Med EMA:   10, 20, 30   (3 values)
 * Slow EMA:  30, 40, 50   (3 values)
 * = 36 combos
 */
const tv = require('../index');
const { getClient, close } = require('../lib/ws-client');

const SCRIPT = 'USER;3f778e242a9b42d7992cd31da1320432';
const SYMBOL = 'CME_MINI:ES1!';
const BATCH_SIZE = 6;
const BATCH_PAUSE = 2000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Build combos
const combos = [];
for (const fast of [5, 6, 7, 8]) {
  for (const med of [10, 20, 30]) {
    for (const slow of [30, 40, 50]) {
      combos.push({ fast, med, slow });
    }
  }
}

const results = [];
let failed = 0;

async function runOne({ fast, med, slow }, index) {
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
    console.log(`  [${String(index + 1).padStart(2)}/${combos.length}] ${label}: FAILED (${elapsed}s) — ${r.message} ${r.error || ''}`);
    failed++;
    return;
  }

  const p = r.report.performance.all || {};
  const trades = p.totalTrades || 0;
  const pnl = p.netProfit || 0;
  const wr = ((p.percentProfitable || 0) * 100).toFixed(1);
  const pf = (p.profitFactor || 0).toFixed(3);

  console.log(`  [${String(index + 1).padStart(2)}/${combos.length}] ${label}: ${trades} trades | $${pnl.toFixed(0)} | WR ${wr}% | PF ${pf} (${elapsed}s)`);

  results.push({
    fast, med, slow,
    trades,
    pnl,
    winRate: p.percentProfitable || 0,
    pf: p.profitFactor || 0,
    maxDD: r.report.performance.maxStrategyDrawDown || 0,
    elapsed: parseFloat(elapsed),
  });
}

(async () => {
  const totalStart = Date.now();

  try {
    await getClient();
    console.log(`Running ${combos.length} combos in batches of ${BATCH_SIZE}...\n`);

    const promises = [];
    for (let i = 0; i < combos.length; i++) {
      promises.push(runOne(combos[i], i));
      if ((i + 1) % BATCH_SIZE === 0 && i + 1 < combos.length) {
        await sleep(BATCH_PAUSE);
      }
    }
    await Promise.all(promises);

    // Timing stats
    const times = results.map(r => r.elapsed);
    const avgTime = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1);
    const minTime = Math.min(...times).toFixed(1);
    const maxTime = Math.max(...times).toFixed(1);

    // Sort by profit factor descending
    results.sort((a, b) => b.pf - a.pf);

    console.log(`\n=== Top 10 by Profit Factor ===`);
    console.log('Fast | Med | Slow | Trades |     P&L |    WR |    PF |    Max DD | Time');
    console.log('-----|-----|------|--------|---------|-------|-------|-----------|-----');
    for (const r of results.slice(0, 10)) {
      console.log(
        `${String(r.fast).padStart(4)} | ${String(r.med).padStart(3)} | ${String(r.slow).padStart(4)} | ` +
        `${String(r.trades).padStart(6)} | ${String(r.pnl.toFixed(0)).padStart(7)} | ` +
        `${(r.winRate * 100).toFixed(1).padStart(5)}% | ${r.pf.toFixed(3)} | ` +
        `${String(r.maxDD).padStart(9)} | ${r.elapsed}s`
      );
    }

    const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);
    console.log(`\n=== Timing ===`);
    console.log(`Per-combo:  avg ${avgTime}s | min ${minTime}s | max ${maxTime}s`);
    console.log(`Total:      ${results.length} succeeded, ${failed} failed in ${totalElapsed}s`);
    console.log(`Throughput: ${(results.length / (parseFloat(totalElapsed))).toFixed(1)} combos/sec`);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await close();
    process.exit(0);
  }
})();
