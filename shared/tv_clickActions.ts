import { debugLog } from './debug_log';
import { TVSelectors } from './tv_selectors';

export type ClickActionOptions = {
  enabled: boolean;
  selector: string;
  confirmSelector: string;
  maxAttempts?: number;
  retryDelay?: number;
  waitAfterClick?: number;
  logPrefix?: string;
};

export async function clickAction(options: ClickActionOptions): Promise<boolean> {
  const stored = JSON.parse(localStorage.getItem('click-action') || '{}');

  const {
    enabled,
    selector,
    confirmSelector,
    maxAttempts = stored?.maxAttempts ?? 5,
    retryDelay = stored?.retryDelay ?? 500,
    waitAfterClick = stored?.waitAfterClick ?? 300,
    logPrefix = 'clickAction',
  } = options;

  if (!enabled) {
    debugLog('log', '[clickAction][${logPrefix}] Skipping click – disabled via settings');
    return false;
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const el = document.querySelector(selector) as HTMLElement;
    if (!el) {
      debugLog('log', '[clickAction][${logPrefix}] Attempt ${attempt}: Element not found: ${selector}');
    } else {
      el.click();
      await new Promise(res => setTimeout(res, waitAfterClick));

      const confirmed = document.querySelector(confirmSelector);
      if (confirmed) {
        debugLog('log', '[clickAction][${logPrefix}] Click confirmed after attempt ${attempt}');
        return true;
      }

      debugLog('log', '[clickAction][${logPrefix}] Attempt ${attempt}: Confirmation failed, retrying...');
    }

    await new Promise(res => setTimeout(res, retryDelay));
  }

  debugLog('log', '[${logPrefix}] ❌ Failed to confirm after ${maxAttempts} attempts');
  return false;
}

/**
 * Detects if deep backtesting mode is active.
 * Uses multiple detection methods as fallbacks since users can dismiss the warning banner.
 *
 * Detection methods (in order of reliability):
 * 1. Deep backtesting status icon (class contains "deepBacktesting") - most reliable, cannot be dismissed
 * 2. Strategy button title contains "Deep Backtesting"
 * 3. Warning banner (can be dismissed by user - least reliable)
 *
 * @returns true if any deep backtesting indicator is found
 */
export function isDeepBacktestingActive(): boolean {
  // Method 1: Check for deep backtesting status icon (most reliable)
  const statusIcon = document.querySelector(TVSelectors.deepBacktestStatusIcon);
  if (statusIcon) {
    debugLog('log', '[isDeepBacktestingActive] ✅ Detected via status icon (class*="deepBacktesting")');
    return true;
  }

  // Method 2: Check for title attribute containing "Deep Backtesting"
  const titleIndicator = document.querySelector(TVSelectors.deepBacktestTitleIndicator);
  if (titleIndicator) {
    debugLog('log', '[isDeepBacktestingActive] ✅ Detected via title attribute (title*="Deep Backtesting")');
    return true;
  }

  // Method 3: Check for warning banner (can be dismissed by user)
  const warning = document.querySelector(TVSelectors.deepBacktestWarning);
  if (warning) {
    debugLog('log', '[isDeepBacktestingActive] ✅ Detected via warning banner');
    return true;
  }

  debugLog('log', '[isDeepBacktestingActive] ❌ No deep backtesting indicators found - normal backtesting mode');
  return false;
}

/**
 * Waits for success snackbar to appear, indicating the backtest is complete.
 * Used for BOTH normal and deep backtesting after all button clicks are done.
 *
 * IMPORTANT: This function tracks state transitions to avoid returning early
 * due to a stale success snackbar from a previous iteration. We must see
 * either "updating" or "outdated" state before accepting "success" as valid.
 *
 * CRITICAL: Once we see the "updating" state, we NEVER timeout - we wait
 * until the update completes. This prevents moving to the next iteration
 * while a backtest is still processing.
 *
 * @param maxWaitMs - Maximum time to wait for transition state (default: 30000ms)
 * @param pollInterval - How often to check (default: 200ms)
 * @param requireTransition - If true, must see updating/outdated state before accepting success (default: true)
 */
