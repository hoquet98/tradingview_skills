const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

// Selectors derived from actual TradingView DOM (updated March 2026)
const TVSelectors = {
  // Right sidebar alerts button
  ALERTS_BUTTON: 'button[data-name="alerts"]',
  // Tabs inside the alerts widget
  ALERTS_TAB: 'button[role="tab"]#list',
  LOG_TAB: 'button[role="tab"]#log',
  // Alert list items — no alert-item-name exists; description is the primary text
  ALERT_ITEM: '[class*="itemBody-"]',
  ALERT_DESCRIPTION: '[data-name="alert-item-description"]',
  ALERT_TICKER: '[data-name="alert-item-ticker"]',
  ALERT_STATUS: '[data-name="alert-item-status"]',
  // Alert action buttons (overlay on hover)
  ALERT_STOP: '[data-name="alert-stop-button"]',
  ALERT_RESTART: '[data-name="alert-restart-button"]',
  ALERT_EDIT: '[data-name="alert-edit-button"]',
  ALERT_DELETE: '[data-name="alert-delete-button"]',
};

/**
 * Open the alerts panel in the right sidebar.
 * If already open, this is a no-op.
 */
async function openAlertsPanel(page) {
  await page.waitForSelector(TVSelectors.ALERTS_BUTTON, { timeout: 10000 }).catch(() => {});
  const btn = await page.$(TVSelectors.ALERTS_BUTTON);
  if (!btn) return { success: false, message: 'Alerts button not found in toolbar' };

  // Check if panel is already open (aria-pressed="true")
  const pressed = await btn.getAttribute('aria-pressed');
  if (pressed !== 'true') {
    await btn.click();
    await page.waitForTimeout(500);
  }

  // Make sure we're on the Alerts tab (not Log)
  const alertsTab = await page.$(TVSelectors.ALERTS_TAB);
  if (alertsTab) {
    const selected = await alertsTab.getAttribute('aria-selected');
    if (selected !== 'true') {
      await alertsTab.click();
      await page.waitForTimeout(300);
    }
  }

  return { success: true };
}

/**
 * Extract a short name from the alert description.
 * Description format: "StrategyName (params...): order message..."
 * Returns the strategy name portion before the first parenthesis or colon.
 */
