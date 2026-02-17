# Workflows

Runnable workflow scripts that combine multiple skills for real tasks. Each workflow is in the `workflows/` directory and can be run from the command line or imported as a module.

## Quick Reference

| Workflow | Script | Browser? | Description |
|----------|--------|----------|-------------|
| Market Research | `workflows/market-research.js` | No | Search, quote, TA, metadata in one call |
| Strategy Backtest | `workflows/strategy-backtest.js` | No | Backtest across multiple symbols/timeframes |
| Indicator Analysis | `workflows/indicator-analysis.js` | No | Search and inspect indicator details |
| Portfolio Monitor | `workflows/portfolio-monitor.js` | No | Batch quotes + TA for a symbol list |
| Script Management | `workflows/script-management.js` | No | List scripts, inspect, manage permissions |
| Chart Setup | `workflows/chart-setup.js` | Yes | Configure chart with symbol, TF, type, indicators |
| Data Export | `workflows/data-export.js` | No | Export OHLCV to CSV/JSON files |
| Get Strategy Params | `workflows/get-strategy-params.js` | No | Search strategy, return parameters + defaults |
| Validate Strategy | `workflows/validate-strategy.js` | No | Test if a script compiles successfully |
| Load Strategy | `workflows/load-strategy.js` | No | Load strategy with custom params, get performance |
| Save Chart Layout | `workflows/save-chart-layout.js` | Yes | Load strategy on chart, save layout, get URL |
| Optimize Strategy | `workflows/optimize-strategy.js` | No | Parameter sweep across value ranges |

---

## Market Research

**Script:** `workflows/market-research.js`

```bash
node workflows/market-research.js "AAPL"              # Search + quote + TA + metadata
node workflows/market-research.js "BTC" crypto         # With category filter
node workflows/market-research.js "NASDAQ:TSLA"        # Direct symbol (skip search)
```

**Returns:** symbol, price, fundamentals (P/E, market cap, sector), TA across 8 timeframes, market metadata (exchange, currency, session hours).

### As a module

```js
const tv = require('./index');

// 1. Search for the symbol
const results = await tv.searchMarket('Tesla', 'stock');
const symbol = results.results[0].id; // "NASDAQ:TSLA"

// 2. Get real-time quote
const quote = await tv.getQuote(symbol);
console.log(`${symbol}: $${quote.quote.lastPrice} (${quote.quote.changePercent}%)`);
console.log(`P/E: ${quote.quote.peRatio}, Market Cap: ${quote.quote.marketCap}`);

// 3. Get technical analysis across all timeframes
const ta = await tv.getTechnicalAnalysis(symbol);
for (const [tf, analysis] of Object.entries(ta.analysis)) {
  console.log(`${tf}: ${analysis.overall} (MA: ${analysis.movingAverages}, Osc: ${analysis.oscillators})`);
}

// 4. Get market metadata
const info = await tv.getMarketInfo(symbol);
console.log(`Exchange: ${info.info.exchange}, Currency: ${info.info.currency}, Timezone: ${info.info.timezone}`);
```

### Scan multiple symbols (custom code)

```js
const tv = require('./index');

const symbols = ['NASDAQ:AAPL', 'NASDAQ:GOOGL', 'NASDAQ:MSFT', 'NASDAQ:AMZN', 'NASDAQ:META'];

for (const symbol of symbols) {
  const [quote, ta] = await Promise.all([
    tv.getQuote(symbol),
    tv.getTechnicalAnalysis(symbol),
  ]);

  console.log(`${symbol}: $${quote.quote.lastPrice} | Daily: ${ta.analysis['1D'].overall} | Weekly: ${ta.analysis['1W'].overall}`);
}
```

### CLI version

```bash
# Search → get quote → get TA
node skills/search-market/index.js "AAPL" stock
node skills/get-quote/index.js NASDAQ:AAPL
node skills/get-technical-analysis/index.js NASDAQ:AAPL
node skills/get-market-info/index.js NASDAQ:AAPL
```

---

## Strategy Backtesting

**Script:** `workflows/strategy-backtest.js`

```bash
node workflows/strategy-backtest.js "STD;RSI%1Strategy" BINANCE:BTCUSDT D
node workflows/strategy-backtest.js "STD;RSI%1Strategy" BINANCE:BTCUSDT,BINANCE:ETHUSDT,NASDAQ:AAPL D
node workflows/strategy-backtest.js "STD;RSI%1Strategy" BINANCE:BTCUSDT D,240,60
```

**Returns:** Strategy details, performance metrics per symbol/timeframe, comparison summary (best by profit factor, best by win rate).

