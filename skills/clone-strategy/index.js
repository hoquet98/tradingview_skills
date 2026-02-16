const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

async function copyStrategySettings(page, strategyName = null) {
  try {
    const items = await page.$$('div[data-qa-id="legend-source-item"]');
    if (items.length === 0) {
      return { success: false, message: 'No strategy found on chart' };
    }

    let targetItem = items[0];
    if (strategyName) {
      for (const item of items) {
        const titleEl = await item.$('[data-qa-id="legend-source-title"]');
        const title = titleEl ? (await titleEl.textContent())?.trim() : '';
        if (title?.toLowerCase().includes(strategyName.toLowerCase())) {
          targetItem = item;
          break;
        }
      }
    }

    const settingsBtn = await targetItem.$('[data-qa-id="legend-settings-action"]');
    if (!settingsBtn) {
      return { success: false, message: 'Settings button not found' };
    }

    await settingsBtn.click();
    await page.waitForSelector('[data-name="indicator-properties-dialog"]', { timeout: 5000 });

    const settings = await page.evaluate(() => {
      const inputs = document.querySelectorAll('[class*="cell-"] input, [class*="input-"] input, input[type="text"], input[type="number"]');
      const result = {};
      inputs.forEach((input, idx) => {
        const label = input.closest('[class*="cell-"]')?.querySelector('[class*="label-"]')?.textContent || `param_${idx}`;
        result[label.trim()] = input.value;
      });
      return result;
    });

    // Close dialog
    const closeBtn = await page.$('button[data-name="close"]');
    if (closeBtn) await closeBtn.click();

    return { success: true, message: 'Strategy settings copied', settings };
  } catch (error) {
    return { success: false, message: 'Error copying settings', error: error.message };
  }
}

async function pasteStrategySettings(page, strategyName = null, settings = {}) {
  try {
    if (!settings || Object.keys(settings).length === 0) {
      return { success: false, message: 'No settings to paste. Copy settings first.' };
    }

    const items = await page.$$('div[data-qa-id="legend-source-item"]');
    let targetItem = items[0];
    if (strategyName) {
      for (const item of items) {
        const titleEl = await item.$('[data-qa-id="legend-source-title"]');
        const title = titleEl ? (await titleEl.textContent())?.trim() : '';
        if (title?.toLowerCase().includes(strategyName.toLowerCase())) {
          targetItem = item;
          break;
        }
      }
    }

    const settingsBtn = await targetItem.$('[data-qa-id="legend-settings-action"]');
    if (!settingsBtn) {
      return { success: false, message: 'Settings button not found' };
    }

    await settingsBtn.click();
    await page.waitForSelector('[data-name="indicator-properties-dialog"]', { timeout: 5000 });

    for (const [key, value] of Object.entries(settings)) {
      const inputs = await page.$$('[class*="cell-"] input, [class*="input-"] input, input[type="text"], input[type="number"]');
      for (const input of inputs) {
        const label = await input.evaluate((el) => {
          return el.closest('[class*="cell-"]')?.querySelector('[class*="label-"]')?.textContent?.trim() || '';
        });
        if (label === key) {
          await input.click({ clickCount: 3 });
          await input.fill(String(value));
          break;
        }
      }
    }

    const submitBtn = await page.$('button[name="submit"]');
    if (!submitBtn) {
      const applyBtn = await page.locator('button:has-text("Apply"), button:has-text("OK")').first();
      if (await applyBtn.count()) await applyBtn.click();
    } else {
      await submitBtn.click();
    }
    await page.waitForTimeout(500);

    return { success: true, message: 'Strategy settings pasted' };
  } catch (error) {
    return { success: false, message: 'Error pasting settings', error: error.message };
  }
}

async function cloneStrategy(page, sourceName, targetName = null) {
  const copyResult = await copyStrategySettings(page, sourceName);
  if (!copyResult.success) return copyResult;

  const pasteResult = await pasteStrategySettings(page, targetName, copyResult.settings);
  return pasteResult;
}

async function main() {
  const action = process.argv[2] || 'clone';
  const source = process.argv[3];
  const target = process.argv[4];
  const { browser, page } = await launchBrowser({ headless: false });

  try {
    await openChart(page);
    let result;
    switch (action) {
      case 'copy': result = await copyStrategySettings(page, source); break;
      case 'paste': result = await pasteStrategySettings(page, source, target ? JSON.parse(target) : {}); break;
      case 'clone': result = await cloneStrategy(page, source, target); break;
      default: result = { success: false, message: 'Usage: clone|copy|paste <source> [target]' };
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { copyStrategySettings, pasteStrategySettings, cloneStrategy };
if (require.main === module) main();
