/**
 * Workflow: Setup Dead Zone Indicator
 *
 * 1. Open chart
 * 2. Remove all existing indicators
 * 3. Add "The Dead Zone [v5]" from favorites
 *
 * Usage:
 *   node workflows/setup-dead-zone.js [SYMBOL]
 *   node workflows/setup-dead-zone.js BINANCE:BTCUSDT
 */

const { launchBrowser, openChart, closeBrowser } = require('../lib/browser');
const { changeSymbol } = require('../skills/change-symbol');
const { getIndicatorList, removeIndicator, addFavoriteIndicator } = require('../skills/get-indicator-list');

async function setupDeadZone(page, options = {}) {
  const { symbol = null } = options;
  const results = [];

  // Step 1: Change symbol if specified
  if (symbol) {
    console.log(`[workflow] Changing symbol to ${symbol}...`);
    const symbolResult = await changeSymbol(page, symbol);
    results.push({ step: 'changeSymbol', ...symbolResult });
    if (!symbolResult.success) {
      return { success: false, message: `Failed at changeSymbol: ${symbolResult.message}`, results };
    }
  }

  // Step 2: Get current indicators and remove them all
  console.log('[workflow] Getting current indicators...');
  const listResult = await getIndicatorList(page);
  results.push({ step: 'getIndicatorList', ...listResult });

  if (listResult.success && listResult.count > 0) {
    console.log(`[workflow] Removing ${listResult.count} indicator(s)...`);
    for (const indicator of listResult.indicators) {
      if (!indicator.name) continue;
      console.log(`[workflow]   Removing "${indicator.name}"...`);
      const removeResult = await removeIndicator(page, indicator.name);
      results.push({ step: `removeIndicator:${indicator.name}`, ...removeResult });
    }
  } else {
    console.log('[workflow] No indicators to remove.');
  }

  // Wait for chart to stabilize after removing indicators
  await page.waitForTimeout(1000);

  // Dismiss any popups that may have appeared (free account limits, etc.)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Step 3: Add "The Dead Zone [v5]" from favorites
  console.log('[workflow] Adding "The Dead Zone [v5]" from favorites...');
  const addResult = await addFavoriteIndicator(page, 'Dead Zone');
  results.push({ step: 'addFavoriteIndicator', ...addResult });

  const allSucceeded = results.every(r => r.success !== false);

  return {
    success: allSucceeded,
    message: allSucceeded
      ? 'Dead Zone indicator setup complete'
      : 'Workflow completed with some failures',
    results,
  };
}

async function main() {
  const symbol = process.argv[2] || null;
  const { browser, page } = await launchBrowser({ headless: false });

  try {
    console.log('=== Setup Dead Zone Workflow ===\n');
    await openChart(page);
    const result = await setupDeadZone(page, { symbol });
    console.log('\n=== Result ===');
    console.log(JSON.stringify(result, null, 2));

    // Keep browser open for inspection
    console.log('\nKeeping browser open for 10 seconds...');
    await page.waitForTimeout(10000);
  } catch (error) {
    console.error('Workflow FAILED:', error.message);
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { setupDeadZone };
if (require.main === module) main();
