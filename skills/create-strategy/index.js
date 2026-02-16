const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

async function createStrategy(page, options = {}) {
  const {
    name = 'My Strategy',
    source = null,
  } = options;

  try {
    // Open Pine Editor
    let editorBtn = await page.$('button[aria-label*="Pine Editor"], button[data-name="pine-editor"]');
    if (!editorBtn) {
      editorBtn = await page.locator('button:has-text("Pine Editor")').first();
      if (await editorBtn.count()) {
        await editorBtn.click();
      } else {
        return { success: false, message: 'Pine Editor button not found' };
      }
    } else {
      await editorBtn.click();
    }
    await page.waitForTimeout(1000);

    // Click "New" to create a new script
    const newBtn = await page.locator('button:has-text("New")').first();
    if (await newBtn.count()) {
      await newBtn.click();
      await page.waitForTimeout(500);
    }

    // Enter strategy name if name input exists
    const nameInput = await page.$('input[placeholder*="name"], input[placeholder*="Name"]');
    if (nameInput) {
      await nameInput.click({ clickCount: 3 });
      await nameInput.fill(name);
    }

    // If source code provided, paste it into the editor
    if (source) {
      const editor = await page.$('[class*="editor"], textarea, [role="textbox"], [contenteditable]');
      if (editor) {
        await editor.click();
        // Select all and replace
        await page.keyboard.press('Control+A');
        await page.keyboard.type(source, { delay: 5 });
      }
    }

    // Click "Add to Chart"
    const addBtn = await page.$('[data-qa-id="add-to-chart"]');
    if (!addBtn) {
      const addBtnLocator = await page.locator('button:has-text("Add to Chart")').first();
      if (await addBtnLocator.count()) {
        await addBtnLocator.click();
      }
    } else {
      await addBtn.click();
    }
    await page.waitForTimeout(2000);

    return { success: true, message: `Strategy "${name}" created`, strategyName: name };
  } catch (error) {
    return { success: false, message: 'Error creating strategy', error: error.message };
  }
}

async function main() {
  const name = process.argv[2] || 'My Strategy';
  const sourceFile = process.argv[3];
  let source = null;
  if (sourceFile) {
    const fs = require('fs');
    source = fs.readFileSync(sourceFile, 'utf-8');
  }

  const { browser, page } = await launchBrowser({ headless: false });

  try {
    await openChart(page);
    const result = await createStrategy(page, { name, source });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { createStrategy };
if (require.main === module) main();
