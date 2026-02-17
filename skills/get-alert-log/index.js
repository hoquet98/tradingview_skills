const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');
const { openAlertsPanel, TVSelectors } = require('../view-alert');

/**
 * Get alert firing logs from TradingView's alerts Log tab.
 *
 * The log tab shows fired alert entries grouped by date headers (e.g., "February 16").
 * Each entry has: alert name, message (webhook payload), ticker, and time.
 *
 * @param {object} page - Playwright page
 * @param {number} [days=1] - Number of days to include (1 = today only, 2 = today + yesterday, etc.)
 * @returns {Promise<{success:boolean, logs:Array, count:number, days:number}>}
 *
 * Usage:
 *   node skills/get-alert-log 1        # today's logs
 *   node skills/get-alert-log 7        # last 7 days
 *   node skills/get-alert-log 30       # last 30 days
 */
async function getAlertLog(page, days = 1) {
  try {
    // Open the alerts panel
    const openResult = await openAlertsPanel(page);
    if (!openResult.success) return openResult;

    // Switch to the Log tab
    const logTab = await page.$(TVSelectors.LOG_TAB);
    if (!logTab) {
      return { success: false, message: 'Log tab not found in alerts panel' };
    }

    const selected = await logTab.getAttribute('aria-selected');
    if (selected !== 'true') {
      await logTab.click();
      await page.waitForTimeout(800);
    }

    // Calculate the cutoff date
    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - days);
    cutoffDate.setHours(0, 0, 0, 0);

    // Scroll and collect all log entries
    // Log entries use: [data-name="alert-log-item"]
    // Date headers use: .label-cU4vU9Kj (e.g., "February 16", "February 13")
    // Scroll container: .scrollContainer-RT_yiIRf
    const collected = [];
    const seenKeys = new Set();
    let noNewCount = 0;
    let pastCutoff = false;

    for (let i = 0; i < 200; i++) {
      if (pastCutoff) break;

      const batch = await page.evaluate(() => {
        const LOG_ITEM = '[data-name="alert-log-item"]';
        const DATE_LABEL = '[class*="label-cU4vU9Kj"], [class*="label-Z31nwDQw"]';

        // Build a map of date labels and their positions to associate entries with dates
        const labels = document.querySelectorAll(DATE_LABEL);
        const dateBoundaries = Array.from(labels).map(el => ({
          text: el.textContent?.trim() || '',
          top: el.getBoundingClientRect().top,
        }));

        const items = document.querySelectorAll(LOG_ITEM);
        return Array.from(items).map(item => {
          const name = item.querySelector('[class*="name-"]')?.textContent?.trim() || '';
          const message = item.querySelector('[class*="message-"]')?.textContent?.trim() || '';
          const attrs = item.querySelectorAll('[class*="attribute-"]');
          const ticker = attrs[0]?.textContent?.trim() || '';
          const time = attrs[1]?.textContent?.trim() || '';
          const itemTop = item.getBoundingClientRect().top;

          // Find the closest date label above this item
          let dateLabel = '';
          for (let j = dateBoundaries.length - 1; j >= 0; j--) {
            if (dateBoundaries[j].top <= itemTop) {
              dateLabel = dateBoundaries[j].text;
              break;
            }
          }

          return { name, message, ticker, time, dateLabel };
        }).filter(entry => entry.name);
      });

      const prevSize = collected.length;
      for (const entry of batch) {
        const key = `${entry.name}|${entry.dateLabel}|${entry.time}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        // Parse the date to check against cutoff
        const entryDate = parseDateLabel(entry.dateLabel, entry.time);
        if (entryDate && entryDate < cutoffDate) {
          pastCutoff = true;
          break;
        }

        collected.push({
          name: entry.name,
          message: entry.message,
          ticker: entry.ticker,
          time: entry.time,
          date: entry.dateLabel,
          triggeredAt: entryDate ? entryDate.toISOString() : null,
        });
      }

      if (collected.length === prevSize && !pastCutoff) {
        noNewCount++;
        if (noNewCount >= 3) break;
      } else {
        noNewCount = 0;
      }

      if (pastCutoff) break;

      // Scroll down in the log container
      const scrolled = await page.evaluate(() => {
        // The log scrollable container
        const container = document.querySelector('[class*="scrollContainer-RT_yiIRf"]')
          || document.querySelector('#id_alert-widget-tabs-slots_tabpanel_log [class*="scrollContainer"]');
        if (!container) {
          // Fallback: find any scrollable element in the log panel
          const panel = document.querySelector('#id_alert-widget-tabs-slots_tabpanel_log');
          if (panel) {
            const els = panel.querySelectorAll('*');
            for (const el of els) {
              if (el.scrollHeight > el.clientHeight + 10) {
                el.scrollTop += 400;
                return true;
              }
            }
          }
          return false;
        }
        if (container.scrollTop + container.clientHeight >= container.scrollHeight) return false;
        container.scrollTop += 400;
        return true;
      });

      if (!scrolled) break;
      await page.waitForTimeout(200);
    }

    // Switch back to Alerts tab
    const alertsTab = await page.$(TVSelectors.ALERTS_TAB);
    if (alertsTab) {
      await alertsTab.click();
      await page.waitForTimeout(200);
    }

    return {
      success: true,
      logs: collected,
      count: collected.length,
      days,
    };
  } catch (error) {
    return { success: false, message: 'Error getting alert log', error: error.message };
  }
}

/**
 * Parse a date label like "February 16" + time "05:52:01 AM" into a Date object.
 * The year is inferred from the current date (if the parsed date is in the future, subtract a year).
 */
function parseDateLabel(dateLabel, timeStr) {
  if (!dateLabel) return null;

  try {
    const currentYear = new Date().getFullYear();
    // dateLabel is like "February 16" or "January 3"
    const fullStr = `${dateLabel} ${currentYear} ${timeStr || '12:00:00 AM'}`;
    const parsed = new Date(fullStr);

    if (isNaN(parsed.getTime())) return null;

    // If parsed date is in the future, it's probably from last year
    if (parsed > new Date()) {
      parsed.setFullYear(currentYear - 1);
    }

    return parsed;
  } catch {
    return null;
  }
}

async function main() {
  const days = parseInt(process.argv[2]) || 1;
  const { browser, page } = await launchBrowser({ headless: false });

  try {
    await openChart(page);
    const result = await getAlertLog(page, days);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Error', error: error.message }, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { getAlertLog };
if (require.main === module) main();
