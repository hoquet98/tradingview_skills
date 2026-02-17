/**
 * Strategy Backtest Workflow
 * Backtest a strategy across multiple symbols and timeframes, then compare results.
 *
 * Usage:
 *   node workflows/strategy-backtest.js "STD;RSI%1Strategy" BINANCE:BTCUSDT D
 *   node workflows/strategy-backtest.js "STD;RSI%1Strategy" BINANCE:BTCUSDT,BINANCE:ETHUSDT,NASDAQ:AAPL D
 *   node workflows/strategy-backtest.js "STD;RSI%1Strategy" BINANCE:BTCUSDT D,240,60
 */
const { getStrategyReport } = require('../skills/get-strategy-report');
const { getIndicatorDetails } = require('../skills/get-indicator-details');
const { close } = require('../lib/ws-client');

async function strategyBacktest(scriptId, symbols, timeframes, options = {}) {
  const { range = 1000 } = options;
  const results = { scriptId, tests: [], summary: {} };

  // 1. Get indicator details
  try {
    const details = await getIndicatorDetails(scriptId);
    if (details.success) {
      results.strategy = {
        name: details.indicator.shortDescription || details.indicator.description,
        inputs: details.indicator.inputs
          .filter(i => !i.isHidden)
          .map(i => ({ name: i.name, value: i.value, type: i.type })),
      };
    }
  } catch (e) {
    results.strategy = { name: scriptId, error: e.message };
  }

  // 2. Run backtests
  for (const symbol of symbols) {
    for (const timeframe of timeframes) {
      try {
        const report = await getStrategyReport(scriptId, symbol, { timeframe, range });
        if (report.success && report.report) {
          const r = report.report;
          const test = {
            symbol,
            timeframe,
            performance: r.performance,
            tradeCount: r.tradeCount,
          };
          results.tests.push(test);
        } else {
          results.tests.push({ symbol, timeframe, error: report.message || 'No report data' });
        }
      } catch (error) {
        results.tests.push({ symbol, timeframe, error: error.message });
      }
    }
  }

  // 3. Summary
  const successful = results.tests.filter(t => !t.error);
  if (successful.length > 0) {
    results.summary = {
      totalTests: results.tests.length,
      successful: successful.length,
      failed: results.tests.length - successful.length,
      bestByProfitFactor: successful.sort((a, b) =>
        (b.performance?.profitFactor || 0) - (a.performance?.profitFactor || 0)
      )[0],
      bestByWinRate: [...successful].sort((a, b) =>
        (b.performance?.percentProfitable || 0) - (a.performance?.percentProfitable || 0)
      )[0],
    };
  }

  return { success: true, ...results };
}

async function main() {
  const scriptId = process.argv[2] || 'STD;RSI%1Strategy';
  const symbols = (process.argv[3] || 'BINANCE:BTCUSDT').split(',');
  const timeframes = (process.argv[4] || 'D').split(',');
  const range = parseInt(process.argv[5]) || 1000;

  try {
    const result = await strategyBacktest(scriptId, symbols, timeframes, { range });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Workflow error', error: error.message }, null, 2));
  } finally {
    await close();
  }
}

module.exports = { strategyBacktest };
if (require.main === module) main();
