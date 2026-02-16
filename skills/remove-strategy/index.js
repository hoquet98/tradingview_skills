const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

async function removeStrategy(page, strategyName = null) {
  try {
    const items = await page.$$('div[data-qa-id="legend-source-item"]');
    if (items.length === 0) {
      return { success: false, message: 'No strategy/indicator found on chart' };
    }

    let removedCount = 0;
    const removedNames = [];

    for (const item of items) {
      const titleEl = await item.$('[data-qa-id="legend-source-title"]');
      const name = titleEl ? (await titleEl.textContent())?.trim() : '';

      if (strategyName && !name?.toLowerCase().includes(strategyName.toLowerCase())) {
        continue;
      }

      // Try right-click context menu first
      await item.click({ button: 'right' });
      await page.waitForTimeout(300);

      const removeOption = await page.$('[data-action="delete"], [data-action="remove"]');
      if (removeOption) {
        await removeOption.click();
        await page.waitForTimeout(500);
        removedCount++;
        removedNames.push(name);
        continue;
      }

      // Fallback: try the remove/delete via settings
      const settingsBtn = await item.$('[data-qa-id="legend-settings-action"]');
      if (settingsBtn) {
        await settingsBtn.click();
        await page.waitForSelector('[data-name="indicator-properties-dialog"]', { timeout: 3000 }).catch(() => {});

        const deleteBtn = await page.locator('button:has-text("Remove"), button:has-text("Delete")').first();
        if (await deleteBtn.count()) {
          await deleteBtn.click();
          await page.waitForTimeout(500);
          removedCount++;
          removedNames.push(name);
          continue;
        }

        // Close dialog if no delete button found
        const closeBtn = await page.$('button[data-name="close"]');
        if (closeBtn) await closeBtn.click();
      }
    }

    if (removedCount > 0) {
      return { success: true, message: `Removed ${removedCount} item(s)`, removed: removedNames };
    } else {
      return { success: false, message: strategyName ? `Strategy "${strategyName}" not found or could not be removed` : 'Could not remove any strategies' };
    }
  } catch (error) {
    return { success: false, message: 'Error removing strategy', error: error.message };
  }
}

async function main() {
  const strategyName = process.argv[2] || null;
  const { browser, page } = await launchBrowser({ headless: false });

  try {
    await openChart(page);
    const result = await removeStrategy(page, strategyName);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { removeStrategy };
if (require.main === module) main();
