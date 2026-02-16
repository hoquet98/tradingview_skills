/**
 * tv_detection.ts
 *
 * Detects which version of TradingView UI is currently active.
 * TradingView is doing a gradual rollout of a new UI that consolidates tabs.
 *
 * Legacy UI (5 tabs): Overview, Performance, Trade Analysis, Risk Ratios, List of Trades
 * New UI (2 tabs): Strategy Report (consolidated), List of Trades
 */

export type UIVersion = 'legacy' | 'new' | 'unknown';

/**
 * Detects the current TradingView UI version by checking for tab elements
 * @returns 'legacy', 'new', or 'unknown'
 */
export function detectUIVersion(): UIVersion {
  // Check for new UI tab selector (unique to new UI)
  const hasNewStrategyReportTab = !!document.querySelector('button#Strategy\\ report');

  // Check for legacy UI tab selectors (unique to old UI)
  const hasOldOverviewTab = !!document.querySelector('button#Overview');
  const hasOldPerformanceTab = !!document.querySelector('button#Performance');

  if (hasNewStrategyReportTab) {
    return 'new';
  } else if (hasOldOverviewTab && hasOldPerformanceTab) {
    return 'legacy';
  }

  return 'unknown';
}
