import { TVSelectors } from './tv_selectors';
import { normalizeAllStrings } from '@extension/shared/lib/utils/normalize';

export async function scrape_results(strategyName: string) {
  const results: Record<string, any> = {
    overview: {},
    performance: {},
    tradeAnalysis: {},
    riskRatios: {},
    listOfTradesSummary: {},
  };

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
  const clickTab = async (selector: string) => {
    const el = document.querySelector(selector) as HTMLElement;
    if (el) {
      el.click();
      await delay(500); // 👈 give the DOM a moment to swap tabs/render
    }
  };

  const getValueBlock = (td: Element): string => {
    const value = td.querySelector(TVSelectors.performanceValue)?.textContent?.trim() || '';
    const currency = td.querySelector(TVSelectors.performanceCurrency)?.textContent?.trim() || '';
    const percent = td.querySelector(TVSelectors.performancePercent)?.textContent?.trim() || '';
    return [value, currency, percent].filter(Boolean).join(' ');
  };

  function isStrategyTesterVisible(): boolean {
    return document.getElementById('report-tabs') !== null;
  }

  function openStrategyTester(): void {
    const button = document.querySelector('[aria-label="Open Strategy Tester"]') as HTMLButtonElement;
    if (button) {
      button.click();
      console.log('[tv_results] 🟢 Clicked "Open Strategy Tester" to expand panel');
    } else {
      console.warn('[tv_results] 🔴 Strategy Tester button not found');
    }
  }

  async function ensureStrategyTesterVisible(): Promise<void> {
    if (!isStrategyTesterVisible()) {
      console.log('[tv_results] 🟡 Strategy Tester panel not visible — attempting to open...');
      openStrategyTester();
      await new Promise(res => setTimeout(res, 1000)); // allow panel to render
    } else {
      //console.log('[tv_results] ✅ Strategy Tester panel already visible');
    }
  }
  //Ensure the strategy is visible the eye icon.
  async function ensureStrategyVisible(strategyName: string) {
    const strategies = Array.from(document.querySelectorAll('div[data-name="legend-source-item"]'));
    let found = false;

    for (const strategyElement of strategies) {
      const titleElement = strategyElement.querySelector('.title-l31H9iuA');
      const title = titleElement?.textContent?.trim() ?? '';

      if (title.includes(strategyName)) {
        found = true;

        // 🪄 Simulate hover to force the eye button to appear
        strategyElement.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        await new Promise(res => setTimeout(res, 300));

        // 🔧 Force show toolbar in case it's hidden
        const toolbar = strategyElement.querySelector('.buttonsWrapper-l31H9iuA');
        if (toolbar) {
          toolbar.classList.remove('blockHidden-e6PF69Df');
          toolbar.style.display = 'flex';
        }

        const eyeButton = strategyElement.querySelector('[data-name="legend-show-hide-action"]');

        if (eyeButton) {
          const aria = eyeButton.getAttribute('aria-label');

          if (aria === 'Show') {
            console.log(`[tv_settings] 👁️ "${title}" is hidden — clicking to show it`);
            const events = ['mousedown', 'mouseup', 'click'].map(
              type => new MouseEvent(type, { bubbles: true, cancelable: true, view: window }),
            );
            events.forEach(e => eyeButton.dispatchEvent(e));
          } else if (aria === 'Hide') {
            console.log(`[tv_settings] ✅ "${title}" is already visible`);
          } else {
            console.warn(`[tv_settings] ⚠️ Unknown aria-label state: "${aria}" for "${title}"`);
          }
        } else {
          console.error(`[tv_settings] ❌ Eye button not found for "${title}"`);
        }

        return;
      }
    }

    if (!found) {
      console.error('[tv_settings] ❌ No strategy found matching:', strategyName);
    }
  }

  //

  function scrapeSymbol(): { symbol: string; exchange: string; ticker: string } {
    const symbolButton = document.querySelector('[data-name="legend-source-title"] button');
    const exchangeEl = document.querySelector('[data-name="legend-source-exchange"]');
    const tickerEl = document.querySelector('button[aria-label="Symbol Search"] .js-button-text');

    const rawSymbol = symbolButton?.textContent?.trim() || '';
    const exchange = exchangeEl?.textContent?.trim() || '';
    const ticker = tickerEl?.textContent?.trim() || '';

    return {
      symbol: rawSymbol,
      exchange,
      ticker,
    };
  }
  // ensure that the strategy is in visible mode, not hidden, we need to click the eye.
  await ensureStrategyVisible(strategyName);
  // Ensure the tables are visible by clicking Strategy Tester
  await ensureStrategyTesterVisible();

  // === 1. OVERVIEW ===
  try {
    await clickTab(TVSelectors.tabOverview);

    const container = document.querySelector(TVSelectors.overviewContainer);
    const rows = container?.querySelectorAll(TVSelectors.overviewStatRow) || [];

    rows.forEach(row => {
      const label = row.querySelector(TVSelectors.overviewLabel)?.textContent?.trim();
      const value = row.querySelector(TVSelectors.overviewValue)?.textContent?.trim();
      const change = row.querySelector(TVSelectors.overviewChange)?.textContent?.trim();
      if (label) {
        results.overview[label] = change ? `${value} (${change})` : value || '';
      }
    });
  } catch (err) {
    console.warn('⚠️ Failed to scrape overview:', err);
  }

  // === 2–4. PERFORMANCE, TRADE ANALYSIS, RISK RATIOS ===
  const structuredTabs = [
    {
      key: 'performance',
      tab: TVSelectors.tabPerformance,
      container: TVSelectors.performanceContainer,
      row: TVSelectors.performanceRow,
      label: TVSelectors.performanceLabel,
    },
    {
      key: 'tradeAnalysis',
      tab: TVSelectors.tabTradeAnalysis,
      container: TVSelectors.tradeAnalysisContainer,
      row: TVSelectors.tradeAnalysisRow,
      label: TVSelectors.tradeAnalysisLabel,
    },
    {
      key: 'riskRatios',
      tab: TVSelectors.tabRiskRatios,
      container: TVSelectors.riskRatiosContainer,
      row: TVSelectors.riskRatiosRow,
      label: TVSelectors.riskRatiosLabel,
    },
  ];

  for (const tab of structuredTabs) {
    try {
      await clickTab(tab.tab);

      const container = document.querySelector(tab.container);
      const rows = container?.querySelectorAll(tab.row) || [];

      rows.forEach((row, i) => {
        const label = row.querySelector(tab.label)?.textContent?.trim() || `[Row ${i + 1}]`;
        const cells = row.querySelectorAll('td.ka-cell');
        results[tab.key][label] = {
          all: cells[1] ? getValueBlock(cells[1]) : '',
          long: cells[2] ? getValueBlock(cells[2]) : '',
          short: cells[3] ? getValueBlock(cells[3]) : '',
        };
      });
    } catch (err) {
      console.warn(`⚠️ Failed to scrape ${tab.key}:`, err);
    }
  }

  // === 5. LIST OF TRADES SUMMARY ===
  try {
    await clickTab(TVSelectors.tabListOfTrades);

    const headersRow = document.querySelector(TVSelectors.listOfTradesHeaderRow);
    const headerCells = headersRow ? Array.from(headersRow.querySelectorAll(TVSelectors.listOfTradesHeaderCell)) : [];

    const headers = headerCells.map(th => th.textContent?.trim().replace(/\s+/g, ' ') || `Column ${th.cellIndex}`);

    const doubleCellIndexes = new Set([1, 2, 3, 4]);

    const extractTradeRow = (): Record<string, any> => {
      const row = document.querySelector(TVSelectors.listOfTradesRow);
      if (!row) return {};

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

      return trade;
    };

    const mostRecentTrade = extractTradeRow();

    const tradeHeader = Array.from(document.querySelectorAll(TVSelectors.listOfTradesSortHeader)).find(
      el => (el as HTMLElement).textContent?.trim().toLowerCase() === 'trade #',
    ) as HTMLElement;

    tradeHeader?.click();
    await delay(800);

    const oldestTrade = extractTradeRow();

    results.listOfTradesSummary = {
      mostRecentTrade,
      oldestTrade,
    };
  } catch (err) {
    console.warn('⚠️ Failed to scrape list of trades summary:', err);
  }

  const { symbol, exchange, ticker } = scrapeSymbol();
  const normalizedResults = normalizeAllStrings({
    ...results,
    symbol,
    exchange,
    ticker,
    strategyName,
  });

  console.log('✅ scrape_results complete and Normalized:', normalizedResults);
  return normalizedResults;
}
