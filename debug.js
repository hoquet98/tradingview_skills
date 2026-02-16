const { launchBrowser, openChart, closeBrowser } = require('./lib/browser');

async function main() {
  const { browser, page } = await launchBrowser({ headless: false });

  try {
    await openChart(page);

    // Debug: find the indicators button
    console.log('\n=== Searching for Indicators button ===');
    const candidates = await page.evaluate(() => {
      const results = [];
      const allButtons = document.querySelectorAll('button');
      for (const btn of allButtons) {
        const text = btn.textContent?.trim() || '';
        const aria = btn.getAttribute('aria-label') || '';
        const dataName = btn.getAttribute('data-name') || '';
        const dataTooltip = btn.getAttribute('data-tooltip') || '';
        if (
          text.toLowerCase().includes('indicator') ||
          aria.toLowerCase().includes('indicator') ||
          dataName.toLowerCase().includes('indicator') ||
          dataTooltip.toLowerCase().includes('indicator')
        ) {
          results.push({
            text: text.substring(0, 80),
            aria,
            dataName,
            dataTooltip,
            visible: btn.offsetParent !== null,
            tagName: btn.tagName,
            id: btn.id,
          });
        }
      }
      return results;
    });
    console.log('Indicator buttons found:', JSON.stringify(candidates, null, 2));

    // Debug: find legend items (indicators on chart)
    console.log('\n=== Searching for legend items ===');
    const legends = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-qa-id="legend-source-item"]');
      return Array.from(items).map(item => ({
        title: item.querySelector('[data-qa-id="legend-source-title"]')?.textContent?.trim(),
        html: item.innerHTML.substring(0, 200),
      }));
    });
    console.log('Legend items:', JSON.stringify(legends, null, 2));

    // Debug: look at the indicators dialog/search
    console.log('\n=== Looking for indicator search inputs ===');
    const inputs = await page.evaluate(() => {
      const allInputs = document.querySelectorAll('input');
      return Array.from(allInputs).map(input => ({
        placeholder: input.placeholder,
        type: input.type,
        name: input.name,
        visible: input.offsetParent !== null,
        dataQa: input.getAttribute('data-qa-id') || '',
      }));
    });
    console.log('Inputs on page:', JSON.stringify(inputs, null, 2));

    // Take a screenshot for reference
    await page.screenshot({ path: 'debug-screenshot.png', fullPage: false });
    console.log('\nScreenshot saved to debug-screenshot.png');

    console.log('\nKeeping browser open for 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);
  } finally {
    await closeBrowser(browser);
  }
}

main();
