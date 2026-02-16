import { TVSelectors } from './tv_selectors';
import { normalizeAllStrings } from '@extension/shared/lib/utils/normalize';
import { clickAction } from './tv_clickActions';
import { debugLog } from './debug_log';
import { detectUIVersion, type UIVersion } from './tv_detection';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const getValueBlock = (td: Element): string => {
  const value = td.querySelector(TVSelectors.performanceValue)?.textContent?.trim() || '';
  const currency = td.querySelector(TVSelectors.performanceCurrency)?.textContent?.trim() || '';
  const percent = td.querySelector(TVSelectors.performancePercent)?.textContent?.trim() || '';
  return [value, currency, percent].filter(Boolean).join(' ');
};

// TradingView is doing gradual rollout - support both old (5 tabs) and new (2 tabs) UI
type TabName =
  | 'strategyReport' // New UI only
  | 'overview' // Legacy UI only
  | 'performance' // Legacy UI only
  | 'tradeAnalysis' // Legacy UI only
  | 'riskPerformance' // Legacy UI only
  | 'listOfTrades'; // Both UIs
type OldTabName = 'overview' | 'performance' | 'tradeAnalysis' | 'riskPerformance' | 'listOfTrades';

function getEnabledScrapeTabs(): TabName[] {
  try {
    const raw = localStorage.getItem('scrapeTabs');
    const parsed = JSON.parse(raw || '[]');

    if (!Array.isArray(parsed)) {
      return ['strategyReport']; // Default
    }

    // One-time migration: Convert old tab names to new format
    const tabs = parsed as TabName[];
    const oldTabNames: OldTabName[] = ['overview', 'performance', 'tradeAnalysis', 'riskPerformance'];
    const hasOldTabs = tabs.some(tab => oldTabNames.includes(tab as OldTabName));

    if (hasOldTabs) {
      // Migrate to new format
      const newTabs: TabName[] = ['strategyReport']; // Strategy Report is always enabled now

      // Preserve List of Trades preference
      if (tabs.includes('listOfTrades')) {
        newTabs.push('listOfTrades');
      }

      // Save migrated config
      localStorage.setItem('scrapeTabs', JSON.stringify(newTabs));
      debugLog('log', '[tv_results] ✅ Migrated old tab config to new format:', newTabs);

      return newTabs;
    }

    // Already using new format or no migration needed
    return tabs;
  } catch (err) {
    debugLog('warn', '[tv_results] ❌ Failed to read scrapeTabs from localStorage:', err);
    return ['strategyReport']; // Default
  }
}

function isStrategyTesterVisible(): boolean {
  const toggleBtn = document.querySelector(TVSelectors.strategyTesterReportTabs);
  return !!toggleBtn;
}

async function openStrategyTester(): Promise<void> {
  if (isStrategyTesterVisible()) {
    //console.log('[tv_results] Strategy Tester is already open');
    return;
  }
  const success = await clickAction({
    enabled: true,
    selector: TVSelectors.strategyTesterTabButton,
    confirmSelector: TVSelectors.strategyTesterReportTabs,
    logPrefix: 'StrategyTester',
  });

  if (success) {
    //console.log('[tv_results] Opened Strategy Tester');
  } else {
    debugLog('warn', '[tv_results] Strategy Tester open button not found or failed to confirm');
  }
}

// Ensure the strategy eye is visible
async function ensureStrategyVisible(strategyName: string): Promise<void> {
  const strategies = Array.from(document.querySelectorAll(TVSelectors.legendSourceItem));
  for (const strategyElement of strategies) {
    const titleElement = strategyElement.querySelector(TVSelectors.legendTitle);
    const title = titleElement?.textContent?.trim() ?? '';

    if (title.includes(strategyName)) {
      strategyElement.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await delay(300);

      const toolbar = strategyElement.querySelector(TVSelectors.legendEyeButton)?.parentElement;
      if (toolbar) {
        toolbar.classList.remove('blockHidden-e6PF69Df');
        toolbar.style.display = 'flex';
      }

      const eyeButton = strategyElement.querySelector(TVSelectors.legendEyeButton);
      const aria = eyeButton?.getAttribute('aria-label');

      if (aria === 'Show') {
        const events = ['mousedown', 'mouseup', 'click'].map(
          type => new MouseEvent(type, { bubbles: true, cancelable: true, view: window }),
        );
        events.forEach(e => eyeButton?.dispatchEvent(e));
      }
      return;
    }
  }

  debugLog('warn', '[tv_results] Strategy "${strategyName}" not found in visible legend items.');
}

