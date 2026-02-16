const { launchBrowser, openChart, closeBrowser } = require('./lib/browser');

async function main() {
  const { browser, page } = await launchBrowser({ headless: false });

  try {
    await openChart(page);

    // Find ALL favorite-indicator buttons and check which are visible
    console.log('\n=== All favorite indicator buttons ===');
    const favButtons = await page.$$('button[data-name="show-favorite-indicators"]');
    console.log(`Found ${favButtons.length} buttons`);
    for (let i = 0; i < favButtons.length; i++) {
      const visible = await favButtons[i].isVisible();
      const box = await favButtons[i].boundingBox();
      console.log(`  Button ${i}: visible=${visible}, box=${JSON.stringify(box)}`);
    }

    // Click the FIRST VISIBLE one
    for (let i = 0; i < favButtons.length; i++) {
      const visible = await favButtons[i].isVisible();
      if (visible) {
        console.log(`\nClicking visible button ${i}...`);
        await favButtons[i].click();
        break;
      }
    }

    await page.waitForTimeout(2000);

    // Take screenshot of the dropdown
    await page.screenshot({ path: 'debug-favorites.png', fullPage: false });
    console.log('Screenshot saved to debug-favorites.png');

    // Inspect what appeared
    console.log('\n=== Dropdown/menu items ===');
    const menuItems = await page.evaluate(() => {
      const results = [];
      // Check for menus, popups, dropdowns
      const candidates = document.querySelectorAll('[role="menu"], [role="listbox"], [class*="popup"], [class*="dropdown"], [class*="menu"], [class*="overlay"]');
      for (const c of candidates) {
        if (c.offsetParent !== null) {
          results.push({
            tag: c.tagName,
            role: c.getAttribute('role'),
            class: c.className?.substring(0, 100),
            childCount: c.children.length,
            text: c.textContent?.substring(0, 500),
          });
        }
      }
      return results;
    });
    console.log(JSON.stringify(menuItems, null, 2));

    // Also look for any new items/options
    console.log('\n=== role=option / role=menuitem elements ===');
    const options = await page.evaluate(() => {
      const items = document.querySelectorAll('[role="option"], [role="menuitem"], [role="row"]');
      return Array.from(items).filter(i => i.offsetParent !== null).map(i => ({
        role: i.getAttribute('role'),
        text: i.textContent?.trim().substring(0, 100),
        dataName: i.getAttribute('data-name'),
      }));
    });
    console.log(JSON.stringify(options, null, 2));

    console.log('\nKeeping browser open 30 seconds...');
    await page.waitForTimeout(30000);
  } finally {
    await closeBrowser(browser);
  }
}

main();
