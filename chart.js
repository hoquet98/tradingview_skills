/**
 * Take a screenshot of a TradingView chart.
 * Usage: node screenshot-chart.js <chart-url> [output-filename]
 *
 * Examples:
 *   node screenshot-chart.js https://www.tradingview.com/chart/fXStfxnU/
 *   node screenshot-chart.js https://www.tradingview.com/chart/fXStfxnU/ my-chart.png
 */
const { launchBrowser, closeBrowser } = require('./lib/browser');
const path = require('path');

const chartUrl = process.argv[2];
const outputName = process.argv[3] || 'chart-screenshot.png';
const outputPath = path.join(__dirname, outputName);

if (!chartUrl) {
  console.error('Usage: node screenshot-chart.js <chart-url> [output-filename]');
  process.exit(1);
}

(async () => {
  const { browser, page } = await launchBrowser();
  try {
    await page.goto(chartUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('canvas', { timeout: 30000 });
    await page.waitForTimeout(5000);

    // Dismiss promotional popups
    const decline = await page.$('button:has-text("Decline offer")');
    if (decline) { await decline.click(); await page.waitForTimeout(1000); }
    const closeBtn = await page.$('[data-name="dialog-close"]');
    if (closeBtn) { await closeBtn.click(); await page.waitForTimeout(1000); }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: outputPath, fullPage: false });
    console.log(`Screenshot saved to ${outputPath}`);
  } finally {
    await closeBrowser();
  }
})();