async function waitForSuccessSnackbar(
  maxWaitMs: number = 30000,
  pollInterval: number = 200,
  requireTransition: boolean = true,
): Promise<'success' | 'empty' | 'timeout'> {
  const startTime = Date.now();
  let sawTransitionState = false; // Track if we've seen updating or outdated state
  let lastUpdateLogTime = 0; // For periodic logging

  debugLog(
    'log',
    `[waitForSuccessSnackbar] 🔍 Waiting for success snackbar (max ${maxWaitMs}ms, requireTransition=${requireTransition})`,
  );

  // Once we see "updating" state, we wait indefinitely (up to 5 minutes max safety limit)
  const ABSOLUTE_MAX_WAIT = 300000; // 5 minutes absolute max

  while (true) {
    const elapsed = Date.now() - startTime;

    // Check for updating or outdated snackbar (transition states)
    const updatingSnackbar = document.querySelector(TVSelectors.updatingReportSnackbar);
    const outdatedSnackbar = document.querySelector(TVSelectors.outdatedReportSnackbar);

    if (updatingSnackbar || outdatedSnackbar) {
      if (!sawTransitionState) {
        debugLog(
          'log',
          `[waitForSuccessSnackbar] 📋 Detected ${updatingSnackbar ? 'updating' : 'outdated'} state at ${elapsed}ms`,
        );
        sawTransitionState = true;
      }
      // Log updating state every 5 seconds (not too spammy)
      if (updatingSnackbar && elapsed - lastUpdateLogTime >= 5000) {
        debugLog(
          'log',
          `[waitForSuccessSnackbar] ⏳ Still updating... (${(elapsed / 1000).toFixed(1)}s) - waiting for completion`,
        );
        lastUpdateLogTime = elapsed;
      }
    }

    // Check for success snackbar - only accept if we've seen transition OR don't require it
    const successSnackbar = document.querySelector(TVSelectors.successReportSnackbar);
    if (successSnackbar) {
      if (!requireTransition || sawTransitionState) {
        debugLog(
          'log',
          `[waitForSuccessSnackbar] ✅ Success snackbar appeared after ${elapsed}ms (sawTransition=${sawTransitionState})`,
        );
        return 'success';
      } else {
        // Stale success from previous iteration - wait for it to clear
        if (elapsed - lastUpdateLogTime >= 1000) {
          debugLog(
            'log',
            `[waitForSuccessSnackbar] ⚠️ Ignoring stale success snackbar at ${elapsed}ms - waiting for transition state`,
          );
          lastUpdateLogTime = elapsed;
        }
      }
    }

    // Check if snackbar is empty - only accept if we've seen transition OR don't require it
    const snackbarLayer = document.querySelector(TVSelectors.snackbarLayer);
    const isEmpty = snackbarLayer?.classList.contains(TVSelectors.SNACKBAR_EMPTY_CLASS);
    if (isEmpty) {
      if (!requireTransition || sawTransitionState) {
        debugLog(
          'log',
          `[waitForSuccessSnackbar] ✅ Snackbar empty after ${elapsed}ms - update complete (sawTransition=${sawTransitionState})`,
        );
        return 'empty';
      } else {
        // Empty state but we haven't seen transition - might be initial state, keep waiting
        if (elapsed - lastUpdateLogTime >= 1000) {
          debugLog('log', `[waitForSuccessSnackbar] ⚠️ Snackbar empty but no transition seen yet at ${elapsed}ms`);
          lastUpdateLogTime = elapsed;
        }
      }
    }

    // Timeout logic:
    // - If we've seen the "updating" state, NEVER timeout (wait for completion)
    // - If we haven't seen transition yet, timeout after maxWaitMs
    // - Always have an absolute max as safety valve
    if (elapsed >= ABSOLUTE_MAX_WAIT) {
      debugLog(
        'log',
        `[waitForSuccessSnackbar] ⏱️ ABSOLUTE timeout after ${elapsed}ms (sawTransition=${sawTransitionState})`,
      );
      return 'timeout';
    }

    if (!sawTransitionState && elapsed >= maxWaitMs) {
      debugLog('log', `[waitForSuccessSnackbar] ⏱️ Timeout after ${maxWaitMs}ms - no transition state detected`);
      return 'timeout';
    }

    await new Promise(res => setTimeout(res, pollInterval));
  }
}

/**
 * For deep backtesting: Waits for the "Update report" button to appear in the DOM.
 * This button appears after clicking OK when TradingView detects a parameter change.
 *
 * @param maxWaitMs - Maximum time to wait for button (default: 10000ms)
 * @param pollInterval - How often to check (default: 100ms)
 */
async function waitForUpdateButton(maxWaitMs: number = 10000, pollInterval: number = 100): Promise<HTMLElement | null> {
  const startTime = Date.now();

  debugLog('log', `[waitForUpdateButton] 🔍 Waiting for Update Report button (max ${maxWaitMs}ms)`);

  while (Date.now() - startTime < maxWaitMs) {
    const elapsed = Date.now() - startTime;

    // Check for the Update Report button
    const button = document.querySelector(TVSelectors.updateReportButton) as HTMLElement;
    if (button) {
      debugLog('log', `[waitForUpdateButton] ✅ Update button appeared after ${elapsed}ms`);
      return button;
    }

    // Check for outdated snackbar (button should be inside it)
    const outdatedSnackbar = document.querySelector(TVSelectors.outdatedReportSnackbar);
    if (outdatedSnackbar && elapsed % 500 < pollInterval) {
      debugLog('log', `[waitForUpdateButton] 📋 Outdated snackbar visible (${elapsed}ms) - looking for button...`);
    }

    await new Promise(res => setTimeout(res, pollInterval));
  }

  debugLog('log', `[waitForUpdateButton] ⏱️ Timeout after ${maxWaitMs}ms - no button found`);
  return null;
}

