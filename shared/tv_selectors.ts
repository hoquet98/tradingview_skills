// Track if we've logged the summary yet
let loggedSummary = false;

// Helper function to get selector value with override support
function getSelector(key: string, defaultValue: string): string {
  try {
    const overridesStr = localStorage.getItem('selector-overrides');
    const overrides = JSON.parse(overridesStr || '{}');
    const hasOverride = overrides[key] !== undefined;
    const result = overrides[key] || defaultValue;

    // Log summary once at startup
    if (!loggedSummary) {
      loggedSummary = true;
      const overrideCount = Object.keys(overrides).length;
      if (overrideCount > 0) {
        console.log(`[SelectorOverride] 🔧 ${overrideCount} selector override(s) active:`, Object.keys(overrides));
      } else {
        console.log('[SelectorOverride] ✅ Using all default selectors (no overrides)');
      }
    }

    // Only log when actually using an override (reduces noise)
    if (hasOverride) {
      console.log(`[SelectorOverride] ⚙️ ${key}: OVERRIDE = "${result}" (default: "${defaultValue}")`);
    }

    return result;
  } catch (err) {
    console.warn(`[SelectorOverride] ${key}: ERROR parsing overrides, using default "${defaultValue}"`, err);
    return defaultValue;
  }
}

export const TVSelectors = {
  // === Strategy Settings ===
  get SETTINGS_DIALOG() {
    return getSelector('SETTINGS_DIALOG', '[data-name="indicator-properties-dialog"]');
  },
  get SETTINGS_DIALOG_CONTENT() {
    return getSelector('SETTINGS_DIALOG_CONTENT', '[class*="scrollable"], [data-name="dialog-content"]');
  },
  get SETTINGS_SCROLLABLE_CONTENT() {
    return getSelector('SETTINGS_SCROLLABLE_CONTENT', '[class*="scrollable-"] [class*="content-"]');
  },
  get SETTINGS_CELL() {
    return getSelector('SETTINGS_CELL', '[class*="cell-"]');
  },
  get SETTINGS_LABEL() {
    return getSelector('SETTINGS_LABEL', '[class*="label-"]');
  },
  get SETTINGS_CHECKBOX() {
    return getSelector('SETTINGS_CHECKBOX', 'input[type="checkbox"]');
  },
  get SETTINGS_INPUT_ELEMENT() {
    return getSelector('SETTINGS_INPUT_ELEMENT', 'input, select, textarea, [role="button"], [role="combobox"]');
  },

  // === Strategy Visibility / Legend
  get legendSourceItem() {
    return getSelector('legendSourceItem', 'div[data-qa-id="legend-source-item"]');
  },
  get legendTitle() {
    return getSelector('legendTitle', 'div[class*="titleWrap"]');
  },
  get legendEyeButton() {
    return getSelector('legendEyeButton', '[data-qa-id="legend-show-hide-action"]');
  },

  // === Chart Symbol (used in scrapeSymbol) - targets the header toolbar symbol display
  get chartSymbolButton() {
    // The symbol search button in the header toolbar - contains the full symbol like "NASDAQ:AAPL" or "GC1!"
    return getSelector('chartSymbolButton', '#header-toolbar-symbol-search');
  },
  get chartSymbolText() {
    // The text content inside the symbol button showing the ticker
    return getSelector(
      'chartSymbolText',
      '#header-toolbar-symbol-search [class*="shortName"], #header-toolbar-symbol-search .js-button-text',
    );
  },
  get chartExchangeText() {
    // The exchange prefix text (e.g., "NASDAQ", "COMEX")
    return getSelector('chartExchangeText', '#header-toolbar-symbol-search [class*="exchangeName"]');
  },
  get chartCanvas() {
    // The main chart canvas - aria-label contains symbol and timeframe: "Chart for CME_MINI:MNQ1!, 5 minutes"
    return getSelector('chartCanvas', 'canvas[data-name="pane-top-canvas"][aria-label^="Chart for"]');
  },
  // Legacy selectors (kept for backwards compatibility with selector overrides)
  get symbolButton() {
    return getSelector('symbolButton', '#header-toolbar-symbol-search');
  },
  get symbolExchange() {
    return getSelector('symbolExchange', '#header-toolbar-symbol-search [class*="exchangeName"]');
  },
  get symbolTicker() {
    return getSelector(
      'symbolTicker',
      '#header-toolbar-symbol-search [class*="shortName"], #header-toolbar-symbol-search .js-button-text',
    );
  },
  get symbolSearchButton() {
    return getSelector('symbolSearchButton', '#header-toolbar-symbol-search');
  },
  get symbolSearchInput() {
    return getSelector('symbolSearchInput', 'input[data-qa-id="symbol-search-input"]');
  },
  get symbolSearchResultItem() {
    return getSelector('symbolSearchResultItem', 'div[data-role="list-item"]');
  },
  get symbolSearchDialogClose() {
    return getSelector('symbolSearchDialogClose', '[data-name="close"]');
  },
  get symbolListItemFull() {
    return getSelector('symbolListItemFull', '[class*="listContainer"] [data-symbol-full]');
  },
  get dataSymbolFull() {
    return getSelector('dataSymbolFull', '[data-symbol-full]');
  },

  // === Strategy Tester Tab ===
  get strategyTesterTabButton() {
    return getSelector('strategyTesterTabButton', 'button[data-name="backtesting"]');
  },
  get strategyTesterReportTabs() {
    return getSelector('strategyTesterReportTabs', 'div#report-tabs');
  },

  // === Strategy Tester Tabs ===
  // TradingView is doing gradual rollout - support both old (5 tabs) and new (2 tabs) UI

  // NEW UI (2 tabs) - Dec 2024
  get tabStrategyReport() {
    return getSelector('tabStrategyReport', 'button#Strategy\\ report');
  },

  // LEGACY UI (5 tabs) - Pre-Dec 2024
  get tabOverview() {
    return getSelector('tabOverview', 'button#Overview');
  },
  get tabPerformance() {
    return getSelector('tabPerformance', 'button#Performance');
  },
  get tabTradeAnalysis() {
    return getSelector('tabTradeAnalysis', 'button#Trades\\ Analysis');
  },
  get tabRiskRatios() {
    return getSelector('tabRiskRatios', 'button#Ratios');
  },

  // COMMON (both UIs)
  get tabListOfTrades() {
    return getSelector('tabListOfTrades', 'button#List\\ of\\ Trades');
  },
  get strategyReportTables() {
    return getSelector('strategyReportTables', '#bottom-area table.ka-table');
  },
  get updateReportButton() {
    return getSelector('updateReportButton', 'button[data-overflow-tooltip-text="Update report"]');
  },
  get updatingReportSnackbar() {
    return getSelector('updatingReportSnackbar', '[data-qa-id="backtesting-loading-report-snackbar"]');
  },
  get successReportSnackbar() {
    return getSelector('successReportSnackbar', '[data-qa-id="backtesting-success-report-snackbar"]');
  },
  get snackbarLayer() {
    return getSelector('snackbarLayer', 'div.snackbarLayer-_MKqWk5g');
  },
  // "No data" empty state - shown when strategy has no trades for current parameters
  get noDataEmptyState() {
    return getSelector('noDataEmptyState', '#bottom-area div[class*="emptyStateIcon-"]');
  },

  // --- Overview Tab ---
  get overviewContainer() {
    return getSelector(
      'overviewContainer',
      '#bottom-area .bottom-widgetbar-content.backtesting div[class*="reportContainer"]',
    );
  },
  get overviewStatRow() {
    return getSelector('overviewStatRow', 'div[class^="containerCell-"]');
  },
  get overviewLabel() {
    return getSelector('overviewLabel', 'div[class^="title-"]');
  },
  get overviewValue() {
    return getSelector('overviewValue', 'div[class^="highlightedValue-"], div[class^="value-"]');
  },
  get overviewCurrency() {
    return getSelector('overviewCurrency', 'div[class^="currency-"]');
  },
  get overviewChange() {
    return getSelector('overviewChange', 'div[class^="change-"]');
  },

  // --- Performance Tab ---
  get performanceContainer() {
    return getSelector('performanceContainer', '#bottom-area .bottom-widgetbar-content.backtesting table.ka-table');
  },
  get performanceRow() {
    return getSelector('performanceRow', 'tr.ka-tr.ka-row');
  },
  get performanceLabel() {
    return getSelector('performanceLabel', 'div[class*="title-"]');
  },
  get performanceValue() {
    return getSelector('performanceValue', 'div[class^="value-"]');
  },
  get performanceCurrency() {
    return getSelector('performanceCurrency', 'div[class^="currency-"]');
  },
  get performancePercent() {
    return getSelector('performancePercent', 'div[class^="percentValue-"]');
  },

  // --- Trade Analysis Tab ---
  get tradeAnalysisContainer() {
    return getSelector('tradeAnalysisContainer', '#bottom-area .bottom-widgetbar-content.backtesting table.ka-table');
  },
  get tradeAnalysisRow() {
    return getSelector('tradeAnalysisRow', 'tr.ka-tr.ka-row');
  },
  get tradeAnalysisLabel() {
    return getSelector('tradeAnalysisLabel', 'div[class*="title-"]');
  },

  // --- Risk / Performance Ratios Tab ---
  get riskRatiosContainer() {
    return getSelector('riskRatiosContainer', '#bottom-area .bottom-widgetbar-content.backtesting table.ka-table');
  },
  get riskRatiosRow() {
    return getSelector('riskRatiosRow', 'tr.ka-tr.ka-row');
  },
  get riskRatiosLabel() {
    return getSelector('riskRatiosLabel', 'div[class*="title-"]');
  },

  // === List of Trades Tab ===
  get listOfTradesRow() {
    return getSelector('listOfTradesRow', 'tr[data]');
  },
  get listOfTradesHeaderRow() {
    return getSelector('listOfTradesHeaderRow', 'thead tr.ka-thead-row');
  },
  get listOfTradesHeaderCell() {
    return getSelector('listOfTradesHeaderCell', 'th');
  },
  get listOfTradesCell() {
    return getSelector('listOfTradesCell', 'td.ka-cell');
  },
  get listOfTradesDoubleCell() {
    return getSelector('listOfTradesDoubleCell', 'div[class^="doubleCell-"]');
  },
  get listOfTradesEntryPart() {
    return getSelector('listOfTradesEntryPart', 'div[data-part="1"]');
  },
  get listOfTradesExitPart() {
    return getSelector('listOfTradesExitPart', 'div[data-part="0"]');
  },
  get listOfTradesSortHeader() {
    return getSelector('listOfTradesSortHeader', 'div.ka-thead-cell-content.ka-pointer');
  },

  get SETTINGS_DIALOG_CLOSE_BUTTON() {
    return getSelector('SETTINGS_DIALOG_CLOSE_BUTTON', 'button[data-name="close"]');
  },
  get SETTINGS_DIALOG_OK_BUTTON() {
    return getSelector('SETTINGS_DIALOG_OK_BUTTON', 'button[name="submit"][data-name="submit-button"]');
  },
  get SETTINGS_DIALOG_TABS() {
    return getSelector('SETTINGS_DIALOG_TABS', '#indicator-properties-dialog-tabs button');
  },
  get SETTINGS_DIALOG_TAB_SELECTED() {
    return getSelector('SETTINGS_DIALOG_TAB_SELECTED', 'aria-selected');
  },
  get SETTINGS_CELL_WILDCARD() {
    return getSelector('SETTINGS_CELL_WILDCARD', '[class*="cell-"]');
  },

  get STRATEGY_LEGEND_ITEM() {
    return getSelector('STRATEGY_LEGEND_ITEM', 'div[data-qa-id="legend-source-item"]');
  },
  get STRATEGY_TITLE() {
    return getSelector('STRATEGY_TITLE', '[data-qa-id="legend-source-title"]');
  },
  get STRATEGY_SETTINGS_ACTION() {
    return getSelector('STRATEGY_SETTINGS_ACTION', '[data-qa-id="legend-settings-action"]');
  },
  get STRATEGY_SETTINGS_REMOVE_BLOCK() {
    return getSelector('STRATEGY_SETTINGS_REMOVE_BLOCK', 'blockHidden-e6PF69Df');
  },
  get STRATEGY_BUTTONS_WRAPPER() {
    return getSelector('STRATEGY_BUTTONS_WRAPPER', '.buttonsWrapper-l31H9iuA');
  },

  get DROPDOWN_OPTION() {
    return getSelector('DROPDOWN_OPTION', '[role="option"]');
  },
  get DROPDOWN_OPTION_LABEL() {
    // Updated: TradingView now uses div.title-* instead of span.label-*
    return getSelector('DROPDOWN_OPTION_LABEL', '[class*="title-"], span[class^="label"]');
  },
  get COMBOBOX_BUTTON() {
    return getSelector('COMBOBOX_BUTTON', '[role="combobox"]');
  },
  get COMBOBOX_MIDDLE_SLOT() {
    return getSelector('COMBOBOX_MIDDLE_SLOT', '[class*="middleSlot-"]');
  },
  get LISTBOX_POPUP() {
    // Updated: TradingView may use various popup containers
    return getSelector('LISTBOX_POPUP', '[role="listbox"], [class*="mainScrollWrapper-"], [class*="popover-"]');
  },
  get TIME_INTERVAL_BUTTON() {
    return getSelector('TIME_INTERVAL_BUTTON', 'button[aria-label="Chart interval"]');
  },
  get TIMEFRAME_MENU_BOX() {
    return getSelector('TIMEFRAME_MENU_BOX', '[class^="menuBox-"]');
  },
  get TIMEFRAME_MENU_LABEL() {
    return getSelector('TIMEFRAME_MENU_LABEL', 'span[class^="label-"]');
  },
  get TIMEFRAME_MUNU_ROW() {
    return getSelector('TIMEFRAME_MUNU_ROW', 'div[role="row"]');
  },

  // === Session Input (input.session) ===
  get SESSION_INPUT_GROUP() {
    return getSelector('SESSION_INPUT_GROUP', '[class*="inputGroup-"]');
  },
  get SESSION_START() {
    return getSelector('SESSION_START', '[class*="sessionStart-"]');
  },
  get SESSION_END() {
    return getSelector('SESSION_END', '[class*="sessionEnd-"]');
  },

  // === Settings Dialog Helpers ===
  get SETTINGS_TITLE_WRAP() {
    return getSelector('SETTINGS_TITLE_WRAP', '.titleWrap-Izz3hpJc');
  },
  get SETTINGS_FIRST_CELL_CLASS() {
    return getSelector('SETTINGS_FIRST_CELL_CLASS', 'first-');
  },

  // === Strategy Detection ===
  get STRATEGY_DETECTION_NODES() {
    return getSelector('STRATEGY_DETECTION_NODES', 'div[class*="titleWrapper"][class*="mainTitle"] > div');
  },

  // === Snackbar Classes ===
  get SNACKBAR_EMPTY_CLASS() {
    return getSelector('SNACKBAR_EMPTY_CLASS', 'empty-_MKqWk5g');
  },

  // === Deep Backtesting Detection ===
  // Warning banner that appears when deep backtesting is active (can be dismissed by user)
  get deepBacktestWarning() {
    return getSelector('deepBacktestWarning', 'div.backtestingWarningContainer-c7aRkO2u');
  },
  // Deep backtesting status icon (more reliable - appears in strategy header, cannot be dismissed)
  get deepBacktestStatusIcon() {
    return getSelector('deepBacktestStatusIcon', '[class*="deepBacktesting"]');
  },
  // Strategy button title contains "Deep Backtesting" when in deep backtest mode
  get deepBacktestTitleIndicator() {
    return getSelector('deepBacktestTitleIndicator', '[title*="Deep Backtesting"]');
  },
  // Outdated report snackbar (contains "Update report" button)
  get outdatedReportSnackbar() {
    return getSelector('outdatedReportSnackbar', '[data-qa-id="backtesting-updated-report-snackbar"]');
  },

  // === Watchlist Panel ===
  // Watchlist button in the right sidebar to open/close the watchlist panel
  get watchlistButton() {
    return getSelector('watchlistButton', 'button[aria-label="Watchlist, details and news"]');
  },
};
