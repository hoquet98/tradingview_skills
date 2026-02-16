const { launchBrowser, openChart, closeBrowser } = require('./lib/browser');

async function main() {
  const { browser, page } = await launchBrowser({ headless: false });

  try {
    await openChart(page);

    // Debug: find legend/indicator items on the chart
    console.log('\n=== Legend area inspection ===');
    const legendInfo = await page.evaluate(() => {
      const results = { legendItems: [], sourceItems: [], allDataQa: [] };

      // Method 1: data-qa-id selectors (what OpenClaw used)
      const qaItems = document.querySelectorAll('[data-qa-id="legend-source-item"]');
      results.sourceItems = Array.from(qaItems).map(i => ({
        text: i.textContent?.trim().substring(0, 100),
        visible: i.offsetParent !== null,
      }));

      // Method 2: look for anything with "legend" in class/data attributes
      const legendElements = document.querySelectorAll('[class*="legend"], [data-name*="legend"]');
      for (const el of legendElements) {
        if (el.offsetParent !== null) {
          results.legendItems.push({
            tag: el.tagName,
            class: el.className?.substring(0, 120),
            dataName: el.getAttribute('data-name'),
            text: el.textContent?.trim().substring(0, 150),
            childCount: el.children.length,
          });
        }
      }

      // Method 3: find all data-qa-id values on the page for reference
      const allQa = document.querySelectorAll('[data-qa-id]');
      const qaSet = new Set();
      for (const el of allQa) {
        qaSet.add(el.getAttribute('data-qa-id'));
      }
      results.allDataQa = Array.from(qaSet).sort();

      return results;
    });

    console.log('data-qa-id="legend-source-item" matches:', legendInfo.sourceItems.length);
    console.log(JSON.stringify(legendInfo.sourceItems, null, 2));

    console.log('\n[class*="legend"] visible elements:');
    console.log(JSON.stringify(legendInfo.legendItems, null, 2));

    console.log('\nAll data-qa-id values on page:');
    console.log(legendInfo.allDataQa.join(', '));

    // Debug: look at the top-left area of chart where indicators typically show
    console.log('\n=== Top-left chart overlay (indicator labels) ===');
    const topLeft = await page.evaluate(() => {
      // TradingView shows indicator names in a floating div at top-left of chart
      const items = document.querySelectorAll('[class*="valuesWrapper"], [class*="sourcesWrapper"], [class*="pane-legend"]');
      return Array.from(items).filter(i => i.offsetParent !== null).map(i => ({
        class: i.className?.substring(0, 120),
        text: i.textContent?.trim().substring(0, 300),
        childCount: i.children.length,
        dataName: i.getAttribute('data-name'),
      }));
    });
    console.log(JSON.stringify(topLeft, null, 2));

    // Also check for the "..." buttons near the chart title (ADAUSD label area)
    console.log('\n=== Chart title/source area ===');
    const titleArea = await page.evaluate(() => {
      const items = document.querySelectorAll('[class*="titleWrap"], [class*="title-"], [class*="sourceWrap"], [class*="main-"]');
      return Array.from(items).filter(i => i.offsetParent !== null && i.textContent?.length < 500).map(i => ({
        class: i.className?.substring(0, 120),
        text: i.textContent?.trim().substring(0, 200),
        dataName: i.getAttribute('data-name'),
      })).slice(0, 20);
    });
    console.log(JSON.stringify(titleArea, null, 2));

    await page.screenshot({ path: 'debug-legend.png', fullPage: false });
    console.log('\nScreenshot saved');

    console.log('\nKeeping open 20s...');
    await page.waitForTimeout(20000);
  } finally {
    await closeBrowser(browser);
  }
}

main();