/**
 * Scrape the current chart symbol and timeframe from TradingView.
 * Returns the full symbol (EXCHANGE:TICKER), exchange prefix, short ticker name, and timeframe.
 *
 * TradingView displays symbols like:
 * - "NASDAQ:AAPL" (stocks)
 * - "COMEX:GC1!" (futures)
 * - "CME_MINI:MNQ1!" (micro futures)
 * - "BINANCE:BTCUSDT" (crypto)
 *
 * Primary method: Parse from canvas aria-label which contains "Chart for EXCHANGE:TICKER, timeframe"
 * Fallback: Header toolbar symbol button
 */
export function scrapeSymbolAndTimeframe(): { symbol: string; exchange: string; ticker: string; timeframe: string } {
  let exchange = '';
  let ticker = '';
  let timeframe = '';

  // Primary method: Parse from chart canvas aria-label
  // Format: "Chart for CME_MINI:MNQ1!, 5 minutes"
  const chartCanvas = document.querySelector(TVSelectors.chartCanvas);
  if (chartCanvas) {
    const ariaLabel = chartCanvas.getAttribute('aria-label') || '';
    // Extract symbol and timeframe from "Chart for SYMBOL, timeframe" format
    const match = ariaLabel.match(/^Chart for ([^,]+),\s*(.+)$/);
    if (match) {
      const fullSymbol = match[1]?.trim() || '';
      timeframe = match[2]?.trim() || '';

      if (fullSymbol.includes(':')) {
        const parts = fullSymbol.split(':');
        exchange = parts[0] || '';
        ticker = parts.slice(1).join(':') || '';
        debugLog(
          'log',
          `[scrapeSymbolAndTimeframe] Parsed from canvas: ${exchange}:${ticker}, timeframe: ${timeframe}`,
        );
        return { symbol: fullSymbol, exchange, ticker, timeframe };
      } else if (fullSymbol) {
        // No colon - just the ticker
        ticker = fullSymbol;
        debugLog('log', `[scrapeSymbolAndTimeframe] Found ticker from canvas: ${ticker}, timeframe: ${timeframe}`);
        return { symbol: ticker, exchange: '', ticker, timeframe };
      }
    }
  }

  // Fallback 1: Try to get the exchange and ticker from separate header elements
  const exchangeEl = document.querySelector(TVSelectors.chartExchangeText);
  const tickerEl = document.querySelector(TVSelectors.chartSymbolText);

  exchange = exchangeEl?.textContent?.trim() || '';
  ticker = tickerEl?.textContent?.trim() || '';

  // Try to get timeframe from the interval button
  const timeframeButton = document.querySelector(TVSelectors.TIME_INTERVAL_BUTTON);
  if (timeframeButton) {
    timeframe = timeframeButton.textContent?.trim() || '';
  }

  if (exchange && ticker) {
    const symbol = `${exchange}:${ticker}`;
    debugLog('log', `[scrapeSymbolAndTimeframe] Found separate exchange/ticker: ${symbol}, timeframe: ${timeframe}`);
    return { symbol, exchange, ticker, timeframe };
  }

  // Fallback 2: Try to get the full text from the symbol button
  const symbolButton = document.querySelector(TVSelectors.chartSymbolButton);
  if (symbolButton) {
    const fullText = symbolButton.textContent?.trim() || '';

    if (fullText.includes(':')) {
      const parts = fullText.split(':');
      exchange = parts[0] || '';
      ticker = parts.slice(1).join(':') || '';
      debugLog(
        'log',
        `[scrapeSymbolAndTimeframe] Parsed from button text: ${exchange}:${ticker}, timeframe: ${timeframe}`,
      );
      return { symbol: fullText, exchange, ticker, timeframe };
    }

    if (fullText) {
      ticker = fullText;
      debugLog('log', `[scrapeSymbolAndTimeframe] Found ticker only from button: ${ticker}, timeframe: ${timeframe}`);
      return { symbol: ticker, exchange: '', ticker, timeframe };
    }
  }

  // Final fallback: Try legacy selectors
  const legacyTickerEl = document.querySelector(TVSelectors.symbolTicker);
  const legacyExchangeEl = document.querySelector(TVSelectors.symbolExchange);

  ticker = legacyTickerEl?.textContent?.trim() || '';
  exchange = legacyExchangeEl?.textContent?.trim() || '';

  const symbol = exchange && ticker ? `${exchange}:${ticker}` : ticker || exchange || '';
  debugLog(
    'log',
    `[scrapeSymbolAndTimeframe] Final fallback: symbol=${symbol}, exchange=${exchange}, ticker=${ticker}, timeframe=${timeframe}`,
  );

  return { symbol, exchange, ticker, timeframe };
}
// Scrape Overview section (now at the top of Strategy Report tab in new UI, or Overview tab in legacy UI)
// Includes retry logic for first backtest when DOM may not be fully populated
async function scrapeOverviewSection(results: Record<string, any>, maxRetries: number = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const container = document.querySelector(TVSelectors.overviewContainer);
    const rows = container?.querySelectorAll(TVSelectors.overviewStatRow) || [];

    if (rows.length === 0 && attempt < maxRetries) {
      debugLog('log', `[tv_results] Overview container empty, retrying (${attempt}/${maxRetries})...`);
      await delay(500);
      continue;
    }

    rows.forEach(row => {
      const label = row.querySelector(TVSelectors.overviewLabel)?.textContent?.trim();
      const valueEl = row.querySelector(TVSelectors.overviewValue);
      const value = valueEl?.textContent?.trim() || '';

      const currencyEl = row.querySelector(TVSelectors.overviewCurrency);
      const currency = currencyEl?.textContent?.trim() || '';

      const changeEl = row.querySelector(TVSelectors.overviewChange);
      const change = changeEl?.textContent?.trim() || '';

      if (label) {
        if (change) {
          // Combine value + currency + (percent) if available
          const fullValue = [value, currency].filter(Boolean).join(' ');
          results.overview[label] = `${fullValue} (${change})`;
        } else if (currency) {
          results.overview[label] = `${value} ${currency}`;
        } else {
          results.overview[label] = value;
        }
      }
    });

    // If we got data, exit the retry loop
    if (Object.keys(results.overview).length > 0) {
      debugLog('log', `[tv_results] Scraped overview with ${Object.keys(results.overview).length} entries`);
      break;
    } else if (attempt < maxRetries) {
      debugLog('log', `[tv_results] Overview empty after scraping, retrying (${attempt}/${maxRetries})...`);
      await delay(500);
    }
  }
}

