const { launchBrowser, openChart, verifySession, closeBrowser } = require('./lib/browser');

async function main() {
  console.log('=== TradingView Skills — Smoke Test ===\n');

  const { browser, page } = await launchBrowser({ headless: false });

  try {
    console.log('1. Opening chart...');
    await openChart(page);
    console.log('   Chart loaded successfully.\n');

    console.log('2. Verifying session...');
    const session = await verifySession(page);
    if (session.loggedIn) {
      console.log('   Logged in!\n');
    } else {
      console.log('   NOT logged in — cookies may be expired.\n');
    }

    console.log('3. Keeping browser open for 10 seconds for visual inspection...');
    await page.waitForTimeout(10000);

    console.log('\nSmoke test complete.');
  } catch (error) {
    console.error('Smoke test FAILED:', error.message);
  } finally {
    await closeBrowser(browser);
  }
}

main();
