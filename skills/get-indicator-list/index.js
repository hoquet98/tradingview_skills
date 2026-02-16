const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

async function getIndicatorList(page) {
  try {
    // Wait for chart to fully load - legend items appear after chart renders
    await page.waitForSelector('div[data-qa-id="legend-source-item"]', { timeout: 5000 }).catch(() => {});

    // Use page.evaluate to query legend items and force toolbar visibility
    // (TradingView hides toolbar buttons with blockHidden-* class until hover)
    const indicators = await page.evaluate(() => {
      const LEGEND_ITEM = 'div[data-qa-id="legend-source-item"]';
      const TITLE = '[data-qa-id="legend-source-title"]';
      const EYE_BTN = '[data-qa-id="legend-show-hide-action"]';
      const DELETE_BTN = '[data-qa-id="legend-delete-action"]';
      const BUTTONS_WRAPPER = '[class*="buttonsWrapper"]';
      const HIDDEN_CLASS = 'blockHidden-e6PF69Df';

      const items = document.querySelectorAll(LEGEND_ITEM);
      return Array.from(items).map(item => {
        // Force toolbar visible so we can inspect buttons
        const toolbar = item.querySelector(BUTTONS_WRAPPER);
        if (toolbar) {
          toolbar.classList.remove(HIDDEN_CLASS);
          toolbar.style.display = 'flex';
        }

        // Force all buttons visible
        item.querySelectorAll('button').forEach(btn => {
          btn.classList.remove(HIDDEN_CLASS);
        });

        const titleEl = item.querySelector(TITLE);
        const eyeBtn = item.querySelector(EYE_BTN);
        const deleteBtn = item.querySelector(DELETE_BTN);

        return {
          name: titleEl?.textContent?.trim() || null,
          visible: eyeBtn ? eyeBtn.getAttribute('aria-label') !== 'Show' : true,
          canDelete: !!deleteBtn,
        };
      });
    });

    return { success: true, indicators, count: indicators.length };
  } catch (error) {
    return { success: false, message: 'Error getting indicators', error: error.message };
  }
}

/**
 * Opens the indicators dialog and returns when it's ready.
 * Reused by addIndicator and addFavoriteIndicator.
 */
async function openIndicatorsDialog(page) {
  const indicatorsBtn = page.locator('#header-toolbar-indicators button[data-name="open-indicators-dialog"]').first();
  if (!(await indicatorsBtn.count())) {
    return { success: false, message: 'Indicators button not found' };
  }
  await indicatorsBtn.click();
  await page.waitForSelector('[data-name="indicators-dialog"]', { timeout: 5000 });
  await page.waitForTimeout(500);
  return { success: true };
}

/**
 * Closes the indicators dialog.
 */
async function closeIndicatorsDialog(page) {
  const closeBtn = await page.$('[data-name="indicators-dialog"] [data-qa-id="close"]');
  if (closeBtn) await closeBtn.click();
}

async function addIndicator(page, indicatorName = 'SMA') {
  try {
    const openResult = await openIndicatorsDialog(page);
    if (!openResult.success) return openResult;

    // Type in the search box
    const searchInput = await page.$('#indicators-dialog-search-input');
    if (!searchInput) {
      await closeIndicatorsDialog(page);
      return { success: false, message: 'Indicator search input not found' };
    }

    await searchInput.fill(indicatorName);
    await page.waitForTimeout(1000);

    // Click the first matching list item (items have data-role="list-item" and data-title)
    const resultItem = await page.$('[data-name="indicators-dialog"] [data-role="list-item"]');
    if (resultItem) {
      await resultItem.click();
      await page.waitForTimeout(1000);
    } else {
      await closeIndicatorsDialog(page);
      return { success: false, message: `No results found for "${indicatorName}"` };
    }

    await closeIndicatorsDialog(page);
    return { success: true, message: `Indicator "${indicatorName}" added` };
  } catch (error) {
    return { success: false, message: 'Error adding indicator', error: error.message };
  }
}

// Sidebar section name -> data-qa-id mapping
const SIDEBAR_SECTIONS = {
  favorites: 'indicator-sidebar-item-favorites',
  'my-scripts': 'indicator-sidebar-item-my-scripts',
  'invite-only': 'indicator-sidebar-item-invite-only-scripts',
  purchased: 'indicator-sidebar-item-purchased',
  technicals: 'indicator-sidebar-item-built-ins',
  fundamentals: 'indicator-sidebar-item-fundamentals',
  'editors-picks': 'indicator-sidebar-item-editors-picks',
  top: 'indicator-sidebar-item-top',
  trending: 'indicator-sidebar-item-trending',
  store: 'indicator-sidebar-item-store',
};

