const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

async function saveStrategy(page, strategyName = null) {
  try {
    const items = await page.$$('div[data-qa-id="legend-source-item"]');
    if (items.length === 0) {
      return { success: false, message: 'No strategy found on chart' };
    }

    let targetItem = items[0];
    let name = '';

    if (strategyName) {
      for (const item of items) {
        const titleEl = await item.$('[data-qa-id="legend-source-title"]');
        const title = titleEl ? (await titleEl.textContent())?.trim() : '';
        if (title?.toLowerCase().includes(strategyName.toLowerCase())) {
          targetItem = item;
          name = title;
          break;
        }
      }
    } else {
      const titleEl = await targetItem.$('[data-qa-id="legend-source-title"]');
      name = titleEl ? (await titleEl.textContent())?.trim() : 'Unknown';
    }

    // Open settings from the target item
    const settingsBtn = await targetItem.$('[data-qa-id="legend-settings-action"]');
    if (settingsBtn) {
      await settingsBtn.click();
      await page.waitForSelector('[data-name="indicator-properties-dialog"]', { timeout: 5000 }).catch(() => {});
    }

    // Click Save
    let saveBtn = await page.$('[data-qa-id="save-strategy"]');
    if (!saveBtn) {
      const saveBtnLocator = await page.locator('button:has-text("Save")').first();
      if (await saveBtnLocator.count()) {
        await saveBtnLocator.click();
      } else {
        return { success: false, message: 'Save button not found' };
      }
    } else {
      await saveBtn.click();
    }
    await page.waitForTimeout(1000);

    return { success: true, message: `Strategy "${name}" saved`, strategyName: name };
  } catch (error) {
    return { success: false, message: 'Error saving strategy', error: error.message };
  }
}

async function main() {
  const strategyName = process.argv[2] || null;
  const { browser, page } = await launchBrowser({ headless: false });

  try {
    await openChart(page);
    const result = await saveStrategy(page, strategyName);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { saveStrategy };
if (require.main === module) main();
