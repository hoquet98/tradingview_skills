/**
 * Test MACD Liquidity Tracker Strategy — fetch params, run backtest with session type fix.
 */
const { fetchStrategyReport, getClient, close, TradingView, getCredentials } = require('../lib/ws-client');

const SCRIPT = 'PUB;97230b13d2284b0c9c5034bb870e5693';
const SYMBOL = 'COINBASE:BTCUSD';

(async () => {
  try {
    // 1. Fetch indicator metadata to see all params
    const { session, signature } = getCredentials();
    const ind = await TradingView.getIndicator(SCRIPT, 'last', session, signature);
    const params = Object.entries(ind.inputs)
      .filter(([id, inp]) => !inp.isHidden && id !== 'pineFeatures' && id !== '__profile')
      .map(([id, inp]) => ({
        id,
        name: (inp.name || '').trim(),
        type: inp.type,
        value: inp.value,
        ...(inp.options ? { options: inp.options } : {}),
      }));

    console.log('=== MACD Liquidity Tracker Parameters ===\n');
    for (const p of params) {
      console.log(`  ${p.id.padEnd(6)} | ${p.type.padEnd(10)} | ${p.name.padEnd(30)} | default: ${JSON.stringify(p.value)}${p.options ? ` | options: ${JSON.stringify(p.options)}` : ''}`);
    }

    // 2. Run a backtest with date strings (tests the time type coercion fix)
    console.log('\n=== Running backtest with date string params ===\n');
    await getClient();
    const report = await fetchStrategyReport(SCRIPT, SYMBOL, {
      timeframe: '240',
      range: 20000,
      params: {
        'Start Date': '2018-01-01',
        'End Date': '2069-12-31',
      },
    });

    const perf = report.performance;
    if (perf && perf.all) {
      console.log('Trades:', perf.all.totalTrades);
      console.log('Net Profit:', perf.all.netProfit);
      console.log('Win Rate:', (perf.all.percentProfitable * 100).toFixed(1) + '%');
      console.log('Profit Factor:', perf.all.profitFactor);
      console.log('Max DD:', perf.maxStrategyDrawDown);
    } else {
      console.log('No performance data returned');
      console.log('Report keys:', Object.keys(report));
    }

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await close();
    process.exit(0);
  }
})();
