const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

// Selectors derived from actual TradingView DOM
const TVSelectors = {
  // Right sidebar alerts button
  ALERTS_BUTTON: 'button[data-name="alerts"]',
  // Tabs inside the alerts widget
  ALERTS_TAB: 'button[role="tab"]#list',
  LOG_TAB: 'button[role="tab"]#log',
  // Alert list items — select by the data-name children, traverse up to parent
  ALERT_NAME: '[data-name="alert-item-name"]',
  ALERT_DESCRIPTION: '[data-name="alert-item-description"]',
  ALERT_TICKER: '[data-name="alert-item-ticker"]',
  ALERT_STATUS: '[data-name="alert-item-status"]',
  ALERT_TIME: '[data-name="alert-item-time"]',
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
 * List all alerts from the alerts panel.
 * Scrolls through the virtualized list to collect all items.
 * Finds items via stable [data-name] selectors and traverses up to parent containers.
 */
async function listAlerts(page) {
  try {
    const openResult = await openAlertsPanel(page);
    if (!openResult.success) return openResult;

    await page.waitForTimeout(500);

    // Collect all alerts by scrolling through the virtualized list
    const collected = [];
    const seenNames = new Set();
    let noNewCount = 0;

    for (let i = 0; i < 100; i++) {
      const visibleAlerts = await page.evaluate((sel) => {
        // Find all alert-item-name elements and traverse up to the item container
        const nameEls = document.querySelectorAll(sel.ALERT_NAME);
        return Array.from(nameEls).map(nameEl => {
          // The item container is the closest ancestor with position:absolute (virtualized row)
          const item = nameEl.closest('[class*="itemBody"]') || nameEl.parentElement?.parentElement;
          if (!item) return null;
          const name = nameEl.textContent?.trim() || '';
          const description = item.querySelector(sel.ALERT_DESCRIPTION)?.textContent?.trim() || '';
          const ticker = item.querySelector(sel.ALERT_TICKER)?.textContent?.trim() || '';
          const status = item.querySelector(sel.ALERT_STATUS)?.textContent?.trim() || '';
          const time = item.querySelector(sel.ALERT_TIME)?.textContent?.trim() || '';
          const isActive = item.querySelector(sel.ALERT_STATUS)?.classList?.toString()?.includes('active') || false;
          const hasStop = !!item.querySelector(sel.ALERT_STOP);
          const hasRestart = !!item.querySelector(sel.ALERT_RESTART);
          return { name, description, ticker, status, time, isActive, canPause: hasStop, canRestart: hasRestart };
        }).filter(a => a && a.name);
      }, TVSelectors);

      const prevSize = collected.length;
      for (const alert of visibleAlerts) {
        const key = `${alert.name}|${alert.time}`;
        if (!seenNames.has(key)) {
          seenNames.add(key);
          collected.push(alert);
        }
      }

      if (collected.length === prevSize) {
        noNewCount++;
        if (noNewCount >= 3) break;
      } else {
        noNewCount = 0;
      }

      // Scroll down — find the scrollable container dynamically
      const scrolled = await page.evaluate(() => {
        // Look for the alerts list scrollable container within the alerts panel
        const panel = document.querySelector('#id_alert-widget-tabs-slots_tabpanel_list')
          || document.querySelector('[data-name="alerts"]')?.closest('[class*="widget"]');
        if (!panel) {
          // Fallback: find any scrollable element containing alert items
          const nameEl = document.querySelector('[data-name="alert-item-name"]');
          if (!nameEl) return false;
          let el = nameEl.parentElement;
          while (el) {
            if (el.scrollHeight > el.clientHeight + 10) {
              el.scrollTop += 300;
              return true;
            }
            el = el.parentElement;
          }
          return false;
        }
        // Find the scrollable child within the panel
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
 * View details for a specific alert by name (partial match).
 */
async function viewAlert(page, alertName = null) {
  try {
    const result = await listAlerts(page);
    if (!result.success) return result;

    if (!alertName) {
      // Return the first alert
      return {
        success: true,
        alert: result.alerts[0] || null,
        message: result.alerts[0] ? 'First alert retrieved' : 'No alerts found',
      };
    }

    const match = result.alerts.find(a =>
      a.name.toLowerCase().includes(alertName.toLowerCase())
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

    // Find the alert item by name and click its edit button
    const found = await page.evaluate((sel, targetName) => {
      const nameEls = document.querySelectorAll(sel.ALERT_NAME);
      for (const nameEl of nameEls) {
        const name = nameEl.textContent?.trim() || '';
        if (name.toLowerCase().includes(targetName.toLowerCase())) {
          const item = nameEl.closest('[class*="itemBody"]') || nameEl.parentElement?.parentElement;
          if (!item) return { found: true, name, error: 'Could not find item container' };
          // Hover to reveal overlay buttons, then click edit
          const editBtn = item.querySelector(sel.ALERT_EDIT);
          if (editBtn) {
            editBtn.click();
            return { found: true, name };
          }
          return { found: true, name, error: 'Edit button not found — try hovering over the alert first' };
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
      const nameEls = document.querySelectorAll(sel.ALERT_NAME);
      for (const nameEl of nameEls) {
        const name = nameEl.textContent?.trim() || '';
        if (!targetName || name.toLowerCase().includes(targetName.toLowerCase())) {
          const item = nameEl.closest('[class*="itemBody"]') || nameEl.parentElement?.parentElement;
          if (!item) return { found: true, name, error: 'Could not find item container' };
          const deleteBtn = item.querySelector(sel.ALERT_DELETE);
          if (deleteBtn) {
            deleteBtn.click();
            return { found: true, name };
          }
          return { found: true, name, error: 'Delete button not found — try hovering over the alert first' };
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

async function main() {
  const action = process.argv[2] || 'list';
  const param = process.argv[3];
  const { browser, page } = await launchBrowser({ headless: false });

  try {
    await openChart(page);

    let result;
    switch (action) {
      case 'view': result = await viewAlert(page, param); break;
      case 'list': result = await listAlerts(page); break;
      case 'edit': result = await editAlert(page, param); break;
      case 'delete': result = await deleteAlert(page, param); break;
      default: result = { success: false, message: 'Usage: list|view|edit|delete [alertName]' };
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { viewAlert, listAlerts, editAlert, deleteAlert, openAlertsPanel, TVSelectors };
if (require.main === module) main();