/**
 * Add an indicator/strategy from a specific section of the indicators dialog.
 * @param {object} page - Playwright page
 * @param {string} indicatorName - Name (or partial name) to match
 * @param {string} section - Sidebar section key (e.g. 'favorites', 'invite-only', 'technicals')
 */
async function addIndicatorFromSection(page, indicatorName, section = 'favorites') {
  try {
    if (!indicatorName) {
      return { success: false, message: 'Indicator name required' };
    }

    const openResult = await openIndicatorsDialog(page);
    if (!openResult.success) return openResult;

    // Navigate to the requested sidebar section
    const sidebarQaId = SIDEBAR_SECTIONS[section];
    if (sidebarQaId) {
      const sidebarItem = await page.$(`[data-qa-id="${sidebarQaId}"]`);
      if (sidebarItem) {
        await sidebarItem.click();
        await page.waitForTimeout(500);
      } else {
        await closeIndicatorsDialog(page);
        return { success: false, message: `Sidebar section "${section}" not found` };
      }
    }

    // Find the indicator by data-title attribute in list items
    const listItems = await page.$$('[data-name="indicators-dialog"] [data-role="list-item"]');
    for (const item of listItems) {
      const title = await item.getAttribute('data-title');
      if (title?.toLowerCase().includes(indicatorName.toLowerCase())) {
        await item.click();
        await page.waitForTimeout(1000);
        await closeIndicatorsDialog(page);
        return { success: true, message: `Indicator "${indicatorName}" added from ${section}` };
      }
    }

    // Fallback: try searching if not found in the section
    const searchInput = await page.$('#indicators-dialog-search-input');
    if (searchInput) {
      await searchInput.fill(indicatorName);
      await page.waitForTimeout(1000);

      const searchResult = await page.$('[data-name="indicators-dialog"] [data-role="list-item"]');
      if (searchResult) {
        await searchResult.click();
        await page.waitForTimeout(1000);
        await closeIndicatorsDialog(page);
        return { success: true, message: `Indicator "${indicatorName}" added via search` };
      }
    }

    await closeIndicatorsDialog(page);
    return { success: false, message: `Indicator "${indicatorName}" not found in ${section}` };
  } catch (error) {
    return { success: false, message: 'Error adding indicator from section', error: error.message };
  }
}

async function addFavoriteIndicator(page, indicatorName) {
  return addIndicatorFromSection(page, indicatorName, 'favorites');
}

async function removeIndicator(page, indicatorName = null) {
  try {
    // Wait for legend items to load
    await page.waitForSelector('div[data-qa-id="legend-source-item"]', { timeout: 5000 }).catch(() => {});

    // Force toolbar visible on the target indicator and click its delete button via page.evaluate
    // This uses the same pattern as the Chrome extension: remove blockHidden class, force display,
    // then dispatch mousedown/mouseup/click events on the delete button
    const result = await page.evaluate((targetName) => {
      const LEGEND_ITEM = 'div[data-qa-id="legend-source-item"]';
      const TITLE = '[data-qa-id="legend-source-title"]';
      const DELETE_BTN = '[data-qa-id="legend-delete-action"]';
      const BUTTONS_WRAPPER = '[class*="buttonsWrapper"]';
      const HIDDEN_CLASS = 'blockHidden-e6PF69Df';

      const items = document.querySelectorAll(LEGEND_ITEM);
      for (const item of items) {
        const titleEl = item.querySelector(TITLE);
        const name = titleEl?.textContent?.trim() || '';

        if (!targetName || name.includes(targetName)) {
          // Force toolbar visible (extension pattern)
          const toolbar = item.querySelector(BUTTONS_WRAPPER);
          if (toolbar) {
            toolbar.classList.remove(HIDDEN_CLASS);
            toolbar.style.display = 'flex';
          }

          // Find and force-show the delete button
          const deleteBtn = item.querySelector(DELETE_BTN);
          if (deleteBtn) {
            deleteBtn.classList.remove(HIDDEN_CLASS);
            deleteBtn.style.display = 'block';
            deleteBtn.style.opacity = '1';

            // Simulate full click sequence (extension pattern)
            ['mousedown', 'mouseup', 'click'].forEach(type => {
              deleteBtn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
            });
            return { found: true, deleted: true, name };
          }

          return { found: true, deleted: false, name, error: 'Delete button not found' };
        }
      }
      return { found: false, deleted: false };
    }, indicatorName);

    if (!result.found) {
      return { success: false, message: indicatorName ? `Indicator "${indicatorName}" not found` : 'No indicators found' };
    }

    if (result.deleted) {
      await page.waitForTimeout(500);
      return { success: true, message: `Indicator "${result.name}" removed` };
    }

    // Fallback: try the "more" menu if direct delete button wasn't found
    const legendItems = await page.$$('div[data-qa-id="legend-source-item"]');
    for (const item of legendItems) {
      const name = await item.$eval('[data-qa-id="legend-source-title"]', el => el.textContent?.trim()).catch(() => '');
      if (!indicatorName || name?.includes(indicatorName)) {
        const moreBtn = await item.$('[data-qa-id="legend-more-action"]');
        if (moreBtn) {
          await moreBtn.click();
          await page.waitForTimeout(300);
          const removeItem = page.locator('[role="menuitem"]:has-text("Remove")').first();
          if (await removeItem.count()) {
            await removeItem.click();
            await page.waitForTimeout(500);
            return { success: true, message: `Indicator "${name}" removed` };
          }
          await page.keyboard.press('Escape');
        }
        break;
      }
    }

    return { success: false, message: `Could not find remove option for "${result.name}"` };
  } catch (error) {
    return { success: false, message: 'Error removing indicator', error: error.message };
  }
}