### As a module

```js
const tv = require('./index');

// Get strategy report for RSI Strategy on BTC daily
const report = await tv.getStrategyReport('STD;RSI%1Strategy', 'BINANCE:BTCUSDT', {
  timeframe: 'D',
  range: 1000,
});

console.log(`Net Profit: ${report.report.performance.netProfit}`);
console.log(`Win Rate: ${report.report.performance.percentProfitable}%`);
console.log(`Total Trades: ${report.report.tradeCount}`);
```

### Full strategy workflow with Playwright

```js
const tv = require('./index');

const { browser, page } = await tv.launchBrowser({ headless: false });
await tv.openChart(page);

// 1. Set up the chart
await tv.changeSymbol(page, 'BINANCE:BTCUSDT');
await tv.changeTimeframe(page, 'D');

// 2. Add a strategy
await tv.addStrategy(page, 'RSI Strategy');

// 3. Read its current settings
const settings = await tv.openStrategySettings(page, 'RSI Strategy');
console.log('Current settings:', settings.settings);

// 4. Get the backtest report
const overview = await tv.getStrategyReport(page, 'overview');
console.log('Overview:', overview);

const trades = await tv.getStrategyReport(page, 'listOfTrades');
console.log('Trades:', trades);

// 5. Clean up
await tv.removeStrategy(page, 'RSI Strategy');
await tv.closeBrowser(browser);
```

### Compare strategies across symbols

```js
const tv = require('./index');

const strategy = 'STD;RSI%1Strategy';
const symbols = ['BINANCE:BTCUSDT', 'BINANCE:ETHUSDT', 'NASDAQ:AAPL'];

for (const symbol of symbols) {
  try {
    const report = await tv.getStrategyReport(strategy, symbol, { timeframe: 'D', range: 500 });
    console.log(`${symbol}: ${report.report.tradeCount} trades, PF: ${report.report.performance.profitFactor}`);
  } catch (err) {
    console.log(`${symbol}: ${err.message}`);
  }
}
```

### CLI version

```bash
node skills/get-strategy-report/index.js STD;RSI%1Strategy BINANCE:BTCUSDT D
node skills/get-strategy-report/index.js STD;RSI%1Strategy NASDAQ:AAPL D
```

---

## Indicator Analysis

**Script:** `workflows/indicator-analysis.js`

```bash
node workflows/indicator-analysis.js "RSI"             # Search + top result details
node workflows/indicator-analysis.js "MACD"
node workflows/indicator-analysis.js "STD;RSI"         # Direct ID lookup
```

**Returns:** Search results (top 10), full details for top match (inputs with types/defaults/options, plots).

### As a module

```js
const tv = require('./index');

// 1. Search for indicators
const results = await tv.getIndicatorList('MACD');
console.log(`Found ${results.count} indicators:`);
results.indicators.forEach(i => console.log(`  ${i.id} — ${i.name} (${i.type})`));

// 2. Get full details for a specific one
const details = await tv.getIndicatorDetails('STD;MACD');
console.log(`\n${details.indicator.description}`);
console.log('Inputs:');
details.indicator.inputs.forEach(input => {
  if (!input.isHidden) {
    console.log(`  ${input.name}: ${input.type} = ${input.value}${input.options ? ` [${input.options.join(', ')}]` : ''}`);
  }
});
```

### Add and configure an indicator via Playwright

```js
const tv = require('./index');

const { browser, page } = await tv.launchBrowser({ headless: false });
await tv.openChart(page);

// 1. Add RSI indicator
await tv.addIndicator(page, 'RSI');

// 2. Read current settings
const current = await tv.getIndicatorSettings(page, 'RSI');
console.log('Current:', current.settings);

// 3. Update settings
await tv.setIndicatorSettings(page, 'RSI', { 'RSI Length': '21' });

// 4. Verify
const updated = await tv.getIndicatorSettings(page, 'RSI');
console.log('Updated:', updated.settings);

await tv.closeBrowser(browser);
```

### CLI version

```bash
node skills/get-indicator-list/index.js search MACD
node skills/get-indicator-details/index.js STD;MACD
node skills/get-indicator-list/index.js add "RSI"
node skills/get-indicator-list/index.js get-settings "RSI"
node skills/get-indicator-list/index.js set-settings "RSI" '{"RSI Length": "21"}'
```

---

## Portfolio Monitoring

**Script:** `workflows/portfolio-monitor.js`

```bash
node workflows/portfolio-monitor.js NASDAQ:AAPL,NASDAQ:GOOGL,NASDAQ:MSFT
node workflows/portfolio-monitor.js BINANCE:BTCUSDT,BINANCE:ETHUSDT,BINANCE:SOLUSDT
```

