// shared-script.ts
//import { automationTimingStorage } from '@extension/storage';
import { tv_settings } from './tv_settings';
import * as tv_results from './tv_results';
import * as tv_symbols from './tv_symbols';
import { debugLog } from './debug_log';
import { handleBacktestUpdate, isDeepBacktestingActive } from './tv_clickActions';
import { TVSelectors } from './tv_selectors';
import { detectUIVersion } from './tv_detection';
// Expose to window for dev testing
(window as any).tv_symbols = tv_symbols;
const defaultTiming = {
  waitDialog: 500,
  waitReprocess: 3000,
  waitLoad: 600,
  updateDelay: 300,
  waitChartTime: 800,
  waitSettingsClose: 300,
  waitDeepBacktest: 500,
};
const timing = { ...defaultTiming, ...JSON.parse(localStorage.getItem('automation-timing') || '{}') };

/**
 * Wait until automation is resumed OR stopped.
 * Returns true if resumed normally, false if stop was requested during pause.
 */
function waitUntilResumedOrStopped(): Promise<boolean> {
  return new Promise(resolve => {
    const check = () => {
      // Check stop flag first - if stopped, exit immediately
      const stopped = localStorage.getItem('automationStopped') === 'true';
      if (stopped) {
        debugLog('log', '[Shared-Script] 🛑 Stop detected during pause - exiting wait');
        resolve(false); // Return false to indicate stop was requested
        return;
      }

      const paused = localStorage.getItem('automationPaused') === 'true';
      if (!paused) {
        resolve(true); // Return true to indicate normal resume
      } else {
        setTimeout(check, 500); // Poll every 500ms (faster response to stop)
      }
    };
    check();
  });
}

debugLog('log', '[Shared-Script] Running');
export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'SleepEventComplete') {
        //console.log(`[Shared-Script] 🛌 Sleep complete after ${ms}ms`);
        window.removeEventListener('message', handler);
        resolve();
      }
    };

    //console.log(`[Shared-Script] ⏱ Requesting sleep for ${ms}ms...`);

    window.addEventListener('message', handler);
    window.postMessage({ type: 'SleepEventStart', delay: ms }, '*');
  });

// ─── APPLY PARAMETERS NOTIFICATION ─────────────────────────────────
// Shows a loading notification when applying parameters from historical results

