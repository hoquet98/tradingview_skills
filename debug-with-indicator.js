const { launchBrowser, openChart, closeBrowser } = require('./lib/browser');
const { addFavoriteIndicator } = require('./skills/get-indicator-list');

async function main() {
  const { browser, page } = await launchBrowser({ headless: false });

  try {
    await openChart(page);

    // Add an indicator first
    console.log('Adding Dead Zone indicator...');
    const addResult = await addFavoriteIndicator(page, 'Dead Zone');
    console.log('Add result:', JSON.stringify(addResult));

    await page.waitForTimeout(2000);

    // Now inspect the legend DOM with an indicator present
    console.log('\n=== Legend with indicator loaded ===');
    const legendInfo = await page.evaluate(() => {
      const results = {
        seriesItems: [],
        legendChildren: [],
        allLegendQa: [],
      };

      // Check data-qa-id="legend-series-item" (the CORRECT one from debug)
      const seriesItems = document.querySelectorAll('[data-qa-id="legend-series-item"]');
      results.seriesItems = Array.from(seriesItems).map(item => ({
        text: item.textContent?.trim().substring(0, 200),
        visible: item.offsetParent !== null,
        childClasses: Array.from(item.children).map(c => c.className?.substring(0, 80)),
        innerHTML: item.innerHTML?.substring(0, 500),
      }));

      // Get the entire legend wrapper and its children
      const legend = document.querySelector('[data-qa-id="legend"]');
      if (legend) {
        const children = legend.querySelectorAll('div[class*="source"], div[class*="wrapper"]');
        results.legendChildren = Array.from(children).filter(c => c.offsetParent !== null).map(c => ({
          class: c.className?.substring(0, 120),
          text: c.textContent?.trim().substring(0, 200),
          dataQaId: c.getAttribute('data-qa-id'),
          dataName: c.getAttribute('data-name'),
        }));
      }

      // Get all data-qa-id values containing "legend"
      const allQa = document.querySelectorAll('[data-qa-id*="legend"]');
      results.allLegendQa = Array.from(allQa).filter(e => e.offsetParent !== null).map(e => ({
        qaId: e.getAttribute('data-qa-id'),
        tag: e.tagName,
        text: e.textContent?.trim().substring(0, 100),
      }));

      return results;
    });

    console.log('\ndata-qa-id="legend-series-item":');
    console.log(JSON.stringify(legendInfo.seriesItems, null, 2));

    console.log('\nLegend children:');
    console.log(JSON.stringify(legendInfo.legendChildren, null, 2));

    console.log('\nAll legend data-qa-id elements:');
    console.log(JSON.stringify(legendInfo.allLegendQa, null, 2));

    await page.screenshot({ path: 'debug-with-indicator.png', fullPage: false });
    console.log('\nScreenshot saved');

    console.log('\nKeeping open 20s...');
    await page.waitForTimeout(20000);
  } finally {
    await closeBrowser(browser);
  }
}

main();