function extractAlertName(description) {
  if (!description) return '';
  // Take everything before the first '(' or ':'
  const match = description.match(/^([^(:]+)/);
  return match ? match[1].trim() : description.substring(0, 80).trim();
}

/**
 * List all alerts from the alerts panel.
 * Scrolls through the virtualized list to collect all items.
 */
async function listAlerts(page) {
  try {
    const openResult = await openAlertsPanel(page);
    if (!openResult.success) return openResult;

    await page.waitForTimeout(500);

    // Collect all alerts by scrolling through the virtualized list
    const collected = [];
    const seenKeys = new Set();
    let noNewCount = 0;

    for (let i = 0; i < 100; i++) {
      const visibleAlerts = await page.evaluate((sel) => {
        // Find all alert item containers
        const items = document.querySelectorAll(sel.ALERT_ITEM);
        return Array.from(items).map(item => {
          const description = item.querySelector(sel.ALERT_DESCRIPTION)?.textContent?.trim() || '';
          const ticker = item.querySelector(sel.ALERT_TICKER)?.textContent?.trim() || '';
          const statusEl = item.querySelector(sel.ALERT_STATUS);
          const status = statusEl?.textContent?.trim() || '';
          const isActive = statusEl?.classList?.toString()?.includes('active') || false;
          const hasStop = !!item.querySelector(sel.ALERT_STOP);
          const hasRestart = !!item.querySelector(sel.ALERT_RESTART);
          return { description, ticker, status, isActive, canPause: hasStop, canRestart: hasRestart };
        }).filter(a => a.description);
      }, TVSelectors);

      const prevSize = collected.length;
      for (const alert of visibleAlerts) {
        const key = `${alert.description}|${alert.ticker}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          collected.push({
            name: extractAlertName(alert.description),
            description: alert.description,
            ticker: alert.ticker,
            status: alert.status,
            isActive: alert.isActive,
            canPause: alert.canPause,
            canRestart: alert.canRestart,
          });
        }
      }

      if (collected.length === prevSize) {
        noNewCount++;
        if (noNewCount >= 3) break;
      } else {
        noNewCount = 0;
      }

      // Scroll down
      const scrolled = await page.evaluate(() => {
        const panel = document.querySelector('#id_alert-widget-tabs-slots_tabpanel_list');
        if (!panel) return false;
        const els = panel.querySelectorAll('*');
        for (const el of els) {
          if (el.scrollHeight > el.clientHeight + 10) {
            if (el.scrollTop + el.clientHeight >= el.scrollHeight) return false;
            el.scrollTop += 300;
            return true;
          }
        }
        return false;
      });

      if (!scrolled) break;
      await page.waitForTimeout(200);
    }

    return {
      success: true,
      alerts: collected,
      count: collected.length,
    };
  } catch (error) {
    return { success: false, message: 'Error listing alerts', error: error.message };
  }
}

/**
 * View details for a specific alert by name (partial match on name or description).
 */
async function viewAlert(page, alertName = null) {
  try {
    const result = await listAlerts(page);
    if (!result.success) return result;

    if (!alertName) {
      return {
        success: true,
        alert: result.alerts[0] || null,
        message: result.alerts[0] ? 'First alert retrieved' : 'No alerts found',
      };
    }

    const match = result.alerts.find(a =>
      a.name.toLowerCase().includes(alertName.toLowerCase()) ||
      a.description.toLowerCase().includes(alertName.toLowerCase())
    );

    if (!match) {
      return { success: false, message: `Alert "${alertName}" not found` };
    }

    return { success: true, alert: match, message: `Alert "${match.name}" found` };
  } catch (error) {
    return { success: false, message: 'Error viewing alert', error: error.message };
  }
}

/**
 * Edit an alert by name — opens the edit dialog.
 */
async function editAlert(page, alertName) {
  try {
    if (!alertName) return { success: false, message: 'Alert name required' };

    const openResult = await openAlertsPanel(page);
    if (!openResult.success) return openResult;

    await page.waitForTimeout(500);

    const found = await page.evaluate((sel, targetName) => {
      const items = document.querySelectorAll(sel.ALERT_ITEM);
      const target = targetName.toLowerCase();
      for (const item of items) {
        const desc = item.querySelector(sel.ALERT_DESCRIPTION)?.textContent?.trim() || '';
        if (desc.toLowerCase().includes(target)) {
          const editBtn = item.querySelector(sel.ALERT_EDIT);
          if (editBtn) {
            editBtn.click();
            return { found: true, name: desc.split('(')[0].trim() };
          }
          return { found: true, name: desc.split('(')[0].trim(), error: 'Edit button not found' };
        }
      }
      return { found: false };
    }, TVSelectors, alertName);

    if (!found.found) {
      return { success: false, message: `Alert "${alertName}" not found` };
    }
    if (found.error) {
      return { success: false, message: found.error };
    }

    await page.waitForTimeout(500);
    return { success: true, message: `Edit dialog opened for "${found.name}"` };
  } catch (error) {
    return { success: false, message: 'Error editing alert', error: error.message };
  }
}

/**
 * Delete an alert by name.
 */
async function deleteAlert(page, alertName = null) {
  try {
    const openResult = await openAlertsPanel(page);
    if (!openResult.success) return openResult;

    await page.waitForTimeout(500);

    const found = await page.evaluate((sel, targetName) => {
      const items = document.querySelectorAll(sel.ALERT_ITEM);
      const target = targetName ? targetName.toLowerCase() : null;
      for (const item of items) {
        const desc = item.querySelector(sel.ALERT_DESCRIPTION)?.textContent?.trim() || '';
        if (!target || desc.toLowerCase().includes(target)) {
          const deleteBtn = item.querySelector(sel.ALERT_DELETE);
          if (deleteBtn) {
            deleteBtn.click();
            return { found: true, name: desc.split('(')[0].trim() };
          }
          return { found: true, name: desc.split('(')[0].trim(), error: 'Delete button not found' };
        }
      }
      return { found: false };
    }, TVSelectors, alertName);

    if (!found.found) {
      return { success: false, message: alertName ? `Alert "${alertName}" not found` : 'No alerts found' };
    }
    if (found.error) {
      return { success: false, message: found.error };
    }

    // Wait for and click confirmation dialog
    await page.waitForTimeout(500);
    const confirmBtn = page.locator('button:has-text("Yes"), button:has-text("Delete"), button[name="submit"]').first();
    if (await confirmBtn.count()) {
      await confirmBtn.click();
      await page.waitForTimeout(500);
    }

    return { success: true, message: `Alert "${found.name}" deleted` };
  } catch (error) {
    return { success: false, message: 'Error deleting alert', error: error.message };
  }
}

/**
 * Find an alert item by name, hover to reveal overlay buttons, and click the target button.
 * Shared helper for pause/resume.
 */
async function findAndClickAlertButton(page, alertName, buttonSelector, buttonLabel) {
  try {
    const openResult = await openAlertsPanel(page);
    if (!openResult.success) return openResult;

    await page.waitForTimeout(500);

    const items = await page.$$(TVSelectors.ALERT_ITEM);
    let targetItem = null;
    let targetDesc = '';

    for (const item of items) {
      const descEl = await item.$(TVSelectors.ALERT_DESCRIPTION);
      const desc = descEl ? await descEl.textContent() : '';
      if (!alertName || desc.toLowerCase().includes(alertName.toLowerCase())) {
        targetItem = item;
        targetDesc = desc.trim();
        break;
      }
    }

    if (!targetItem) {
      return { success: false, message: alertName ? `Alert "${alertName}" not found` : 'No alerts found' };
    }

    // Hover to reveal overlay buttons
    await targetItem.hover();
    await page.waitForTimeout(300);

    const btn = await targetItem.$(buttonSelector);
    if (!btn) {
      return { success: false, message: `${buttonLabel} button not found for this alert` };
    }

    await btn.click();

    // Wait up to 5s for the state to change (pause/resume takes a few seconds)
    const expectedButton = buttonLabel === 'Pause' ? TVSelectors.ALERT_RESTART : TVSelectors.ALERT_STOP;
    const name = extractAlertName(targetDesc);
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(500);
      await targetItem.hover();
      await page.waitForTimeout(200);
      const confirmed = await targetItem.$(expectedButton);
      if (confirmed) {
        return { success: true, message: `Alert "${name}" ${buttonLabel.toLowerCase()}d`, name };
      }
    }

    return { success: true, message: `Alert "${name}" ${buttonLabel.toLowerCase()}d (unverified)`, name };
  } catch (error) {
    return { success: false, message: `Error ${buttonLabel.toLowerCase()}ing alert`, error: error.message };
  }
}

/**
 * Pause (stop) an active alert by name.
 * @param {object} page - Playwright page
 * @param {string} [alertName] - Partial match on alert description. If null, pauses first alert.
 */
async function pauseAlert(page, alertName = null) {
  return findAndClickAlertButton(page, alertName, TVSelectors.ALERT_STOP, 'Pause');
}

/**
 * Resume (restart) a paused alert by name.
 * @param {object} page - Playwright page
 * @param {string} [alertName] - Partial match on alert description. If null, resumes first alert.
 */
async function resumeAlert(page, alertName = null) {
  return findAndClickAlertButton(page, alertName, TVSelectors.ALERT_RESTART, 'Resume');
}

/**
 * Pause all active alerts.
 */
async function pauseAllAlerts(page) {
  try {
    const result = await listAlerts(page);
    if (!result.success) return result;

    const active = result.alerts.filter(a => a.canPause);
    if (active.length === 0) {
      return { success: true, message: 'No active alerts to pause', paused: [] };
    }

    const paused = [];
    for (const alert of active) {
      const r = await pauseAlert(page, alert.description.substring(0, 40));
      if (r.success) paused.push(r.name);
    }

    return { success: true, message: `Paused ${paused.length}/${active.length} alerts`, paused };
  } catch (error) {
    return { success: false, message: 'Error pausing all alerts', error: error.message };
  }
}

/**
 * Resume all paused alerts.
 */
async function resumeAllAlerts(page) {
  try {
    const result = await listAlerts(page);
    if (!result.success) return result;

    const stopped = result.alerts.filter(a => a.canRestart);
    if (stopped.length === 0) {
      return { success: true, message: 'No paused alerts to resume', resumed: [] };
    }

    const resumed = [];
    for (const alert of stopped) {
      const r = await resumeAlert(page, alert.description.substring(0, 40));
      if (r.success) resumed.push(r.name);
    }

    return { success: true, message: `Resumed ${resumed.length}/${stopped.length} alerts`, resumed };
  } catch (error) {
    return { success: false, message: 'Error resuming all alerts', error: error.message };
  }
}

/**
 * Get full alert settings by opening the edit dialog.
 * Hovers on the alert item to reveal overlay buttons, clicks edit,
 * reads the settings dialog, then closes it without saving.
 *
 * @param {object} page - Playwright page
 * @param {string} [alertName] - Partial match on alert description. If null, opens first alert.
 * @returns {Promise<{success:boolean, settings?:Object}>}
 */
async function getAlertSettings(page, alertName = null) {
  try {
    const openResult = await openAlertsPanel(page);
    if (!openResult.success) return openResult;

    await page.waitForTimeout(500);

    // Find the target alert item and hover to reveal overlay buttons
    const items = await page.$$(TVSelectors.ALERT_ITEM);
    let targetItem = null;
    let targetDesc = '';

    for (const item of items) {
      const descEl = await item.$(TVSelectors.ALERT_DESCRIPTION);
      const desc = descEl ? await descEl.textContent() : '';
      if (!alertName || desc.toLowerCase().includes(alertName.toLowerCase())) {
        targetItem = item;
        targetDesc = desc.trim();
        break;
      }
    }

    if (!targetItem) {
      return { success: false, message: alertName ? `Alert "${alertName}" not found` : 'No alerts found' };
    }

    // Hover to reveal overlay buttons
    await targetItem.hover();
    await page.waitForTimeout(300);

    // Click the edit button
    const editBtn = await targetItem.$('[data-name="alert-edit-button"]');
    if (!editBtn) {
      return { success: false, message: 'Edit button not found after hover' };
    }
    await editBtn.click();

    // Wait for the edit dialog to appear
    await page.waitForSelector('[data-qa-id="alerts-create-edit-dialog"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Read all settings from the dialog
    const settings = await page.evaluate(() => {
      const dialog = document.querySelector('[data-qa-id="alerts-create-edit-dialog"]');
      if (!dialog) return null;

      // Symbol
      const symbolEl = dialog.querySelector('[class*="symbolName-"]');
      const symbol = symbolEl?.textContent?.trim() || '';

      // Strategy/condition — the item-title label
      const conditionEl = dialog.querySelector('[data-qa-id="item-title"] [class*="label-"]');
      const condition = conditionEl?.textContent?.trim() || '';

      // Operator (e.g. "Order fills only")
      const operatorBtn = dialog.querySelector('[data-qa-id="operator-dropdown"]');
      const operator = operatorBtn?.textContent?.replace(/[▼▾]/g, '')?.trim() || '';

      // Interval (e.g. "1m")
      const intervalBtn = dialog.querySelector('[data-qa-id="resolution-dropdown"]');
      const interval = intervalBtn?.textContent?.replace(/[▼▾]/g, '')?.trim() || '';

      // Expiration
      const expirationBtn = dialog.querySelector('[data-qa-id="expiration-time-dropdown-button"]');
      const expiration = expirationBtn?.textContent?.trim() || '';

      // Message (webhook payload template)
      const messageBtn = dialog.querySelector('[data-qa-id="alert-message-button"]');
      const message = messageBtn?.textContent?.trim() || '';

      // Notifications
      const notificationsBtn = dialog.querySelector('[data-qa-id="alert-notifications-button"]');
      const notifications = notificationsBtn?.textContent?.trim() || '';

      return { symbol, condition, operator, interval, expiration, message, notifications };
    });

    // Close the dialog without saving
    const closeBtn = await page.$('[data-qa-id="alerts-create-edit-dialog"] [data-qa-id="close"]');
    if (closeBtn) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    } else {
      // Fallback: press Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    if (!settings) {
      return { success: false, message: 'Could not read alert settings dialog' };
    }

    // Extract the strategy name from the condition
    const name = extractAlertName(settings.condition);

    return {
      success: true,
      message: `Alert settings for "${name}"`,
      settings: {
        name,
        ...settings,
      },
    };
  } catch (error) {
    // Try to close any open dialog
    try {
      const closeBtn = await page.$('[data-qa-id="alerts-create-edit-dialog"] [data-qa-id="close"]');
      if (closeBtn) await closeBtn.click();
    } catch (_) {}
    return { success: false, message: 'Error getting alert settings', error: error.message };
  }
}

async function main() {
  const action = process.argv[2] || 'list';
  const param = process.argv[3];
  const { browser, page } = await launchBrowser();

  try {
    await openChart(page);

    let result;
    switch (action) {
      case 'view': result = await viewAlert(page, param); break;
      case 'list': result = await listAlerts(page); break;
      case 'settings': result = await getAlertSettings(page, param); break;
      case 'edit': result = await editAlert(page, param); break;
      case 'delete': result = await deleteAlert(page, param); break;
      case 'pause': result = await pauseAlert(page, param); break;
      case 'resume': result = await resumeAlert(page, param); break;
      case 'pause-all': result = await pauseAllAlerts(page); break;
      case 'resume-all': result = await resumeAllAlerts(page); break;
      default: result = { success: false, message: 'Usage: list|view|settings|edit|delete|pause|resume|pause-all|resume-all [alertName]' };
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { viewAlert, listAlerts, getAlertSettings, editAlert, deleteAlert, pauseAlert, resumeAlert, pauseAllAlerts, resumeAllAlerts, openAlertsPanel, TVSelectors };
if (require.main === module) main();
