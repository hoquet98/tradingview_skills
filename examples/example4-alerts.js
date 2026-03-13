/**
 * Example 4: List alerts and get alert logs
 * Uses Playwright — browser automation.
 */
const { launchBrowser, openChart, closeBrowser } = require('../lib/browser');
const { listAlerts, getAlertSettings } = require('../skills/view-alert');
const { getAlertLog } = require('../skills/get-alert-log');

(async () => {
  const { browser, page } = await launchBrowser();

  try {
    await openChart(page);

    // 1. List all alerts
    console.log('=== ALERTS ===\n');
    const alerts = await listAlerts(page);

    if (!alerts.success) {
      console.log('Failed to get alerts:', alerts.message, alerts.error || '');
    } else {
      console.log(`Found ${alerts.count} alert(s):\n`);
      for (const a of alerts.alerts) {
        console.log(`  ${a.name}`);
        console.log(`    Ticker: ${a.ticker} | Status: ${a.status} | Time: ${a.time}`);
        if (a.description) console.log(`    Desc: ${a.description}`);
        console.log();
      }
    }

    // 2. Get settings for each alert
    console.log('=== ALERT SETTINGS ===\n');
    if (alerts.success && alerts.count > 0) {
      for (const a of alerts.alerts) {
        const settings = await getAlertSettings(page, a.name);
        if (settings.success) {
          const s = settings.settings;
          console.log(`  ${s.name}`);
          console.log(`    Symbol:        ${s.symbol}`);
          console.log(`    Interval:      ${s.interval}`);
          console.log(`    Operator:      ${s.operator}`);
          console.log(`    Expiration:    ${s.expiration}`);
          console.log(`    Notifications: ${s.notifications}`);
          console.log(`    Condition:     ${s.condition.substring(0, 80)}...`);
          console.log();
        } else {
          console.log(`  Failed for "${a.name}": ${settings.message}`);
        }
      }
    }

    // 3. Get alert log (last 7 days)
    console.log('=== ALERT LOG (last 7 days) ===\n');
    const log = await getAlertLog(page, 7);

    if (!log.success) {
      console.log('Failed to get alert log:', log.message, log.error || '');
    } else {
      console.log(`Found ${log.count} log entries:\n`);
      for (const entry of log.logs.slice(0, 20)) {
        console.log(`  [${entry.date} ${entry.time}] ${entry.name}`);
        console.log(`    Ticker: ${entry.ticker}`);
        if (entry.message) console.log(`    Message: ${entry.message.substring(0, 100)}`);
        console.log();
      }
      if (log.count > 20) {
        console.log(`  ... and ${log.count - 20} more entries`);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await closeBrowser(browser);
  }
})();
