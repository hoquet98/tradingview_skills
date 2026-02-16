const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

async function getSavedScripts(page) {
  try {
    // Open Pine Editor
    const editorBtn = await page.$('button[aria-label*="Pine Editor"], button[data-name="pine-editor"]');
    if (editorBtn) {
      await editorBtn.click();
      await page.waitForTimeout(1000);
    }

    // Look for the scripts/indicators button
    const found = await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button'));

      const indicatorsBtn = allButtons.find(btn => {
        const text = btn.textContent || '';
        const aria = btn.getAttribute('aria-label') || '';
        return text.includes('Indicators') || aria.includes('Indicators') ||
               text.includes('My Scripts') || aria.includes('My Scripts');
      });

      if (indicatorsBtn) {
        return {
          found: true,
          text: indicatorsBtn.textContent?.trim(),
          aria: indicatorsBtn.getAttribute('aria-label'),
          dataName: indicatorsBtn.getAttribute('data-name'),
        };
      }

      return { found: false };
    });

    // Try to get saved scripts list from the Pine Editor panel
    const scripts = await page.evaluate(() => {
      const items = document.querySelectorAll('[class*="scriptItem"], [class*="script-"], [data-qa-id*="script"]');
      return Array.from(items).map((item, idx) => ({
        id: idx,
        name: item.textContent?.trim().substring(0, 100),
      }));
    });

    return {
      success: true,
      message: `Found ${scripts.length} saved scripts`,
      scripts,
      count: scripts.length,
      indicatorsButton: found,
    };
  } catch (error) {
    return { success: false, message: 'Error getting saved scripts', error: error.message };
  }
}

async function main() {
  const { browser, page } = await launchBrowser({ headless: false });

  try {
    await openChart(page);
    const result = await getSavedScripts(page);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { getSavedScripts };
if (require.main === module) main();
