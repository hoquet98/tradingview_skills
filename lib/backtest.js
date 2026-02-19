/**
 * Unified backtest wrapper with range presets and auto-routing.
 * Routes between regular backtest (get-strategy-report) and deep backtest
 * based on the range preset.
 */

const { fetchStrategyReport, fetchDeepBacktest, detectPlan, close } = require('./ws-client');

/** Plan-based default bar limits matching TradingView's "range from chart" behavior */
const PLAN_BAR_LIMITS = {
  '': 5000,             // Free
  'pro': 10000,         // Pro
  'trial': 10000,       // Trial
  'pro_plus': 10000,    // Pro+
  'pro_premium': 20000, // Premium
};

/**
 * Convert a timeframe string to minutes.
 * @param {string} tf - e.g. '1', '5', '15', '60', '240', 'D', 'W', 'M'
 * @returns {number}
 */
function timeframeToMinutes(tf) {
  const map = {
    '1': 1, '3': 3, '5': 5, '10': 10, '15': 15, '30': 30,
    '45': 45, '60': 60, '120': 120, '180': 180, '240': 240,
    '480': 480,
    'D': 1440, '1D': 1440,
    'W': 10080, '1W': 10080,
    'M': 43200, '1M': 43200,
  };
  return map[tf] || parseInt(tf, 10) || 1440;
}

/**
 * Convert calendar days to estimated bar count for a given timeframe.
 * Defaults to futures-style market hours (23.8h/day, 5 trading days/week).
 *
 * @param {number} days - Calendar days
 * @param {string} timeframe - Chart timeframe
 * @returns {number} Estimated bar count
 */
function daysToBars(days, timeframe) {
  const tfMinutes = timeframeToMinutes(timeframe);

  if (tfMinutes >= 1440) {
    // Daily or higher: ~5 trading days per 7 calendar days
    const tradingDays = Math.ceil(days * 5 / 7);
    return Math.ceil(tradingDays * (1440 / tfMinutes));
  }

  // Intraday: 23.8 trading hours/day, 5 trading days/week (futures)
  const tradingDays = Math.ceil(days * 5 / 7);
  const minutesPerDay = 23.8 * 60;
  return Math.ceil(tradingDays * minutesPerDay / tfMinutes);
}

/**
 * Parse a range preset into routing instructions.
 *
 * @param {string|number|{from:string,to:string}} range - Range preset or date range
 * @param {string} timeframe - Chart timeframe
 * @param {string} plan - User plan string from detectPlan()
 * @returns {{ mode: 'regular', bars: number } | { mode: 'deep', from?: number, to?: number }}
 */
function parseRange(range, timeframe, plan) {
  // Custom date range object → deep backtest
  if (typeof range === 'object' && range !== null && range.from) {
    let from = range.from;
    let to = range.to;
    if (typeof from === 'string') from = Math.floor(new Date(from).getTime() / 1000);
    if (typeof to === 'string') {
      const d = new Date(to);
      d.setUTCHours(23, 59, 59, 0);
      to = Math.floor(d.getTime() / 1000);
    }
    return { mode: 'deep', from, to: to || Math.floor(Date.now() / 1000) };
  }

  const preset = String(range).toLowerCase().trim();

  if (preset === 'max') {
    return { mode: 'deep' };
  }

  if (preset === 'chart') {
    const tfMin = timeframeToMinutes(timeframe);
    // Daily+ timeframes: load all available (20000 bars covers decades)
    if (tfMin >= 1440) return { mode: 'regular', bars: 20000 };
    return { mode: 'regular', bars: PLAN_BAR_LIMITS[plan] || 5000 };
  }

  // Day-based presets: "7d", "30d", "90d", "365d", or any "<N>d"
  const dayMatch = preset.match(/^(\d+)d$/);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    const bars = daysToBars(days, timeframe);
    // Cap at plan limit for regular backtest
    const planLimit = PLAN_BAR_LIMITS[plan] || 5000;
    if (bars > planLimit) {
      // Too many bars for regular backtest — route to deep
      return { mode: 'deep', from: Math.floor((Date.now() - days * 86400000) / 1000), to: Math.floor(Date.now() / 1000) };
    }
    return { mode: 'regular', bars };
  }

  // Raw number fallback (backward compat)
  const rawBars = Number(range);
  if (!Number.isNaN(rawBars) && rawBars > 0) {
    return { mode: 'regular', bars: Math.floor(rawBars) };
  }

  throw new Error(
    `Invalid range: ${JSON.stringify(range)}. ` +
    `Use a preset ("chart", "7d", "30d", "90d", "365d", "max"), ` +
    `a date range ({ from: "2025-01-01", to: "2025-06-01" }), ` +
    `or a raw bar count (e.g. 1000).`
  );
}

/**
 * Unified backtest entry point. Auto-routes between regular and deep backtest.
 *
 * @param {string} scriptId - Strategy script ID (e.g. 'STD;RSI%1Strategy')
 * @param {string} [symbol='BINANCE:BTCUSDT'] - Market symbol
 * @param {Object} [options]
 * @param {string} [options.timeframe='D'] - Chart timeframe
 * @param {string|number|Object} [options.range='chart'] - Range preset, bar count, or {from, to}
 * @param {Object} [options.params] - Strategy parameter overrides
 * @returns {Promise<{success:boolean, message:string, mode?:string, range?:Object, report?:Object}>}
 */
async function backtest(scriptId, symbol = 'BINANCE:BTCUSDT', options = {}) {
  const { timeframe = 'D', range = 'chart', params } = options;

  try {
    const plan = await detectPlan();
    const parsed = parseRange(range, timeframe, plan);

    let report;
    let mode;

    if (parsed.mode === 'deep') {
      if (plan !== 'pro_premium') {
        return {
          success: false,
          message: `Deep backtesting requires a Premium plan (your plan: ${plan || 'free'}). ` +
            `Use "chart", "7d", "30d", "90d", or "365d" for regular backtest instead.`,
        };
      }

      mode = 'deep';
      report = await fetchDeepBacktest(scriptId, symbol, {
        timeframe,
        from: parsed.from,
        to: parsed.to,
        params,
      });
    } else {
      mode = 'regular';
      report = await fetchStrategyReport(scriptId, symbol, {
        timeframe,
        range: parsed.bars,
        params,
      });
    }

    return {
      success: true,
      message: `${mode === 'deep' ? 'Deep backtest' : 'Backtest'} completed: ${report.trades?.length || 0} trades`,
      mode,
      range: parsed.mode === 'deep'
        ? { from: parsed.from, to: parsed.to }
        : { bars: parsed.bars },
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
    return { success: false, message: 'Backtest error', error: error.message };
  }
}

module.exports = {
  backtest,
  parseRange,
  daysToBars,
  timeframeToMinutes,
  PLAN_BAR_LIMITS,
};
