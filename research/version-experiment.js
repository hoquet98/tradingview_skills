/**
 * Automated Version Experiment
 *
 * Uses Playwright to:
 * 1. Open TradingView Pine Editor
 * 2. Create a minimal indicator script and save it
 * 3. Modify the script slightly and save again (creating versions)
 * 4. Repeat with more modifications
 * 5. Fetch all versions via the API and compare their ILs
 *
 * This tests whether different versions of the SAME script share
 * the same encryption key. If they do, XOR of ciphertexts reveals
 * plaintext differences — the breakthrough we need.
 */

const { launchBrowser, openChart, closeBrowser } = require('../lib/browser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const SESSION = process.env.TV_SESSION;
const SIGNATURE = process.env.TV_SIGNATURE;
const cookie = `sessionid=${SESSION};sessionid_sign=${SIGNATURE}`;

function parseIL(ilString) {
  const parts = ilString.split('_');
  return {
    prefix: parts[0],
    hash: parts[1],
    hashBytes: Buffer.from(parts[1], 'base64'),
    bodyBytes: Buffer.from(parts.slice(2).join('_'), 'base64'),
  };
}

function xorBuffers(a, b) {
  const len = Math.min(a.length, b.length);
  const result = Buffer.alloc(len);
  for (let i = 0; i < len; i++) result[i] = a[i] ^ b[i];
  return result;
}

function computeEntropy(buffer) {
  if (buffer.length === 0) return 0;
  const freq = new Map();
  for (const b of buffer) freq.set(b, (freq.get(b) || 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / buffer.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// The test scripts — each version makes one small change
const VERSIONS = [
  {
    label: 'v1: plot(close)',
    code: `//@version=6
indicator("DiffTest")
plot(close)`,
  },
  {
    label: 'v2: plot(open)',
    code: `//@version=6
indicator("DiffTest")
plot(open)`,
  },
  {
    label: 'v3: plot(close + 1)',
    code: `//@version=6
indicator("DiffTest")
plot(close + 1)`,
  },
  {
    label: 'v4: plot(close) + plot(open)',
    code: `//@version=6
indicator("DiffTest")
plot(close)
plot(open)`,
  },
  {
    label: 'v5: plot(ta.sma(close, 14))',
    code: `//@version=6
indicator("DiffTest")
plot(ta.sma(close, 14))`,
  },
];

async function typeInEditor(page, code) {
  // Click on the Pine Editor code area
  // The Monaco editor used by TradingView
  const editorSelectors = [
    '.view-lines',
    '[class*="monaco"] .view-lines',
    '.pine-editor .view-lines',
    'textarea.inputarea',
  ];

  let clicked = false;
  for (const sel of editorSelectors) {
    const el = await page.$(sel);
    if (el) {
      await el.click();
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    // Try clicking the editor container
    const containers = [
      '[class*="editor-container"]',
      '[class*="pine-editor"]',
      '.layout__area--pine-editor',
    ];
    for (const sel of containers) {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        clicked = true;
        break;
      }
    }
  }

  if (!clicked) {
    throw new Error('Could not find Pine Editor code area');
  }

  await page.waitForTimeout(300);

  // Select all existing code
  await page.keyboard.press('Control+A');
  await page.waitForTimeout(100);

  // Delete it
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(200);

  // Type the new code
  // Use clipboard for speed and reliability
  await page.evaluate((text) => {
    navigator.clipboard.writeText(text);
  }, code);
  await page.keyboard.press('Control+V');
  await page.waitForTimeout(500);
}

async function openPineEditor(page) {
  // Check if Pine Editor is already open and visible
  const pineArea = await page.$('.layout__area--pine-editor');
  if (pineArea) {
    const isVisible = await pineArea.isVisible();
    if (isVisible) {
      console.log('  Pine Editor already open');
      return true;
    }
  }

  // Pine Editor button is in the RIGHT sidebar toolbar
  // data-name="pine-dialog-button" inside div[data-name="right-toolbar"]
  // The button may not be visible via standard locators because
  // the widgetbar-pages div has width:0px. Use page.evaluate to click it directly.

  const clicked = await page.evaluate(() => {
    // Find the button within the right toolbar
    const toolbar = document.querySelector('[data-name="right-toolbar"]');
    if (toolbar) {
      const btn = toolbar.querySelector('button[data-name="pine-dialog-button"]');
      if (btn) {
        btn.click();
        return 'toolbar';
      }
    }
    // Fallback: find anywhere in DOM
    const btn = document.querySelector('button[data-name="pine-dialog-button"]');
    if (btn) {
      btn.click();
      return 'global';
    }
    // Fallback: find by aria-label
    const pineBtn = document.querySelector('button[aria-label="Pine"]');
    if (pineBtn) {
      pineBtn.click();
      return 'aria';
    }
    return null;
  });

  if (clicked) {
    await page.waitForTimeout(2000);
    console.log(`  Opened Pine Editor via ${clicked} selector`);
    return true;
  }

  throw new Error('Could not open Pine Editor — button not found in DOM');
}

async function clickNewIndicator(page) {
  // Click the "New" dropdown in Pine Editor toolbar
  // Look for "New" button or menu
  const newBtnSelectors = [
    'button[data-name="new"]',
    '.pine-editor-header button:has-text("New")',
  ];

  for (const sel of newBtnSelectors) {
    const btn = await page.$(sel);
    if (btn) {
      await btn.click();
      await page.waitForTimeout(500);
      break;
    }
  }

  // If a dropdown appeared, click "Indicator"
  const menuItems = await page.$$('[class*="menu"] [class*="item"], [role="menuitem"]');
  for (const item of menuItems) {
    const text = await item.textContent();
    if (text?.includes('Indicator')) {
      await item.click();
      await page.waitForTimeout(500);
      return;
    }
  }

  // Alternative: just try the locator
  const indicatorOption = page.locator('[role="menuitem"]:has-text("Indicator")').first();
  if (await indicatorOption.count()) {
    await indicatorOption.click();
    await page.waitForTimeout(500);
    return;
  }

  console.log('  Warning: Could not find "New > Indicator" menu. Will try to type code directly.');
}

async function dismissPromoPopup(page) {
  // Close the "upgrade" promo popup if it appears (indicator limit dialog)
  try {
    const closeBtn = await page.$('[data-qa-id="promo-dialog-close-button"]');
    if (closeBtn) {
      await closeBtn.click();
      await page.waitForTimeout(500);
      console.log('  Dismissed promo popup');
    }
  } catch (e) {}
}

async function saveScript(page, isFirstSave = false) {
  // Dismiss any promo popup first
  await dismissPromoPopup(page);

  // Use Ctrl+S to save (works in Pine Editor)
  await page.keyboard.press('Control+S');
  await page.waitForTimeout(1500);

  // Dismiss popup if save triggered one
  await dismissPromoPopup(page);

  if (isFirstSave) {
    // "Save Script" dialog appears with data-name="rename-dialog"
    // Input has value="My strategy", Save button has data-qa-id="save-btn"
    try {
      // Wait for the dialog to appear
      await page.waitForSelector('[data-name="rename-dialog"]', { timeout: 3000 });
      console.log('  Save dialog appeared');

      // Clear and type the name
      const nameInput = await page.$('[data-name="rename-dialog"] input');
      if (nameInput) {
        await nameInput.click({ clickCount: 3 });
        await nameInput.fill('DiffTest');
        await page.waitForTimeout(300);
      }

      // Click the Save button
      const saveBtn = await page.$('[data-qa-id="save-btn"]');
      if (saveBtn) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
        console.log('  Clicked Save in dialog');
      }
    } catch (e) {
      console.log('  Save dialog not found:', e.message.substring(0, 60));
    }
  }

  // Dismiss popup if it appeared after save
  await dismissPromoPopup(page);

  // Wait for save to complete
  await page.waitForTimeout(1500);
  console.log('  Saved');
}

async function addToChart(page) {
  // Click "Add to chart" button in Pine Editor
  const selectors = [
    'button[data-name="apply-script-button"]',
    'button:has-text("Add to chart")',
    'button:has-text("Apply to chart")',
    'button:has-text("Update on chart")',
  ];

  for (const sel of selectors) {
    try {
      const btn = sel.includes(':has-text')
        ? page.locator(sel).first()
        : page.locator(sel);
      if (await btn.count()) {
        await btn.click();
        await page.waitForTimeout(2000);
        console.log('  Added to chart');
        return;
      }
    } catch (e) {}
  }
  console.log('  Warning: Could not find Add to chart button');
}

async function findScriptId(page) {
  // After saving, try to get the script ID
  // Check the URL or use the API
  const { data } = await axios.get(
    'https://pine-facade.tradingview.com/pine-facade/list?filter=saved',
    { headers: { cookie }, validateStatus: () => true }
  );

  if (Array.isArray(data)) {
    // Find the DiffTest script
    const diffTest = data.find(s => s.scriptName === 'DiffTest' || s.scriptName.includes('DiffTest'));
    if (diffTest) {
      return `USER;${diffTest.scriptIdPart}`;
    }
    // If not found by name, return the most recently saved
    console.log('  Available scripts:', data.map(s => s.scriptName).join(', '));
  }
  return null;
}

async function fetchVersionIL(scriptId, version) {
  const [getResp, translateResp] = await Promise.all([
    axios.get(`https://pine-facade.tradingview.com/pine-facade/get/${scriptId}/${version}`, {
      headers: { cookie }, validateStatus: () => true,
    }),
    axios.get(`https://pine-facade.tradingview.com/pine-facade/translate/${scriptId}/${version}`, {
      headers: { cookie }, validateStatus: () => true,
    }),
  ]);

  if (translateResp.status !== 200 || !translateResp.data?.success) {
    return null;
  }

  return {
    version,
    source: getResp.data?.source || null,
    il: translateResp.data?.result?.ilTemplate || null,
    rawIL: translateResp.data?.result?.IL || null,
  };
}

async function compareVersionILs(versions) {
  console.log('\n' + '='.repeat(60));
  console.log('  IL VERSION COMPARISON — THE CRITICAL TEST');
  console.log('='.repeat(60) + '\n');

  for (let i = 0; i < versions.length; i++) {
    const v = versions[i];
    if (!v || !v.il) continue;
    const il = parseIL(v.il);
    console.log(`Version ${v.version}: hash=${il.hash} body=${il.bodyBytes.length}b`);
    if (v.source) {
      console.log(`  Source: ${v.source.substring(0, 100).replace(/\n/g, '\\n')}`);
    }
  }

  console.log('\n--- Pairwise Comparisons ---\n');

  for (let i = 0; i < versions.length - 1; i++) {
    const a = versions[i], b = versions[i + 1];
    if (!a?.il || !b?.il) continue;

    const ilA = parseIL(a.il);
    const ilB = parseIL(b.il);

    console.log(`v${a.version} → v${b.version}:`);
    console.log(`  Hash SAME: ${ilA.hash === ilB.hash}`);
    console.log(`  Body size: ${ilA.bodyBytes.length} → ${ilB.bodyBytes.length} (delta: ${ilB.bodyBytes.length - ilA.bodyBytes.length})`);

    if (ilA.hash === ilB.hash) {
      console.log('  *** SAME HASH = SAME KEY! XOR reveals plaintext diff! ***');
    }

    const minLen = Math.min(ilA.bodyBytes.length, ilB.bodyBytes.length);
    let changed = 0;
    for (let k = 0; k < minLen; k++) {
      if (ilA.bodyBytes[k] !== ilB.bodyBytes[k]) changed++;
    }
    console.log(`  Bytes changed: ${changed}/${minLen} (${(changed/minLen*100).toFixed(1)}%)`);

    let bits = 0;
    for (let k = 0; k < minLen; k++) {
      let xor = ilA.bodyBytes[k] ^ ilB.bodyBytes[k];
      while (xor) { bits += xor & 1; xor >>= 1; }
    }
    console.log(`  Hamming: ${bits}/${minLen*8} bits (${(bits/(minLen*8)*100).toFixed(1)}%)`);

    const xor = xorBuffers(ilA.bodyBytes, ilB.bodyBytes);
    console.log(`  XOR entropy: ${computeEntropy(xor).toFixed(4)}`);

    // Check how many bytes are identical
    const samePositions = [];
    for (let k = 0; k < minLen; k++) {
      if (ilA.bodyBytes[k] === ilB.bodyBytes[k]) samePositions.push(k);
    }
    if (samePositions.length > 0 && samePositions.length < 50) {
      console.log(`  Same byte positions: ${samePositions.join(', ')}`);
    } else {
      console.log(`  Same bytes: ${samePositions.length}/${minLen}`);
    }

    // If XOR entropy is low, show the XOR as hex
    if (computeEntropy(xor) < 6) {
      console.log(`  XOR hex (first 64): ${xor.slice(0, 64).toString('hex')}`);
      console.log(`  XOR ascii: ${xor.slice(0, 64).toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);
    }
    console.log();
  }

  // Final verdict
  console.log('='.repeat(60));
  const allSameHash = versions.filter(v => v?.il).every((v, i, arr) => {
    if (i === 0) return true;
    return parseIL(v.il).hash === parseIL(arr[0].il).hash;
  });

  const anyLowHamming = [];
  for (let i = 0; i < versions.length - 1; i++) {
    const a = versions[i], b = versions[i + 1];
    if (!a?.il || !b?.il) continue;
    const ilA = parseIL(a.il), ilB = parseIL(b.il);
    const minLen = Math.min(ilA.bodyBytes.length, ilB.bodyBytes.length);
    let bits = 0;
    for (let k = 0; k < minLen; k++) {
      let xor = ilA.bodyBytes[k] ^ ilB.bodyBytes[k];
      while (xor) { bits += xor & 1; xor >>= 1; }
    }
    const rate = bits / (minLen * 8);
    if (rate < 0.4) anyLowHamming.push({ a: a.version, b: b.version, rate });
  }

  if (allSameHash) {
    console.log('  BREAKTHROUGH: All versions share the same encryption key!');
    console.log('  XOR of any two versions reveals the plaintext difference.');
    console.log('  We can now build a decompiler using differential analysis.');
  } else if (anyLowHamming.length > 0) {
    console.log('  PARTIAL BREAKTHROUGH: Some version pairs show related encryption.');
    for (const { a, b, rate } of anyLowHamming) {
      console.log(`  v${a}→v${b}: ${(rate*100).toFixed(1)}% bit change (expected 50% if independent)`);
    }
  } else {
    console.log('  NO BREAKTHROUGH: Each version uses an independent encryption key.');
    console.log('  The IL cannot be reverse-engineered without the server-side key.');
  }
  console.log('='.repeat(60));
}

async function main() {
  console.log('=== Automated Version Experiment ===\n');
  console.log('This will:');
  console.log('  1. Open TradingView in a browser');
  console.log('  2. Create a minimal indicator in Pine Editor');
  console.log('  3. Save it, modify it, save again (multiple versions)');
  console.log('  4. Fetch all versions via API and compare ILs\n');

  const { browser, context, page } = await launchBrowser({ headless: false });

  try {
    // Step 1: Open chart
    console.log('Step 1: Opening chart...');
    await openChart(page);
    console.log('  Chart canvas found, waiting for full load...');

    // Wait longer for the full UI to render (right sidebar, etc.)
    await page.waitForTimeout(5000);

    // Check what's in the DOM
    const domInfo = await page.evaluate(() => {
      const rightToolbar = document.querySelector('[data-name="right-toolbar"]');
      const widgetbar = document.querySelector('.widgetbar-wrap');
      const pineBtn = document.querySelector('button[data-name="pine-dialog-button"]');
      const allBtns = document.querySelectorAll('button').length;
      return {
        hasRightToolbar: !!rightToolbar,
        hasWidgetbar: !!widgetbar,
        hasPineBtn: !!pineBtn,
        totalButtons: allBtns,
        url: window.location.href,
        title: document.title,
      };
    });
    console.log('  DOM state:', JSON.stringify(domInfo));
    console.log('  Chart loaded');

    // Step 2: Open Pine Editor
    console.log('\nStep 2: Opening Pine Editor...');
    await openPineEditor(page);

    // Step 3: Create new indicator
    console.log('\nStep 3: Creating new indicator...');
    await clickNewIndicator(page);
    await page.waitForTimeout(1000);

    // Step 4: Type each version, save. Don't need to add to chart.
    // Just saving creates the script in the account, which the API can fetch.
    for (let i = 0; i < VERSIONS.length; i++) {
      const v = VERSIONS[i];
      console.log(`\nStep ${4 + i}: ${v.label}`);

      // Type the code
      await typeInEditor(page, v.code);
      await page.waitForTimeout(500);

      // Save — first save needs a name, subsequent saves create new versions
      await saveScript(page, i === 0);

      // Wait between versions for the save to propagate
      await page.waitForTimeout(1000);
    }

    // Step 5: Find the script ID
    console.log('\nStep 9: Finding script ID...');
    const scriptId = await findScriptId(page);
    if (!scriptId) {
      console.log('  ERROR: Could not find the DiffTest script in your saved scripts');
      console.log('  Try running: node research/controlled-diff.js scan');
      return;
    }
    console.log(`  Found: ${scriptId}`);

    // Step 6: Fetch all versions via API
    console.log('\nStep 10: Fetching all versions via API...');
    const versionData = [];
    for (let v = 1; v <= VERSIONS.length + 2; v++) {
      const data = await fetchVersionIL(scriptId, v);
      if (!data) {
        console.log(`  Version ${v}: not found (end of versions)`);
        break;
      }
      console.log(`  Version ${v}: source=${data.source?.length || 0} chars, IL=${data.il ? parseIL(data.il).bodyBytes.length + 'b' : 'none'}`);
      versionData.push(data);
    }

    // Step 7: Compare!
    if (versionData.length >= 2) {
      await compareVersionILs(versionData);
    } else {
      console.log('\nNot enough versions found for comparison.');
      console.log('The script may need to be saved multiple times.');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);

    // Take a screenshot for debugging
    const screenshotPath = path.join(__dirname, 'debug-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Debug screenshot saved to: ${screenshotPath}`);
  } finally {
    // Keep browser open for 5 seconds so user can see the result
    console.log('\nClosing browser in 5 seconds...');
    await page.waitForTimeout(5000);
    await closeBrowser(browser);
  }
}

main().catch(console.error);