**Returns:** Per-symbol price, change, volume, market cap, P/E, sector, daily/weekly TA. Summary with gainers/losers count.

### Build a watchlist and monitor it (Playwright)

```js
const tv = require('./index');

const { browser, page } = await tv.launchBrowser({ headless: false });
await tv.openChart(page);

// 1. Create a watchlist
await tv.createWatchlist(page, 'Tech Portfolio');

// 2. Add symbols
const symbols = ['NASDAQ:AAPL', 'NASDAQ:GOOGL', 'NASDAQ:MSFT', 'NASDAQ:AMZN'];
for (const sym of symbols) {
  await tv.addToWatchlist(page, sym, 'Tech Portfolio');
}

// 3. Read back the watchlist
const list = await tv.getWatchlistSymbols(page, 'Tech Portfolio');
console.log('Watchlist:', list.symbols);

await tv.closeBrowser(browser);
```

### Get quotes for a set of symbols (headless)

```js
const tv = require('./index');
const { close } = require('./lib/ws-client');

const symbols = ['NASDAQ:AAPL', 'NASDAQ:GOOGL', 'BINANCE:BTCUSDT', 'FOREX:EURUSD'];

for (const sym of symbols) {
  const q = await tv.getQuote(sym);
  console.log(`${sym}: $${q.quote.lastPrice} (${q.quote.changePercent > 0 ? '+' : ''}${q.quote.changePercent}%)`);
}

await close();
```

### CLI version

```bash
node skills/get-quote/index.js NASDAQ:AAPL
node skills/get-quote/index.js NASDAQ:GOOGL
node skills/get-quote/index.js BINANCE:BTCUSDT
```

---

## Script Management

**Script:** `workflows/script-management.js`

```bash
node workflows/script-management.js                         # List all saved scripts
node workflows/script-management.js inspect "USER;abc123"    # Inspect a script's inputs/plots
node workflows/script-management.js perms "PUB;abc123"       # List authorized users
node workflows/script-management.js grant "PUB;abc123" trader1 "2025-12-31"  # Add user
node workflows/script-management.js revoke "PUB;abc123" trader1              # Remove user
```

**Returns:** Script list, full indicator details, or permission management results.

### As a module

```js
const tv = require('./index');

// 1. List all saved scripts
const scripts = await tv.getSavedScripts();
console.log(`You have ${scripts.count} saved scripts:`);
scripts.scripts.forEach(s => console.log(`  ${s.id} — ${s.name} (${s.type})`));

// 2. Get details for a specific script
if (scripts.scripts.length > 0) {
  const details = await tv.getIndicatorDetails(scripts.scripts[0].id);
  console.log(`\nInputs for "${details.indicator.shortDescription}":`);
  details.indicator.inputs.forEach(i => {
    if (!i.isHidden) console.log(`  ${i.name}: ${i.value}`);
  });
}
```

### Manage invite-only script permissions

```js
const tv = require('./index');

const pineId = 'PUB;abc123def456';

// List current users
const users = await tv.managePinePermissions('list', pineId);
console.log(`${users.count} authorized users`);

// Add a user with expiration
await tv.managePinePermissions('add', pineId, {
  username: 'trader123',
  expiration: '2025-12-31T00:00:00Z',
});

// Remove a user
await tv.managePinePermissions('remove', pineId, { username: 'old_user' });
```

### CLI version

```bash
node skills/get-saved-scripts/index.js
node skills/get-indicator-details/index.js "USER;abc123"
node skills/manage-pine-permissions/index.js list "PUB;abc123"
node skills/manage-pine-permissions/index.js add "PUB;abc123" trader123 "2025-12-31"
```

---

## Chart Configuration

**Script:** `workflows/chart-setup.js` (requires browser)

```bash
node workflows/chart-setup.js BINANCE:BTCUSDT 240 "Heikin Ashi" RSI,MACD,Volume
node workflows/chart-setup.js NASDAQ:AAPL D Candles RSI
node workflows/chart-setup.js BINANCE:ETHUSDT 60
```

**Returns:** Confirmation of each step (symbol changed, timeframe set, chart type applied, indicators added), plus final chart state.

### As a module

