/**
 * Load Strategy Workflow
 * Load a strategy with custom parameters for a symbol/timeframe and get performance results.
 * Supports overriding any strategy parameter via the params option.
 *
 * Usage:
 *   node workflows/load-strategy.js "STD;RSI%1Strategy" BINANCE:BTCUSDT D
 *   node workflows/load-strategy.js "STD;RSI%1Strategy" BINANCE:BTCUSDT D '{"RSI Length":21}'
 *   node workflows/load-strategy.js "PUB;abc123" NASDAQ:AAPL 60 '{"Fast Length":8,"Slow Length":26}'
 */
const { getClient, getCredentials, TradingView, close } = require('../lib/ws-client');
const { getIndicatorDetails } = require('../skills/get-indicator-details');

async function loadStrategy(scriptId, options = {}) {
  const {
    symbol = 'BINANCE:BTCUSDT',
    timeframe = 'D',
    range = 1000,
    params = {},
    timeout = 30000,
  } = options;

  if (!scriptId) {
    return { success: false, message: 'Script ID required (e.g. STD;RSI%1Strategy, PUB;xxxxx)' };
  }

  // 1. Load indicator and apply custom parameters
  const { session, signature } = getCredentials();
  let indicator;
  try {
    indicator = await TradingView.getIndicator(scriptId, 'last', session, signature);
  } catch (error) {
    return { success: false, message: 'Failed to load script', error: error.message };
  }

  indicator.setType('StrategyScript@tv-scripting-101!');

  // Collect original defaults before overriding
  const defaults = {};
  const appliedParams = {};
  Object.entries(indicator.inputs).forEach(([id, input]) => {
    if (!input.isHidden) {
      defaults[input.name] = input.value;
    }
  });

  // Apply custom parameter overrides
  for (const [key, value] of Object.entries(params)) {
    try {
      indicator.setOption(key, value);
      appliedParams[key] = value;
    } catch (error) {
      return {
        success: false,
        message: `Invalid parameter override: ${key}`,
        error: error.message,
        availableParams: defaults,
      };
    }
  }

  // 2. Create chart and load the strategy
  const client = await getClient();

  return new Promise((resolve) => {
    const chart = new client.Session.Chart();
    let study;
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        chart.delete();
        resolve({
          success: false,
          message: 'Strategy report timed out. The strategy may have no trades for this symbol/timeframe.',
          scriptId,
          symbol,
          timeframe,
        });
      }
    }, timeout);

    chart.onError((...err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        chart.delete();
        resolve({ success: false, message: 'Chart error', error: err.join(' ') });
      }
    });

    chart.onUpdate(() => {
      if (resolved || !study) return;
      const report = study.strategyReport;
      if (report && report.trades && report.trades.length > 0) {
        resolved = true;
        clearTimeout(timer);
        chart.delete();

        const perf = report.performance?.all || {};
        resolve({
          success: true,
          message: `Strategy loaded with ${report.trades.length} trades`,
          strategy: {
            id: scriptId,
            name: indicator.shortDescription || indicator.description,
          },
          symbol,
          timeframe,
          defaults,
          appliedParams: Object.keys(appliedParams).length > 0 ? appliedParams : undefined,
          performance: {
            netProfit: perf.netProfit,
            netProfitPercent: perf.netProfitPercent,
            totalTrades: perf.totalTrades,
            percentProfitable: perf.percentProfitable,
            profitFactor: perf.profitFactor,
            maxDrawdown: report.performance?.maxStrategyDrawDown,
            maxDrawdownPercent: report.performance?.maxStrategyDrawDownPercent,
            sharpeRatio: report.performance?.sharpeRatio,
            sortinoRatio: report.performance?.sortinoRatio,
            avgTrade: perf.avgTrade,
            avgTradePercent: perf.avgTradePercent,
            winningTrades: perf.numberOfWiningTrades,
            losingTrades: perf.numberOfLosingTrades,
            largestWin: perf.largestWinTrade,
            largestLoss: perf.largestLosTrade,
            avgWin: perf.avgWinTrade,
            avgLoss: perf.avgLosTrade,
          },
          performanceLong: report.performance?.long ? {
            netProfit: report.performance.long.netProfit,
            totalTrades: report.performance.long.totalTrades,
            percentProfitable: report.performance.long.percentProfitable,
            profitFactor: report.performance.long.profitFactor,
          } : undefined,
          performanceShort: report.performance?.short ? {
            netProfit: report.performance.short.netProfit,
            totalTrades: report.performance.short.totalTrades,
            percentProfitable: report.performance.short.percentProfitable,
            profitFactor: report.performance.short.profitFactor,
          } : undefined,
          tradeCount: report.trades.length,
          currency: report.currency || '',
        });
      }
    });

    chart.setMarket(symbol, { timeframe, range });

    chart.onSymbolLoaded(() => {
      study = new chart.Study(indicator);
      study.onError((...err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          chart.delete();
          resolve({
            success: false,
            message: 'Strategy error (compilation or runtime)',
            errors: err,
            scriptId,
            symbol,
            timeframe,
          });
        }
      });
    });
  });
}

async function main() {
  const scriptId = process.argv[2] || 'STD;RSI%1Strategy';
  const symbol = process.argv[3] || 'BINANCE:BTCUSDT';
  const timeframe = process.argv[4] || 'D';
  const params = process.argv[5] ? JSON.parse(process.argv[5]) : {};

  try {
    const result = await loadStrategy(scriptId, { symbol, timeframe, params });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Workflow error', error: error.message }, null, 2));
  } finally {
    await close();
  }
}

module.exports = { loadStrategy };
if (require.main === module) main();