function showApplyingParametersNotification(strategyName: string): HTMLElement {
  // Remove any existing notification
  const existing = document.getElementById('qt-apply-params-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.id = 'qt-apply-params-notification';
  notification.innerHTML = `
    <style>
      @keyframes qt-spin {
        to { transform: rotate(360deg); }
      }
      #qt-apply-params-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #18181b;
        border: 1px solid #3f3f46;
        border-radius: 12px;
        padding: 16px 20px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        max-width: 320px;
        animation: qt-slide-in 0.3s ease-out;
      }
      @keyframes qt-slide-in {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
      }
    </style>
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <div id="qt-notif-icon" style="flex-shrink: 0; width: 24px; height: 24px;">
        <svg style="animation: qt-spin 1s linear infinite; width: 24px; height: 24px;" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
        </svg>
      </div>
      <div style="flex: 1;">
        <div id="qt-notif-title" style="color: #ffffff; font-weight: 600; font-size: 14px; margin-bottom: 4px;">
          Applying Parameters...
        </div>
        <div id="qt-notif-message" style="color: #a1a1aa; font-size: 13px; line-height: 1.4;">
          Loading settings for <strong style="color: #e4e4e7;">${strategyName}</strong>
        </div>
      </div>
      <button onclick="this.closest('#qt-apply-params-notification').remove()" style="
        background: none;
        border: none;
        color: #52525b;
        cursor: pointer;
        font-size: 18px;
        padding: 0;
        line-height: 1;
      ">&times;</button>
    </div>
  `;
  document.body.appendChild(notification);
  return notification;
}

function updateNotificationToSuccess(notification: HTMLElement): void {
  const icon = notification.querySelector('#qt-notif-icon');
  const title = notification.querySelector('#qt-notif-title');
  const message = notification.querySelector('#qt-notif-message');

  if (icon) {
    icon.innerHTML = `
      <svg style="width: 24px; height: 24px;" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 12l3 3 5-6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }
  if (title) title.textContent = 'Parameters Applied!';
  if (message) message.innerHTML = 'Strategy settings have been updated successfully.';

  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    notification.style.transition = 'opacity 0.3s, transform 0.3s';
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(20px)';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function updateNotificationToError(notification: HTMLElement, error: string): void {
  const icon = notification.querySelector('#qt-notif-icon');
  const title = notification.querySelector('#qt-notif-title');
  const message = notification.querySelector('#qt-notif-message');

  if (icon) {
    icon.innerHTML = `
      <svg style="width: 24px; height: 24px;" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M15 9l-6 6M9 9l6 6" stroke-linecap="round"/>
      </svg>
    `;
  }
  if (title) title.textContent = 'Error Applying Parameters';
  if (message) message.innerHTML = `<span style="color: #fca5a5;">${error}</span>`;

  // Don't auto-dismiss errors - let user close manually
}

function updateNotificationToInfo(notification: HTMLElement, strategyName: string): void {
  const icon = notification.querySelector('#qt-notif-icon');
  const title = notification.querySelector('#qt-notif-title');
  const message = notification.querySelector('#qt-notif-message');

  if (icon) {
    icon.innerHTML = `
      <svg style="width: 24px; height: 24px;" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v4M12 16h.01" stroke-linecap="round"/>
      </svg>
    `;
  }
  if (title) title.textContent = 'Strategy Not Found';
  if (message) {
    message.innerHTML = `The strategy <strong style="color: #e4e4e7;">${strategyName}</strong> is not loaded on your chart.<br><br>Please add it to your chart and try again. <span style="
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #333;
      color: #a1a1aa;
      font-size: 11px;
      font-weight: 700;
      cursor: help;
      vertical-align: middle;
      position: relative;
    " title="If you renamed or recreated this strategy, TradingView treats it as a new script. Add the current version to your chart, then save new parameters to the library.">?</span>`;
  }

  // Don't auto-dismiss - let user close manually
}

/**
 * T2.E: Wait for TradingView's backtest success snackbar to appear
 * This indicates the strategy calculation is complete and we can proceed immediately
 *
 * Watches for: <div data-qa-id="backtesting-success-report-snackbar">
 * with message "The report has been updated successfully"
 *
 * @param timeoutMs - Maximum time to wait before falling back (default: 10000ms)
 * @param pollInterval - How often to check for snackbar (default: 100ms)
 * @param settleDelayMs - Delay after snackbar detected to let DOM fully render (default: 200ms)
 * @returns Promise that resolves when snackbar appears or timeout is reached
 */
/**
 * Result type for waitForBacktestComplete
 * - 'success': Backtest completed with data
 * - 'no_data': Strategy produced no trades for these parameters
 * - 'timeout': Timed out waiting
 * - 'stopped': User requested stop during wait
 */
export type BacktestCompleteResult = 'success' | 'no_data' | 'timeout' | 'stopped';

export const waitForBacktestComplete = (
  timeoutMs: number = 10000,
  pollInterval: number = 100,
  settleDelayMs: number = 200,
): Promise<BacktestCompleteResult> =>
  new Promise(resolve => {
    const startTime = Date.now();
    let resolved = false;

    const checkSnackbar = () => {
      if (resolved) return;

      // PRIORITY 1: Check for stop flag - exit immediately if user wants to stop
      const stopped = localStorage.getItem('automationStopped') === 'true';
      if (stopped) {
        resolved = true;
        const elapsed = Date.now() - startTime;
        debugLog('log', `[T2.E] 🛑 Stop flag detected after ${elapsed}ms - aborting wait`);
        resolve('stopped');
        return;
      }

      // Check for "No data" empty state - this means strategy has no trades for these parameters
      // We can immediately move on without waiting
      const noDataElement = document.querySelector('#bottom-area div[class*="emptyStateIcon-"]');
      if (noDataElement) {
        // Verify it's the "No data" message by checking sibling text
        const container = noDataElement.closest('div[class*="container-"]');
        const textElement = container?.querySelector('div[class*="text-"]');
        if (textElement?.textContent?.includes('No data')) {
          resolved = true;
          const elapsed = Date.now() - startTime;
          debugLog(
            'log',
            `[T2.E] ⚠️ "No data" empty state detected after ${elapsed}ms - no trades for these parameters, moving on`,
          );
          // Minimal delay since there's no data to render
          setTimeout(() => resolve('no_data'), 50);
          return;
        }
      }

      // Check for the success snackbar
      const snackbar = document.querySelector('[data-qa-id="backtesting-success-report-snackbar"]');

      if (snackbar) {
        // Verify it contains the success message
        const text = snackbar.textContent || '';
        if (text.includes('report has been updated successfully')) {
          resolved = true;
          const elapsed = Date.now() - startTime;
          debugLog(
            'log',
            `[T2.E] ✅ Backtest success snackbar detected after ${elapsed}ms, waiting ${settleDelayMs}ms for DOM to settle`,
          );
          // Add settling delay to let the results DOM fully render before scraping
          setTimeout(() => resolve('success'), settleDelayMs);
          return;
        }
      }

      // Check timeout
      if (Date.now() - startTime >= timeoutMs) {
        resolved = true;
        debugLog('log', `[T2.E] ⏱️ Snackbar timeout after ${timeoutMs}ms - proceeding anyway`);
        resolve('timeout');
        return;
      }

      // Continue polling
      setTimeout(checkSnackbar, pollInterval);
    };

    // Start checking
    checkSnackbar();
  });

if ((window as any).tvSharedScriptInjected) {
  debugLog('log', '[Shared-Script] Main - ⚠️ shared-script.js already injected. Skipping.');
} else {
  (window as any).tvSharedScriptInjected = true;

  debugLog('log', '[Shared-Script] Main - 🧠 script.ts running inside the TradingView page context');

  // Detect and store UI version early
  const detectedUIVersion = detectUIVersion();
  localStorage.setItem('detectedUIVersion', detectedUIVersion);
  debugLog('log', `[Shared-Script] 🎨 Detected TradingView UI version: ${detectedUIVersion}`);

  // ─── EMERGENCY STOP FUNCTION (exposed to window for DevTools) ───
  (window as any).emergencyStopAutomation = function () {
    localStorage.setItem('automationStopped', 'true');
    localStorage.setItem('automationStatus', 'Idle');
    localStorage.setItem('automationPaused', 'false');
    localStorage.removeItem('comboList');
    localStorage.removeItem('strategyName');

    console.log('🛑 EMERGENCY STOP ACTIVATED');
    console.log('✅ Automation stopped and reset successfully!');
    console.log('📊 Current state:', {
      status: localStorage.getItem('automationStatus'),
      stopped: localStorage.getItem('automationStopped'),
      paused: localStorage.getItem('automationPaused'),
    });

    return '✅ Automation stopped!';
  };

  (window as any).resetAllExtensionData = function () {
    const keys = Object.keys(localStorage).filter(
      key =>
        key.includes('automation') ||
        key.includes('combo') ||
        key.includes('strategy') ||
        key.includes('user-symbols') ||
        key.includes('click-action') ||
        key.includes('scrapeTabs') ||
        key.includes('debugLogs'),
    );

    keys.forEach(key => localStorage.removeItem(key));

    console.log('🔄 COMPLETE RESET PERFORMED');
    console.log(`✅ Cleared ${keys.length} extension keys:`, keys);

    return `✅ Reset complete! Cleared ${keys.length} keys.`;
  };

  debugLog(
    'log',
    '[Shared-Script] 💡 Emergency functions available: emergencyStopAutomation(), resetAllExtensionData()',
  );
  // ─────────────────────────────────────────────────────────────

  // ─── RESET STALE AUTOMATION STATE ───────────────────────────
  ['automationStatus', 'automationStopped', 'automationPaused'].forEach(key => localStorage.removeItem(key));
  debugLog('log', '[Shared-Script] 🧹 Cleared stale automation state');
  // ─────────────────────────────────────────────────────────────

  (async () => {
    await sleep(300);
    detectAndListStrategies();
  })();

  // 🔁 Listen for request from background
  window.addEventListener('message', event => {
    if (event.source !== window) return;

    // 🔁 Refresh Strategies
    if (event.data?.type === 'REFRESH_STRATEGIES') {
      debugLog(
        'log',
        '[Shared-Script] Main - 🔁 REFRESH_STRATEGIES received. Re-running detection... after sleep 300 ...',
      );
      (async () => {
        await sleep(300);
        detectAndListStrategies();
      })();
    }

    // 🛠 Open Strategy Settings
    if (event.data?.type === 'OPEN_STRATEGY_SETTINGS') {
      (async () => {
        const strategyName = localStorage.getItem('strategyName');

        if (!strategyName) {
          debugLog('warn', '[Shared-Script] ❌ No strategyName found in localStorage');
          return;
        }

        debugLog('log', '[Shared-Script] 🛠 Opening strategy settings for:', strategyName);

        tv_settings.clickStrategySettings(strategyName);
        await sleep(JSON.parse(localStorage.getItem('automation-timing') || '{}')?.waitLoad ?? 400);

        const scrapedSettings = await tv_settings.scrapeSettingsDialog();
        debugLog('log', '[Shared-Script] 🧪 Raw scraped settings:', scrapedSettings);
        window.postMessage(
          {
            type: 'SETTINGS_SCRAPED',
            source: 'tv-param-extractor',
            payload: scrapedSettings,
          },
          '*',
        );
      })();
    } // END OF IF OPEN STRATEGY SETTINGS

    // 🧪 Start Automation Trigger
    if (event.data?.type === 'START_AUTOMATION') {
      const status = localStorage.getItem('automationStatus');
      debugLog('log', '[Shared-Script] Automation Status: ', status);
      if (status === 'Running') {
        debugLog('log', '[Shared-Script] Automation already running — skipping START_AUTOMATION');
        return;
      }
      if (status === 'Completed') {
        debugLog('log', '[Shared-Script] 🔄 Resetting automation state for re-run');
        ['automationStatus', 'automationStopped', 'automationPaused'].forEach(key => localStorage.removeItem(key));
      }

      debugLog('log', '[Shared-Script] 🔁 Received START_AUTOMATION — launching run');
      startAutomation();
    } // END START AUTOMATION BLOCK
    // ⏸️ Handle pause toggle
    if (event.data?.type === 'SET_AUTOMATION_PAUSED') {
      const paused = !!event.data.value;
      localStorage.setItem('automationPaused', paused ? 'true' : 'false');
      debugLog('log', '[Shared-Script] ⏸️ SET_AUTOMATION_PAUSED =', paused);

      window.postMessage(
        {
          type: 'AUTOMATION_PAUSE_STATUS',
          source: 'tv-param-extractor',
          value: paused,
        },
        '*',
      );
    } // End of Set automation paused

    if (event.data?.type === 'STOP_AUTOMATION') {
      debugLog('log', '[Shared-Script] 🛑 STOP_AUTOMATION received - setting stop flag');
      localStorage.setItem('automationStopped', 'true');
      // Don't set status to 'Idle' here - let the loop finish and send AUTOMATION_COMPLETE
      // which will properly save results to IndexedDB and set status to 'Completed'
    }

    // ✅ Apply parameters to chart (Step 3)
    if (event.data?.type === 'APPLY_PARAMETERS') {
      (async () => {
        const { params, name } = event.data.payload;
        if (!params || !name) {
          debugLog('log', '[Shared-Script] ❌ Missing parameters or strategy name in APPLY_PARAMETERS');
          return;
        }

        debugLog('log', '[Shared-Script] 📌 Applying parameters to strategy:', params);

        // Show loading notification
        const notification = showApplyingParametersNotification(name);

        try {
          await tv_settings.updateSettingsDialog(params, name);
          await sleep(300); // slight delay before clicking OK
          await tv_settings.clickOkButton();

          debugLog('log', '[Shared-Script] ✅ Parameters applied and confirmed');

          // Update notification to success
          updateNotificationToSuccess(notification);
        } catch (error) {
          const errMsg = String(error);
          if (errMsg.includes('STRATEGY_NOT_FOUND')) {
            debugLog('log', `[Shared-Script] Strategy not on chart: ${name}`);
            updateNotificationToInfo(notification, name);
          } else {
            debugLog('log', '[Shared-Script] Error applying parameters:', error);
            updateNotificationToError(notification, errMsg);
          }
        }
      })();
    }

    // 📋 Scrape symbols on-demand (opens watchlist if closed)
    if (event.data?.type === 'SCRAPE_SYMBOLS') {
      (async () => {
        debugLog('log', '[Shared-Script] 📋 SCRAPE_SYMBOLS received - scraping watchlist...');
        const symbols = await tv_symbols.openWatchlistAndScrape();
        debugLog('log', `[Shared-Script] 📋 Scraped ${symbols.length} symbols`);

        window.postMessage(
          {
            type: 'SYMBOLS_SCRAPED',
            source: 'tv-param-extractor',
            payload: symbols,
          },
          '*',
        );
      })();
    }
    // 📚 Save current strategy parameters to library
    if (event.data?.type === 'SCRAPE_FOR_LIBRARY') {
      (async () => {
        debugLog('log', '[Shared-Script] 📚 SCRAPE_FOR_LIBRARY received - scraping params + performance');

        try {
          // 1. Get strategy name from the strategy tester DOM (not localStorage)
          const strategyTitleBtn = document.querySelector('button[data-strategy-title]');
          const strategyName =
            strategyTitleBtn?.getAttribute('data-strategy-title') || localStorage.getItem('strategyName');
          if (!strategyName) {
            window.postMessage(
              {
                type: 'LIBRARY_SCRAPE_RESULT',
                source: 'tv-param-extractor',
                payload: { success: false, error: 'No strategy found on chart' },
              },
              '*',
            );
            return;
          }
          debugLog('log', `[Shared-Script] 📚 Strategy name from DOM: ${strategyName}`);

          // 2. Scrape symbol from header toolbar (most reliable source)
          const headerSymbolBtn = document.querySelector('#header-toolbar-symbol-search');
          const instrument =
            headerSymbolBtn?.querySelector('span[class*="value-"]')?.textContent?.trim() ||
            headerSymbolBtn?.textContent?.trim() ||
            '';
          const { timeframe } = tv_results.scrapeSymbolAndTimeframe();
          debugLog('log', `[Shared-Script] 📚 Instrument: ${instrument}, Timeframe: ${timeframe}`);

          // 3. Scrape performance directly from the overview cards in strategy tester
          // These are the top-level stat cards (Total P&L, Max equity drawdown, etc.)
          const overviewCards = document.querySelectorAll('#bottom-area div[class*="containerCell-"]');
          const overviewData: Record<string, string> = {};
          overviewCards.forEach(card => {
            const titleEl = card.querySelector('div[class*="title-"]');
            const valueEl = card.querySelector('div[class*="highlightedValue-"], div[class*="value-"]');
            const currencyEl = card.querySelector('div[class*="currency-"]');
            const changeEl = card.querySelector('div[class*="change-"]');
            if (titleEl && valueEl) {
              const title = titleEl.textContent?.trim() || '';
              const parts = [valueEl.textContent?.trim() || ''];
              if (currencyEl?.textContent?.trim()) parts.push(currencyEl.textContent.trim());
              if (changeEl?.textContent?.trim()) parts.push(`(${changeEl.textContent.trim()})`);
              overviewData[title] = parts.join(' ');
            }
          });
          debugLog('log', '[Shared-Script] 📚 Overview data:', overviewData);

          const getMetric = (...keys: string[]) => {
            for (const k of keys) {
              if (overviewData[k]) return overviewData[k];
            }
            return '—';
          };
          // Format dollar value: "+1,800.00" → "+$1,800" or "−1,800.00" → "-$1,800"
          const formatDollar = (raw: string) => {
            if (raw === '—') return raw;
            // Extract the first number (with optional sign and commas)
            // Handles ASCII +/-, Unicode minus (U+2212), en-dash (U+2013)
            const match = raw.match(/([+\-\u2212\u2013]?)[\s]*([\d,]+)(?:\.\d+)?/);
            if (!match) return raw;
            // Normalize any minus-like character to ASCII hyphen
            const sign = match[1] ? (match[1] === '+' ? '+' : '-') : '';
            const intPart = match[2];
            return `${sign}$${intPart}`;
          };
          const performance = {
            netProfit: formatDollar(getMetric('Total P&L', 'Net Profit', 'Net profit')),
            maxDrawdown: formatDollar(getMetric('Max equity drawdown', 'Max Drawdown', 'Max drawdown')),
            winRate: getMetric('Profitable trades', 'Percent Profitable', 'Percent profitable', 'Win Rate'),
            profitFactor: getMetric('Profit factor', 'Profit Factor'),
            totalTrades: getMetric('Total trades', 'Total Closed Trades', 'Total closed trades'),
          };
          debugLog('log', '[Shared-Script] 📚 Performance:', performance);

          // 4. Scrape current parameters from settings dialog
          tv_settings.clickStrategySettings(strategyName);
          await sleep(timing.waitLoad);
          const scrapedSettings = await tv_settings.scrapeSettingsDialog();

          // Build flat param map: name → defaultValue (exclude synthetic params like _Symbol)
          const parameters: Record<string, any> = {};
          if (scrapedSettings) {
            for (const s of scrapedSettings) {
              if (s.name === '_Symbol' || s.name === 'tabs' || s.name === '_Timeframe') continue;
              parameters[s.name] = s.defaultValue;
            }
          }
          debugLog('log', '[Shared-Script] 📚 Parameters:', parameters);

          // Close settings dialog without applying changes
          tv_settings.clickCloseButton();

          // 5. Send scraped data back for the save dialog
          window.postMessage(
            {
              type: 'LIBRARY_SCRAPE_RESULT',
              source: 'tv-param-extractor',
              payload: {
                success: true,
                strategyName,
                instrument,
                timeframe,
                parameters,
                performance,
              },
            },
            '*',
          );
        } catch (err) {
          debugLog('warn', '[Shared-Script] ❌ Error scraping for library:', err);
          try {
            tv_settings.clickCloseButton();
          } catch {}
          window.postMessage(
            {
              type: 'LIBRARY_SCRAPE_RESULT',
              source: 'tv-param-extractor',
              payload: { success: false, error: String(err) },
            },
            '*',
          );
        }
      })();
    }
    // 📚 Save to Library button clicked (from content-ui)
    if (event.data?.type === 'SAVE_TO_LIBRARY_CLICKED') {
      startLibrarySaveFlow();
    }
  }); // End Listener from background

  // ─── SAVE-TO-LIBRARY FLOW ──────────────────────────────────────
  // Button injection moved to content-ui (auto-runs on page load).
  // content-ui sends SAVE_TO_LIBRARY_CLICKED message → handled above.
  // 1. Scrape params + performance
  // 2. Show name/description dialog
  // 3. Send SAVE_TO_LIBRARY message

  function startLibrarySaveFlow() {
    debugLog('log', '[Shared-Script] 📚 Starting library save flow...');

    // Request scrape from page context (we're already in page context, but the flow
    // goes through message passing so the response is async)
    window.postMessage({ type: 'SCRAPE_FOR_LIBRARY', source: 'tv-param-extractor' }, '*');

    // Listen for the scrape result
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'LIBRARY_SCRAPE_RESULT' && event.data?.source === 'tv-param-extractor') {
        window.removeEventListener('message', handler);

        const payload = event.data.payload;
        if (!payload?.success) {
          showSaveNotification('error', payload?.error || 'Failed to scrape parameters');
          return;
        }

        // Show name/description dialog
        showSaveDialog(payload);
      }
    };
    window.addEventListener('message', handler);

    // Timeout
    setTimeout(() => {
      window.removeEventListener('message', handler);
    }, 30000);
  }

  function showSaveDialog(scrapeData: any) {
    // Remove any existing dialog
    const existing = document.getElementById('qt-save-library-dialog');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'qt-save-library-dialog';
    overlay.innerHTML = `
      <style>
        #qt-save-library-dialog {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #qt-save-library-dialog .qt-dialog {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 24px;
          width: 360px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }
        #qt-save-library-dialog h3 {
          color: white;
          font-size: 15px;
          font-weight: 600;
          margin: 0 0 4px 0;
        }
        #qt-save-library-dialog .qt-subtitle {
          color: #888;
          font-size: 12px;
          margin: 0 0 16px 0;
        }
        #qt-save-library-dialog label {
          display: block;
          color: #aaa;
          font-size: 12px;
          margin-bottom: 4px;
        }
        #qt-save-library-dialog input {
          width: 100%;
          background: #0f0f0f;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 13px;
          color: white;
          outline: none;
          box-sizing: border-box;
        }
        #qt-save-library-dialog input:focus {
          border-color: #3b82f6;
        }
        #qt-save-library-dialog .qt-char-count {
          color: #555;
          font-size: 11px;
          text-align: right;
          margin-top: 2px;
        }
        #qt-save-library-dialog .qt-metrics {
          display: flex;
          gap: 8px;
          margin: 12px 0 16px 0;
        }
        #qt-save-library-dialog .qt-metric {
          flex: 1;
          background: #0f0f0f;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          padding: 6px 8px;
          text-align: center;
        }
        #qt-save-library-dialog .qt-metric-label {
          color: #666;
          font-size: 9px;
          text-transform: uppercase;
        }
        #qt-save-library-dialog .qt-metric-value {
          color: white;
          font-size: 11px;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        #qt-save-library-dialog .qt-buttons {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }
        #qt-save-library-dialog .qt-btn {
          flex: 1;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          transition: background 0.15s;
        }
        #qt-save-library-dialog .qt-btn-cancel {
          background: #252525;
          color: #ccc;
          border: 1px solid #333;
        }
        #qt-save-library-dialog .qt-btn-cancel:hover {
          background: #2a2a2a;
        }
        #qt-save-library-dialog .qt-btn-save {
          background: #2563eb;
          color: white;
          font-weight: 600;
        }
        #qt-save-library-dialog .qt-btn-save:hover {
          background: #3b82f6;
        }
        #qt-save-library-dialog .qt-btn-save:disabled {
          background: #1e3a5f;
          color: #6b8cba;
          cursor: not-allowed;
        }
      </style>
      <div class="qt-dialog">
        <h3>Save to Library</h3>
        <p class="qt-subtitle">${scrapeData.strategyName} &bull; ${scrapeData.instrument} &bull; ${scrapeData.timeframe}</p>
        <div class="qt-metrics">
          <div class="qt-metric">
            <div class="qt-metric-label">PnL</div>
            <div class="qt-metric-value">${scrapeData.performance.netProfit}</div>
          </div>
          <div class="qt-metric">
            <div class="qt-metric-label">DD</div>
            <div class="qt-metric-value">${scrapeData.performance.maxDrawdown}</div>
          </div>
          <div class="qt-metric">
            <div class="qt-metric-label">Win</div>
            <div class="qt-metric-value">${scrapeData.performance.winRate}</div>
          </div>
          <div class="qt-metric">
            <div class="qt-metric-label">PF</div>
            <div class="qt-metric-value">${scrapeData.performance.profitFactor}</div>
          </div>
        </div>
        <div style="margin-bottom: 12px;">
          <label for="qt-save-name">Name</label>
          <input type="text" id="qt-save-name" placeholder="e.g. ES Aggressive Entry" maxlength="80" />
        </div>
        <div>
          <label for="qt-save-desc">Description (optional)</label>
          <input type="text" id="qt-save-desc" placeholder="Short description..." maxlength="40" />
          <div class="qt-char-count"><span id="qt-desc-count">0</span>/40</div>
        </div>
        <div class="qt-buttons">
          <button class="qt-btn qt-btn-cancel" id="qt-save-cancel">Cancel</button>
          <button class="qt-btn qt-btn-save" id="qt-save-confirm" disabled>Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const nameInput = document.getElementById('qt-save-name') as HTMLInputElement;
    const descInput = document.getElementById('qt-save-desc') as HTMLInputElement;
    const descCount = document.getElementById('qt-desc-count')!;
    const saveBtn = document.getElementById('qt-save-confirm') as HTMLButtonElement;
    const cancelBtn = document.getElementById('qt-save-cancel')!;

    // Focus name input
    setTimeout(() => nameInput.focus(), 100);

    nameInput.addEventListener('input', () => {
      saveBtn.disabled = nameInput.value.trim().length === 0;
    });
    descInput.addEventListener('input', () => {
      descCount.textContent = String(descInput.value.length);
    });

    // Cancel
    cancelBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });

    // Save
    saveBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (!name) return;

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const payload = {
        strategy: {
          scriptId: '',
          savedName: '',
          chartName: scrapeData.strategyName,
          tab: 'favorites' as const,
        },
        instrument: scrapeData.instrument,
        timeframe: scrapeData.timeframe,
        name,
        description: descInput.value.trim() || undefined,
        parameters: scrapeData.parameters,
        performance: scrapeData.performance,
      };

      // Send save message through injector → background → API
      window.postMessage({ type: 'SAVE_TO_LIBRARY', source: 'tv-param-extractor', payload }, '*');

      // Listen for response
      const responseHandler = (event: MessageEvent) => {
        if (event.data?.type === 'LIBRARY_SAVE_RESPONSE' && event.data?.source === 'tv-param-extractor-response') {
          window.removeEventListener('message', responseHandler);
          overlay.remove();

          if (event.data.payload?.success) {
            showSaveNotification('success', 'Parameters saved to library!');
          } else {
            showSaveNotification('error', event.data.payload?.error || 'Failed to save');
          }
        }
      };
      window.addEventListener('message', responseHandler);

      // Timeout
      setTimeout(() => {
        window.removeEventListener('message', responseHandler);
        if (document.contains(overlay)) {
          overlay.remove();
          showSaveNotification('error', 'Save timed out — please try again');
        }
      }, 15000);
    });

    // Enter to save
    nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !saveBtn.disabled) saveBtn.click();
    });
    descInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !saveBtn.disabled) saveBtn.click();
    });
  }

  function showSaveNotification(type: 'success' | 'error', message: string) {
    const existing = document.getElementById('qt-save-notification');
    if (existing) existing.remove();

    const notif = document.createElement('div');
    notif.id = 'qt-save-notification';
    const isSuccess = type === 'success';
    notif.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #18181b;
      border: 1px solid ${isSuccess ? '#22c55e33' : '#ef444433'};
      border-radius: 10px;
      padding: 12px 16px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      gap: 10px;
      animation: qt-slide-in 0.3s ease-out;
      max-width: 320px;
    `;
    notif.innerHTML = `
      <div style="color: ${isSuccess ? '#22c55e' : '#ef4444'}; font-size: 18px;">${isSuccess ? '&#10003;' : '&#10007;'}</div>
      <div style="color: #e4e4e7; font-size: 13px;">${message}</div>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#555;cursor:pointer;font-size:16px;padding:0;margin-left:4px;">&times;</button>
    `;
    document.body.appendChild(notif);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      if (document.contains(notif)) {
        notif.style.transition = 'opacity 0.3s';
        notif.style.opacity = '0';
        setTimeout(() => notif.remove(), 300);
      }
    }, 4000);
  }
}

