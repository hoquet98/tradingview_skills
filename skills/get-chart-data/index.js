const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');
const { getSymbolInfo } = require('../../lib/chart-utils');

async function getChartData(page, count = 100) {
  try {
    const chartData = await page.evaluate((limit) => {
      const bars = [];

      // Method 1: TradingView internal chart API
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
  const count = parseInt(process.argv[2]) || 100;
  const { browser, page } = await launchBrowser({ headless: false });

  try {
    await openChart(page);
    const result = await getChartData(page, count);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { getChartData };
if (require.main === module) main();