```js
const tv = require('./index');

const { browser, page } = await tv.launchBrowser({ headless: false });
await tv.openChart(page);

// 1. Set symbol and timeframe
await tv.changeSymbol(page, 'BINANCE:BTCUSDT');
await tv.changeTimeframe(page, '240'); // 4 hour

// 2. Set chart type to Heikin Ashi
await tv.setChartType(page, 'Heikin Ashi');

// 3. Set timezone
await tv.setTimezone(page, 'America/New_York');

// 4. Add indicators
await tv.addIndicator(page, 'RSI');
await tv.addIndicator(page, 'MACD');
await tv.addIndicator(page, 'Volume');

// 5. Take a screenshot
await tv.takeScreenshot(page, { path: './my-chart.png' });

await tv.closeBrowser(browser);
```

### Set custom chart types via WebSocket (headless)

```js
const tv = require('./index');
const { close } = require('./lib/ws-client');

// These custom chart types work via WebSocket — no browser needed
// They validate that the type is supported by fetching data with it
await tv.setChartType('HeikinAshi', 'BINANCE:BTCUSDT');
await tv.setChartType('Renko', 'BINANCE:BTCUSDT');

await close();
```

---

## Data Export

**Script:** `workflows/data-export.js`

```bash
node workflows/data-export.js BINANCE:BTCUSDT D 500 csv     # 500 daily bars → CSV
node workflows/data-export.js NASDAQ:AAPL 60 1000 json       # 1000 hourly bars → JSON
node workflows/data-export.js BINANCE:ETHUSDT D 2000 csv     # Auto uses fetchMore for >300
```

**Returns:** Exported file path, bar count, date range. Output files saved to current directory.

### As a module

```js
const tv = require('./index');
const fs = require('fs');
const { close } = require('./lib/ws-client');

// 1. Fetch chart data
const data = await tv.getChartData('NASDAQ:AAPL', { timeframe: 'D', count: 500 });

// 2. Write to CSV
const csv = 'time,open,high,low,close,volume\n' +
  data.data.map(bar => `${bar.time},${bar.open},${bar.high},${bar.low},${bar.close},${bar.volume}`).join('\n');
fs.writeFileSync('aapl_daily.csv', csv);
console.log(`Exported ${data.count} bars to aapl_daily.csv`);

await close();
```

### Fetch extended history

```js
const tv = require('./index');
const { close } = require('./lib/ws-client');

// Fetch 100 initial + 900 more = 1000 total daily bars
const data = await tv.fetchMoreData('BINANCE:BTCUSDT', {
  timeframe: 'D',
  initialRange: 100,
  additional: 900,
});

console.log(`Total bars: ${data.totalBars}`);
console.log(`Date range: ${new Date(data.bars[data.bars.length - 1].time * 1000).toISOString()} to ${new Date(data.bars[0].time * 1000).toISOString()}`);

await close();
```

### Replay and record historical data

```js
const tv = require('./index');
const { close } = require('./lib/ws-client');

// Replay 30 daily bars from January 1, 2024
const replay = await tv.replayChart('BINANCE:BTCUSDT', {
  timeframe: 'D',
  replayFrom: Math.floor(new Date('2024-01-01').getTime() / 1000),
  steps: 30,
});

console.log(`Replayed ${replay.stepsCompleted} bars, total ${replay.barCount} bars in history`);

await close();
```

### CLI version

```bash
node skills/get-chart-data/index.js NASDAQ:AAPL D 500
node skills/fetch-more-data/index.js BINANCE:BTCUSDT D 900
node skills/replay-chart/index.js BINANCE:BTCUSDT D 1704067200 30
```

---

## Get Strategy Parameters

**Script:** `workflows/get-strategy-params.js`

```bash
node workflows/get-strategy-params.js "RSI Strategy"           # Search by name
node workflows/get-strategy-params.js "STD;RSI%1Strategy"       # Direct ID
node workflows/get-strategy-params.js "Bollinger Bands Strategy"
node workflows/get-strategy-params.js "MACD Strategy" last      # Specific version
```

**Returns:** Strategy metadata, full parameter list with IDs, names, types, default values, and options.

### As a module

```js
const { getStrategyParams } = require('./workflows/get-strategy-params');

const result = await getStrategyParams('RSI Strategy');
console.log(`${result.paramCount} parameters for "${result.strategy.shortName}":`);
result.params.forEach(p => {
  console.log(`  ${p.name} (${p.type}): default=${p.default}${p.options ? ' options=' + p.options.join(',') : ''}`);
});
```

---

## Validate Strategy

**Script:** `workflows/validate-strategy.js`

```bash
node workflows/validate-strategy.js "STD;RSI%1Strategy"                    # Default symbol/TF
node workflows/validate-strategy.js "PUB;abc123" BINANCE:BTCUSDT D         # Custom symbol/TF
```

**Returns:** `compiles: true/false`, script name, type (strategy/indicator), any error messages.

### As a module

