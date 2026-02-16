const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

async function renameStrategy(page, oldName, newName) {
  try {
    if (!oldName || !newName) {
      return { success: false, message: 'Both oldName and newName are required' };
    }

    const items = await page.$$('div[data-qa-id="legend-source-item"]');
    let targetItem = null;

    for (const item of items) {
      const titleEl = await item.$('[data-qa-id="legend-source-title"]');
      const title = titleEl ? (await titleEl.textContent())?.trim() : '';
      if (title?.toLowerCase().includes(oldName.toLowerCase())) {
        targetItem = item;
        break;
      }
    }

    if (!targetItem) {
      return { success: false, message: `Strategy "${oldName}" not found` };
    }

    // Open settings dialog from the target item
    const settingsBtn = await targetItem.$('[data-qa-id="legend-settings-action"]');
    if (!settingsBtn) {
      return { success: false, message: 'Settings button not found on strategy' };
    }

    await settingsBtn.click();
    await page.waitForSelector('[data-name="indicator-properties-dialog"]', { timeout: 5000 });

    // Find name input and update
    const nameInput = await page.$('input[name*="name"], input[placeholder*="Strategy"], input[value*="strategy"]');
    if (nameInput) {
      await nameInput.click({ clickCount: 3 });
      await nameInput.fill(newName);
    }

    // Click submit/apply
    const submitBtn = await page.$('button[name="submit"]');
    if (!submitBtn) {
      const applyBtn = await page.locator('button:has-text("Apply"), button:has-text("OK")').first();
      if (await applyBtn.count()) {
        await applyBtn.click();
      }
    } else {
      await submitBtn.click();
    }
    await page.waitForTimeout(500);

    return { success: true, message: `Strategy renamed from "${oldName}" to "${newName}"`, oldName, newName };
  } catch (error) {
    return { success: false, message: 'Error renaming strategy', error: error.message };
  }
}

async function main() {
  const oldName = process.argv[2];
  const newName = process.argv[3];
  const { browser, page } = await launchBrowser({ headless: false });

  try {
    await openChart(page);
    const result = await renameStrategy(page, oldName, newName);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { renameStrategy };
if (require.main === module) main();
