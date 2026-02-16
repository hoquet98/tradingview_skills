/**
 * Chart utility functions extracted from set-chart-type skill.
 * These read-only helpers can be used by any skill.
 */

async function getSymbolInfo(page) {
  try {
    const canvas = await page.$('canvas[aria-label^="Chart for"]');
    if (!canvas) {
      return { success: false, message: 'Chart canvas not found' };
    }
    const ariaLabel = (await canvas.getAttribute('aria-label')) || '';
    const symbolMatch = ariaLabel.match(/Chart for ([^,]+)/);
    const timeframeMatch = ariaLabel.match(/,\s*([^,]+)$/);

    return {
      success: true,
      symbol: symbolMatch ? symbolMatch[1] : 'Unknown',
      timeframe: timeframeMatch ? timeframeMatch[1].trim() : 'Unknown',
      fullLabel: ariaLabel,
    };
  } catch (error) {
    return { success: false, message: 'Error getting symbol info', error: error.message };
  }
}

async function getTimeframeInfo(page) {
  try {
    const info = await page.evaluate(() => {
      const intervalBtn = document.querySelector('button[aria-label="Chart interval"]');
      return {
        currentTimeframe: intervalBtn?.textContent?.trim() || 'Unknown',
      };
    });
    return { success: true, ...info };
  } catch (error) {
    return { success: false, message: 'Error getting timeframe', error: error.message };
  }
}

async function getBarData(page, count = 100) {
  try {
    const bars = await page.evaluate((limit) => {
      try {
        const chart = window.tv?.chart?.();
        if (chart?.activeChart?.()?.mainSeries?.data) {
          const data = chart.activeChart().mainSeries.data();
          return data.slice(-limit).map(bar => ({
            time: bar.time,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
          }));
        }
      } catch (e) {
        // TradingView internal API not available
      }
      return [];
    }, count);

    return { success: bars.length > 0, bars, count: bars.length };
  } catch (error) {
    return { success: false, message: 'Error getting bar data', error: error.message };
  }
}

module.exports = { getSymbolInfo, getTimeframeInfo, getBarData };
