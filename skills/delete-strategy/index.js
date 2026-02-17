const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

async function deleteStrategy(page, name = null) {
  try {
    const items = await page.$$('div[data-qa-id="legend-source-item"]');
    if (items.length === 0) {
      return { success: false, message: 'No strategy found on chart' };
    }

    let targetItem = items[0];
    let targetName = '';

    if (name) {
      for (const item of items) {
        const titleEl = await item.$('[data-qa-id="legend-source-title"]');
        const title = titleEl ? (await titleEl.textContent())?.trim() : '';
        if (title?.toLowerCase().includes(name.toLowerCase())) {
          targetItem = item;
          targetName = title;
          break;
        }
      }
    } else {
      const titleEl = await targetItem.$('[data-qa-id="legend-source-title"]');
      targetName = titleEl ? (await titleEl.textContent())?.trim() : 'Unknown';
    }

    // Right-click for context menu
    await targetItem.click({ button: 'right' });
    await page.waitForTimeout(300);

    let deleteBtn = await page.$('[data-action="delete"], [data-action="remove"]');
    if (!deleteBtn) {
      deleteBtn = await page.locator('button:has-text("Delete"), button:has-text("Remove")').first();
      if (!(await deleteBtn.count())) {
        return { success: false, message: 'Delete/Remove option not found in context menu' };
      }
    }

    await deleteBtn.click();
    await page.waitForTimeout(300);

    // Confirm deletion if a confirmation dialog appears
    const confirmBtn = await page.locator('button:has-text("Yes"), button:has-text("Confirm"), button:has-text("Delete")').first();
    if (await confirmBtn.count()) {
      await confirmBtn.click();
    }
    await page.waitForTimeout(500);

    return { success: true, message: `Strategy "${targetName}" deleted`, strategyName: targetName };
  } catch (error) {
    return { success: false, message: 'Error deleting strategy', error: error.message };
  }
}

async function main() {
  const name = process.argv[2] || null;
  const { browser, page } = await launchBrowser();

  try {
    await openChart(page);
    const result = await deleteStrategy(page, name);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { deleteStrategy };
if (require.main === module) main();
