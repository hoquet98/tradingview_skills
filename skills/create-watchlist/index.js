const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

async function createWatchlist(page, name = 'My Watchlist') {
  try {
    const watchlistBtn = await page.$('button[aria-label="Watchlist, details and news"]');
    if (watchlistBtn) {
      await watchlistBtn.click();
      await page.waitForTimeout(1000);
    }

    // Look for create button
    let createBtn = await page.$('[data-qa-id="create-watchlist"], [class*="createButton"], [class*="addWatchlist"]');
    if (!createBtn) {
      const buttons = await page.$$('button, [role="button"]');
      for (const btn of buttons) {
        const text = await btn.textContent();
        const ariaLabel = await btn.getAttribute('aria-label');
        if ((text && text.toLowerCase().includes('create')) ||
            (ariaLabel && ariaLabel.toLowerCase().includes('create watchlist'))) {
          createBtn = btn;
          break;
        }
      }
    }

    if (!createBtn) {
      const plusButtons = await page.$$('[aria-label*="add"], [aria-label*="Add"]');
      if (plusButtons.length > 0) createBtn = plusButtons[0];
    }

    if (!createBtn) {
      return { success: false, message: 'Could not find Create Watchlist button' };
    }

    await createBtn.click();
    await page.waitForTimeout(500);

    // Fill in watchlist name
    let nameInput = await page.$('input[placeholder*="name"], input[placeholder*="Name"], input[class*="nameInput"]');
    if (!nameInput) {
      nameInput = await page.$('input[type="text"]:not([disabled])');
    }

    if (nameInput) {
      await nameInput.click({ clickCount: 3 });
      await nameInput.fill(name);
    } else {
      return { success: false, message: 'Could not find name input field' };
    }

    // Confirm creation
    let confirmBtn = await page.$('button[type="submit"], button[class*="confirm"], button[class*="save"]');
    if (!confirmBtn) {
      const confirmLocator = await page.locator('button:has-text("Create"), button:has-text("Save")').first();
      if (await confirmLocator.count()) {
        await confirmLocator.click();
      } else {
        await page.keyboard.press('Enter');
      }
    } else {
      await confirmBtn.click();
    }
    await page.waitForTimeout(1000);

    return { success: true, message: `Watchlist "${name}" created`, name };
  } catch (error) {
    return { success: false, message: 'Error creating watchlist', error: error.message };
  }
}

async function main() {
  const name = process.argv[2] || 'My Watchlist';
  const { browser, page } = await launchBrowser({ headless: false });

  try {
    await openChart(page);
    const result = await createWatchlist(page, name);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { createWatchlist };
if (require.main === module) main();
