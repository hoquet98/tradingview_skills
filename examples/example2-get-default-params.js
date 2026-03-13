/**
 * Example 2: Get default parameters for an invite-only script
 * Uses the HTTP API — no browser needed.
 */
const { getIndicatorDetails } = require('../index');

const SCRIPT_ID = 'PUB;58c41e796e954b6a8644bc37b6493a61';

async function main() {
  const result = await getIndicatorDetails(SCRIPT_ID);

  if (!result.success) {
    console.error('Failed:', result.message, result.error);
    process.exit(1);
  }

  const { indicator } = result;
  console.log(`Script: ${indicator.description || indicator.shortDescription}`);
  console.log(`Type:   ${indicator.type}`);
  console.log(`Inputs: ${indicator.inputCount} | Plots: ${indicator.plotCount}\n`);

  console.log('Default Parameters:');
  console.log('─'.repeat(60));

  for (const input of indicator.inputs) {
    if (input.isHidden) continue;
    const opts = input.options ? ` [${input.options.join(', ')}]` : '';
    console.log(`  ${input.name}: ${JSON.stringify(input.value)}${opts}`);
  }
}

main();
