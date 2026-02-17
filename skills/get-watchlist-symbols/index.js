const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

async function getWatchlistSymbols(page, watchlistName = null) {
  try {
    const watchlistBtn = await page.$('button[aria-label="Watchlist, details and news"]');
    if (watchlistBtn) {
      await watchlistBtn.click();
      await page.waitForTimeout(1000);
    }

    const watchlistData = await page.evaluate((targetName) => {
      const results = { watchlists: [], currentWatchlist: null, symbols: [] };

      const watchlistHeader = document.querySelector('[class*="headerTitle"], [class*="watchlistHeader"], [data-qa-id*="watchlist-title"]');
      results.currentWatchlist = watchlistHeader?.textContent?.trim() || targetName || 'Default Watchlist';

      const items = document.querySelectorAll('[class*="listItem-"], [class*="rowWrapper-"], [data-qa-id*="watchlist-item"]');
      items.forEach(item => {
        const symbolEl = item.querySelector('[class*="symbol-"], [class*="ticker-"], [class*="title-"], [data-qa-id*="symbol"]');
        const symbol = symbolEl?.textContent?.trim();
        if (symbol) {
          const nameEl = item.querySelector('[class*="name-"], [class*="description-"], [class*="subtitle-"]');
          const priceEl = item.querySelector('[class*="price-"], [class*="lastPrice-"]');
          const changeEl = item.querySelector('[class*="change-"], [class*="percent-"]');
          results.symbols.push({
            symbol,
            name: nameEl?.textContent?.trim() || '',
            price: priceEl?.textContent?.trim() || '',
            change: changeEl?.textContent?.trim() || '',
          });
        }
      });

      const tabs = document.querySelectorAll('[class*="tabButton-"], [class*="watchlistTab"], [role="tab"]');
      tabs.forEach(tab => {
        const name = tab.textContent?.trim();
        const isActive = tab.getAttribute('aria-selected') === 'true';
        if (name) results.watchlists.push({ name, active: isActive });
      });

      return results;
    }, watchlistName);

    return {
      success: true,
      message: `Retrieved ${watchlistData.symbols.length} symbols from watchlist`,
      watchlist: watchlistData.currentWatchlist || watchlistName || 'Default',
      symbols: watchlistData.symbols,
      count: watchlistData.symbols.length,
      availableWatchlists: watchlistData.watchlists,
    };
  } catch (error) {
    return { success: false, message: 'Error getting watchlist symbols', error: error.message };
  }
}

async function main() {
  const watchlistName = process.argv[2] || null;
  const { browser, page } = await launchBrowser();

  try {
    await openChart(page);
    const result = await getWatchlistSymbols(page, watchlistName);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { getWatchlistSymbols };
if (require.main === module) main();
