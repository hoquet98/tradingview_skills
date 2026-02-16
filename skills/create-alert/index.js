const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

async function createAlert(page, options = {}) {
  const { symbol = 'NASDAQ:AAPL', condition = 'Crosses above', price = 200, action = 'Webhook URL', webhookUrl = '' } = options;

  try {
    // Open alerts panel
    const alertBtn = await page.$('button[aria-label*="Alert"], button[data-name="alerts"]');
    if (alertBtn) {
      await alertBtn.click();
      await page.waitForTimeout(500);
    }

    // Look for create alert button
    let createBtn = await page.$('[data-qa-id="create-alert"]');
    if (!createBtn) {
      const createLocator = await page.locator('button:has-text("Create Alert")').first();
      if (await createLocator.count()) {
        createBtn = await createLocator.elementHandle();
      } else {
        const buttons = await page.$$('button');
        for (const btn of buttons) {
          const text = await btn.textContent();
          if (text?.toLowerCase().includes('create') && text?.toLowerCase().includes('alert')) {
            createBtn = btn;
            break;
          }
        }
      }
    }

    if (createBtn) {
      await createBtn.click();
      await page.waitForTimeout(500);
    }

    // Set symbol
    const symbolInput = await page.$('input[data-qa*="symbol"], input[placeholder*="symbol"]');
    if (symbolInput) {
      await symbolInput.click({ clickCount: 3 });
      await symbolInput.fill(symbol);
      await page.waitForSelector('[role="option"]', { timeout: 3000 }).catch(() => {});
    }

    // Select first result
    const symbolResult = await page.$('[role="option"]:first-child');
    if (symbolResult) {
      await symbolResult.click();
      await page.waitForTimeout(300);
    }

    // Set condition
    const conditionBtn = await page.$('[data-qa*="condition"], [data-qa*="condition-dropdown"]');
    if (conditionBtn) {
      await conditionBtn.click();
      await page.waitForTimeout(300);

      const conditionLocator = await page.locator(`text="${condition}"`).first();
      if (await conditionLocator.count()) await conditionLocator.click();
    }

    // Set price
    const priceInput = await page.$('input[type="number"], input[placeholder*="price"]');
    if (priceInput) {
      await priceInput.fill(String(price));
    }

    // Set webhook action
    if (action === 'Webhook URL' && webhookUrl) {
      const webhookLocator = await page.locator('button:has-text("Webhook URL")').first();
      if (await webhookLocator.count()) await webhookLocator.click();

      const webhookInput = await page.$('input[type="url"], input[placeholder*="URL"]');
      if (webhookInput) await webhookInput.fill(webhookUrl);
    }

    // Confirm creation
    const confirmLocator = await page.locator('button:has-text("Create"), button[type="submit"]').first();
    if (await confirmLocator.count()) {
      await confirmLocator.click();
      await page.waitForTimeout(1000);
    }

    return {
      success: true,
      message: `Alert created for ${symbol}`,
      alert: { symbol, condition, price, action, webhookUrl },
    };
  } catch (error) {
    return { success: false, message: 'Error creating alert', error: error.message };
  }
}

async function main() {
  const options = process.argv[2] ? JSON.parse(process.argv[2]) : {};
  const { browser, page } = await launchBrowser({ headless: false });

  try {
    await openChart(page);
    const result = await createAlert(page, options);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { createAlert };
if (require.main === module) main();