// ─── P0-B: INLINE COMBO GENERATOR FUNCTIONS ─────────────────────
// These are inlined here because shared-script.ts runs in page context
// and cannot import from external modules
// ⚠️ MAINTENANCE: Keep in sync with packages/shared/lib/utils/automation_utils.ts

// ─── HELPER: Generate values from a numeric range ─────────────────────────────
function generateRangeValues(
  start: number | string | undefined,
  end: number | string | undefined,
  increment: number | string | undefined,
  type: 'integer' | 'float',
): any[] {
  const s = parseFloat(String(start ?? '0'));
  const e = parseFloat(String(end ?? '0'));
  const step = parseFloat(String(increment ?? '1'));

  if (isNaN(s) || isNaN(e) || isNaN(step) || step <= 0) return [];

  const values: any[] = [];
  for (let v = s; v <= e; v += step) {
    values.push(type === 'integer' ? Math.round(v) : parseFloat(v.toFixed(4)));
  }
  return values;
}

// ─── HELPER: Check if a value falls within any avoid range ────────────────────
function isInAvoidRange(value: number, avoidRanges: any[]): boolean {
  for (const range of avoidRanges) {
    const start = parseFloat(String(range.start));
    const end = parseFloat(String(range.end));
    if (!isNaN(start) && !isNaN(end) && value >= start && value <= end) {
      return true;
    }
  }
  return false;
}

