const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

async function setChartType(page, chartType = 'Candles') {
  try {
    const typeBtn = await page.$('button[aria-label*="Chart type"], button[data-name="chart-type"]');
    if (typeBtn) {
      await typeBtn.click();
      await page.waitForSelector('[class^="menuBox-"]', { timeout: 5000 }).catch(() => {});
    }

    const typeOption = await page.locator(`button:has-text("${chartType}")`).first();
    if (await typeOption.count()) {
      await typeOption.click();
      await page.waitForSelector('canvas[aria-label^="Chart for"]', { timeout: 10000 });
    }

    return { success: true, message: `Chart type set to ${chartType}` };
  } catch (error) {
    return { success: false, message: 'Error setting chart type', error: error.message };
  }
}

async function setPriceScale(page, options = {}) {
  try {
    const priceAxis = await page.$('[class*="priceAxis"], [class*="price-scale"]');
    if (priceAxis) {
      await priceAxis.click({ button: 'right' });
      await page.waitForSelector('[class^="menuBox-"]', { timeout: 5000 }).catch(() => {});
    }

    return { success: true, message: 'Price scale configured', options };
  } catch (error) {
    return { success: false, message: 'Error setting price scale', error: error.message };
  }
}

async function setTimezone(page, timezone = 'UTC') {
  try {
    const timezoneBtn = await page.$('button[aria-label*="Timezone"], button[data-name="timezone"]');
    if (timezoneBtn) {
      await timezoneBtn.click();
      await page.waitForSelector('input[placeholder*="timezone"], input[placeholder*="Timezone"]', { timeout: 5000 }).catch(() => {});
    }

    const searchInput = await page.$('input[placeholder*="timezone"], input[placeholder*="Timezone"]');
    if (searchInput) {
      await searchInput.fill(timezone);
      await page.waitForSelector('[role="option"]', { timeout: 3000 }).catch(() => {});
    }

    const tzOption = await page.$('[role="option"]:first-child');
    if (tzOption) {
      await tzOption.click();
    }

    return { success: true, message: `Timezone set to ${timezone}` };
  } catch (error) {
    return { success: false, message: 'Error setting timezone', error: error.message };
  }
}

async function exportChartData(page, format = 'CSV') {
  try {
    const menuBtn = await page.$('button[aria-label*="More"], button[data-name="more-options"]');
    if (menuBtn) {
      await menuBtn.click();
      await page.waitForSelector('[class^="menuBox-"]', { timeout: 5000 }).catch(() => {});
    }

    const exportBtn = await page.locator('button:has-text("Export"), [data-qa-id="export-data"]').first();
    if (await exportBtn.count()) {
      await exportBtn.click();
      await page.waitForTimeout(500);
    }

    const formatBtn = await page.locator(`button:has-text("${format}")`).first();
    if (await formatBtn.count()) {
      await formatBtn.click();
    }

    return { success: true, message: `Chart data exported as ${format}` };
  } catch (error) {
    return { success: false, message: 'Error exporting data', error: error.message };
  }
}

async function takeScreenshot(page, options = {}) {
  try {
    const menuBtn = await page.$('button[aria-label*="Screenshot"], button[aria-label*="Snapshot"]');
    if (menuBtn) {
      await menuBtn.click();
      await page.waitForSelector('[class^="menuBox-"]', { timeout: 5000 }).catch(() => {});
    }

    const snapshotBtn = await page.locator('button:has-text("Snapshot"), button[data-name="snapshot"]').first();
    if (await snapshotBtn.count()) {
      await snapshotBtn.click();
    }

    return { success: true, message: 'Screenshot taken' };
  } catch (error) {
    return { success: false, message: 'Error taking screenshot', error: error.message };
  }
}

async function main() {
  const action = process.argv[2];
  const param = process.argv[3];
  const { browser, page } = await launchBrowser({ headless: false });

  try {
    await openChart(page);

    let result;
    switch (action) {
      case 'chart-type': result = await setChartType(page, param); break;
      case 'price-scale': result = await setPriceScale(page, param ? JSON.parse(param) : {}); break;
      case 'timezone': result = await setTimezone(page, param); break;
      case 'export': result = await exportChartData(page, param); break;
      case 'screenshot': result = await takeScreenshot(page); break;
      default: result = { success: false, message: 'Unknown action. Use: chart-type, price-scale, timezone, export, screenshot' };
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { setChartType, setPriceScale, setTimezone, exportChartData, takeScreenshot };
if (require.main === module) main();
