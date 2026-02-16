const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

const TVSelectors = {
  STRATEGY_LEGEND_ITEM: 'div[data-qa-id="legend-source-item"]',
  STRATEGY_TITLE: '[data-qa-id="legend-source-title"]',
  SETTINGS_BUTTON: '[data-qa-id="legend-settings-action"]',
  SETTINGS_DIALOG: '[data-name="indicator-properties-dialog"]',
  DIALOG_CONTENT: '[class*="scrollable"], [data-name="dialog-content"]',
  CLOSE_BUTTON: 'button[data-name="close"]',
};

async function openStrategySettings(page, strategyName = null) {
  try {
    const items = await page.$$(TVSelectors.STRATEGY_LEGEND_ITEM);
    if (items.length === 0) {
      return { success: false, message: 'No strategy/indicator found on chart' };
    }

    let targetItem = items[0];
    if (strategyName) {
      for (const item of items) {
        const titleEl = await item.$(TVSelectors.STRATEGY_TITLE);
        const title = titleEl ? (await titleEl.textContent())?.trim() : '';
        if (title?.toLowerCase().includes(strategyName.toLowerCase())) {
          targetItem = item;
          break;
        }
      }
    }

    const settingsBtn = await targetItem.$(TVSelectors.SETTINGS_BUTTON);
    if (!settingsBtn) {
      return { success: false, message: 'Settings button not found on strategy item' };
    }

    await settingsBtn.click();
    await page.waitForSelector(TVSelectors.SETTINGS_DIALOG, { timeout: 5000 });

    const settings = await page.evaluate(() => {
      const inputs = document.querySelectorAll('[class*="cell-"] input, [class*="input-"] input');
      const result = {};
      inputs.forEach((input, idx) => {
        const label = input.closest('[class*="cell-"]')?.querySelector('[class*="label-"]')?.textContent || `param_${idx}`;
        result[label.trim()] = input.value;
      });
      return result;
    });

    const titleEl = await targetItem.$(TVSelectors.STRATEGY_TITLE);
    const name = titleEl ? (await titleEl.textContent())?.trim() : 'Unknown';

    return {
      success: true,
      message: `Settings dialog opened for "${name}"`,
      strategyName: name,
      settings,
    };
  } catch (error) {
    return { success: false, message: 'Error opening strategy settings', error: error.message };
  }
}

async function main() {
  const strategyName = process.argv[2] || null;
  const { browser, page } = await launchBrowser({ headless: false });

  try {
    await openChart(page);
    const result = await openStrategySettings(page, strategyName);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { openStrategySettings, TVSelectors };
if (require.main === module) main();
