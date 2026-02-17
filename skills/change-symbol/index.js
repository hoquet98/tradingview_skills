const { fetchChartData, close } = require('../../lib/ws-client');

/**
 * Change the chart symbol.
 * - WebSocket mode (default): pass symbol string, verifies by fetching data
 * - Playwright mode (backward compat): pass a Playwright page as first arg
 *
 * @param {Page|string} pageOrSymbol - Playwright page or symbol string (e.g. 'NASDAQ:AAPL')
 * @param {string} [symbol] - Symbol when first arg is a page
 * @returns {Promise<{success:boolean, message:string, symbol?:string}>}
 */
async function changeSymbol(pageOrSymbol, symbol) {
  if (pageOrSymbol && typeof pageOrSymbol.evaluate === 'function') {
    return changeSymbolPlaywright(pageOrSymbol, symbol || 'NASDAQ:AAPL');
  }
  return changeSymbolWS(pageOrSymbol || 'NASDAQ:AAPL');
}

async function changeSymbolWS(symbol) {
  try {
    const data = await fetchChartData(symbol, { timeframe: 'D', range: 1 });
    if (data.length > 0) {
      return { success: true, message: `Symbol changed to ${symbol}`, symbol };
    }
    return { success: false, message: `No data for symbol ${symbol}`, symbol };
  } catch (error) {
    return { success: false, message: 'Error changing symbol', error: error.message };
  }
}

async function changeSymbolPlaywright(page, symbol = 'NASDAQ:AAPL') {
  try {
    const symbolButton = await page.$('#header-toolbar-symbol-search');
    if (!symbolButton) {
      return { success: false, message: 'Symbol button not found' };
    }
    await symbolButton.click();

    await page.waitForSelector('input[data-qa-id="symbol-search-input"]', { timeout: 5000 });
    const searchInput = await page.$('input[data-qa-id="symbol-search-input"]');
    if (!searchInput) {
      return { success: false, message: 'Symbol search input not found' };
    }

    await searchInput.click({ clickCount: 3 });
    await searchInput.fill('');
    await searchInput.type(symbol);

    await page.waitForSelector('div[data-role="list-item"]', { timeout: 5000 });
    const resultItem = await page.$('div[data-role="list-item"]');
    if (!resultItem) {
      return { success: false, message: 'Symbol search result not found' };
    }
    await resultItem.click();

    await page.waitForSelector('canvas[aria-label^="Chart for"]', { timeout: 10000 });

    const chartCanvas = await page.$('canvas[aria-label^="Chart for"]');
    const ariaLabel = (await chartCanvas?.getAttribute('aria-label')) || '';
    const symbolMatch = ariaLabel.match(/Chart for ([^,]+)/);
    const currentSymbol = symbolMatch ? symbolMatch[1] : '';

    if (currentSymbol && (currentSymbol.includes(symbol.split(':')[1]) || currentSymbol === symbol)) {
      return { success: true, message: `Symbol changed to ${symbol}`, symbol };
    } else {
      return { success: false, message: 'Symbol change verification failed', symbol: currentSymbol || symbol };
    }
  } catch (error) {
    return { success: false, message: 'Error changing symbol', error: error.message };
  }
}

async function main() {
  const symbol = process.argv[2] || 'NASDAQ:AAPL';

  try {
    const result = await changeSymbol(symbol);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await close();
  }
}

module.exports = { changeSymbol };
if (require.main === module) main();
