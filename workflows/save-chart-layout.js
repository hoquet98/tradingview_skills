/**
 * Save Chart Layout Workflow
 * Load a strategy on a chart via Playwright, save to a new layout, and return the chart URL.
 * This requires Playwright (browser automation) because WS chart sessions are ephemeral.
 *
 * Usage:
 *   node workflows/save-chart-layout.js "RSI Strategy" BINANCE:BTCUSDT D
 *   node workflows/save-chart-layout.js "RSI Strategy" NASDAQ:AAPL 60 "My Layout Name"
 */
const { launchBrowser, openChart, closeBrowser } = require('../lib/browser');
const { changeSymbol } = require('../skills/change-symbol');
const { changeTimeframe } = require('../skills/change-timeframe');
const { addIndicator } = require('../skills/get-indicator-list');

async function saveChartLayout(strategyName, options = {}) {
  const {
    symbol = 'BINANCE:BTCUSDT',
    timeframe = 'D',
    layoutName = null,
    headless = false,
  } = options;

  if (!strategyName) {
    return { success: false, message: 'Strategy name required' };
  }

  const { browser, page } = await launchBrowser({ headless });

  try {
    await openChart(page);
    const results = { strategyName, symbol, timeframe };

    // 1. Change symbol
    const symResult = await changeSymbol(page, symbol);
    results.symbolChanged = symResult.success;

    // 2. Change timeframe
    const tfResult = await changeTimeframe(page, timeframe);
    results.timeframeChanged = tfResult.success;

    // 3. Add the strategy (addIndicator has built-in study limit check)
    const addResult = await addIndicator(page, strategyName);
    results.strategyAdded = addResult.success;
    if (!addResult.success) {
      const reason = addResult.limitReached
        ? `Study limit reached on ${addResult.plan} plan (${addResult.maxStudies} max). ` +
          `Current studies: ${addResult.currentStudies?.join(', ') || 'none'}. ` +
          `Remove an existing indicator/strategy first.`
        : addResult.message;
      return { success: false, message: `Failed to add strategy: ${reason}`, ...results };
    }

    // Wait for strategy to load
    await page.waitForTimeout(3000);

    // 4. Save as new layout
    // Use Ctrl+Shift+S (Save As) keyboard shortcut
    const actualLayoutName = layoutName || `${strategyName} - ${symbol} ${timeframe}`;

    // Click the layout dropdown to access Save As
    const layoutBtn = page.locator('#header-toolbar-save-load').first();
    if (await layoutBtn.count()) {
      await layoutBtn.click();
      await page.waitForTimeout(500);

      // Look for "Save layout as" or "Make a copy" in dropdown
      const saveAsItem = page.locator('[role="menuitem"]:has-text("Make a copy"), [role="menuitem"]:has-text("Save layout as")').first();
      if (await saveAsItem.count()) {
        await saveAsItem.click();
        await page.waitForTimeout(500);

        // Fill in the layout name
        const nameInput = page.locator('input[maxlength], [data-name="rename-dialog"] input').first();
        if (await nameInput.count()) {
          await nameInput.fill(actualLayoutName);
          await page.waitForTimeout(300);

          // Click Save button
          const saveBtn = page.locator('button:has-text("Save"), button[name="submit"]').first();
          if (await saveBtn.count()) {
            await saveBtn.click();
            await page.waitForTimeout(2000);
            results.layoutSaved = true;
            results.layoutName = actualLayoutName;
          }
        }
      } else {
        // Fallback: try Ctrl+S to save current layout
        await page.keyboard.press('Escape');
        await page.keyboard.press('Control+s');
        await page.waitForTimeout(1000);
        results.layoutSaved = true;
        results.layoutName = 'Current layout (updated)';
      }
    }

    // 5. Get the chart URL
    const currentUrl = page.url();
    results.chartUrl = currentUrl;

    // Try to extract the layout ID from the URL
    const layoutMatch = currentUrl.match(/\/chart\/([^/?#]+)/);
    if (layoutMatch) {
      results.layoutId = layoutMatch[1];
    }

    return { success: true, message: `Chart layout saved: ${actualLayoutName}`, ...results };
  } catch (error) {
    return { success: false, message: 'Save chart layout error', error: error.message };
  } finally {
    await closeBrowser(browser);
  }
}

async function main() {
  const strategyName = process.argv[2] || 'RSI Strategy';
  const symbol = process.argv[3] || 'BINANCE:BTCUSDT';
  const timeframe = process.argv[4] || 'D';
  const layoutName = process.argv[5] || null;

  try {
    const result = await saveChartLayout(strategyName, { symbol, timeframe, layoutName });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Workflow error', error: error.message }, null, 2));
  }
}

module.exports = { saveChartLayout };
if (require.main === module) main();
