const { getCredentials, TradingView } = require('../../lib/ws-client');

/**
 * Get user's saved/private Pine scripts.
 * - HTTP API mode (default): uses getPrivateIndicators (no browser needed)
 * - Playwright mode (backward compat): pass a Playwright page as first arg
 *
 * @param {Page|null} [pageOrNull] - Playwright page for legacy mode, or null/undefined for HTTP API
 * @returns {Promise<{success:boolean, message:string, scripts?:Array, count?:number}>}
 */
async function getSavedScripts(pageOrNull) {
  if (pageOrNull && typeof pageOrNull.evaluate === 'function') {
    return getSavedScriptsPlaywright(pageOrNull);
  }
  return getSavedScriptsAPI();
}

async function getSavedScriptsAPI() {
  try {
    const { session, signature } = getCredentials();
    const scripts = await TradingView.getPrivateIndicators(session, signature);

    return {
      success: true,
      message: `Found ${scripts.length} saved scripts`,
      scripts: scripts.map(s => ({
        id: s.id,
        name: s.name,
        version: s.version,
        type: s.type,
        access: s.access,
      })),
      count: scripts.length,
    };
  } catch (error) {
    return { success: false, message: 'Error getting saved scripts', error: error.message };
  }
}

async function getSavedScriptsPlaywright(page) {
  try {
    const editorBtn = await page.$('button[aria-label*="Pine Editor"], button[data-name="pine-editor"]');
    if (editorBtn) {
      await editorBtn.click();
      await page.waitForTimeout(1000);
    }

    const found = await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button'));
      const indicatorsBtn = allButtons.find(btn => {
        const text = btn.textContent || '';
        const aria = btn.getAttribute('aria-label') || '';
        return text.includes('Indicators') || aria.includes('Indicators') ||
               text.includes('My Scripts') || aria.includes('My Scripts');
      });
      if (indicatorsBtn) {
        return {
          found: true,
          text: indicatorsBtn.textContent?.trim(),
          aria: indicatorsBtn.getAttribute('aria-label'),
          dataName: indicatorsBtn.getAttribute('data-name'),
        };
      }
      return { found: false };
    });

    const scripts = await page.evaluate(() => {
      const items = document.querySelectorAll('[class*="scriptItem"], [class*="script-"], [data-qa-id*="script"]');
      return Array.from(items).map((item, idx) => ({
        id: idx,
        name: item.textContent?.trim().substring(0, 100),
      }));
    });

    return {
      success: true,
      message: `Found ${scripts.length} saved scripts`,
      scripts,
      count: scripts.length,
      indicatorsButton: found,
    };
  } catch (error) {
    return { success: false, message: 'Error getting saved scripts', error: error.message };
  }
}

async function main() {
  try {
    const result = await getSavedScripts();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  }
}

module.exports = { getSavedScripts };
if (require.main === module) main();
