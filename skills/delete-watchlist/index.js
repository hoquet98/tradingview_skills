const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

async function deleteWatchlist(page, name) {
  try {
    if (!name) {
      return { success: false, message: 'Watchlist name is required' };
    }

    const watchlistBtn = await page.$('button[aria-label="Watchlist, details and news"]');
    if (watchlistBtn) {
      await watchlistBtn.click();
      await page.waitForTimeout(1000);
    }

    // Find and right-click the target watchlist tab
    const tabs = await page.$$('[role="tab"], [class*="tabButton"]');
    let targetTab = null;
    for (const tab of tabs) {
      const text = await tab.textContent();
      if (text?.trim().toLowerCase() === name.toLowerCase()) {
        targetTab = tab;
        break;
      }
    }

    if (!targetTab) {
      return { success: false, message: `Watchlist "${name}" not found` };
    }

    await targetTab.click({ button: 'right' });
    await page.waitForTimeout(300);

    // Click delete from context menu
    let deleteOption = await page.$('[data-action="delete"], [data-action="remove"]');
    if (!deleteOption) {
      const deleteLocator = await page.locator('button:has-text("Delete"), button:has-text("Remove")').first();
      if (await deleteLocator.count()) {
        await deleteLocator.click();
      } else {
        return { success: false, message: 'Delete option not found in context menu' };
      }
    } else {
      await deleteOption.click();
    }
    await page.waitForTimeout(300);

    // Confirm deletion
    const confirmBtn = await page.locator('button:has-text("Delete"), button:has-text("Yes"), button[type="submit"]').first();
    if (await confirmBtn.count()) {
      await confirmBtn.click();
    }
    await page.waitForTimeout(500);

    return { success: true, message: `Watchlist "${name}" deleted`, name };
  } catch (error) {
    return { success: false, message: 'Error deleting watchlist', error: error.message };
  }
}

async function main() {
  const name = process.argv[2];
  const { browser, page } = await launchBrowser();

  try {
    await openChart(page);
    const result = await deleteWatchlist(page, name);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { deleteWatchlist };
if (require.main === module) main();
