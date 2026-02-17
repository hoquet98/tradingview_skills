const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

const TVSelectors = {
  STRATEGY_TESTER_TAB: 'button[data-name="backtesting"]',
  NEW_STRATEGY_BUTTON: '[data-qa-id="new-strategy"]',
  STRATEGY_SEARCH_INPUT: 'input[placeholder*="strategy"]',
  STRATEGY_LEGEND_ITEM: 'div[data-qa-id="legend-source-item"]',
  STRATEGY_TITLE: '[data-qa-id="legend-source-title"]',
  SETTINGS_BUTTON: '[data-qa-id="legend-settings-action"]',
  SETTINGS_DIALOG: '[data-name="indicator-properties-dialog"]',
  SETTINGS_DIALOG_OK: 'button[name="submit"][data-name="submit-button"]',
};

async function addStrategy(page, strategyName = 'SMA Crossover') {
  try {
    // Pre-flight study limit check
    const { checkStudyCapacity } = require('../../lib/study-limits');
    const capacity = await checkStudyCapacity(page, 1);
    if (!capacity.canAdd) {
      return {
        success: false,
        message: `Cannot add strategy "${strategyName}": ${capacity.message}`,
        limitReached: true,
        currentStudies: capacity.currentStudies,
        maxStudies: capacity.maxStudies,
        plan: capacity.plan,
      };
    }

    // Step 1: Open Strategy Tester panel
    let strategyTesterBtn = await page.$(TVSelectors.STRATEGY_TESTER_TAB);
    if (!strategyTesterBtn) {
      strategyTesterBtn = await page.$('button[aria-label*="Strategy Tester"], button[aria-label*="Backtesting"]');
      if (!strategyTesterBtn) {
        return { success: false, message: 'Strategy Tester button not found' };
      }
    }
    await strategyTesterBtn.click();
    await page.waitForTimeout(1000);

    // Step 2: Look for "New Strategy" button
    let newStrategyBtn = await page.$(TVSelectors.NEW_STRATEGY_BUTTON);

    if (!newStrategyBtn) {
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await btn.textContent();
        if (text && (text.toLowerCase().includes('new strategy') || text.toLowerCase().includes('add strategy'))) {
          newStrategyBtn = btn;
          break;
        }
      }
    }

    if (newStrategyBtn) {
      await newStrategyBtn.click();
      await page.waitForTimeout(500);
    } else {
      const existingStrategy = await page.$(TVSelectors.STRATEGY_LEGEND_ITEM);
      if (existingStrategy) {
        return { success: true, message: 'A strategy is already added to the chart', strategyName };
      }
      return { success: false, message: 'Could not find Add/New Strategy button' };
    }

    // Step 3: Search for the strategy
    const searchInput = await page.$(TVSelectors.STRATEGY_SEARCH_INPUT);
    if (searchInput) {
      await searchInput.fill('');
      await searchInput.type(strategyName);
      await page.waitForTimeout(1000);
    }

    // Step 4: Select the strategy from the list
    let strategyOption = await page.$(`[title*="${strategyName}"], [data-name*="${strategyName}"]`);

    if (!strategyOption) {
      const options = await page.$$('[role="option"], [class*="option"], [class*="item"]');
      for (const option of options) {
        const text = await option.textContent();
        if (text && text.toLowerCase().includes(strategyName.toLowerCase())) {
          strategyOption = option;
          break;
        }
      }
    }

    if (strategyOption) {
      await strategyOption.click();
      await page.waitForTimeout(2000);

      const strategyLegend = await page.$(TVSelectors.STRATEGY_LEGEND_ITEM);
      if (strategyLegend) {
        return { success: true, message: `Strategy "${strategyName}" added to chart`, strategyName };
      } else {
        return { success: false, message: 'Strategy selected but not visible on chart' };
      }
    } else {
      return { success: false, message: `Strategy "${strategyName}" not found in the list` };
    }
  } catch (error) {
    return { success: false, message: 'Error adding strategy', error: error.message };
  }
}

async function main() {
  const strategyName = process.argv[2] || 'SMA Crossover';
  const { browser, page } = await launchBrowser();

  try {
    await openChart(page);
    const result = await addStrategy(page, strategyName);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { addStrategy, TVSelectors };
if (require.main === module) main();