async function scrapeListOfTradesSummary(results: Record<string, any>) {
  const tabClicked = await clickAction({
    enabled: true,
    selector: TVSelectors.tabListOfTrades,
    confirmSelector: TVSelectors.listOfTradesHeaderRow,
    logPrefix: 'ListOfTradesTab',
  });

  if (!tabClicked) {
    results.listOfTradesSummary = { error: 'Tab not found or no data loaded or tradingview screen width too narrow' };
    return;
  }

  const headersRow = document.querySelector(TVSelectors.listOfTradesHeaderRow);
  const headerCells = headersRow ? Array.from(headersRow.querySelectorAll(TVSelectors.listOfTradesHeaderCell)) : [];

  const headers = headerCells.map(th => th.textContent?.trim().replace(/\s+/g, ' ') || `Column ${th.cellIndex}`);
  const doubleCellIndexes = new Set([1, 2, 3, 4]);

  const extractTradeRow = (label: string): Record<string, any> => {
    const row = document.querySelector(TVSelectors.listOfTradesRow);
    if (!row) {
      debugLog('warn', '[tv_results][List of Trades] No row found for ${label}');
      return {};
    }

    const cells = row.querySelectorAll(TVSelectors.listOfTradesCell);
    const trade: Record<string, any> = {};

    cells.forEach((td, j) => {
      const key = headers[j] || `Column ${j + 1}`;
      if (doubleCellIndexes.has(j)) {
        const doubleCell = td.querySelector(TVSelectors.listOfTradesDoubleCell);
        const entry = doubleCell?.querySelector(TVSelectors.listOfTradesEntryPart)?.textContent?.trim() || '';
        const exit = doubleCell?.querySelector(TVSelectors.listOfTradesExitPart)?.textContent?.trim() || '';
        trade[key] = { entry, exit };
      } else {
        trade[key] = td.textContent?.trim();
      }
    });

    //console.log(`[tv_results][ListOfTrades] Scraped ${label}:`, trade)
    return trade;
  };

  const mostRecentTrade = extractTradeRow('Most Recent');

  const tradeHeader = Array.from(document.querySelectorAll(TVSelectors.listOfTradesSortHeader)).find(
    el => (el as HTMLElement).textContent?.trim().toLowerCase() === 'trade #',
  ) as HTMLElement;

  tradeHeader?.click();
  await delay(800);

  const oldestTrade = extractTradeRow('Oldest');
  results.listOfTradesSummary = { mostRecentTrade, oldestTrade };
}