// ─── HELPER: Convert "HH:MM" or "HHmm" to total minutes since midnight ───────
function timeToMinutes(time: string): number {
  const clean = time.replace(':', '');
  const hours = parseInt(clean.substring(0, 2), 10);
  const minutes = parseInt(clean.substring(2, 4), 10);
  return hours * 60 + minutes;
}

// ─── HELPER: Generate time strings from a range ──────────────────────────────
function generateSessionTimes(from: string, to: string, incrementMinutes: number): string[] {
  const startMins = timeToMinutes(from);
  const endMins = timeToMinutes(to);
  const times: string[] = [];
  if (isNaN(startMins) || isNaN(endMins) || incrementMinutes <= 0 || endMins < startMins) return times;
  for (let m = startMins; m <= endMins; m += incrementMinutes) {
    const h = Math.floor(m / 60)
      .toString()
      .padStart(2, '0');
    const min = (m % 60).toString().padStart(2, '0');
    times.push(`${h}${min}`);
  }
  return times;
}

/**
 * P0-B: Generate possible values for a parameter
 * Supports modes: single (default), clustered, specific, locked
 */
function getParamValues(param: any): any[] {
  const { type, mode = 'single' } = param;

  // SESSION: Generate "HHmm-HHmm" string combinations (start x end cartesian product)
  if (type === 'session') {
    const startTimes = generateSessionTimes(
      param.sessionStartFrom ?? '09:00',
      param.sessionStartTo ?? '09:00',
      param.sessionStartIncrement ?? 60,
    );
    const endTimes = generateSessionTimes(
      param.sessionEndFrom ?? '16:00',
      param.sessionEndTo ?? '16:00',
      param.sessionEndIncrement ?? 60,
    );
    const combinations: string[] = [];
    for (const s of startTimes) {
      for (const e of endTimes) {
        if (timeToMinutes(s) < timeToMinutes(e)) {
          combinations.push(`${s}-${e}`);
        }
      }
    }
    return combinations;
  }

  // CHECKBOX: unchanged (already uses values array)
  if (type === 'checkbox') {
    // For checkbox, check if locked mode with a specific value
    if (mode === 'locked' && param.lockedValue !== undefined) {
      return [param.lockedValue === true || param.lockedValue === 'true'];
    }
    return param.values?.map((v: any) => v === 'true') ?? [];
  }

  // DROPDOWN: check for locked mode, otherwise use values array
  if (type === 'dropdown') {
    if (mode === 'locked' && param.lockedValue !== undefined) {
      return [param.lockedValue];
    }
    return Array.isArray(param.values)
      ? param.values
      : String(param.values)
          .split(',')
          .map((s: string) => s.trim());
  }

  // NUMERIC TYPES: handle all modes
  if (type === 'integer' || type === 'float') {
    // LOCKED MODE: single fixed value
    if (mode === 'locked') {
      if (param.lockedValue === undefined) return [];
      const val = parseFloat(String(param.lockedValue));
      if (isNaN(val)) return [];
      return [type === 'integer' ? Math.round(val) : val];
    }

    // SPECIFIC VALUES MODE: explicit list of values
    if (mode === 'specific') {
      if (!param.specificValues || param.specificValues.length === 0) return [];
      return param.specificValues
        .map((v: any) => {
          const num = parseFloat(String(v));
          return type === 'integer' ? Math.round(num) : num;
        })
        .filter((v: number) => !isNaN(v));
    }

    // CLUSTERED MODE: union of all cluster ranges
    if (mode === 'clustered') {
      if (!param.clusters || param.clusters.length === 0) return [];
      const allValues: any[] = [];
      for (const cluster of param.clusters) {
        const clusterValues = generateRangeValues(cluster.start, cluster.end, cluster.increment, type);
        allValues.push(...clusterValues);
      }
      // Remove duplicates and sort
      return [...new Set(allValues)].sort((a: number, b: number) => a - b);
    }

    // SINGLE MODE (default): standard range with optional avoid ranges
    const values = generateRangeValues(param.start, param.end, param.increment, type);

    // Apply avoid ranges if present
    if (param.avoidRanges && param.avoidRanges.length > 0) {
      return values.filter((v: number) => !isInAvoidRange(v, param.avoidRanges));
    }

    return values;
  }

  return [];
}