/**
 * Handles the backtest update cycle after clicking OK on settings dialog.
 *
 * IMPORTANT BEHAVIOR:
 * - The timeout values only apply to waiting for TradingView to START processing
 * - Once we see the "updating" state, we wait INDEFINITELY until completion
 * - This ensures we never move to the next iteration while processing is ongoing
 *
 * For DEEP backtesting:
 * 1. Wait for "Update Report" button to appear (max 10s)
 * 2. Click the button
 * 3. Wait for success snackbar (once updating seen, wait until done)
 *
 * For NORMAL backtesting:
 * - TradingView auto-updates after OK click
 * - Wait for success snackbar (once updating seen, wait until done)
 *
 * @param isDeepBacktest - Whether this is deep backtesting mode
 * @returns Promise that resolves when update is complete
 */
export async function handleBacktestUpdate(isDeepBacktest: boolean): Promise<'success' | 'timeout'> {
  const timingConfig = JSON.parse(localStorage.getItem('automation-timing') || '{}');
  // Get timeout settings (in seconds) from localStorage - synced from chrome.storage by background script
  const timeoutSettings = JSON.parse(localStorage.getItem('timeout-settings') || '{}');
  const deepBacktestTimeoutMs = (timeoutSettings?.deepBacktestTimeoutSec ?? 30) * 1000;

  if (isDeepBacktest) {
    debugLog('log', '[handleBacktestUpdate] 🔬 Deep backtesting mode - will wait for full completion');

    // Step 1: Wait for the Update Report button to appear
    const maxButtonWait = timingConfig?.waitDeepBacktest ?? 10000;
    const button = await waitForUpdateButton(maxButtonWait);

    if (button) {
      // Step 2: Click the button
      debugLog('log', '[handleBacktestUpdate] 🖱️ Clicking Update Report button');
      button.click();

      // Brief delay after click
      await new Promise(res => setTimeout(res, 200));
    } else {
      debugLog('log', '[handleBacktestUpdate] ⚠️ No Update button found - checking if already updated');
      // Button might not appear if settings didn't actually change
      // Check if we're already in success/empty state
      const snackbarLayer = document.querySelector(TVSelectors.snackbarLayer);
      const isEmpty = snackbarLayer?.classList.contains(TVSelectors.SNACKBAR_EMPTY_CLASS);
      if (isEmpty) {
        debugLog('log', '[handleBacktestUpdate] ✅ Snackbar empty - no update needed');
        return 'success';
      }
    }

    // Step 3: Wait for success snackbar
    // Use configurable timeout (default 30s) for waiting for "updating" state to appear
    // Once updating is seen, we wait indefinitely until complete
    const maxInitialWait = deepBacktestTimeoutMs;
    debugLog(
      'log',
      `[handleBacktestUpdate] ⏳ Waiting for success (initial timeout: ${maxInitialWait}ms, then indefinite once updating seen)`,
    );
    const result = await waitForSuccessSnackbar(maxInitialWait);

    if (result === 'success' || result === 'empty') {
      debugLog('log', `[handleBacktestUpdate] ✅ Deep backtest update complete (${result})`);
      return 'success';
    } else {
      debugLog('log', '[handleBacktestUpdate] ⏱️ Timeout - no update state detected');
      return 'timeout';
    }
  } else {
    debugLog('log', '[handleBacktestUpdate] 📊 Normal backtesting mode - will wait for full completion');

    // For normal backtesting, TradingView auto-updates after OK click
    // 10s is just the max wait for "updating" state to appear
    // Once updating is seen, we wait indefinitely until complete
    const maxInitialWait = timingConfig?.waitReprocess ?? 10000;
    debugLog(
      'log',
      `[handleBacktestUpdate] ⏳ Waiting for success (initial timeout: ${maxInitialWait}ms, then indefinite once updating seen)`,
    );
    const result = await waitForSuccessSnackbar(maxInitialWait);

    if (result === 'success' || result === 'empty') {
      debugLog('log', `[handleBacktestUpdate] ✅ Normal backtest update complete (${result})`);
      return 'success';
    } else {
      debugLog('log', '[handleBacktestUpdate] ⏱️ Timeout - no update state detected');
      return 'timeout';
    }
  }
}

/**
 * @deprecated Use handleBacktestUpdate instead
 * Kept for backwards compatibility
 */
export async function clickUpdateReport(waitForButton: boolean = false): Promise<boolean> {
  const result = await handleBacktestUpdate(waitForButton);
  return result === 'success' || result === 'timeout'; // Always returns true for backwards compat
}
