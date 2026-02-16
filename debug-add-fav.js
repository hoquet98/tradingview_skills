const { launchBrowser, openChart, closeBrowser } = require('./lib/browser');
const { getIndicatorList, removeIndicator } = require('./skills/get-indicator-list');

async function main() {
  const { browser, page } = await launchBrowser({ headless: false });
  try {
    await openChart(page);

    // Step 1: Get and remove indicators
    const list = await getIndicatorList(page);
    console.log('Indicators found:', list.count);

    if (list.count > 0) {
      for (const ind of list.indicators) {
        console.log('Removing:', ind.name);
        await removeIndicator(page, ind.name);
      }
      console.log('All removed, waiting 2s...');
      await page.waitForTimeout(2000);
    }

    // Check for any popups/dialogs before clicking favorites
    const popups = await page.evaluate(() => {
      const dialogs = document.querySelectorAll('[role="dialog"], [class*="popup"], [class*="modal"], [class*="overlay"]');
      return Array.from(dialogs).filter(d => d.offsetParent !== null).map(d => ({
        role: d.getAttribute('role'),
        class: d.className?.substring(0, 100),
        text: d.textContent?.substring(0, 200),
      }));
    });
    console.log('\nActive popups/dialogs:', JSON.stringify(popups, null, 2));

    // Try clicking favorites
    console.log('\nClicking favorites button...');
    const favBtn = page.locator('#header-toolbar-indicators button[data-name="show-favorite-indicators"]').first();
    console.log('Fav button count:', await favBtn.count());
    console.log('Fav button visible:', await favBtn.isVisible());
    await favBtn.click();

    console.log('Waiting for menu...');
    const menuAppeared = await page.waitForSelector('[role="menu"]', { timeout: 5000 }).catch(e => {
      console.log('Menu wait FAILED:', e.message);
      return null;
    });
    console.log('Menu appeared:', !!menuAppeared);
    await page.waitForTimeout(1000);

    // Screenshot after clicking favorites
    await page.screenshot({ path: 'debug-add-fav.png', fullPage: false });
    console.log('Screenshot saved');

    // Check what appeared
    const menuItems = await page.$$('[role="menuitem"]');
    console.log('\nMenu items found:', menuItems.length);
    for (const item of menuItems) {
      const vis = await item.isVisible();
      const text = await item.textContent();
      console.log('  item:', vis, text?.substring(0, 80));
    }

    // Also look for the item with broader search
    const broader = await page.evaluate(() => {
      const all = document.querySelectorAll('*');
      const matches = [];
      for (const el of all) {
        if (el.textContent?.includes('DEAD ZONE') && el.children.length === 0) {
          matches.push({
            tag: el.tagName,
            text: el.textContent?.substring(0, 100),
            visible: el.offsetParent !== null,
            parent: el.parentElement?.tagName,
            parentRole: el.parentElement?.getAttribute('role'),
          });
        }
      }
      return matches;
    });
    console.log('\nElements containing DEAD ZONE:', JSON.stringify(broader, null, 2));

    console.log('\nKeeping open 10s...');
    await page.waitForTimeout(10000);
  } finally {
    await closeBrowser(browser);
  }
}

main();