export async function scrape_results(strategyName: string) {
  const results: Record<string, any> = {
    overview: {},
    performance: {},
    tradeAnalysis: {},
    riskPerformance: {},
    listOfTradesSummary: {},
  };

  await ensureStrategyVisible(strategyName); // Make sure the eye icon is open
  await openStrategyTester(); // Now make sure that the strategy tester at bottom is open

  // Wait for tabs to fully render after Strategy Tester opens
  await delay(500);

  // Detect UI version AFTER Strategy Tester is open and tabs are visible
  const uiVersion = detectUIVersion();
  debugLog('log', `[tv_results] Detected UI version: ${uiVersion}`);

  const enabledTabs = getEnabledScrapeTabs();

  // Route to appropriate scraping logic based on UI version
  if (uiVersion === 'new') {
    // NEW UI: Strategy Report tab contains Overview, Performance, Trade Analysis, and Risk/Performance Ratios
    // Check if user wants to scrape Strategy Report OR any of the old tabs (which are now part of Strategy Report)
    const shouldScrapeStrategyReport =
      enabledTabs.includes('strategyReport') ||
      enabledTabs.includes('overview') ||
      enabledTabs.includes('performance') ||
      enabledTabs.includes('tradeAnalysis') ||
      enabledTabs.includes('riskPerformance');

    if (shouldScrapeStrategyReport) {
      try {
        // Check if Strategy Report tab is already selected
        const strategyReportTab = document.querySelector(TVSelectors.tabStrategyReport);
        const isAlreadySelected = strategyReportTab?.getAttribute('aria-selected') === 'true';

        debugLog('log', `[tv_results] Strategy Report tab already selected: ${isAlreadySelected}`);

        let clicked = isAlreadySelected;

        if (!isAlreadySelected) {
          // Click the Strategy Report tab
          clicked = await clickAction({
            enabled: true,
            selector: TVSelectors.tabStrategyReport,
            confirmSelector: TVSelectors.overviewContainer,
            logPrefix: 'StrategyReportTab',
          });
        }

        if (!clicked) {
          debugLog('warn', '[tv_results] Failed to click Strategy Report tab');
        } else {
          // Confirm UI version after successfully clicking Strategy Report tab
          const confirmedUIVersion = detectUIVersion();
          debugLog('log', `[tv_results] Confirmed UI version after clicking Strategy Report: ${confirmedUIVersion}`);

          // Scrape Overview section (at the top) - includes retry logic
          await scrapeOverviewSection(results);

          // Scrape all table sections on the Strategy Report tab
          // The tables are for Performance, Trades analysis, and Risk/performance ratios
          // Strategy: Find all ka-table tables, then find their section titles
          // Includes retry logic for first backtest when DOM may not be fully populated
          const tablesSelector = TVSelectors.strategyReportTables;
          debugLog('log', `[tv_results] Using tables selector: ${tablesSelector}`);

          let strategyReportTables: NodeListOf<Element>;
          const maxTableRetries = 3;
          for (let tableAttempt = 1; tableAttempt <= maxTableRetries; tableAttempt++) {
            strategyReportTables = document.querySelectorAll(tablesSelector);
            debugLog(
              'log',
              `[tv_results] Found ${strategyReportTables.length} strategy report tables (attempt ${tableAttempt})`,
            );

            if (strategyReportTables.length === 0 && tableAttempt < maxTableRetries) {
              debugLog('log', `[tv_results] No tables found, waiting and retrying...`);
              await delay(500);
              continue;
            }
            break;
          }

          strategyReportTables.forEach(table => {
            // Navigate up to find the section title
            let currentElement = table.parentElement;
            let sectionTitle = '';
            let depth = 0;
            const maxDepth = 10; // Prevent infinite loops

            // Walk up the DOM tree to find the section title
            while (currentElement && depth < maxDepth) {
              // Look for a sibling or ancestor sibling that contains the title
              const parentDiv = currentElement.parentElement;
              if (parentDiv) {
                // Check all children of the parent for a title
                const titleSpan = Array.from(parentDiv.querySelectorAll('span')).find(span => {
                  const text = span.textContent?.trim().toLowerCase() || '';
                  return (
                    text === 'performance' ||
                    text === 'trades analysis' ||
                    (text.includes('risk') && text.includes('ratio'))
                  );
                });

                if (titleSpan) {
                  sectionTitle = titleSpan.textContent?.trim().toLowerCase() || '';
                  break;
                }
              }
              currentElement = currentElement.parentElement;
              depth++;
            }

            if (!sectionTitle) {
              debugLog('warn', '[tv_results] Could not find section title for table');
              return;
            }

            // Determine which section this is based on the title
            let key: string;
            if (sectionTitle.includes('performance') && !sectionTitle.includes('risk')) {
              key = 'performance';
            } else if (sectionTitle.includes('trade') && sectionTitle.includes('analysis')) {
              key = 'tradeAnalysis';
            } else if (sectionTitle.includes('risk') || sectionTitle.includes('ratio')) {
              key = 'riskPerformance';
            } else {
              // Not a table section we care about, skip
              return;
            }

            const rows = table.querySelectorAll(TVSelectors.performanceRow) || [];
            debugLog('log', `[tv_results] Scraping section: ${sectionTitle}, found ${rows.length} rows`);

            rows.forEach((row, i) => {
              const label = row.querySelector(TVSelectors.performanceLabel)?.textContent?.trim() || `[Row ${i + 1}]`;
              const cells = row.querySelectorAll(TVSelectors.listOfTradesCell);
              results[key][label] = {
                all: cells[1] ? getValueBlock(cells[1]) : '',
                long: cells[2] ? getValueBlock(cells[2]) : '',
                short: cells[3] ? getValueBlock(cells[3]) : '',
              };
            });
          });
        }
      } catch (err) {
        debugLog('warn', '[tv_results] Failed to scrape Strategy Report tab:', err);
      }
    }
  } else if (uiVersion === 'legacy') {
    // LEGACY UI: Individual tabs for Overview, Performance, Trade Analysis, Risk/Performance Ratios
    debugLog('log', '[tv_results] Legacy UI detected - using individual tab scraping');

    // If strategyReport is enabled, treat it as "all legacy tabs enabled"
    const hasStrategyReport = enabledTabs.includes('strategyReport');

    // Scrape Overview tab
    if (enabledTabs.includes('overview') || hasStrategyReport) {
      try {
        const clicked = await clickAction({
          enabled: true,
          selector: TVSelectors.tabOverview,
          confirmSelector: TVSelectors.overviewContainer,
          logPrefix: 'OverviewTab',
        });

        if (clicked) {
          await scrapeOverviewSection(results);
        }
      } catch (err) {
        debugLog('warn', '[tv_results] Failed to scrape Overview tab:', err);
      }
    }

    // Scrape Performance, Trade Analysis, and Risk/Performance tabs (structured tables)
    const structuredTabs = [
      {
        key: 'performance' as const,
        enabled: enabledTabs.includes('performance') || hasStrategyReport,
        tab: TVSelectors.tabPerformance,
        container: TVSelectors.performanceContainer,
        row: TVSelectors.performanceRow,
        label: TVSelectors.performanceLabel,
        logPrefix: 'PerformanceTab',
      },
      {
        key: 'tradeAnalysis' as const,
        enabled: enabledTabs.includes('tradeAnalysis') || hasStrategyReport,
        tab: TVSelectors.tabTradeAnalysis,
        container: TVSelectors.tradeAnalysisContainer,
        row: TVSelectors.tradeAnalysisRow,
        label: TVSelectors.tradeAnalysisLabel,
        logPrefix: 'TradeAnalysisTab',
      },
      {
        key: 'riskPerformance' as const,
        enabled: enabledTabs.includes('riskPerformance') || hasStrategyReport,
        tab: TVSelectors.tabRiskRatios,
        container: TVSelectors.riskRatiosContainer,
        row: TVSelectors.riskRatiosRow,
        label: TVSelectors.riskRatiosLabel,
        logPrefix: 'RiskRatiosTab',
      },
    ];

    for (const tabConfig of structuredTabs) {
      if (!tabConfig.enabled) continue;

      try {
        const clicked = await clickAction({
          enabled: true,
          selector: tabConfig.tab,
          confirmSelector: tabConfig.container,
          logPrefix: tabConfig.logPrefix,
        });

        if (clicked) {
          const container = document.querySelector(tabConfig.container);
          const rows = container?.querySelectorAll(tabConfig.row) || [];

          rows.forEach((row, i) => {
            const label = row.querySelector(tabConfig.label)?.textContent?.trim() || `[Row ${i + 1}]`;
            const cells = row.querySelectorAll(TVSelectors.listOfTradesCell);
            results[tabConfig.key][label] = {
              all: cells[1] ? getValueBlock(cells[1]) : '',
              long: cells[2] ? getValueBlock(cells[2]) : '',
              short: cells[3] ? getValueBlock(cells[3]) : '',
            };
          });

          debugLog('log', `[tv_results] Scraped ${tabConfig.key}: ${rows.length} rows`);
        }
      } catch (err) {
        debugLog('warn', `[tv_results] Failed to scrape ${tabConfig.key} tab:`, err);
      }
    }
  } else {
    // Unknown UI version - try new UI logic as fallback
    debugLog('warn', '[tv_results] Unknown UI version detected, attempting new UI scraping');

    const shouldScrapeStrategyReport =
      enabledTabs.includes('strategyReport') ||
      enabledTabs.includes('overview') ||
      enabledTabs.includes('performance') ||
      enabledTabs.includes('tradeAnalysis') ||
      enabledTabs.includes('riskPerformance');

    if (shouldScrapeStrategyReport) {
      try {
        const clicked = await clickAction({
          enabled: true,
          selector: TVSelectors.tabStrategyReport,
          confirmSelector: TVSelectors.overviewContainer,
          logPrefix: 'StrategyReportTab',
        });

        if (clicked) {
          // Successfully clicked Strategy Report - confirm this is new UI
          const confirmedUIVersion = detectUIVersion();
          debugLog(
            'log',
            `[tv_results] Fallback confirmed UI version after clicking Strategy Report: ${confirmedUIVersion}`,
          );

          await scrapeOverviewSection(results);
        }
      } catch (err) {
        debugLog('warn', '[tv_results] Fallback scraping failed:', err);
      }
    }
  }

  // List of Trades is common to both UIs
  if (enabledTabs.includes('listOfTrades')) {
    try {
      await scrapeListOfTradesSummary(results);
    } catch (err) {
      debugLog('warn', '[tv_results] Failed to scrape List of Trades:', err);
    }
  }

  const { symbol, exchange, ticker, timeframe } = scrapeSymbolAndTimeframe();
  const normalizedResults = normalizeAllStrings({
    ...results,
    symbol,
    exchange,
    ticker,
    timeframe,
  });

  // ✅ Manually attach strategyName without normalization
  normalizedResults.strategyName = strategyName;

  debugLog('log', '[tv_results] ✅ scrape_results complete and Normalized:', normalizedResults);
  return normalizedResults;
}
