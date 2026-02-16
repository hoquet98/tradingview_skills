const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

const TVSelectors = {
  ALERTS_BUTTON: 'button[aria-label*="Alert"], button[data-name="alerts"]',
  ALERT_ITEM: '[class*="alertItem"], [data-qa-id*="alert"]',
  ALERT_SYMBOL: '[class*="alertSymbol"], [data-qa-id*="symbol"]',
  ALERT_CONDITION: '[class*="alertCondition"], [data-qa-id*="condition"]',
  ALERT_PRICE: '[class*="alertPrice"], [data-qa-id*="price"]',
  ALERT_STATUS: '[class*="alertStatus"], [data-qa-id*="status"]',
  ALERT_ENABLE_TOGGLE: '[role="switch"], [aria-checked]',
};

async function viewAlert(page, alertId = null) {
  try {
    const alertsBtn = await page.$(TVSelectors.ALERTS_BUTTON);
    if (alertsBtn) {
      await alertsBtn.click();
      await page.waitForTimeout(500);
    }

    let targetAlert = null;
    if (alertId) {
      targetAlert = await page.$(`[data-id="${alertId}"], [data-qa-id*="${alertId}"]`);
    } else {
      targetAlert = await page.$(TVSelectors.ALERT_ITEM);
    }

    if (!targetAlert) {
      return { success: false, message: alertId ? `Alert "${alertId}" not found` : 'No alerts found' };
    }

    const alertDetails = await page.evaluate((selectors) => {
      const alert = document.querySelector(selectors.ALERT_ITEM);
      if (!alert) return null;

      return {
        id: alert.getAttribute('data-id') || alert.getAttribute('id'),
        symbol: alert.querySelector(selectors.ALERT_SYMBOL)?.textContent?.trim(),
        condition: alert.querySelector(selectors.ALERT_CONDITION)?.textContent?.trim(),
        price: alert.querySelector(selectors.ALERT_PRICE)?.textContent?.trim(),
        status: alert.querySelector(selectors.ALERT_STATUS)?.textContent?.trim(),
        fullText: alert.textContent?.trim().substring(0, 200),
        isEnabled: alert.querySelector(selectors.ALERT_ENABLE_TOGGLE)?.getAttribute('aria-checked') === 'true',
      };
    }, TVSelectors);

    return { success: true, message: 'Alert details retrieved', alert: alertDetails };
  } catch (error) {
    return { success: false, message: 'Error viewing alert', error: error.message };
  }
}

async function listAlerts(page) {
  try {
    const alertsBtn = await page.$(TVSelectors.ALERTS_BUTTON);
    if (alertsBtn) {
      await alertsBtn.click();
      await page.waitForTimeout(500);
    }

    const alerts = await page.evaluate((selectors) => {
      const items = document.querySelectorAll(selectors.ALERT_ITEM);
      return Array.from(items).map((alert, idx) => ({
        id: alert.getAttribute('data-id') || `alert-${idx}`,
        symbol: alert.querySelector(selectors.ALERT_SYMBOL)?.textContent?.trim(),
        condition: alert.querySelector(selectors.ALERT_CONDITION)?.textContent?.trim(),
        price: alert.querySelector(selectors.ALERT_PRICE)?.textContent?.trim(),
        status: alert.querySelector(selectors.ALERT_STATUS)?.textContent?.trim(),
        enabled: alert.querySelector(selectors.ALERT_ENABLE_TOGGLE)?.getAttribute('aria-checked') === 'true',
      }));
    }, TVSelectors);

    return { success: true, message: `${alerts.length} alerts found`, alerts, count: alerts.length };
  } catch (error) {
    return { success: false, message: 'Error listing alerts', error: error.message };
  }
}

async function editAlert(page, alertId, options = {}) {
  try {
    const alertsBtn = await page.$(TVSelectors.ALERTS_BUTTON);
    if (alertsBtn) {
      await alertsBtn.click();
      await page.waitForTimeout(500);
    }

    const alertItem = await page.$(`[data-id="${alertId}"], [data-qa-id*="${alertId}"]`);
    if (alertItem) {
      const editBtn = await alertItem.$('[data-action="edit"], button[aria-label*="Edit"]');
      if (editBtn) {
        await editBtn.click();
        await page.waitForTimeout(500);
      }
    }

    return { success: true, message: `Alert ${alertId} editing initiated` };
  } catch (error) {
    return { success: false, message: 'Error editing alert', error: error.message };
  }
}

async function deleteAlert(page, alertId = null) {
  try {
    const alertsBtn = await page.$(TVSelectors.ALERTS_BUTTON);
    if (alertsBtn) {
      await alertsBtn.click();
      await page.waitForTimeout(500);
    }

    const alertItem = alertId
      ? await page.$(`[data-id="${alertId}"]`)
      : await page.$('[class*="alertItem"]:first-child');

    if (alertItem) {
      const deleteBtn = await alertItem.$('[data-action="delete"], button[aria-label*="Delete"]');
      if (deleteBtn) {
        await deleteBtn.click();
        await page.waitForTimeout(500);

        const confirmBtn = await page.locator('button:has-text("Delete"), button[type="submit"]').first();
        if (await confirmBtn.count()) await confirmBtn.click();
      }
    }

    return { success: true, message: 'Alert deleted' };
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
      default: result = { success: false, message: 'Usage: list|view|edit|delete [alertId]' };
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { viewAlert, listAlerts, editAlert, deleteAlert, TVSelectors };
if (require.main === module) main();
