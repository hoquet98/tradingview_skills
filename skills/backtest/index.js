const { backtest: runBacktest } = require('../../lib/backtest');
const { getStrategyParams } = require('../../lib/params');
const { close } = require('../../lib/ws-client');

/**
 * Unified backtest skill. Auto-routes between regular and deep backtest
 * based on range preset.
 *
 * @param {string} scriptId - Strategy ID (e.g. 'STD;RSI%1Strategy' or 'USER;abc123')
 * @param {string} [symbol='BINANCE:BTCUSDT'] - Market symbol
 * @param {Object} [options]
 * @param {string} [options.timeframe='D'] - Timeframe: '1','5','15','60','240','D','W','M'
 * @param {string|number|Object} [options.range='chart'] - Range preset:
 *   "chart"  — matches TradingView UI default (plan-based bar limit)
 *   "7d"     — last 7 calendar days
 *   "30d"    — last 30 calendar days
 *   "90d"    — last 90 calendar days
 *   "365d"   — last 365 calendar days
 *   "max"    — all available history (deep backtest, Premium only)
 *   { from: "YYYY-MM-DD", to: "YYYY-MM-DD" } — custom date range (deep backtest, Premium only)
 *   1000     — raw bar count (backward compat)
 * @param {Object} [options.params] - Strategy parameter overrides (any key format: name, inline, in_X)
 * @returns {Promise<{success:boolean, message:string, mode?:string, report?:Object}>}
 */
async function backtest(scriptId, symbol, options) {
  return runBacktest(scriptId, symbol, options);
}

async function main() {
  const scriptId = process.argv[2];
  const symbol = process.argv[3] || 'BINANCE:BTCUSDT';
  const timeframe = process.argv[4] || 'D';
  const range = process.argv[5] || 'chart';
  const paramsJson = process.argv[6];

  if (!scriptId) {
    console.log(JSON.stringify({
      success: false,
      message: 'Usage: node index.js <scriptId> [symbol] [timeframe] [range] [paramsJson]\n' +
        '  Range presets: "chart", "7d", "30d", "90d", "365d", "max"\n' +
        '  Date range:    \'{"from":"2025-01-01","to":"2025-06-01"}\'\n' +
        '  Raw bars:      1000\n' +
        '  Example: node index.js STD;RSI%1Strategy CME_MINI:NQ1! 1 chart',
    }, null, 2));
    return;
  }

  // Parse range: try JSON object first (for date ranges), then use as string/number
  let parsedRange = range;
  if (range.startsWith('{')) {
    try { parsedRange = JSON.parse(range); } catch (e) { /* use as string */ }
  } else if (/^\d+$/.test(range)) {
    parsedRange = parseInt(range, 10);
  }

  const options = { timeframe, range: parsedRange };
  if (paramsJson) options.params = JSON.parse(paramsJson);

  try {
    const result = await backtest(scriptId, symbol, options);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await close();
  }
}

module.exports = { backtest, getStrategyParams };
if (require.main === module) main();
