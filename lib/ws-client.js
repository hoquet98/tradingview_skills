const TradingView = require('../tradingview-api-reference/main');
const fs = require('fs');
const path = require('path');
const { applyParams } = require('./params');

const ROOT_DIR = path.join(__dirname, '..');
const DEFAULT_COOKIES_PATH = path.join(ROOT_DIR, 'cookies.json');
const RAW_COOKIES_PATH = path.join(ROOT_DIR, 'www.tradingview.com_cookies.json');

let _client = null;
let _clientReady = null;

/** Pro plans that should use the prodata server */
const PRO_PLANS = new Set(['pro', 'pro_plus', 'pro_premium', 'trial']);

/**
 * Detect user plan from session cookies and return the appropriate WS server.
 * Pro/Premium/Pro+ → 'prodata', free → 'data'.
 */
async function detectServer(session, signature) {
  try {
    const user = await TradingView.getUser(session, signature);
    if (user.authToken) {
      const payload = JSON.parse(
        Buffer.from(user.authToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
      );
      if (PRO_PLANS.has(payload.plan)) return 'prodata';
    }
  } catch (e) {
    // Fall through to default
  }
  return 'data';
}

/**
 * Extract sessionid + sessionid_sign from any cookie array (Playwright or GetCookies format).
 * Both formats use {name, value} — the only difference is expiry field names.
 */
function extractSessionFromCookies(cookiesPath) {
  if (!fs.existsSync(cookiesPath)) return null;
  const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
  const sessionCookie = cookies.find(c => c.name === 'sessionid');
  const signCookie = cookies.find(c => c.name === 'sessionid_sign');
  if (sessionCookie && sessionCookie.value) {
    return { session: sessionCookie.value, signature: signCookie?.value || '' };
  }
  return null;
}

/**
 * Get TradingView session credentials.
 * Priority: env vars → cookies.json (Playwright) → www.tradingview.com_cookies.json (GetCookies raw)
 */
function getCredentials() {
  // 1. Env vars
  if (process.env.TV_SESSION) {
    return { session: process.env.TV_SESSION, signature: process.env.TV_SIGNATURE || '' };
  }

  // 2. Custom path via env
  if (process.env.TV_COOKIES_PATH) {
    const creds = extractSessionFromCookies(process.env.TV_COOKIES_PATH);
    if (creds) return creds;
  }

  // 3. Converted cookies.json (Playwright format)
  const creds = extractSessionFromCookies(DEFAULT_COOKIES_PATH);
  if (creds) return creds;

  // 4. Raw GetCookies export (www.tradingview.com_cookies.json)
  const rawCreds = extractSessionFromCookies(RAW_COOKIES_PATH);
  if (rawCreds) return rawCreds;

  throw new Error(
    'TradingView credentials not found.\n' +
    'Drop your GetCookies export as www.tradingview.com_cookies.json in the project root,\n' +
    'or set TV_SESSION/TV_SIGNATURE env vars.'
  );
}

/**
 * Get or create an authenticated WebSocket client.
 * Returns a promise that resolves when the client is logged in.
 * @returns {Promise<InstanceType<typeof TradingView.Client>>}
 */
async function getClient() {
  if (_client && _client.isOpen) return _clientReady;

  const { session, signature } = getCredentials();
  const server = await detectServer(session, signature);
  _client = new TradingView.Client({ token: session, signature, server });

  _clientReady = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('WebSocket client login timed out (10s)'));
    }, 10000);

    _client.onLogged(() => {
      clearTimeout(timeout);
      resolve(_client);
    });

    _client.onError((...err) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket client error: ${err.join(' ')}`));
    });
  });

  return _clientReady;
}

/**
 * Fetch OHLCV chart data via WebSocket.
 * @param {string} symbol - e.g. 'BINANCE:BTCUSDT'
 * @param {Object} [options]
 * @param {string} [options.timeframe='D'] - Timeframe: '1','5','15','60','240','D','W','M'
 * @param {number} [options.range=100] - Number of candles
 * @returns {Promise<Array<{time:number,open:number,high:number,low:number,close:number,volume:number}>>}
 */
async function fetchChartData(symbol, options = {}) {
  const { timeframe = 'D', range = 100 } = options;
  const client = await getClient();

  return new Promise((resolve, reject) => {
    const chart = new client.Session.Chart();
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        chart.delete();
        reject(new Error('Chart data fetch timed out (15s)'));
      }
    }, 15000);

    chart.onError((...err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        chart.delete();
        reject(new Error(`Chart error: ${err.join(' ')}`));
      }
    });

    chart.onUpdate(() => {
      if (resolved) return;
      if (chart.periods.length > 0) {
        resolved = true;
        clearTimeout(timeout);
        const data = chart.periods.map(p => ({
          time: p.time,
          open: p.open,
          high: p.max,
          low: p.min,
          close: p.close,
          volume: p.volume,
        }));
        chart.delete();
        resolve(data);
      }
    });

    chart.setMarket(symbol, { timeframe, range });
  });
}

/**
 * Fetch strategy report via WebSocket by loading an indicator as a Study.
 * @param {string} scriptId - e.g. 'PUB;xxxxx' or 'STD;xxx'
 * @param {string} symbol - e.g. 'BINANCE:BTCUSDT'
 * @param {Object} [options]
 * @param {string} [options.timeframe='D']
 * @param {number} [options.range=1000]
 * @param {Object} [options.params] - Strategy parameter overrides { "paramName": value }
 * @returns {Promise<import('../tradingview-api-reference/src/chart/study').StrategyReport>}
 */
async function fetchStrategyReport(scriptId, symbol, options = {}) {
  const { timeframe = 'D', range = 1000, params } = options;
  const { session, signature } = getCredentials();

  const indicator = await TradingView.getIndicator(scriptId, 'last', session, signature);
  indicator.setType('StrategyScript@tv-scripting-101!');

  applyParams(indicator, params);

  const client = await getClient();

  return new Promise((resolve, reject) => {
    const chart = new client.Session.Chart();
    let study;
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        chart.delete();
        reject(new Error('Strategy report fetch timed out (30s)'));
      }
    }, 30000);

    chart.onError((...err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        chart.delete();
        reject(new Error(`Chart error: ${err.join(' ')}`));
      }
    });

    chart.onUpdate(() => {
      if (resolved || !study) return;
      const report = study.strategyReport;
      if (report && report.trades && report.trades.length > 0) {
        resolved = true;
        clearTimeout(timeout);
        chart.delete();
        resolve(report);
      }
    });

    chart.setMarket(symbol, { timeframe, range });

    chart.onSymbolLoaded(() => {
      study = new chart.Study(indicator);
      study.onError((...err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          chart.delete();
          reject(new Error(`Study error: ${err.join(' ')}`));
        }
      });
    });
  });
}

/**
 * Run a deep backtest via the history-data server.
 * Supports backtesting over any date range (up to 2M bars). Premium only.
 * @param {string} scriptId - e.g. 'PUB;xxxxx' or 'STD;xxx'
 * @param {string} symbol - e.g. 'BINANCE:BTCUSDT'
 * @param {Object} [options]
 * @param {string} [options.timeframe='D'] - Timeframe
 * @param {number} [options.from] - Start timestamp (unix seconds). Default: 2010-01-01
 * @param {number} [options.to] - End timestamp (unix seconds). Default: now
 * @param {Object} [options.params] - Strategy parameter overrides { "paramName": value }
 * @returns {Promise<import('../tradingview-api-reference/src/chart/study').StrategyReport>}
 */
async function fetchDeepBacktest(scriptId, symbol, options = {}) {
  const { timeframe = 'D', from, to, params } = options;
  const { session, signature } = getCredentials();

  const indicator = await TradingView.getIndicator(scriptId, 'last', session, signature);
  indicator.setType('StrategyScript@tv-scripting-101!');

  applyParams(indicator, params);

  // Deep backtesting uses a dedicated history-data server
  const historyClient = new TradingView.Client({ token: session, signature, server: 'history-data' });

  return new Promise((resolve, reject) => {
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        history.delete();
        historyClient.end();
        reject(new Error('Deep backtest timed out (120s)'));
      }
    }, 120000);

    historyClient.onError((...err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        historyClient.end();
        reject(new Error(`History client error: ${err.join(' ')}`));
      }
    });

    const history = new historyClient.Session.History();

    history.onError((...err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        history.delete();
        historyClient.end();
        reject(new Error(`Deep backtest error: ${err.join(' ')}`));
      }
    });

    history.onHistoryLoaded((changes) => {
      if (resolved) return;
      const report = history.strategyReport;
      if (report && report.trades && report.trades.length > 0) {
        resolved = true;
        clearTimeout(timeout);
        history.delete();
        historyClient.end();
        resolve(report);
      }
    });

    // Wait for client to be logged in before requesting data
    historyClient.onLogged(() => {
      history.requestHistoryData(symbol, indicator, {
        timeframe,
        from: from || Math.floor(new Date(2010, 1, 1) / 1000),
        to: to || Math.floor(Date.now() / 1000),
      });
    });
  });
}

/**
 * Detect the user's TradingView plan from JWT.
 * Returns the raw plan string: '', 'pro', 'pro_plus', 'pro_premium', 'trial'.
 * Cached after first call.
 * @returns {Promise<string>}
 */
let _cachedPlan = null;
async function detectPlan() {
  if (_cachedPlan !== null) return _cachedPlan;
  try {
    const { session, signature } = getCredentials();
    const user = await TradingView.getUser(session, signature);
    if (user.authToken) {
      const payload = JSON.parse(
        Buffer.from(user.authToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
      );
      _cachedPlan = payload.plan || '';
      return _cachedPlan;
    }
  } catch (e) {
    // Fall through to default
  }
  _cachedPlan = '';
  return _cachedPlan;
}

/**
 * Close the WebSocket client gracefully.
 */
async function close() {
  if (_client) {
    await _client.end();
    _client = null;
    _clientReady = null;
  }
}

module.exports = {
  getClient,
  getCredentials,
  detectPlan,
  fetchChartData,
  fetchStrategyReport,
  fetchDeepBacktest,
  close,
  TradingView,
};
