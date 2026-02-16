const TradingView = require('./main');

/**
 * Test 2: Authenticated session — load indicator + attempt strategy backtest
 */

const SESSION = process.env.TV_SESSION;
const SIGNATURE = process.env.TV_SIGNATURE;

if (!SESSION || !SIGNATURE) {
  throw new Error('Missing required environment variables: TV_SESSION and TV_SIGNATURE must be set.');
}

console.log('=== TradingView-API Authenticated Test ===\n');

const client = new TradingView.Client({
  token: SESSION,
  signature: SIGNATURE,
});

const chart = new client.Session.Chart();

console.log('Setting market to BINANCE:BTCUSDT, timeframe 1H...');
chart.setMarket('BINANCE:BTCUSDT', {
  timeframe: '60',
  range: 300, // Get more candles
});

chart.onError((...err) => {
  console.error('Chart error:', ...err);
});

chart.onSymbolLoaded(() => {
  console.log(`Symbol loaded: "${chart.infos.description}"`);
  console.log(`Candles available: ${chart.periods.length}`);
});

// Add a built-in Volume indicator
const volumeIndicator = new TradingView.BuiltInIndicator('Volume@tv-basicstudies-241');
let volStudy;

chart.onUpdate(() => {
  if (!chart.periods[0]) return;
  console.log(`\nLatest price: $${chart.periods[0].close}`);
  console.log(`Candles loaded: ${chart.periods.length}`);

  // Add volume indicator once we have data
  if (!volStudy) {
    console.log('\nAdding Volume indicator...');
    volStudy = new chart.Study(volumeIndicator);

    volStudy.onReady(() => {
      console.log('Volume indicator ready!');
    });

    volStudy.onUpdate(() => {
      if (volStudy.periods && volStudy.periods.length > 0) {
        const latest = volStudy.periods[0];
        console.log(`\nVolume indicator data (latest candle):`);
        console.log(`  Values:`, JSON.stringify(latest, null, 2));
      }

      // Now try loading a strategy
      console.log('\n--- Attempting to load RSI Strategy ---');
      tryStrategy();
    });

    volStudy.onError((...err) => {
      console.error('Volume indicator error:', ...err);
    });
  }
});

let strategyLoaded = false;
function tryStrategy() {
  if (strategyLoaded) return;
  strategyLoaded = true;

  // Try a built-in strategy
  const rsiStrategy = new TradingView.BuiltInIndicator('RSI_Strategy@tv-basicstudies-241!');
  const strat = new chart.Study(rsiStrategy);

  strat.onReady(() => {
    console.log('RSI Strategy loaded!');
  });

  strat.onUpdate(() => {
    console.log('\nStrategy report available:', !!strat.strategyReport);
    if (strat.strategyReport) {
      const report = strat.strategyReport;
      console.log('\n=== Strategy Backtest Report ===');
      console.log(JSON.stringify(report, null, 2).substring(0, 2000));
      console.log('...(truncated)');
    }

    // Done — close everything
    console.log('\n--- Test complete, closing ---');
    chart.delete();
    client.end();
  });

  strat.onError((...err) => {
    console.error('Strategy error:', ...err);
    console.log('\n--- Error, closing ---');
    chart.delete();
    client.end();
  });
}

// Safety timeout
setTimeout(() => {
  console.log('\n--- Timeout after 30s, closing ---');
  try { chart.delete(); } catch (e) {}
  client.end();
}, 30000);
