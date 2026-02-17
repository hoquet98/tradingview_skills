const { fetchChartData, close } = require('../../lib/ws-client');
const { getSymbolInfo } = require('../../lib/chart-utils');

/**
 * Get OHLCV chart data.
 * - WebSocket mode (default): pass symbol string as first arg
 * - Playwright mode (backward compat): pass a Playwright page as first arg
 *
 * @param {string|Page} symbolOrPage - Symbol (e.g. 'BINANCE:BTCUSDT') or Playwright page
 * @param {number|Object} [countOrOptions=100] - Number of bars, or options object { count, timeframe }
 * @returns {Promise<{success:boolean, message:string, data?:Array, count?:number, symbol?:string, timeframe?:string}>}
 */
async function getChartData(symbolOrPage, countOrOptions = 100) {
  // Detect Playwright page by checking for .evaluate method
  if (symbolOrPage && typeof symbolOrPage.evaluate === 'function') {
    return getChartDataPlaywright(symbolOrPage, countOrOptions);
  }
  return getChartDataWS(symbolOrPage, countOrOptions);
}

async function getChartDataWS(symbol = 'NASDAQ:AAPL', countOrOptions = 100) {
  const options = typeof countOrOptions === 'object' ? countOrOptions : { count: countOrOptions };
  const { count = 100, timeframe = 'D' } = options;

  try {
    const data = await fetchChartData(symbol, { timeframe, range: count });
    return {
      success: true,
      message: `Retrieved ${data.length} bars`,
      data,
      count: data.length,
      symbol,
      timeframe,
    };
  } catch (error) {
    return { success: false, message: 'Error getting chart data', error: error.message };
  }
}

async function getChartDataPlaywright(page, count = 100) {
  try {
    const chartData = await page.evaluate((limit) => {
      const bars = [];
      try {
        const chartObj = window.tv?.chart || window.TradingView?.chart;
        if (chartObj) {
          const series = chartObj.activeChart?.()?.mainSeries || chartObj.mainSeries;
          if (series && series.data) {
            const data = series.data();
            if (Array.isArray(data)) {
              const startIdx = Math.max(0, data.length - limit);
              for (let i = startIdx; i < data.length; i++) {
                const bar = data[i];
                bars.push({
                  time: bar.time || bar.time_,
                  open: bar.open,
                  high: bar.high,
                  low: bar.low,
                  close: bar.close,
                  volume: bar.volume || 0,
                });
              }
            }
          }
        }
      } catch (e) {
        // Internal API not available
      }
      if (bars.length === 0) {
        return { success: false, message: 'Could not access chart data. TradingView internal API not exposed.' };
      }
      return bars;
    }, count);

    if (!Array.isArray(chartData)) {
      return { success: false, message: chartData.message || 'Failed to extract chart data' };
    }

    const symbolInfo = await getSymbolInfo(page);

    return {
      success: true,
      message: `Retrieved ${chartData.length} bars`,
      data: chartData,
      count: chartData.length,
      symbol: symbolInfo.symbol,
      timeframe: symbolInfo.timeframe,
    };
  } catch (error) {
    return { success: false, message: 'Error getting chart data', error: error.message };
  }
}

async function main() {
  // CLI: node index.js [symbol] [timeframe] [count]
  const symbol = process.argv[2] || 'NASDAQ:AAPL';
  const timeframe = process.argv[3] || 'D';
  const count = parseInt(process.argv[4]) || 100;

  try {
    const result = await getChartData(symbol, { count, timeframe });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await close();
  }
}

module.exports = { getChartData };
if (require.main === module) main();
