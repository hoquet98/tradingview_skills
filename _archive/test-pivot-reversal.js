/**
 * Test Pivot Reversal Strategy locally — compare PnL with cloud optimizer results.
 * Cloud log: job_f8137Pivot Reversal Strategy_15.log
 *
 * Cloud result for Left=4, Right=2 (default): PnL=-$61,040, Trades=1192
 * Cloud result for Left=5, Right=3 (best):    PnL=-$11,760, Trades=920
 */
const { fetchStrategyReport, getClient, close } = require('../lib/ws-client');

const SCRIPT = 'STD;Pivot%1Reversal%1Strategy';
const SYMBOL = 'COMEX:GC1!';

async function runTest(label, params, range) {
  console.log(`\n=== ${label} (range=${range}) ===`);
  console.log('Params:', JSON.stringify(params));

  const report = await fetchStrategyReport(SCRIPT, SYMBOL, {
    timeframe: '1',
    range,
    params,
  });

  const perf = report.performance;
  if (perf && perf.all) {
    console.log('Trades:       ', perf.all.totalTrades);
    console.log('Net Profit:   ', perf.all.netProfit);
    console.log('Net Profit %: ', perf.all.netProfitPercent);
    console.log('Win Rate:     ', (perf.all.percentProfitable * 100).toFixed(1) + '%');
    console.log('Profit Factor:', perf.all.profitFactor);
    console.log('Max DD:       ', perf.maxStrategyDrawDown);
    console.log('Max DD %:     ', perf.maxStrategyDrawDownPercent);
  } else {
    console.log('No performance data returned');
    console.log('Report keys:', Object.keys(report));
  }
}

(async () => {
  try {
    await getClient();

    // Test both 10K and 20K bar ranges to find which matches cloud
    for (const range of [10000, 20000]) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`BAR RANGE: ${range}`);
      console.log('='.repeat(50));

      // Cloud: Trades=1192, PnL=-$61,040
      await runTest('Left=4, Right=2', {
        'Pivot Lookback Left': 4,
        'Pivot Lookback Right': 2,
      }, range);

      // Cloud: Trades=920, PnL=-$11,760
      await runTest('Left=5, Right=3', {
        'Pivot Lookback Left': 5,
        'Pivot Lookback Right': 3,
      }, range);

      // Cloud: Trades=2891, PnL=-$44,300
      await runTest('Left=1, Right=1', {
        'Pivot Lookback Left': 1,
        'Pivot Lookback Right': 1,
      }, range);
    }

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await close();
    process.exit(0);
  }
})();
