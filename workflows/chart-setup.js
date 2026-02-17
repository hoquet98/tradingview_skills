/**
 * Chart Setup Workflow
 * Configure a chart with symbol, timeframe, chart type, and indicators via Playwright.
 *
 * Usage:
 *   node workflows/chart-setup.js BINANCE:BTCUSDT 240 "Heikin Ashi" RSI,MACD,Volume
 *   node workflows/chart-setup.js NASDAQ:AAPL D Candles RSI
 *   node workflows/chart-setup.js BINANCE:ETHUSDT 60
 */
const { launchBrowser, openChart, closeBrowser } = require('../lib/browser');
const { changeSymbol } = require('../skills/change-symbol');
const { changeTimeframe } = require('../skills/change-timeframe');
const { setChartType } = require('../skills/set-chart-type');
const { addIndicator } = require('../skills/get-indicator-list');
const { getActiveStrategy } = require('../skills/get-active-strategy');

async function chartSetup(options = {}) {
  const {
    symbol = 'BINANCE:BTCUSDT',
    timeframe = 'D',
    chartType = null,
    indicators = [],
    headless = false,
    screenshot = null,
  } = options;

  const { browser, page } = await launchBrowser({ headless });

  try {
    await openChart(page);
    const results = { symbol, timeframe };

    // 1. Change symbol
    const symResult = await changeSymbol(page, symbol);
    results.symbolChanged = symResult.success;

    // 2. Change timeframe
    const tfResult = await changeTimeframe(page, timeframe);
    results.timeframeChanged = tfResult.success;

    // 3. Set chart type (if specified)
    if (chartType) {
      const ctResult = await setChartType(page, chartType);
      results.chartType = chartType;
      results.chartTypeChanged = ctResult.success;
    }

    // 4. Add indicators (with study limit awareness)
    const { checkStudyCapacity } = require('../lib/study-limits');
    results.indicators = [];

    if (indicators.length > 0) {
      const capacity = await checkStudyCapacity(page, indicators.length);
      results.studyLimits = {
        maxStudies: capacity.maxStudies,
        plan: capacity.plan,
        currentCount: capacity.currentCount,
        available: capacity.available,
        requested: indicators.length,
      };

      if (capacity.available === 0) {
        // No room at all — mark all as skipped
        for (const ind of indicators) {
          results.indicators.push({
            name: ind,
            added: false,
            message: `Study limit reached (${capacity.currentCount}/${capacity.maxStudies} on ${capacity.plan} plan)`,
            limitReached: true,
          });
        }
        results.studyLimitWarning = capacity.message;
      } else {
        // Add as many as we can
        for (let i = 0; i < indicators.length; i++) {
          const ind = indicators[i];
          const indResult = await addIndicator(page, ind);
          results.indicators.push({
            name: ind,
            added: indResult.success,
            message: indResult.message,
            limitReached: indResult.limitReached || false,
          });

          // If limit reached, skip remaining
          if (indResult.limitReached) {
            for (let j = i + 1; j < indicators.length; j++) {
              results.indicators.push({
                name: indicators[j],
                added: false,
                message: `Skipped: study limit reached (${capacity.maxStudies} max on ${capacity.plan} plan)`,
                limitReached: true,
                skipped: true,
              });
            }
            results.studyLimitWarning =
              `Could only add ${i} of ${indicators.length} requested indicators. ` +
              `${capacity.plan} plan allows ${capacity.maxStudies} studies total.`;
            break;
          }
        }
      }
    }

    // 5. Get final chart state
    const state = await getActiveStrategy(page);
    if (state.success) {
      results.chartState = state.strategies;
    }

    // 6. Screenshot (if requested)
    if (screenshot) {
      const { takeScreenshot } = require('../skills/set-chart-type');
      await takeScreenshot(page, { path: screenshot });
      results.screenshot = screenshot;
    }

    return { success: true, message: 'Chart configured', ...results };
  } catch (error) {
    return { success: false, message: 'Chart setup error', error: error.message };
  } finally {
    if (options.keepOpen) {
      console.log('Browser left open. Press Ctrl+C to close.');
      await new Promise(() => {}); // Keep alive
    } else {
      await closeBrowser(browser);
    }
  }
}

async function main() {
  const symbol = process.argv[2] || 'BINANCE:BTCUSDT';
  const timeframe = process.argv[3] || 'D';
  const chartType = process.argv[4] || null;
  const indicators = process.argv[5] ? process.argv[5].split(',') : [];

  try {
    const result = await chartSetup({ symbol, timeframe, chartType, indicators });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Workflow error', error: error.message }, null, 2));
  }
}

module.exports = { chartSetup };
if (require.main === module) main();
