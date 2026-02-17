# Skills Reference

Complete API reference for all 33 TradingView skills. Each skill can be used as a library function or run from the command line.

**Transport key:**
- **WS** = WebSocket (fast, headless)
- **HTTP** = HTTP API (fast, headless)
- **PW** = Playwright (browser automation)
- **Hybrid** = Auto-detects: passes a string → WS/HTTP, passes a Playwright Page → PW

---

## Table of Contents

### Market Data
- [get-chart-data](#get-chart-data) — Fetch OHLCV candle data
- [get-quote](#get-quote) — Real-time quote with fundamentals
- [get-technical-analysis](#get-technical-analysis) — TA recommendations (8 timeframes)
- [search-market](#search-market) — Search symbols by keyword
- [get-market-info](#get-market-info) — Symbol metadata
- [fetch-more-data](#fetch-more-data) — Extended historical candles
- [replay-chart](#replay-chart) — Replay historical data bar-by-bar

### Chart Operations
- [change-symbol](#change-symbol) — Change chart symbol
- [change-timeframe](#change-timeframe) — Change chart timeframe
- [set-chart-type](#set-chart-type) — Chart type, price scale, timezone, export, screenshot

### Strategy Management
- [add-strategy](#add-strategy) — Add strategy from library
- [get-active-strategy](#get-active-strategy) — List strategies on chart
- [get-strategy-report](#get-strategy-report) — Backtest report with trades
- [open-strategy-settings](#open-strategy-settings) — Read strategy parameters
- [create-strategy](#create-strategy) — Create new Pine strategy
- [save-strategy](#save-strategy) — Save strategy
- [remove-strategy](#remove-strategy) — Remove strategy from chart
- [delete-strategy](#delete-strategy) — Delete strategy permanently
- [rename-strategy](#rename-strategy) — Rename a strategy
- [clone-strategy](#clone-strategy) — Copy/paste strategy settings

### Indicators
- [get-indicator-list](#get-indicator-list) — Search, add, remove, configure indicators
- [get-indicator-details](#get-indicator-details) — Indicator inputs, plots, metadata
- [get-saved-scripts](#get-saved-scripts) — List private Pine scripts

### Alerts
- [create-alert](#create-alert) — Create price alert
- [view-alert](#view-alert) — View, list, edit, delete alerts

### Watchlists
- [get-watchlist-symbols](#get-watchlist-symbols) — Read watchlist symbols
- [create-watchlist](#create-watchlist) — Create watchlist
- [add-to-watchlist](#add-to-watchlist) — Add symbol to watchlist
- [delete-watchlist](#delete-watchlist) — Delete watchlist

### Drawings
- [get-drawing-list](#get-drawing-list) — Manage chart drawings (PW)
- [get-chart-drawings](#get-chart-drawings) — Get drawings from saved layouts (HTTP)

### Account
- [get-user-info](#get-user-info) — User profile info
- [manage-pine-permissions](#manage-pine-permissions) — Invite-only script access

---

## Market Data

### get-chart-data

Fetch OHLCV (Open, High, Low, Close, Volume) candle data for any symbol.

**Transport:** Hybrid (WS default, PW fallback)

#### Function Signature

```js
getChartData(symbolOrPage, countOrOptions?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbolOrPage` | `string \| Page` | — | Symbol string for WS, Playwright Page for PW |
| `countOrOptions` | `number \| object` | `100` | Number of candles, or options object |
| `countOrOptions.count` | `number` | `100` | Number of candles |
| `countOrOptions.timeframe` | `string` | `'D'` | `'1','5','15','60','240','D','W','M'` |

#### Returns

```json
{
  "success": true,
  "message": "Fetched 100 candles for BINANCE:BTCUSDT (D)",
  "symbol": "BINANCE:BTCUSDT",
  "timeframe": "D",
  "data": [
    { "time": 1707955200, "open": 51800, "high": 52400, "low": 51200, "close": 52100, "volume": 28451.23 }
  ],
  "count": 100
}
```

#### CLI

```bash
node skills/get-chart-data/index.js BINANCE:BTCUSDT D 100
node skills/get-chart-data/index.js NASDAQ:AAPL 60 50
```

---

### get-quote

Get a real-time quote with price data and fundamentals.

**Transport:** WS

#### Function Signature

```js
getQuote(symbol?, options?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | `string` | `'BINANCE:BTCUSDT'` | Market symbol |
| `options.session` | `string` | `'regular'` | `'regular'` or `'extended'` |

#### Returns

```json
{
  "success": true,
  "symbol": "NASDAQ:AAPL",
  "quote": {
    "lastPrice": 255.78,
    "change": -5.95,
    "changePercent": -2.27,
    "volume": 56290673,
    "open": 262.01,
    "high": 262.23,
    "low": 255.45,
    "prevClose": 261.73,
    "bid": 0,
    "ask": 0,
    "description": "Apple Inc.",
    "exchange": "Cboe One",
    "type": "stock",
    "currency": "USD",
    "isTradable": true,
    "marketCap": 3755141881356,
    "peRatio": 33.11,
    "eps": 7.93,
    "beta": 1.33,
    "dividendYield": 0.41,
    "sector": "Electronic Technology",
    "industry": "Telecommunications Equipment",
    "country": "US"
  }
}
```

#### CLI

```bash
node skills/get-quote/index.js NASDAQ:AAPL
node skills/get-quote/index.js BINANCE:BTCUSDT
```

---

### get-technical-analysis

Get technical analysis recommendations across 8 timeframes.

**Transport:** HTTP (no auth required)

#### Function Signature

```js
getTechnicalAnalysis(symbol?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | `string` | `'BINANCE:BTCUSDT'` | Market symbol |

#### Returns

```json
{
  "success": true,
  "symbol": "NASDAQ:AAPL",
  "analysis": {
    "1": { "overall": "Sell", "movingAverages": "Strong Sell", "oscillators": "Neutral", "raw": { "Other": 0, "All": -0.934, "MA": -1.866 } },
    "5": { "overall": "Strong Sell", "movingAverages": "Strong Sell", "oscillators": "Sell", "raw": {} },
    "15": { "overall": "Sell", "movingAverages": "Strong Sell", "oscillators": "Neutral", "raw": {} },
    "60": { "overall": "Sell", "movingAverages": "Strong Sell", "oscillators": "Neutral", "raw": {} },
    "240": { "overall": "Sell", "movingAverages": "Strong Sell", "oscillators": "Sell", "raw": {} },
    "1D": { "overall": "Sell", "movingAverages": "Strong Sell", "oscillators": "Sell", "raw": {} },
    "1W": { "overall": "Sell", "movingAverages": "Buy", "oscillators": "Sell", "raw": {} },
    "1M": { "overall": "Buy", "movingAverages": "Strong Buy", "oscillators": "Buy", "raw": {} }
  }
}
```

Interpretation: `> 1` = Strong Buy, `> 0` = Buy, `< -1` = Strong Sell, `< 0` = Sell, `0` = Neutral

#### CLI

```bash
node skills/get-technical-analysis/index.js NASDAQ:AAPL
node skills/get-technical-analysis/index.js BINANCE:ETHUSDT
```

---

### search-market

Search for market symbols by keyword with optional category filter.

**Transport:** HTTP (no auth required)

#### Function Signature

```js
searchMarket(query?, options?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | `string` | `''` | Search keywords |
| `options.filter` | `string` | `''` | `'stock','futures','forex','cfd','crypto','index','economic'` |
| `options.offset` | `number` | `0` | Pagination offset |

#### Returns

```json
{
  "success": true,
  "message": "Found 50 markets for \"AAPL\"",
  "results": [
    { "id": "NASDAQ:AAPL", "symbol": "AAPL", "exchange": "NASDAQ", "description": "Apple Inc.", "type": "stock" }
  ],
  "count": 50
}
```

#### CLI

```bash
node skills/search-market/index.js "AAPL"
node skills/search-market/index.js "BTC" crypto
```

---

### get-market-info

Get comprehensive market metadata for a symbol.

**Transport:** WS

#### Function Signature

```js
getMarketInfo(symbol?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | `string` | `'BINANCE:BTCUSDT'` | Market symbol |

#### Returns

```json
{
  "success": true,
  "symbol": "BINANCE:BTCUSDT",
  "info": {
    "name": "BTCUSDT",
    "fullName": "BINANCE:BTCUSDT",
    "description": "Bitcoin / TetherUS",
    "exchange": "BINANCE",
    "listedExchange": "BINANCE",
    "type": "crypto",
    "currency": "USDT",
    "baseCurrency": "BTC",
    "timezone": "Etc/UTC",
    "session": "24x7",
    "priceScale": 100,
    "pointValue": 1,
    "minMove": 1,
    "hasIntraday": true,
    "isTradable": true,
    "isReplayable": true,
    "hasExtendedHours": false,
    "fractional": false
  }
}
```

#### CLI

```bash
node skills/get-market-info/index.js BINANCE:BTCUSDT
node skills/get-market-info/index.js NASDAQ:AAPL
```

---

### fetch-more-data

Fetch extended historical data beyond the initial candle range using `chart.fetchMore()`.

**Transport:** WS

#### Function Signature

```js
fetchMoreData(symbol?, options?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | `string` | `'BINANCE:BTCUSDT'` | Market symbol |
| `options.timeframe` | `string` | `'D'` | Timeframe |
| `options.initialRange` | `number` | `100` | Initial candle count |
| `options.additional` | `number` | `500` | Additional older candles to fetch |

#### Returns

```json
{
  "success": true,
  "message": "Fetched 600 total bars (100 initial + 500 additional)",
  "symbol": "BINANCE:BTCUSDT",
  "timeframe": "D",
  "initialBars": 100,
  "additionalBars": 500,
  "totalBars": 600,
  "bars": [ { "time": 1234567890, "open": 100, "high": 105, "low": 98, "close": 103, "volume": 5000 } ]
}
```

#### CLI

```bash
node skills/fetch-more-data/index.js BINANCE:BTCUSDT D 500
node skills/fetch-more-data/index.js NASDAQ:AAPL 60 1000
```

---

### replay-chart

Replay historical chart data from a specific timestamp, stepping through bars.

**Transport:** WS

#### Function Signature

```js
replayChart(symbol?, options?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | `string` | `'BINANCE:BTCUSDT'` | Market symbol |
| `options.timeframe` | `string` | `'D'` | Timeframe |
| `options.range` | `number` | `100` | Candles before replay point |
| `options.replayFrom` | `number` | **required** | Unix timestamp (seconds) to start replay |
| `options.steps` | `number` | `10` | Number of bars to step forward |

#### Returns

```json
{
  "success": true,
  "message": "Replayed 10 bars from 2024-01-01T00:00:00.000Z",
  "symbol": "BINANCE:BTCUSDT",
  "timeframe": "D",
  "replayFrom": 1704067200,
  "stepsCompleted": 10,
  "bars": [],
  "barCount": 110
}
```

#### CLI

```bash
# Replay 10 daily bars starting from 30 days ago
node skills/replay-chart/index.js BINANCE:BTCUSDT D 1704067200 10
```

---

## Chart Operations

### change-symbol

Change the chart's active symbol.

**Transport:** Hybrid (WS default)

#### Function Signature

```js
changeSymbol(pageOrSymbol, symbol?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pageOrSymbol` | `string \| Page` | — | Symbol string (WS) or Playwright Page (PW) |
| `symbol` | `string` | — | Symbol when first arg is a Page |

#### Returns

```json
{ "success": true, "message": "Symbol changed to BINANCE:ETHUSDT", "symbol": "BINANCE:ETHUSDT" }
```

#### CLI

```bash
node skills/change-symbol/index.js BINANCE:ETHUSDT
```

---

### change-timeframe

Change the chart timeframe.

**Transport:** Hybrid (WS default)

#### Function Signature

```js
changeTimeframe(pageOrTimeframe, timeframe?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pageOrTimeframe` | `string \| Page` | — | Timeframe string (WS) or Playwright Page (PW) |
| `timeframe` | `string` | `'5'` | Timeframe when first arg is a Page |

Supported timeframes: `'1','3','5','15','30','45','60','120','240','D','W','M'`

#### Returns

```json
{ "success": true, "message": "Timeframe changed to 15", "timeframe": "15" }
```

#### CLI

```bash
node skills/change-timeframe/index.js 15
node skills/change-timeframe/index.js D
```

---

### set-chart-type

Set chart type, price scale, timezone. Export data or take screenshots.

**Transport:** Hybrid (WS for custom chart types, PW for other operations)

#### Function Signatures

```js
setChartType(pageOrType, chartTypeOrSymbol?)   // Set chart type
setPriceScale(page, options?)                   // PW only
setTimezone(page, timezone?)                    // PW only
exportChartData(page, format?)                  // PW only
takeScreenshot(page, options?)                  // PW only
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pageOrType` | `string \| Page` | — | Chart type string (WS) or Page (PW) |
| `chartTypeOrSymbol` | `string` | — | Chart type for PW, symbol for WS |

WS chart types: `'HeikinAshi','Renko','LineBreak','Kagi','PointAndFigure','Range'`

PW chart types: `'Bars','Candles','Hollow candles','Line','Area','Baseline','Heikin Ashi','Renko','Line break','Kagi','Point & Figure','Range'`

#### CLI

```bash
node skills/set-chart-type/index.js chart-type "Heikin Ashi"
node skills/set-chart-type/index.js price-scale '{"logScale": true}'
node skills/set-chart-type/index.js timezone "America/New_York"
node skills/set-chart-type/index.js export CSV
node skills/set-chart-type/index.js screenshot '{"path": "./chart.png"}'
```

---

## Strategy Management

### add-strategy

Add a strategy from TradingView's strategy library to the chart.

**Transport:** PW

#### Function Signature

```js
addStrategy(page, strategyName?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `Page` | — | Playwright Page |
| `strategyName` | `string` | `'SMA Crossover'` | Strategy name to search |

#### Returns

```json
{ "success": true, "message": "Strategy \"RSI Strategy\" added", "strategyName": "RSI Strategy" }
```

#### CLI

```bash
node skills/add-strategy/index.js "RSI Strategy"
```

---

### get-active-strategy

List all strategies/indicators currently on the chart.

**Transport:** PW

#### Function Signature

```js
getActiveStrategy(page)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | `Page` | Playwright Page |

#### Returns

```json
{
  "success": true,
  "message": "Found 2 strategy/indicator(s) on chart",
  "strategies": [
    { "name": "RSI Strategy", "visible": true },
    { "name": "Volume", "visible": false }
  ],
  "activeStrategy": "RSI Strategy"
}
```

#### CLI

```bash
node skills/get-active-strategy/index.js
```

---

### get-strategy-report

Get a strategy's backtest report with performance metrics and trade list.

**Transport:** Hybrid (WS default)

#### Function Signature

```js
// WebSocket mode
getStrategyReport(scriptId, symbol, options?)

// Playwright mode
getStrategyReport(page, tab?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `scriptId` | `string` | — | Script ID (e.g. `'STD;RSI%1Strategy'`, `'PUB;xxxxx'`) |
| `symbol` | `string` | — | Market symbol |
| `options.timeframe` | `string` | `'D'` | Timeframe |
| `options.range` | `number` | `1000` | Candle range for backtest |
| `page` | `Page` | — | Playwright Page (PW mode) |
| `tab` | `string` | `'overview'` | `'overview','performance','tradeAnalysis','riskRatios','listOfTrades'` |

#### Returns (WS mode)

```json
{
  "success": true,
  "message": "Strategy report for STD;RSI%1Strategy on BINANCE:BTCUSDT",
  "report": {
    "performance": { "netProfit": 5234.50, "percentProfitable": 62.5, "profitFactor": 1.85, "maxDrawdown": -1200, "totalTrades": 48 },
    "trades": [ { "entry": {}, "exit": {}, "profit": 150 } ],
    "tradeCount": 48
  }
}
```

#### CLI

```bash
# WebSocket mode
node skills/get-strategy-report/index.js STD;RSI%1Strategy BINANCE:BTCUSDT D

# Playwright mode (launches browser)
node skills/get-strategy-report/index.js overview
```

---

### open-strategy-settings

Open a strategy's settings dialog and read its current parameter values.

**Transport:** PW

#### Function Signature

```js
openStrategySettings(page, strategyName?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `Page` | — | Playwright Page |
| `strategyName` | `string \| null` | `null` | Strategy name (first if null) |

#### Returns

```json
{ "success": true, "message": "Settings for RSI Strategy", "strategyName": "RSI Strategy", "settings": { "Length": "14", "Overbought": "70" } }
```

#### CLI

```bash
node skills/open-strategy-settings/index.js "RSI Strategy"
```

---

### create-strategy

Create a new Pine strategy from template or custom source code.

**Transport:** PW

#### Function Signature

```js
createStrategy(page, options?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `Page` | — | Playwright Page |
| `options.name` | `string` | `'My Strategy'` | Strategy name |
| `options.source` | `string \| null` | `null` | Pine Script source code |

#### CLI

```bash
node skills/create-strategy/index.js "My RSI Strategy"
node skills/create-strategy/index.js "My Strategy" ./path/to/strategy.pine
```

---

### save-strategy

Save a strategy to your TradingView profile.

**Transport:** PW

```js
saveStrategy(page, strategyName?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `Page` | — | Playwright Page |
| `strategyName` | `string \| null` | `null` | Strategy name |

#### CLI

```bash
node skills/save-strategy/index.js "My Strategy"
```

---

### remove-strategy

Remove strategy/strategies from the chart.

**Transport:** PW

```js
removeStrategy(page, strategyName?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `Page` | — | Playwright Page |
| `strategyName` | `string \| null` | `null` | Specific strategy, or all if null |

#### CLI

```bash
node skills/remove-strategy/index.js "RSI Strategy"
```

---

### delete-strategy

Delete a strategy permanently.

**Transport:** PW

```js
deleteStrategy(page, name?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `Page` | — | Playwright Page |
| `name` | `string \| null` | `null` | Strategy name (first if null) |

#### CLI

```bash
node skills/delete-strategy/index.js "Old Strategy"
```

---

### rename-strategy

Rename a strategy via its settings dialog.

**Transport:** PW

```js
renameStrategy(page, oldName, newName)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | `Page` | Playwright Page |
| `oldName` | `string` | Current name (**required**) |
| `newName` | `string` | New name (**required**) |

#### CLI

```bash
node skills/rename-strategy/index.js "Old Name" "New Name"
```

---

### clone-strategy

Copy, paste, or clone strategy settings.

**Transport:** PW

```js
copyStrategySettings(page, strategyName?)    // Returns settings object
pasteStrategySettings(page, strategyName?, settings?)  // Applies settings
cloneStrategy(page, sourceName, targetName?) // Copy from one, paste to another
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `Page` | — | Playwright Page |
| `strategyName` | `string \| null` | `null` | Strategy name |
| `settings` | `object` | `{}` | Key-value parameter settings |
| `sourceName` | `string` | — | Source strategy name |
| `targetName` | `string \| null` | `null` | Target strategy name |

#### CLI

```bash
node skills/clone-strategy/index.js copy "RSI Strategy"
node skills/clone-strategy/index.js paste "RSI Strategy" '{"Length": "21"}'
node skills/clone-strategy/index.js clone "Source Strategy" "Target Strategy"
```

---

## Indicators

### get-indicator-list

Search indicators via HTTP API, or add/remove/configure indicators via Playwright.

**Transport:** Hybrid (HTTP for search, PW for add/remove/settings)

#### Function Signatures

```js
getIndicatorList(pageOrQuery)                           // Search (HTTP) or list chart indicators (PW)
addIndicator(page, indicatorName?)                      // Add indicator to chart (PW)
addIndicatorFromSection(page, indicatorName, section?)  // Add from specific section (PW)
addFavoriteIndicator(page, indicatorName)               // Add from favorites (PW)
removeIndicator(page, indicatorName?)                   // Remove from chart (PW)
getIndicatorSettings(page, indicatorName?)              // Read settings (PW)
setIndicatorSettings(page, indicatorName?, settings?)   // Write settings (PW)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pageOrQuery` | `string \| Page` | — | Search query (HTTP) or Playwright Page |
| `indicatorName` | `string` | `'SMA'` | Indicator name |
| `section` | `string` | `'favorites'` | `'favorites','my-scripts','invite-only','purchased','technicals','fundamentals','editors-picks','top','trending','store'` |
| `settings` | `object` | `{}` | Key-value parameter settings |

#### Returns (search mode)

```json
{
  "success": true,
  "indicators": [
    { "id": "STD;RSI", "name": "Relative Strength Index", "author": "@TRADINGVIEW@", "type": "study", "access": "closed_source", "version": "45.0" }
  ],
  "count": 15
}
```

#### CLI

```bash
node skills/get-indicator-list/index.js search RSI
node skills/get-indicator-list/index.js add "MACD"
node skills/get-indicator-list/index.js remove "Volume"
node skills/get-indicator-list/index.js get-settings "RSI"
node skills/get-indicator-list/index.js set-settings "RSI" '{"RSI Length": "21"}'
```

---

### get-indicator-details

Get full metadata for an indicator: inputs, plots, defaults, options.

**Transport:** HTTP

#### Function Signature

```js
getIndicatorDetails(scriptId, options?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `scriptId` | `string` | — | Script ID (e.g. `'STD;RSI'`, `'PUB;xxxxx'`, `'USER;xxxxx'`) |
| `options.version` | `string` | `'last'` | Specific version or `'last'` |

#### Returns

```json
{
  "success": true,
  "indicator": {
    "id": "STD;RSI",
    "version": "45.0",
    "description": "Relative Strength Index",
    "shortDescription": "RSI",
    "inputs": [
      { "id": "in_0", "name": "RSI Length", "type": "integer", "value": 14, "isHidden": false },
      { "id": "in_1", "name": "Source", "type": "source", "value": "close", "options": ["open","high","low","close","hl2","hlc3","hlcc4","ohlc4"] }
    ],
    "plots": { "plot_0": "RSI", "plot_2": "RSIbased_MA" },
    "inputCount": 10,
    "plotCount": 14
  }
}
```

#### CLI

```bash
node skills/get-indicator-details/index.js STD;RSI
node skills/get-indicator-details/index.js "PUB;abc123"
```

---

### get-saved-scripts

List your private/saved Pine scripts.

**Transport:** Hybrid (HTTP default)

#### Function Signature

```js
getSavedScripts(pageOrNull?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pageOrNull` | `Page \| null` | `null` | Playwright Page for PW mode, null/omit for HTTP |

#### Returns

```json
{
  "success": true,
  "message": "Found 3 saved scripts",
  "scripts": [
    { "id": "USER;abc123", "name": "My RSI Strategy", "version": "1.0", "type": "strategy", "access": "private" }
  ],
  "count": 3
}
```

#### CLI

```bash
node skills/get-saved-scripts/index.js
```

---

## Alerts

### create-alert

Create a price alert with optional webhook.

**Transport:** PW

#### Function Signature

```js
createAlert(page, options?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `Page` | — | Playwright Page |
| `options.symbol` | `string` | `'NASDAQ:AAPL'` | Symbol |
| `options.condition` | `string` | `'Crosses above'` | Alert condition |
| `options.price` | `number` | `200` | Trigger price |
| `options.action` | `string` | `'Webhook URL'` | Alert action |
| `options.webhookUrl` | `string` | `''` | Webhook URL |

#### CLI

```bash
node skills/create-alert/index.js '{"symbol":"NASDAQ:AAPL","condition":"Crosses above","price":200}'
```

---

### view-alert

View, list, edit, or delete alerts.

**Transport:** PW

#### Function Signatures

```js
viewAlert(page, alertId?)
listAlerts(page)
editAlert(page, alertId, options?)
deleteAlert(page, alertId?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `Page` | — | Playwright Page |
| `alertId` | `string \| null` | `null` | Alert ID |
| `options` | `object` | `{}` | Fields to update |

#### CLI

```bash
node skills/view-alert/index.js list
node skills/view-alert/index.js view <alertId>
node skills/view-alert/index.js edit <alertId>
node skills/view-alert/index.js delete <alertId>
```

---

## Watchlists

### get-watchlist-symbols

Read symbols from a watchlist with current prices and changes.

**Transport:** PW

```js
getWatchlistSymbols(page, watchlistName?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `Page` | — | Playwright Page |
| `watchlistName` | `string \| null` | `null` | Watchlist name (active if null) |

#### CLI

```bash
node skills/get-watchlist-symbols/index.js "My Watchlist"
```

---

### create-watchlist

Create a new watchlist.

**Transport:** PW

```js
createWatchlist(page, name?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `Page` | — | Playwright Page |
| `name` | `string` | `'My Watchlist'` | Watchlist name |

#### CLI

```bash
node skills/create-watchlist/index.js "Crypto Watchlist"
```

---

### add-to-watchlist

Add a symbol to a watchlist.

**Transport:** PW

```js
addToWatchlist(page, symbol?, watchlistName?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `Page` | — | Playwright Page |
| `symbol` | `string` | `'NASDAQ:AAPL'` | Symbol to add |
| `watchlistName` | `string \| null` | `null` | Target watchlist |

#### CLI

```bash
node skills/add-to-watchlist/index.js BINANCE:BTCUSDT "Crypto Watchlist"
```

---

### delete-watchlist

Delete a watchlist.

**Transport:** PW

```js
deleteWatchlist(page, name)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | `Page` | Playwright Page |
| `name` | `string` | Watchlist name (**required**) |

#### CLI

```bash
node skills/delete-watchlist/index.js "Old Watchlist"
```

---

## Drawings

### get-drawing-list

Manage chart drawings via browser automation.

**Transport:** PW

```js
getDrawingList(page)
addDrawing(page, drawingType?)
removeDrawing(page, drawingId?)
setDrawingProperties(page, properties?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `Page` | — | Playwright Page |
| `drawingType` | `string` | `'Trend Line'` | Drawing tool name |
| `drawingId` | `string \| null` | `null` | Drawing ID |
| `properties` | `object` | `{}` | `{ color?, width? }` |

#### CLI

```bash
node skills/get-drawing-list/index.js list
node skills/get-drawing-list/index.js add "Horizontal Line"
node skills/get-drawing-list/index.js remove
```

---

### get-chart-drawings

Get drawings from a saved TradingView layout via HTTP API.

**Transport:** HTTP

```js
getChartDrawings(layoutId, options?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `layoutId` | `string` | — | Layout ID from chart URL (**required**) |
| `options.symbol` | `string` | `''` | Filter by symbol |
| `options.chartId` | `string` | `'_shared'` | Chart ID within layout |

#### Returns

```json
{
  "success": true,
  "message": "Found 5 drawing(s) in layout abc123",
  "drawings": [
    { "id": "xyz789", "type": "LineToolTrendLine", "symbol": "BINANCE:BTCUSDT", "points": [{ "time_t": 1234567890, "price": 50000 }] }
  ],
  "count": 5
}
```

#### CLI

```bash
node skills/get-chart-drawings/index.js abc123
node skills/get-chart-drawings/index.js abc123 BINANCE:BTCUSDT
```

---

## Account

### get-user-info

Get the authenticated user's profile information, including membership/plan level and account limits.

**Transport:** HTTP

```js
getUserInfo()
```

No parameters — uses credentials from cookies/env.

#### Returns

```json
{
  "success": true,
  "user": {
    "id": "12345",
    "username": "myuser",
    "firstName": "John",
    "lastName": "Doe",
    "reputation": 42,
    "following": 10,
    "followers": 5,
    "notifications": { "following": 0, "user": 2 },
    "authToken": "...",
    "joinDate": "2023-01-15T00:00:00.000Z",
    "plan": "free",
    "planName": "Free / Basic",
    "proStatus": "non_pro",
    "isPro": false,
    "limits": {
      "maxStudies": 2,
      "maxCharts": 1,
      "maxActiveAlerts": 3,
      "maxStudyOnStudy": 1,
      "watchlistSymbolsLimit": 30,
      "maxConnections": 2,
      "extendedHours": true
    }
  }
}
```

**Plan values:** `"free"`, `"pro"` (Pro), `"pro_plus"` (Pro+), `"pro_premium"` (Premium), `"trial"` (Trial)

#### CLI

```bash
node skills/get-user-info/index.js
```

---

### manage-pine-permissions

Manage invite-only Pine script access. Add, remove, list, or modify user permissions.

**Transport:** HTTP

```js
managePinePermissions(action?, pineId, options?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `action` | `string` | `'list'` | `'list','add','modify','remove'` |
| `pineId` | `string` | — | Script ID (**required**, e.g. `'PUB;abc123'`) |
| `options.username` | `string` | — | Username (required for add/modify/remove) |
| `options.expiration` | `string` | `null` | Expiration date ISO string |
| `options.limit` | `number` | `50` | Max users to return (list) |
| `options.order` | `string` | `'-created'` | Sort order (list) |

#### Returns (list)

```json
{
  "success": true,
  "message": "Found 3 authorized user(s) for PUB;abc123",
  "pineId": "PUB;abc123",
  "users": [
    { "id": 1, "username": "trader1", "userpic": "...", "expiration": null, "created": "2024-01-01" }
  ],
  "count": 3
}
```

#### CLI

```bash
node skills/manage-pine-permissions/index.js list "PUB;abc123"
node skills/manage-pine-permissions/index.js add "PUB;abc123" "username" "2025-12-31"
node skills/manage-pine-permissions/index.js remove "PUB;abc123" "username"
```
