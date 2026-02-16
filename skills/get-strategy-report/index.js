const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

async function getStrategyReport(page, tab = 'overview') {
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
  const tab = process.argv[2] || 'overview';
  const { browser, page } = await launchBrowser({ headless: false });

  try {
    await openChart(page);
    const result = await getStrategyReport(page, tab);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { getStrategyReport };
if (require.main === module) main();
