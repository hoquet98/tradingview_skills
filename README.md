# TradingView Skills

A Node.js automation library for TradingView. 35 skills that cover chart operations, strategy management, indicators, alerts, watchlists, market data, and more.

Skills run via **WebSocket** (fast, headless) or **Playwright** (browser automation) depending on the operation. Callers don't need to know which transport is used — the library picks the best one automatically.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Export Your Cookies

Install the [GetCookies](https://chromewebstore.google.com/detail/getcookies/bgaddhkoddajcdgocldbbfleckgcbcid) browser extension, then:

1. Log in to [TradingView](https://www.tradingview.com)
2. Click the GetCookies extension icon on the TradingView page
3. Click **Export** — saves `www.tradingview.com_cookies.json`
4. Move that file into this project's root directory

### 3. Convert Cookies

```bash
node scripts/convert-cookies.js
```

This auto-detects `www.tradingview.com_cookies.json` in the project root and creates `cookies.json` (Playwright format). Both files are used:

- **`cookies.json`** — Playwright skills (browser automation)
- **`www.tradingview.com_cookies.json`** — WebSocket/HTTP skills read this directly as fallback

> **Note:** If you only plan to use WebSocket/HTTP API skills, you can skip the convert step — they read the raw GetCookies file directly.

### 4. Use the Skills

**As a library:**

```js
const tv = require('./index');

// WebSocket — fast, no browser
const data = await tv.getChartData('BINANCE:BTCUSDT', { timeframe: 'D', count: 100 });
const quote = await tv.getQuote('NASDAQ:AAPL');
const ta = await tv.getTechnicalAnalysis('NASDAQ:AAPL');

// Playwright — browser automation
const { browser, page } = await tv.launchBrowser();
await tv.openChart(page);
await tv.addStrategy(page, 'RSI Strategy');
const report = await tv.getStrategyReport(page, 'overview');
await tv.closeBrowser(browser);
```

**From the command line:**

```bash
# No browser needed
node skills/get-chart-data/index.js BINANCE:BTCUSDT D 100
node skills/get-quote/index.js NASDAQ:AAPL
node skills/search-market/index.js "AAPL" stock
node skills/get-technical-analysis/index.js NASDAQ:AAPL

# Browser automation
node skills/add-strategy/index.js "RSI Strategy"
node skills/get-strategy-report/index.js STD;RSI%1Strategy BINANCE:BTCUSDT D
```

## Authentication

Credentials are resolved in this order:

| Priority | Source | Used By |
|----------|--------|---------|
| 1 | `TV_SESSION` / `TV_SIGNATURE` env vars | WebSocket & HTTP skills |
| 2 | `TV_COOKIES_PATH` env var (custom path) | WebSocket & HTTP skills |
| 3 | `cookies.json` (Playwright format) | All skills |
| 4 | `www.tradingview.com_cookies.json` (GetCookies raw) | WebSocket & HTTP skills |

For most users: just drop the GetCookies export in the root and run `node scripts/convert-cookies.js`.

## Skill Categories

### WebSocket / HTTP API (no browser needed)

These skills are fast (~100ms) and run headless. No Playwright or browser required.

| Skill | What It Does |
|-------|-------------|
| [get-chart-data](docs/skills-reference.md#get-chart-data) | Fetch OHLCV candle data |
| [get-quote](docs/skills-reference.md#get-quote) | Real-time quote with fundamentals |
| [get-technical-analysis](docs/skills-reference.md#get-technical-analysis) | TA recommendations across 8 timeframes |
| [search-market](docs/skills-reference.md#search-market) | Search symbols by keyword |
| [get-market-info](docs/skills-reference.md#get-market-info) | Symbol metadata (exchange, session, currency) |
| [get-indicator-details](docs/skills-reference.md#get-indicator-details) | Indicator inputs, plots, defaults |
| [get-saved-scripts](docs/skills-reference.md#get-saved-scripts) | List your private Pine scripts |
| [get-user-info](docs/skills-reference.md#get-user-info) | Authenticated user profile |
| [get-chart-drawings](docs/skills-reference.md#get-chart-drawings) | Drawings from saved layouts |
| [manage-pine-permissions](docs/skills-reference.md#manage-pine-permissions) | Manage invite-only script access |
| [fetch-more-data](docs/skills-reference.md#fetch-more-data) | Load extended historical candles |
| [replay-chart](docs/skills-reference.md#replay-chart) | Replay historical data bar-by-bar |
| [change-symbol](docs/skills-reference.md#change-symbol) | Change chart symbol |
| [change-timeframe](docs/skills-reference.md#change-timeframe) | Change chart timeframe |
| [get-strategy-report](docs/skills-reference.md#get-strategy-report) | Strategy backtest report |
| [set-chart-type](docs/skills-reference.md#set-chart-type) | Set custom chart types (Heikin Ashi, Renko, etc.) |

### Playwright (browser automation)

These skills automate the TradingView UI. They require a browser session.

| Skill | What It Does |
|-------|-------------|
| [add-strategy](docs/skills-reference.md#add-strategy) | Add a strategy from the library |
| [create-strategy](docs/skills-reference.md#create-strategy) | Create a new Pine strategy |
| [save-strategy](docs/skills-reference.md#save-strategy) | Save strategy to your profile |
| [remove-strategy](docs/skills-reference.md#remove-strategy) | Remove strategy from chart |
| [delete-strategy](docs/skills-reference.md#delete-strategy) | Delete strategy permanently |
| [rename-strategy](docs/skills-reference.md#rename-strategy) | Rename a strategy |
| [clone-strategy](docs/skills-reference.md#clone-strategy) | Copy/paste strategy settings |
| [open-strategy-settings](docs/skills-reference.md#open-strategy-settings) | Read strategy parameters |
| [get-active-strategy](docs/skills-reference.md#get-active-strategy) | List strategies on chart |
| [get-indicator-list](docs/skills-reference.md#get-indicator-list) | Add/remove/configure/browse indicators |
| [create-alert](docs/skills-reference.md#create-alert) | Create price alerts |
| [view-alert](docs/skills-reference.md#view-alert) | View/list/edit/delete alerts |
| [get-alert-log](docs/skills-reference.md#get-alert-log) | Alert firing history by days |
| [get-watchlist-symbols](docs/skills-reference.md#get-watchlist-symbols) | Read watchlist symbols |
| [create-watchlist](docs/skills-reference.md#create-watchlist) | Create a watchlist |
| [add-to-watchlist](docs/skills-reference.md#add-to-watchlist) | Add symbol to watchlist |
| [delete-watchlist](docs/skills-reference.md#delete-watchlist) | Delete a watchlist |
| [get-drawing-list](docs/skills-reference.md#get-drawing-list) | Manage chart drawings |

## Workflows

Pre-built scripts that combine multiple skills for common tasks. Run directly from the command line:

```bash
# Market Data
node workflows/market-research.js "AAPL"                    # Full research report
node workflows/portfolio-monitor.js NASDAQ:AAPL,BINANCE:BTCUSDT  # Batch quotes + TA
node workflows/data-export.js BINANCE:BTCUSDT D 500 csv     # Export to CSV

# Strategy Analysis
node workflows/get-strategy-params.js "RSI Strategy"         # Get params + defaults
node workflows/validate-strategy.js "STD;RSI%1Strategy"      # Test compilation
node workflows/load-strategy.js "STD;RSI%1Strategy" BINANCE:BTCUSDT D '{"Length":21}'
node workflows/strategy-backtest.js "STD;RSI%1Strategy" BINANCE:BTCUSDT D
node workflows/optimize-strategy.js "STD;RSI%1Strategy" BINANCE:BTCUSDT D '{"Length":[7,14,21]}'

# Indicators & Scripts
node workflows/indicator-analysis.js "MACD"                  # Search + inspect
node workflows/script-management.js                          # List your scripts

# Chart (Playwright)
node workflows/chart-setup.js BINANCE:BTCUSDT 240 "Heikin Ashi" RSI,MACD
node workflows/save-chart-layout.js "RSI Strategy" BINANCE:BTCUSDT D
```

See [docs/workflows.md](docs/workflows.md) for full details and module usage.

## Documentation

- **[Skills Reference](docs/skills-reference.md)** — Complete API reference for all 35 skills with parameters, return types, and examples
- **[Workflows](docs/workflows.md)** — 12 runnable workflow scripts with CLI and module usage

## Project Structure

```
TradingView Skills/
  index.js                  # Master export (65 functions)
  cookies.json              # Playwright-format cookies (generated)
  www.tradingview.com_cookies.json  # Raw GetCookies export (user drops here)
  package.json
  lib/
    browser.js              # Playwright launch/navigate helpers
    chart-utils.js          # Chart utility functions
    ws-client.js            # WebSocket client singleton + auth
  scripts/
    convert-cookies.js      # Cookie format converter
  skills/
    get-chart-data/         # Each skill is a directory with index.js
    get-quote/
    ...35 total
  workflows/
    market-research.js      # Search + quote + TA + metadata
    strategy-backtest.js    # Multi-symbol/timeframe backtesting
    get-strategy-params.js  # Get strategy parameters + defaults
    validate-strategy.js    # Test if script compiles
    load-strategy.js        # Load strategy with custom params
    optimize-strategy.js    # Parameter sweep optimization
    save-chart-layout.js    # Save chart with strategy (Playwright)
    indicator-analysis.js   # Search + inspect indicators
    portfolio-monitor.js    # Batch quotes + TA
    script-management.js    # List/inspect/permissions
    chart-setup.js          # Full chart configuration (Playwright)
    data-export.js          # Export OHLCV to CSV/JSON
  tradingview-api-reference/  # WebSocket API library (Mathieu2301/TradingView-API)
  docs/
    skills-reference.md     # Full API reference
    workflows.md            # Workflow documentation
```

## Refreshing Cookies

TradingView session cookies expire periodically. When you see authentication errors:

1. Log in to TradingView in your browser
2. Re-export cookies with GetCookies
3. Replace `www.tradingview.com_cookies.json` in the project root
4. Run `node scripts/convert-cookies.js`
