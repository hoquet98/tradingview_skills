const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

// Stable selectors for the watchlist panel
const WatchlistSelectors = {
  // Right sidebar watchlist button
  WATCHLIST_BUTTON: 'button[aria-label="Watchlist, details and news"]',
  // Watchlist name/dropdown button
  WATCHLIST_NAME_BUTTON: 'button[data-name="watchlists-button"]',
  // Watchlist widget container
  WATCHLIST_WIDGET: '.widgetbar-widget-watchlist',
  // Each symbol row in the virtualized list (stable data attribute)
  SYMBOL_ROW: 'div[data-symbol-full]',
  // Scrollable list container
  SYMBOL_LIST_WRAP: '[data-name="symbol-list-wrap"]',
};

/**
 * Open the watchlist panel in the right sidebar.
 * If already open, this is a no-op.
 */
async function openWatchlistPanel(page) {
  // Wait for the right toolbar to load
  await page.waitForSelector('[data-name="right-toolbar"]', { timeout: 10000 }).catch(() => {});

  const btn = await page.$(WatchlistSelectors.WATCHLIST_BUTTON);
  if (!btn) return { success: false, message: 'Watchlist button not found in toolbar' };

  // Check if panel is already open (aria-pressed="true")
  const pressed = await btn.getAttribute('aria-pressed');
  if (pressed !== 'true') {
    await btn.click();
    await page.waitForTimeout(1000);
  }

  // Wait for the watchlist widget to have content
  await page.waitForSelector(WatchlistSelectors.SYMBOL_ROW, { timeout: 10000 }).catch(() => {});

  return { success: true };
}

/**
 * Get all symbols from the current watchlist.
 * Scrolls through the virtualized list to collect all items.
 */
async function getWatchlistSymbols(page, watchlistName = null) {
  try {
    const openResult = await openWatchlistPanel(page);
    if (!openResult.success) return openResult;

    // Get current watchlist name
    const currentWatchlist = await page.evaluate((sel) => {
      const btn = document.querySelector(sel.WATCHLIST_NAME_BUTTON);
      return btn?.textContent?.trim() || 'Default';
    }, WatchlistSelectors);

    // TODO: If watchlistName is specified and doesn't match, switch to it
    // For now we just read whatever watchlist is active

    await page.waitForTimeout(500);

    // Collect all symbols by scrolling through the virtualized list
    const collected = [];
    const seenSymbols = new Set();
    let noNewCount = 0;

    for (let i = 0; i < 100; i++) {
      const visibleSymbols = await page.evaluate((sel) => {
        const rows = document.querySelectorAll(sel.SYMBOL_ROW);
        return Array.from(rows).map(row => {
          const symbolFull = row.getAttribute('data-symbol-full') || '';
          const symbolShort = row.getAttribute('data-symbol-short') || '';
          const isActive = row.getAttribute('data-active') === 'true';
          const status = row.getAttribute('data-status') || '';

          // Extract price from the "last" cell
          const lastCell = row.querySelector('[class*="last-"]');
          const price = lastCell?.textContent?.trim() || '';

          // Extract change
          const changeCell = row.querySelector('[class*="change-"]:not([class*="changeInPercents"])');
          const change = changeCell?.textContent?.trim() || '';

          // Extract change %
          const changePctCell = row.querySelector('[class*="changeInPercents"]');
          const changePercent = changePctCell?.textContent?.trim() || '';

          // Extract volume (may be hidden)
          const volumeCell = row.querySelector('[class*="volume-"]');
          const volume = volumeCell?.querySelector('[data-value]')?.getAttribute('data-value') || '';
          const volumeFormatted = volumeCell?.textContent?.trim() || '';

          // Extract description from tooltip
          const tooltip = row.getAttribute('data-tooltip') || '';
          const descMatch = tooltip.match(/class="description[^"]*">([^<]+)/);
          const description = descMatch ? descMatch[1].replace(/&amp;/g, '&').replace(/&#38;/g, '&') : '';

          return {
            symbol: symbolFull,
            shortName: symbolShort,
            description,
            price,
            change,
            changePercent,
            volume: volume ? Number(volume) : undefined,
            volumeFormatted: volumeFormatted || undefined,
            isActive,
            status,
          };
        }).filter(s => s.symbol);
      }, WatchlistSelectors);

      const prevSize = collected.length;
      for (const sym of visibleSymbols) {
        if (!seenSymbols.has(sym.symbol)) {
          seenSymbols.add(sym.symbol);
          collected.push(sym);
        }
      }

      if (collected.length === prevSize) {
        noNewCount++;
        if (noNewCount >= 3) break;
      } else {
        noNewCount = 0;
      }

      // Scroll down the virtualized list
      const scrolled = await page.evaluate((sel) => {
        const wrap = document.querySelector(sel.SYMBOL_LIST_WRAP);
        if (!wrap) return false;
        // Find the scrollable container inside
        const scrollable = wrap.querySelector('[class*="listContainer"]')
          || wrap.querySelector('[style*="overflow"]');
        if (!scrollable) {
          // Fallback: find any scrollable ancestor/child
          let el = wrap;
          while (el) {
            if (el.scrollHeight > el.clientHeight + 10) {
              if (el.scrollTop + el.clientHeight >= el.scrollHeight) return false;
              el.scrollTop += 300;
              return true;
            }
            el = el.firstElementChild;
          }
          return false;
        }
        if (scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight) return false;
        scrollable.scrollTop += 300;
        return true;
      }, WatchlistSelectors);

      if (!scrolled) break;
      await page.waitForTimeout(200);
    }

    return {
      success: true,
      watchlist: currentWatchlist,
      symbols: collected,
      count: collected.length,
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

module.exports = { getWatchlistSymbols, openWatchlistPanel, WatchlistSelectors };
if (require.main === module) main();