async function getIndicatorSettings(page, indicatorName = null) {
  try {
    const indicators = await page.$$('div[data-qa-id="legend-source-item"]');
    let targetIndicator = indicators[0];

    if (indicatorName) {
      for (const ind of indicators) {
        const name = await ind.$eval('[data-qa-id="legend-source-title"]', el => el.textContent).catch(() => '');
        if (name?.includes(indicatorName)) {
          targetIndicator = ind;
          break;
        }
      }
    }

    if (!targetIndicator) {
      return { success: false, message: 'No indicator found' };
    }

    const settingsBtn = await targetIndicator.$('[data-qa-id="legend-settings-action"]');
    if (settingsBtn) {
      await settingsBtn.click();
      await page.waitForSelector('[data-name="indicator-properties-dialog"]', { timeout: 5000 });
    }

    const settings = await page.evaluate(() => {
      const inputs = document.querySelectorAll('[class*="cell-"] input, [class*="input-"] input');
      const result = {};
      inputs.forEach((input, idx) => {
        const label = input.closest('[class*="cell-"]')?.querySelector('[class*="label-"]')?.textContent || `param_${idx}`;
        result[label.trim()] = input.value;
      });
      return result;
    });

    const closeBtn = await page.$('[data-name="close"]');
    if (closeBtn) await closeBtn.click();

    return { success: true, settings };
  } catch (error) {
    return { success: false, message: 'Error getting settings', error: error.message };
  }
}

async function setIndicatorSettings(page, indicatorName = null, settings = {}) {
  try {
    const indicators = await page.$$('div[data-qa-id="legend-source-item"]');
    let targetIndicator = indicators[0];

    if (indicatorName) {
      for (const ind of indicators) {
        const name = await ind.$eval('[data-qa-id="legend-source-title"]', el => el.textContent).catch(() => '');
        if (name?.includes(indicatorName)) {
          targetIndicator = ind;
          break;
        }
      }
    }

    if (!targetIndicator) {
      return { success: false, message: 'No indicator found' };
    }

    const settingsBtn = await targetIndicator.$('[data-qa-id="legend-settings-action"]');
    if (settingsBtn) {
      await settingsBtn.click();
      await page.waitForSelector('[data-name="indicator-properties-dialog"]', { timeout: 5000 });
    }

    for (const [key, value] of Object.entries(settings)) {
      const inputs = await page.$$('[class*="cell-"] input, [class*="input-"] input');
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
      const applyBtn = await page.locator('button:has-text("Apply")').first();
      if (await applyBtn.count()) await applyBtn.click();
    } else {
      await submitBtn.click();
    }
    await page.waitForTimeout(500);

    return { success: true, message: 'Settings updated' };
  } catch (error) {
    return { success: false, message: 'Error setting settings', error: error.message };
  }
}

async function main() {
  const action = process.argv[2];
  const name = process.argv[3];
  const settingsArg = process.argv[4];
  const settings = settingsArg ? JSON.parse(settingsArg) : {};

  const { browser, page } = await launchBrowser({ headless: false });

  try {
    await openChart(page);

    let result;
    switch (action) {
      case 'list': result = await getIndicatorList(page); break;
      case 'add': result = await addIndicator(page, name); break;
      case 'remove': result = await removeIndicator(page, name); break;
      case 'get-settings': result = await getIndicatorSettings(page, name); break;
      case 'set-settings': result = await setIndicatorSettings(page, name, settings); break;
      default: result = { success: false, message: 'Usage: list|add|remove|get-settings|set-settings <name> [settings]' };
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { getIndicatorList, addIndicator, addIndicatorFromSection, addFavoriteIndicator, removeIndicator, getIndicatorSettings, setIndicatorSettings };
if (require.main === module) main();
