const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DEFAULT_COOKIES_PATH = path.join(__dirname, '..', 'cookies.json');
const DEFAULT_CHART_URL = 'https://www.tradingview.com/chart/fXStfxnU/';

/**
 * Launch a Chromium browser with TradingView cookies loaded.
 * @param {Object} options
 * @param {boolean} [options.headless=true] - Run headless or headed
 * @param {string} [options.cookiesPath] - Path to Playwright-format cookies.json
 * @param {number} [options.slowMo=0] - Slow down actions by ms (useful for debugging)
 * @param {{width: number, height: number}} [options.viewport] - Browser viewport size
 * @returns {Promise<{browser: Browser, context: BrowserContext, page: Page}>}
 */
async function launchBrowser(options = {}) {
  const {
    headless = true,
    cookiesPath = DEFAULT_COOKIES_PATH,
    slowMo = 0,
    viewport = { width: 1920, height: 1080 },
  } = options;

  if (!fs.existsSync(cookiesPath)) {
    throw new Error(
      `Cookies file not found: ${cookiesPath}\n` +
      'Run: node scripts/convert-cookies.js <source-cookies.json>'
    );
  }

  const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));

  // Warn if session is expiring soon
  const sessionCookie = cookies.find(c => c.name === 'sessionid');
  if (sessionCookie && sessionCookie.expires) {
    const hoursLeft = (sessionCookie.expires * 1000 - Date.now()) / (1000 * 60 * 60);
    if (hoursLeft < 0) {
      console.warn('WARNING: sessionid cookie has EXPIRED. Export fresh cookies and re-run convert-cookies.js');
    } else if (hoursLeft < 24) {
      console.warn(`WARNING: sessionid cookie expires in ${hoursLeft.toFixed(1)} hours`);
    }
  }

  const browser = await chromium.launch({ headless, slowMo });
  const context = await browser.newContext({ viewport });
  await context.addCookies(cookies);
  const page = await context.newPage();

  return { browser, context, page };
}

/**
 * Navigate to a TradingView chart and wait for it to be ready.
 * @param {Page} page - Playwright page
 * @param {Object} [options]
 * @param {string} [options.chartId='fXStfxnU'] - TradingView chart ID
 * @param {string} [options.url] - Full URL override (takes precedence over chartId)
 * @param {number} [options.timeout=30000] - Max wait time in ms
 */
async function openChart(page, options = {}) {
  const {
    chartId = 'fXStfxnU',
    url,
    timeout = 30000,
  } = options;

  const chartUrl = url || `https://www.tradingview.com/chart/${chartId}/`;
  await page.goto(chartUrl, { waitUntil: 'domcontentloaded' });
  await waitForChartReady(page, timeout);
}

/**
 * Wait for the TradingView chart to be fully rendered and interactive.
 * @param {Page} page
 * @param {number} [timeout=30000]
 */
async function waitForChartReady(page, timeout = 30000) {
  await page.waitForSelector('canvas[aria-label^="Chart for"]', { timeout });
}

/**
 * Verify that the current session is authenticated.
 * @param {Page} page
 * @returns {Promise<{loggedIn: boolean, username: string|null}>}
 */
async function verifySession(page) {
  try {
    // If the chart canvas loaded with symbol info, we're authenticated.
    // Unauthenticated users get redirected or see a blank/login page.
    const canvas = await page.$('canvas[aria-label^="Chart for"]');
    if (canvas) {
      return { loggedIn: true, username: null };
    }

    // Fallback: check for user menu button variants
    const userMenu = await page.$('[data-qa-id="header-user-menu-button"], button[aria-label="Open user menu"], .tv-header__user-menu-button');
    if (userMenu) {
      return { loggedIn: true, username: null };
    }

    return { loggedIn: false, username: null };
  } catch {
    return { loggedIn: false, username: null };
  }
}

/**
 * Gracefully close the browser.
 * @param {Browser} browser
 */
async function closeBrowser(browser) {
  if (browser) {
    await browser.close();
  }
}

module.exports = {
  launchBrowser,
  openChart,
  waitForChartReady,
  verifySession,
  closeBrowser,
  DEFAULT_CHART_URL,
  DEFAULT_COOKIES_PATH,
};
