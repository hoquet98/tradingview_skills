const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

async function changeTimeframe(page, timeframe = '5') {
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
  const { browser, page } = await launchBrowser({ headless: false });

  try {
    await openChart(page);
    const result = await changeTimeframe(page, timeframe);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { changeTimeframe };
if (require.main === module) main();
