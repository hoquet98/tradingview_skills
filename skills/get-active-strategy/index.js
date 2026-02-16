const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

async function getActiveStrategy(page) {
  try {
    const strategyItems = await page.$$('div[data-qa-id="legend-source-item"]');

    if (strategyItems.length === 0) {
      return { success: false, message: 'No strategy found on chart' };
    }

    const strategies = [];
    for (const item of strategyItems) {
      const titleEl = await item.$('[data-qa-id="legend-source-title"]');
      const name = titleEl ? (await titleEl.textContent())?.trim() : 'Unknown';

      const eyeBtn = await item.$('[data-qa-id="legend-show-hide-action"]');
      const isVisible = eyeBtn ? (await eyeBtn.getAttribute('aria-checked')) !== 'true' : true;

      strategies.push({ name, visible: isVisible });
    }

    return {
      success: true,
      message: `Found ${strategies.length} strategy/indicator(s) on chart`,
      strategies,
      activeStrategy: strategies.find(s => s.visible)?.name || null,
    };
  } catch (error) {
    return { success: false, message: 'Error getting active strategy', error: error.message };
  }
}

async function main() {
  const { browser, page } = await launchBrowser({ headless: false });

  try {
    await openChart(page);
    const result = await getActiveStrategy(page);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { getActiveStrategy };
if (require.main === module) main();