/**
 * P0-B: Generate a specific combination by index (on-demand generation)
 * Uses multi-base number system to map index to combo
 * ⚠️ IMPORTANT: Iterates params in REVERSE order so first param (e.g., _Symbol) changes slowest
 * This minimizes expensive symbol/timeframe switches during automation
 */
function generateComboAtIndex(params: any[], index: number): Record<string, any> {
  const validParams = params.filter((p: any) => p.type !== 'string');
  const combo: Record<string, any> = {};

  let remainingIndex = index;

  // ⚠️ Iterate in REVERSE order: last param changes fastest, first param changes slowest
  // This matches the old buildAllCombinations() cartesian product order
  // Example: [_Symbol, _Length] → Symbol changes slowly, Length changes quickly
  for (let i = validParams.length - 1; i >= 0; i--) {
    const param = validParams[i];
    const paramValues = getParamValues(param);
    if (paramValues.length === 0) continue;

    const valueIndex = remainingIndex % paramValues.length;
    combo[param.name] = paramValues[valueIndex];

    remainingIndex = Math.floor(remainingIndex / paramValues.length);
  }

  return combo;
}

// ─────────────────────────────────────────────────────────────────

// ⏳ Strategy detection logic
function detectAndListStrategies() {
  setTimeout(() => {
    const nodes = document.querySelectorAll(TVSelectors.STRATEGY_DETECTION_NODES);
    debugLog('log', '[Shared-Script] detectAndListStrategies - 🔍 Found strategy nodes:', nodes.length);

    const strategyNames: string[] = [];

    nodes.forEach(node => {
      const name = node.textContent?.trim();
      if (name && name.length > 1 && !/^[A-Z]$/.test(name) && !strategyNames.includes(name)) {
        strategyNames.push(name);
      }
    });

    debugLog('log', '[Shared-Script] detectAndListStrategies - 📈 Strategies found:', strategyNames);
    tv_symbols.scrape_user_lists();
    // 🚀 Post results to injector
    window.postMessage(
      {
        source: 'tv-param-extractor',
        type: 'STRATEGY_LIST',
        payload: strategyNames,
      },
      '*',
    );
  });
}

