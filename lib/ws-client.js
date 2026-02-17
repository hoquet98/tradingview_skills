const TradingView = require('../tradingview-api-reference/main');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DEFAULT_COOKIES_PATH = path.join(ROOT_DIR, 'cookies.json');
const RAW_COOKIES_PATH = path.join(ROOT_DIR, 'www.tradingview.com_cookies.json');

let _client = null;
let _clientReady = null;

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
function getClient() {
  if (_client && _client.isOpen) return _clientReady;

  const { session, signature } = getCredentials();
  _client = new TradingView.Client({ token: session, signature });

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
 * @returns {Promise<import('../tradingview-api-reference/src/chart/study').StrategyReport>}
 */
async function fetchStrategyReport(scriptId, symbol, options = {}) {
  const { timeframe = 'D', range = 1000 } = options;
  const { session, signature } = getCredentials();

  const indicator = await TradingView.getIndicator(scriptId, 'last', session, signature);
  indicator.setType('StrategyScript@tv-scripting-101!');

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
  fetchChartData,
  fetchStrategyReport,
  close,
  TradingView,
};
