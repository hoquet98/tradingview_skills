const { launchBrowser, openChart, closeBrowser } = require('../../lib/browser');

async function getDrawingList(page) {
  try {
    const drawings = await page.evaluate(() => {
      const shapes = document.querySelectorAll('[class*="drawing"], [class*="shape"]');
      return Array.from(shapes).map((shape, idx) => ({
        id: idx,
        type: shape.tagName,
        className: shape.className,
      }));
    });

    return { success: true, drawings, count: drawings.length };
  } catch (error) {
    return { success: false, message: 'Error getting drawings', error: error.message };
  }
}

async function addDrawing(page, drawingType = 'Trend Line') {
  try {
    const drawingsBtn = await page.$('button[aria-label*="Drawing"], button[data-name="drawing-tools"]');
    if (drawingsBtn) {
      await drawingsBtn.click();
      await page.waitForTimeout(500);
    }

    const drawingOption = await page.locator(`button:has-text("${drawingType}")`).first();
    if (await drawingOption.count()) {
      await drawingOption.click();
      await page.waitForTimeout(500);
    }

    return { success: true, message: `Drawing tool "${drawingType}" activated` };
  } catch (error) {
    return { success: false, message: 'Error adding drawing', error: error.message };
  }
}

async function removeDrawing(page, drawingId = null) {
  try {
    const drawing = await page.$('[class*="drawing"], [class*="shape"]');
    if (drawing) {
      await drawing.click();
      await page.keyboard.press('Delete');
      await page.waitForTimeout(500);
    }

    return { success: true, message: 'Drawing removed' };
  } catch (error) {
    return { success: false, message: 'Error removing drawing', error: error.message };
  }
}

async function setDrawingProperties(page, properties = {}) {
  try {
    const propsBtn = await page.$('button[aria-label*="Properties"], button[data-qa-id="drawing-properties"]');
    if (propsBtn) {
      await propsBtn.click();
      await page.waitForTimeout(500);
    }

    if (properties.color) {
      const colorInput = await page.$('input[type="color"], [class*="color"]');
      if (colorInput) await colorInput.fill(properties.color);
    }

    if (properties.width) {
      const widthInput = await page.$('input[type="range"], input[type="number"][class*="width"]');
      if (widthInput) await widthInput.fill(String(properties.width));
    }

    return { success: true, message: 'Drawing properties updated', properties };
  } catch (error) {
    return { success: false, message: 'Error setting properties', error: error.message };
  }
}

async function main() {
  const action = process.argv[2];
  const param = process.argv[3];
  const options = process.argv[4] ? JSON.parse(process.argv[4]) : {};

  const { browser, page } = await launchBrowser();

  try {
    await openChart(page);

    let result;
    switch (action) {
      case 'list': result = await getDrawingList(page); break;
      case 'add': result = await addDrawing(page, param); break;
      case 'remove': result = await removeDrawing(page, param); break;
      case 'properties': result = await setDrawingProperties(page, options); break;
      default: result = { success: false, message: 'Usage: list|add|remove|properties <type> [options]' };
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = { getDrawingList, addDrawing, removeDrawing, setDrawingProperties };
if (require.main === module) main();