async function startAutomation() {
  debugLog('log', '[Shared-Script] Sending Ack Automation Started');

  // Reset any previous stop flag
  localStorage.setItem('automationStopped', 'false');

  // Directly mark as Running (listener already blocked repeats)
  localStorage.setItem('automationStatus', 'Running');

  debugLog('log', '[Shared-Script] 🚀 Starting automation...');

  // P0-B: Read automation recipe instead of full comboList
  // Note: Must read recipe BEFORE sending AUTOMATION_STARTED so we can include resumeRunId
  const rawRecipe = localStorage.getItem('automationRecipe');
  if (!rawRecipe) {
    debugLog('warn', '[Shared-Script] ❌ No automationRecipe found in localStorage');
    return;
  }

  let automationRecipe: { params: any[]; totalCombos: number; startFromIndex?: number; resumeRunId?: string | null };
  try {
    automationRecipe = JSON.parse(rawRecipe);
    debugLog('log', `[Shared-Script] ✅ P0-B: Loaded recipe with ${automationRecipe.totalCombos} combos`);
  } catch (err) {
    debugLog('warn', '[Shared-Script] ❌ Failed to parse automationRecipe:', err);
    return;
  }

  const strategyName = localStorage.getItem('strategyName');
  if (!strategyName) {
    debugLog('log', '[Shared-Script] ⚠️ No strategyName found in localStorage');
    return;
  }

  // P0-B: Generate combos on-demand instead of loading all from localStorage
  const totalCombos = automationRecipe.totalCombos;

  // Tier 1.B: Support resuming from checkpoint (read from recipe)
  const startFromIndex = automationRecipe.startFromIndex ?? 0;
  const resumeRunId = automationRecipe.resumeRunId ?? null;

  if (startFromIndex > 0) {
    debugLog(
      'log',
      `[T1B][Shared-Script] 🔄 RESUMING automation from combo ${startFromIndex + 1}/${totalCombos} (runId: ${resumeRunId?.substring(0, 19)})`,
    );
  } else {
    debugLog('log', `[Shared-Script] 🎯 Starting NEW automation: totalCombos=${totalCombos}`);
  }

  // Notify popup/background that we've started (Tier 1.B: include resumeRunId for resume support)
  window.postMessage(
    {
      type: 'AUTOMATION_STARTED',
      source: 'tv-param-extractor',
      resumeRunId: resumeRunId, // Tier 1.B: Pass to injector so it uses existing runId
    },
    '*',
  );

  //Loop through generating combinations on the fly (Tier 1.B: may start from startFromIndex)
  for (let i = startFromIndex; i < totalCombos; i++) {
    if (localStorage.getItem('automationStopped') === 'true') {
      debugLog('log', '[Shared-Script] 🛑 Detected automation stop flag — breaking');
      break;
    }

    // P0-B: Generate combo on-demand instead of loading from array
    const combo = generateComboAtIndex(automationRecipe.params, i);
    const cleanCombo = structuredClone(combo); //Cloning due to issuew where _Timeframe was being dropped.
    debugLog('log', `[Shared-Script] 🔁 Loop iteration i=${i}, testing combo ${i + 1}/${totalCombos}:`, combo);

    // Block for pause - also check for stop during pause
    const paused = localStorage.getItem('automationPaused') === 'true';
    if (paused) {
      debugLog('log', `[Shared-Script] ⏸️ Paused before combo ${i + 1}. Waiting...`);
      const resumed = await waitUntilResumedOrStopped();
      if (!resumed) {
        // Stop was requested during pause - break immediately
        debugLog('log', '[Shared-Script] 🛑 Stop requested during pause - breaking loop');
        break;
      }
      debugLog('log', `[Shared-Script] ▶️ Resumed. Continuing combo ${i + 1}`);
    }

    try {
      // Reopen settings dialog
      //tv_settings.clickStrategySettings(strategyName);
      //await sleep(JSON.parse(localStorage.getItem('automation-timing') || '{}')?.waitLoad ?? 600);
      //async get of AutomationTiminStorage and sleep.

      // Update with current combo
      await tv_settings.updateSettingsDialog(combo, strategyName);
      tv_settings.clickOkButton();

      // Brief delay to let dialog close and TradingView start processing
      await sleep(timing.waitSettingsClose);

      // Detect if deep backtesting is active (warning banner visible)
      const isDeepBacktest = isDeepBacktestingActive();

      // Handle the backtest update cycle (waits for success snackbar)
      // This unified function handles both deep and normal backtesting
      const updateResult = await handleBacktestUpdate(isDeepBacktest);
      debugLog('log', `[Shared-Script] Backtest update result: ${updateResult}`);

      // Check for stop request after update
      const stopped = localStorage.getItem('automationStopped') === 'true';
      if (stopped) {
        debugLog('log', `[Shared-Script] 🛑 Stop detected after backtest update - breaking loop`);
        break;
      }

      // Check for "No data" state
      const noDataElement = document.querySelector('#bottom-area div[class*="emptyStateIcon-"]');
      let results;
      if (noDataElement) {
        const container = noDataElement.closest('div[class*="container-"]');
        const textElement = container?.querySelector('div[class*="text-"]');
        if (textElement?.textContent?.includes('No data')) {
          debugLog('log', `[Shared-Script] ⚠️ Combo i=${i} has no trades - recording empty result`);
          results = {
            noData: true,
            error: 'No trades generated for these parameters',
          };
        } else {
          results = await tv_results.scrape_results(strategyName);
        }
      } else {
        results = await tv_results.scrape_results(strategyName);
      }

      // 🚀 Post results to injector
      window.postMessage(
        {
          type: 'AUTOMATION_UPDATE',
          source: 'tv-param-extractor',
          payload: {
            currentIndex: i,
            total: totalCombos,
            combination: cleanCombo,
            paramName: Object.keys(combo)[0], // optional fallback
            result: results,
          },
        },
        '*',
      );

      debugLog('log', `[Shared-Script] ✅ Completed combo i=${i} (${i + 1}/${totalCombos})`);
    } catch (err) {
      debugLog('warn', `[Shared-Script] ❌ Error running combo i=${i} (${i + 1}/${totalCombos}):`, err);
    }
  } // End of For loop

  debugLog('log', `[Shared-Script] 🏁 Loop exited. Completed all ${totalCombos} automation tests`);
  debugLog('log', '[Shared-Script] 📝 Setting localStorage.automationStatus = "Completed"');
  localStorage.setItem('automationStatus', 'Completed');

  // No delay needed - the injector flushes the final batch immediately on the last result
  // (detected via currentIndex === total - 1 in AUTOMATION_UPDATE handler)
  debugLog('log', '[Shared-Script] 📤 Posting AUTOMATION_COMPLETE message');
  window.postMessage(
    {
      type: 'AUTOMATION_COMPLETE',
      source: 'tv-param-extractor',
    },
    '*',
  );
  debugLog('log', '[Shared-Script] ✅ AUTOMATION_COMPLETE message posted');
}
