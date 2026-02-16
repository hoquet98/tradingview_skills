const TradingView = require('./main');

const SESSION = process.env.TV_SESSION;
const SIGNATURE = process.env.TV_SIGNATURE;

if (!SESSION || !SIGNATURE) {
  throw new Error('Missing required environment variables: TV_SESSION and TV_SIGNATURE must be set.');
}

console.log('=== Strategy Test (without ! suffix) ===\n');

const client = new TradingView.Client({
  token: SESSION,
  signature: SIGNATURE,
});

const chart = new client.Session.Chart();
chart.setMarket('BINANCE:BTCUSDT', {
  timeframe: 'D',
  range: 200,
});

chart.onError((...err) => {
  console.error('Chart error:', ...err);
});

chart.onSymbolLoaded(() => {
  console.log(`Symbol loaded: "${chart.infos.description}"`);
});

chart.onUpdate(() => {
  if (!chart.periods[0]) return;
  console.log(`Price: $${chart.periods[0].close}, Candles: ${chart.periods.length}`);

  // Try strategy WITHOUT the ! suffix
  console.log('\nLoading RSI Strategy (no ! suffix)...');
  const rsiStrategy = new TradingView.BuiltInIndicator('RSI_Strategy@tv-basicstudies-241');
  const strat = new chart.Study(rsiStrategy);

  strat.onReady(() => {
    console.log('Strategy ready!');
  });

  strat.onUpdate(() => {
    console.log('\nstrategyReport exists:', !!strat.strategyReport);
    console.log('periods count:', strat.periods?.length || 0);

    if (strat.strategyReport) {
      const r = strat.strategyReport;
      console.log('\n=== BACKTEST REPORT ===');
      // Print key metrics if available
      if (r.performance) {
        console.log('Performance:', JSON.stringify(r.performance, null, 2).substring(0, 1500));
      }
      if (r.trades) {
        console.log(`\nTotal trades: ${r.trades.length || 'N/A'}`);
      }
      // Print whatever we get
      const keys = Object.keys(r);
      console.log('\nReport keys:', keys);
      console.log('\nFull report (first 3000 chars):');
      console.log(JSON.stringify(r, null, 2).substring(0, 3000));
    }

    if (strat.periods && strat.periods.length > 0) {
      console.log('\nStrategy period data (latest):');
      console.log(JSON.stringify(strat.periods[0], null, 2));
    }

    chart.delete();
    client.end();
  });

  strat.onError((...err) => {
    console.error('Strategy error:', ...err);
    chart.delete();
    client.end();
  });
});

setTimeout(() => {
  console.log('\n--- Timeout ---');
  try { chart.delete(); } catch (e) {}
  client.end();
}, 20000);
