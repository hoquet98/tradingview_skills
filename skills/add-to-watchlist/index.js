const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

async function addToWatchlist(page, symbol = 'NASDAQ:AAPL', watchlistName = null) {
  try {
    const watchlistBtn = await page.$('button[aria-label="Watchlist, details and news"]');
    if (watchlistBtn) {
      await watchlistBtn.click();
      await page.waitForTimeout(1000);
    }

    // Switch to target watchlist tab if specified
    if (watchlistName) {
      const tabs = await page.$$('[role="tab"], [class*="tabButton"]');
      for (const tab of tabs) {
        const text = await tab.textContent();
        if (text?.trim().toLowerCase() === watchlistName.toLowerCase()) {
          await tab.click();
          await page.waitForTimeout(500);
          break;
        }
      }
    }

    // Find add symbol button
    let addBtn = await page.$('[data-qa-id="add-symbol"], [class*="addSymbol"], [class*="plusButton"]');
    if (!addBtn) {
      const buttons = await page.$$('button, [role="button"]');
      for (const btn of buttons) {
        const ariaLabel = await btn.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.toLowerCase().includes('add symbol')) {
          addBtn = btn;
          break;
        }
      }
    }

    if (addBtn) {
      await addBtn.click();
      await page.waitForTimeout(500);
    }

    // Type symbol in search
    const searchInput = await page.$('input[placeholder*="symbol"], input[placeholder*="Symbol"], input[data-qa*="search"]');
    if (searchInput) {
      await searchInput.fill('');
      await searchInput.type(symbol);
      await page.waitForSelector('[role="option"]', { timeout: 5000 }).catch(() => {});
    }

    // Select first result
    const resultOption = await page.$('[role="option"]:first-child, [class*="option"]:first-child, [class*="suggestion"]:first-child');
    if (resultOption) {
      await resultOption.click();
      await page.waitForTimeout(500);
    }

    return { success: true, message: `Symbol "${symbol}" added to watchlist`, symbol, watchlist: watchlistName || 'Default' };
  } catch (error) {
    return { success: false, message: 'Error adding to watchlist', error: error.message };
  }
}

async function main() {
  const symbol = process.argv[2] || 'NASDAQ:AAPL';
  const watchlistName = process.argv[3] || null;
  const { browser, page } = await launchBrowser();

  try {
    await openChart(page);
    const result = await addToWatchlist(page, symbol, watchlistName);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { addToWatchlist };
if (require.main === module) main();
