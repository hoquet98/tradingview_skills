/**
 * Example 1: List invite-only scripts (name + script ID)
 * Uses Playwright to browse the invite-only section of the indicators dialog.
 */
const { launchBrowser, openChart, closeBrowser } = require('../lib/browser');
const { getIndicatorsFromSection } = require('../skills/get-indicator-list');

async function main() {
  const { browser, page } = await launchBrowser();

  try {
    await openChart(page);
    const result = await getIndicatorsFromSection(page, 'invite-only');

    if (!result.success) {
      console.error('Failed:', result.message, result.error);
      process.exit(1);
    }

    console.log(`Found ${result.count} invite-only script(s):\n`);

    for (const script of result.indicators) {
      console.log(`  Name: ${script.name}`);
      console.log(`  ID:   ${script.id}`);
      console.log();
    }
  } finally {
    await closeBrowser(browser);
  }
}

main();
