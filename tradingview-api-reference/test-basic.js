const TradingView = require('./main');

/**
 * Test 1: Basic chart data (no auth needed)
 * Fetches real-time BTCUSDT price from Binance
 */

console.log('=== TradingView-API Test ===\n');
console.log('Creating client (no auth)...');

const client = new TradingView.Client();

const chart = new client.Session.Chart();

console.log('Setting market to BINANCE:BTCUSDT, timeframe 1D...');
chart.setMarket('BINANCE:BTCUSDT', {
  timeframe: 'D',
});

chart.onError((...err) => {
  console.error('Chart error:', ...err);
});

chart.onSymbolLoaded(() => {
  console.log(`\nSymbol loaded: "${chart.infos.description}"`);
  console.log(`Exchange: ${chart.infos.exchange}`);
  console.log(`Currency: ${chart.infos.currency_id}`);
  console.log(`Type: ${chart.infos.type}`);
});

let updateCount = 0;
chart.onUpdate(() => {
  updateCount++;
  if (!chart.periods[0]) return;

  const latest = chart.periods[0];
  console.log(`\n[Update #${updateCount}] ${chart.infos.description}:`);
  console.log(`  Open:   ${latest.open}`);
  console.log(`  High:   ${latest.high}`);
  console.log(`  Low:    ${latest.low}`);
  console.log(`  Close:  ${latest.close}`);
  console.log(`  Volume: ${latest.volume}`);
  console.log(`  Time:   ${new Date(latest.time * 1000).toISOString()}`);

  if (chart.periods.length > 1) {
    console.log(`\n  (${chart.periods.length} candles available)`);
    console.log(`  Oldest candle: ${new Date(chart.periods[chart.periods.length - 1].time * 1000).toISOString()}`);
  }

  // After 3 updates, close
  if (updateCount >= 3) {
    console.log('\n--- Got 3 updates, closing ---');
    chart.delete();
    client.end();
  }
});

// Safety timeout after 15 seconds
setTimeout(() => {
  console.log('\n--- Timeout after 15s, closing ---');
  try { chart.delete(); } catch (e) {}
  client.end();
}, 15000);
