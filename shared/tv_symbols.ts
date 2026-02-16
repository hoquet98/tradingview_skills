import { TVSelectors } from './tv_selectors';
import { debugLog } from './debug_log';
const LOCAL_KEY = 'user_symbol_memory';
const STORAGE_KEY = 'user-symbols';

export function scrape_user_lists(): string[] {
  const selector = TVSelectors.symbolListItemFull;
  //console.log('[scrape_user_lists] Selector:', selector);

  const elements = document.querySelectorAll(selector);
  //console.log('[scrape_user_lists] Elements found:', elements.length);

  const scraped: string[] = [];

  elements.forEach(el => {
    const symbol = (el as HTMLElement).dataset?.symbolFull;
    if (symbol) scraped.push(symbol);
  });

  debugLog('log', '[scrape_user_lists] Scraped:', scraped.length);

  const LOCAL_KEY = 'user-symbols';
  const existingRaw = window.localStorage.getItem(LOCAL_KEY);
  const existing = existingRaw ? JSON.parse(existingRaw) : [];
  //Sort the symbols by exchange first
  const merged = Array.from(new Set([...existing, ...scraped])).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(merged));

  //console.log('✅ Final merged symbols:', merged);
  return scraped;
}

export function getStoredUserSymbols(): string[] {
  const raw = window.localStorage.getItem(LOCAL_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function scrapeSymbol(): { symbol: string; exchange: string; ticker: string } {
  const symbolButton = document.querySelector(TVSelectors.symbolButton);
  const exchangeEl = document.querySelector(TVSelectors.symbolExchange);
  const tickerEl = document.querySelector(TVSelectors.symbolTicker);

  return {
    symbol: symbolButton?.textContent?.trim() || '',
    exchange: exchangeEl?.textContent?.trim() || '',
    ticker: tickerEl?.textContent?.trim() || '',
  };
}

async function waitFor(selector: string, timeout = 5000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(interval);
        resolve(el);
      } else if (Date.now() - start > timeout) {
        clearInterval(interval);
        reject(new Error(`Timeout waiting for ${selector}`));
      }
    }, 100);
  });
}

/**
 * Opens the watchlist panel if closed, then scrapes symbols.
 * Returns the scraped symbols array.
 */
export async function openWatchlistAndScrape(): Promise<string[]> {
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    const watchlistBtn = document.querySelector(TVSelectors.watchlistButton) as HTMLButtonElement | null;

    if (watchlistBtn) {
      const isPressed = watchlistBtn.getAttribute('aria-pressed') === 'true';

      if (!isPressed) {
        debugLog('log', '[openWatchlistAndScrape] Watchlist is closed, opening it...');
        watchlistBtn.click();
        await wait(500); // Wait for panel to open and render
      } else {
        debugLog('log', '[openWatchlistAndScrape] Watchlist is already open');
      }
    } else {
      debugLog('warn', '[openWatchlistAndScrape] Watchlist button not found');
    }

    // Now scrape symbols
    const symbols = scrape_user_lists();
    debugLog('log', '[openWatchlistAndScrape] Scraped', symbols.length, 'symbols');

    // Return the merged list from localStorage (includes previously scraped)
    const storedRaw = window.localStorage.getItem(STORAGE_KEY);
    const storedSymbols: string[] = storedRaw ? JSON.parse(storedRaw) : [];

    return storedSymbols;
  } catch (err) {
    debugLog('error', '[openWatchlistAndScrape] Error:', err);
    return [];
  }
}

export async function changeSymbol(symbol: string): Promise<void> {
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    const button = document.querySelector(TVSelectors.symbolSearchButton);
    if (!button) {
      await debugLog(new Error().stack, 'warn', '❌', '[changeSymbol] Symbol Search button not found');
      return;
    }

    button.click();
    await debugLog(new Error().stack, 'log', '✅', '[changeSymbol] Clicked Symbol Search');

    await wait(300); // ⏳ Wait for dialog to open

    const input = await waitFor(TVSelectors.symbolSearchInput);
    input.focus();
    input.value = symbol;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await debugLog(new Error().stack, 'log', '🔍', `[changeSymbol] Typed symbol: ${symbol}`);

    await wait(400); // ⏳ Wait for search results to populate

    const firstItem = await waitFor(TVSelectors.symbolSearchResultItem);
    firstItem.click();
    await debugLog(new Error().stack, 'log', '✅', `[changeSymbol] Clicked first result (${symbol})`);

    await wait(400); // ⏳ Wait for chart to load

    // Optional: close the dialog
    // const closeBtn = document.querySelector(TVSelectors.symbolSearchDialogClose);
    // if (closeBtn) (closeBtn as HTMLElement).click();
  } catch (err) {
    await debugLog(new Error().stack, 'error', '❌', '[changeSymbol] Error occurred', err);
  }
}