```js
const { validateStrategy } = require('./workflows/validate-strategy');
const { close } = require('./lib/ws-client');

const result = await validateStrategy('STD;RSI%1Strategy', {
  symbol: 'BINANCE:BTCUSDT',
  timeframe: 'D',
});

console.log(`${result.scriptName}: ${result.compiles ? 'COMPILES' : 'ERRORS'}`);
if (!result.compiles) console.log('Errors:', result.errors);

await close();
```

---

## Load Strategy (with Custom Parameters)

**Script:** `workflows/load-strategy.js`

```bash
node workflows/load-strategy.js "STD;RSI%1Strategy" BINANCE:BTCUSDT D
node workflows/load-strategy.js "STD;RSI%1Strategy" BINANCE:BTCUSDT D '{"Length":21}'
node workflows/load-strategy.js "PUB;abc123" NASDAQ:AAPL 60 '{"Fast Length":8,"Slow Length":26}'
```

**Returns:** Full performance results (net profit, win rate, profit factor, Sharpe/Sortino, long/short breakdown, trade count), default parameter values, and applied overrides.

### As a module

```js
const { loadStrategy } = require('./workflows/load-strategy');
const { close } = require('./lib/ws-client');

const result = await loadStrategy('STD;RSI%1Strategy', {
  symbol: 'BINANCE:BTCUSDT',
  timeframe: 'D',
  params: { 'Length': 21, 'Oversold': 25, 'Overbought': 75 },
});

console.log(`Net Profit: ${result.performance.netProfit}`);
console.log(`Win Rate: ${result.performance.percentProfitable}`);
console.log(`Profit Factor: ${result.performance.profitFactor}`);
console.log(`Sharpe Ratio: ${result.performance.sharpeRatio}`);

await close();
```

---

## Save Chart Layout

**Script:** `workflows/save-chart-layout.js` (requires browser)

```bash
node workflows/save-chart-layout.js "RSI Strategy" BINANCE:BTCUSDT D
node workflows/save-chart-layout.js "RSI Strategy" NASDAQ:AAPL 60 "My Layout Name"
```

**Returns:** Chart URL with layout ID, confirmation of symbol/timeframe/strategy setup.

### As a module

```js
const { saveChartLayout } = require('./workflows/save-chart-layout');

const result = await saveChartLayout('RSI Strategy', {
  symbol: 'BINANCE:BTCUSDT',
  timeframe: 'D',
  layoutName: 'BTC RSI Daily',
});

console.log(`Chart URL: ${result.chartUrl}`);
console.log(`Layout ID: ${result.layoutId}`);
```

---

## Optimize Strategy (Parameter Sweep)

**Script:** `workflows/optimize-strategy.js`

```bash
node workflows/optimize-strategy.js "STD;RSI%1Strategy" BINANCE:BTCUSDT D '{"Length":[7,14,21]}'
node workflows/optimize-strategy.js "STD;RSI%1Strategy" BINANCE:BTCUSDT D '{"Length":[7,14,21],"Oversold":[20,30],"Overbought":[70,80]}'
node workflows/optimize-strategy.js "PUB;abc123" NQ1! 1 '{"Fast":[5,8,13],"Slow":[21,34,55]}' profitFactor
```

**Returns:** Ranked results sorted by metric (default: netProfit), best/worst configurations, all parameter defaults, success/failure counts.

### As a module

```js
const { optimizeStrategy } = require('./workflows/optimize-strategy');
const { close } = require('./lib/ws-client');

const result = await optimizeStrategy('STD;RSI%1Strategy', {
  symbol: 'BINANCE:BTCUSDT',
  timeframe: 'D',
  paramRanges: {
    'Length': [7, 14, 21],
    'Oversold': [20, 25, 30],
    'Overbought': [70, 75, 80],
  },
  sortBy: 'profitFactor', // or 'netProfit', 'percentProfitable', 'sharpeRatio'
});

console.log(`Best configuration (${result.best.profitFactor} PF):`);
console.log(result.best.params);
console.log(`\nTop 5:`);
result.ranked.slice(0, 5).forEach(r => {
  console.log(`  #${r.rank}: ${JSON.stringify(r.params)} → PF=${r.profitFactor}, Win=${r.percentProfitable}`);
});

await close();
```

---

## WebSocket Connection Management

When chaining multiple WebSocket skills, the connection stays open. Always close it when done:

```js
const { close } = require('./lib/ws-client');

try {
  // ... your WebSocket skill calls ...
} finally {
  await close();
}
```

CLI scripts handle this automatically — each skill's `main()` calls `close()` in its `finally` block.
