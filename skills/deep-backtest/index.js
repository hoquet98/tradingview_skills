const { fetchDeepBacktest, close } = require('../../lib/ws-client');

/**
 * Run a deep backtest over a custom date range.
 * Uses TradingView's history-data server (Premium only).
 * Supports up to 2 million bars and 1 million trades.
 *
 * @param {string} scriptId - Script ID (e.g. 'STD;RSI%1Strategy' or 'USER;abc123')
 * @param {string} symbol - Market symbol (e.g. 'CME_MINI:NQ1!')
 * @param {Object} [options]
 * @param {string} [options.timeframe='D'] - Timeframe: '1','5','15','60','240','D','W','M'
 * @param {string|number} [options.from] - Start date as 'YYYY-MM-DD' or unix timestamp
 * @param {string|number} [options.to] - End date as 'YYYY-MM-DD' or unix timestamp
 * @param {Object} [options.params] - Strategy parameter overrides { "paramName": value }
 * @returns {Promise<{success:boolean, message:string, report?:Object}>}
 */
async function deepBacktest(scriptId, symbol = 'BINANCE:BTCUSDT', options = {}) {
  const { timeframe = 'D', params } = options;

  // Parse date strings to unix timestamps
  // 'to' dates use end-of-day (23:59:59) to match TradingView's date picker behavior
  let from = options.from;
  let to = options.to;
  if (typeof from === 'string') from = Math.floor(new Date(from).getTime() / 1000);
  if (typeof to === 'string') {
    const d = new Date(to);
    d.setUTCHours(23, 59, 59, 0);
    to = Math.floor(d.getTime() / 1000);
  }

  try {
    const report = await fetchDeepBacktest(scriptId, symbol, { timeframe, from, to, params });

    return {
      success: true,
      message: `Deep backtest completed: ${report.trades?.length || 0} trades`,
      report: {
        performance: report.performance || {},
        trades: report.trades || [],
        tradeCount: report.trades ? report.trades.length : 0,
        history: report.history || {},
        currency: report.currency || '',
        settings: report.settings || {},
      },
    };
  } catch (error) {
    return { success: false, message: 'Error running deep backtest', error: error.message };
  }
}

async function main() {
  const scriptId = process.argv[2];
  const symbol = process.argv[3] || 'BINANCE:BTCUSDT';
  const timeframe = process.argv[4] || 'D';
  const from = process.argv[5];
  const to = process.argv[6];
  const paramsJson = process.argv[7];

  if (!scriptId) {
    console.log(JSON.stringify({
      success: false,
      message: 'Usage: node index.js <scriptId> [symbol] [timeframe] [from] [to] [paramsJson]\n' +
        '  Example: node index.js STD;RSI%1Strategy CME_MINI:NQ1! 1 2025-01-01 2025-02-17\n' +
        '  Dates: YYYY-MM-DD or unix timestamp. Premium plan required.',
    }, null, 2));
    return;
  }

  const options = { timeframe };
  if (from) options.from = from;
  if (to) options.to = to;
  if (paramsJson) options.params = JSON.parse(paramsJson);

  try {
    const result = await deepBacktest(scriptId, symbol, options);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await close();
  }
}

module.exports = { deepBacktest };
if (require.main === module) main();
