const { fetchChartData, close } = require('../../lib/ws-client');

/**
 * Change the chart timeframe.
 * - WebSocket mode (default): pass timeframe string as first arg
 * - Playwright mode (backward compat): pass a Playwright page as first arg
 *
 * @param {Page|string} pageOrTimeframe - Playwright page or timeframe (e.g. '5', '15', '60', 'D', 'W')
 * @param {string} [timeframe] - Timeframe when first arg is a page
 * @returns {Promise<{success:boolean, message:string, timeframe?:string}>}
 */
async function changeTimeframe(pageOrTimeframe, timeframe) {
  if (pageOrTimeframe && typeof pageOrTimeframe.evaluate === 'function') {
    return changeTimeframePlaywright(pageOrTimeframe, timeframe || '5');
  }
  return changeTimeframeWS(pageOrTimeframe || '5');
}

async function changeTimeframeWS(timeframe) {
  try {
    // Validate by fetching a bar with this timeframe
    const data = await fetchChartData('NASDAQ:AAPL', { timeframe, range: 1 });
    if (data.length > 0) {
      return { success: true, message: `Timeframe changed to ${timeframe}`, timeframe };
    }
    return { success: false, message: `Invalid timeframe ${timeframe}` };
  } catch (error) {
    return { success: false, message: 'Error changing timeframe', error: error.message };
  }
}

async function changeTimeframePlaywright(page, timeframe = '5') {
  try {
    const intervalButton = await page.$('button[aria-label="Chart interval"]');
    if (!intervalButton) {
      return { success: false, message: 'Interval button not found' };
    }
    await intervalButton.click();

    await page.waitForSelector('[class^="menuBox-"]', { timeout: 5000 });

    const timeframeOptions = await page.$$('[class^="menuBox-"] [role="row"] span[class^="label-"], [class^="menuBox-"] span');

    let found = false;
    for (const option of timeframeOptions) {
      const text = await option.textContent();
      if (!text) continue;

      const normalizedText = text.toLowerCase().trim();
      const normalizedInput = timeframe.toLowerCase().trim();

      if (
        normalizedText === normalizedInput ||
        normalizedText.includes(normalizedInput) ||
        normalizedInput.includes(normalizedText) ||
        (normalizedInput === '1' && ['1', '1m', '1 min'].includes(normalizedText)) ||
        (normalizedInput === '5' && ['5', '5m', '5 min'].includes(normalizedText)) ||
        (normalizedInput === '15' && ['15', '15m', '15 min'].includes(normalizedText))
      ) {
        await option.click();
        found = true;
        break;
      }
    }

    if (!found) {
      const rows = await page.$$('[class^="menuBox-"] [role="row"]');
      if (rows.length > 0) {
        const timeframeOrder = ['1', '3', '5', '15', '30', '45', '60', '120', '240', 'D', 'W', 'M'];
        const targetIndex = timeframeOrder.indexOf(timeframe.toUpperCase());

        if (targetIndex >= 0 && rows[targetIndex]) {
          await rows[targetIndex].click();
          found = true;
        }
      }
    }

    if (!found) {
      return { success: false, message: `Timeframe ${timeframe} not found in menu` };
    }

    await page.waitForSelector('canvas[aria-label^="Chart for"]', { timeout: 10000 });
    const currentInterval = await intervalButton.textContent();

    return { success: true, message: `Timeframe changed to ${currentInterval?.trim()}`, timeframe: currentInterval?.trim() };
  } catch (error) {
    return { success: false, message: 'Error changing timeframe', error: error.message };
  }
}

async function main() {
  const timeframe = process.argv[2] || '5';

  try {
    const result = await changeTimeframe(timeframe);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await close();
  }
}

module.exports = { changeTimeframe };
if (require.main === module) main();
