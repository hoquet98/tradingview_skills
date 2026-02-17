const { fetchStrategyReport, close } = require('../../lib/ws-client');

/**
 * Get strategy backtest report.
 * - WebSocket mode (default): pass scriptId as first arg
 * - Playwright mode (backward compat): pass a Playwright page as first arg
 *
 * @param {string|Page} scriptIdOrPage - Script ID (e.g. 'PUB;xxxxx') or Playwright page
 * @param {string|Object} [symbolOrTab] - Symbol for WS mode, or tab name for Playwright mode
 * @param {Object} [options] - { timeframe, range } for WS mode
 * @returns {Promise<{success:boolean, message:string, report?:Object}>}
 */
async function getStrategyReport(scriptIdOrPage, symbolOrTab, options) {
  if (scriptIdOrPage && typeof scriptIdOrPage.evaluate === 'function') {
    return getStrategyReportPlaywright(scriptIdOrPage, symbolOrTab);
  }
  return getStrategyReportWS(scriptIdOrPage, symbolOrTab, options);
}

async function getStrategyReportWS(scriptId, symbol = 'BINANCE:BTCUSDT', options = {}) {
  const { timeframe = 'D', range = 1000 } = options;

  try {
    const report = await fetchStrategyReport(scriptId, symbol, { timeframe, range });

    const result = {
      success: true,
      message: 'Strategy report retrieved via WebSocket',
      report: {
        performance: report.performance || {},
        trades: report.trades || [],
        tradeCount: report.trades ? report.trades.length : 0,
        history: report.history || {},
        currency: report.currency || '',
        settings: report.settings || {},
      },
    };

    return result;
  } catch (error) {
    return { success: false, message: 'Error getting strategy report', error: error.message };
  }
}

async function getStrategyReportPlaywright(page, tab = 'overview') {
  try {
    const strategyTesterBtn = await page.$('button[data-name="backtesting"]');
    if (strategyTesterBtn) {
      await strategyTesterBtn.click();
      await page.waitForTimeout(1000);
    }

    const tabSelectors = {
      overview: 'button#Overview, button#Strategy\\ report',
      performance: 'button#Performance',
      tradeAnalysis: 'button#Trades\\ Analysis',
      riskRatios: 'button#Ratios',
      listOfTrades: 'button#List\\ of\\ Trades',
    };

    const tabSelector = tabSelectors[tab] || tabSelectors.overview;
    const tabButton = await page.$(tabSelector);
    if (tabButton) {
      await tabButton.click();
      await page.waitForTimeout(500);
    }

    const report = await page.evaluate((targetTab) => {
      const stats = {};
      const rows = document.querySelectorAll('#bottom-area .bottom-widgetbar-content.backtesting div[class^="containerCell-"], #bottom-area div[class^="containerCell-"]');

      if (rows.length === 0) {
        const altRows = document.querySelectorAll('[class^="containerCell-"], [class*="reportContainer"]');
        altRows.forEach(row => {
          const label = row.querySelector('[class^="title-"]')?.textContent?.trim();
          const value = row.querySelector('[class^="highlightedValue-"], [class^="value-"]')?.textContent?.trim();
          if (label && value) stats[label] = value;
        });
      } else {
        rows.forEach(row => {
          const label = row.querySelector('div[class^="title-"]')?.textContent?.trim();
          const value = row.querySelector('div[class^="highlightedValue-"], div[class^="value-"]')?.textContent?.trim();
          if (label && value) stats[label] = value;
        });
      }

      const tables = document.querySelectorAll('#bottom-area table.ka-table, table[class*="ka-table"]');
      tables.forEach((table, idx) => {
        const tableRows = table.querySelectorAll('tr.ka-tr');
        tableRows.forEach(row => {
          const label = row.querySelector('td:first-child, th:first-child')?.textContent?.trim();
          const value = row.querySelector('td:last-child, [class^="value-"]')?.textContent?.trim();
          if (label && value && label !== 'Symbol' && label !== 'Order') {
            stats[`${targetTab}_table_${idx}_${label}`] = value;
          }
        });
      });

      return stats;
    }, tab);

    const strategyInfo = await page.evaluate(() => {
      const strategyTitle = document.querySelector('[data-qa-id="legend-source-title"]');
      return { name: strategyTitle?.textContent?.trim() || 'Unknown Strategy' };
    });

    let tradeCount;
    if (tab === 'listOfTrades') {
      const tradeRows = await page.$$('tr[data]');
      tradeCount = tradeRows.length;
    }

    return {
      success: true,
      message: `Strategy report retrieved from ${tab} tab`,
      tab,
      strategyName: strategyInfo.name,
      report,
      tradeCount: tradeCount > 0 ? tradeCount : undefined,
    };
  } catch (error) {
    return { success: false, message: 'Error getting strategy report', error: error.message };
  }
}

async function main() {
  // CLI: node index.js <scriptId> [symbol] [timeframe]
  const scriptId = process.argv[2];
  const symbol = process.argv[3] || 'BINANCE:BTCUSDT';
  const timeframe = process.argv[4] || 'D';

  if (!scriptId) {
    console.log(JSON.stringify({
      success: false,
      message: 'Usage: node index.js <scriptId> [symbol] [timeframe]\n  Example: node index.js STD;Stochastic_RSI BINANCE:BTCUSDT D',
    }, null, 2));
    return;
  }

  try {
    const result = await getStrategyReport(scriptId, symbol, { timeframe });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await close();
  }
}

module.exports = { getStrategyReport };
if (require.main === module) main();
