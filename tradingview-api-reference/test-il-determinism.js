const axios = require('axios');

const SESSION = process.env.TV_SESSION;
const SIGNATURE = process.env.TV_SIGNATURE;

if (!SESSION || !SIGNATURE) {
  throw new Error('Missing required environment variables: TV_SESSION and TV_SIGNATURE must be set.');
}

const cookie = `sessionid=${SESSION};sessionid_sign=${SIGNATURE}`;

async function fetchIL(scriptId) {
  const { data } = await axios.get(
    `https://pine-facade.tradingview.com/pine-facade/translate/${scriptId}/last`,
    { headers: { cookie }, validateStatus: () => true }
  );
  if (data.success) {
    return data.result.ilTemplate;
  }
  throw new Error(`Failed: ${data.reason}`);
}

(async () => {
  const scriptId = 'USER;5f943e0581f844078b9a06ce1e42cb04'; // Your Zero Lag
  const attempts = 5;

  console.log('=== IL Determinism Test: Zero Lag ===');
  console.log(`Fetching IL ${attempts} times for ${scriptId}\n`);

  const results = [];

  for (let i = 1; i <= attempts; i++) {
    console.log(`Fetch #${i}...`);
    const il = await fetchIL(scriptId);
    results.push(il);
    console.log(`  Length: ${il.length}`);
    console.log(`  First 80 chars: ${il.substring(0, 80)}`);
    console.log(`  Last 40 chars:  ...${il.substring(il.length - 40)}`);

    // Small delay between requests
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n=== Comparison ===\n');

  // Compare all pairs
  let allIdentical = true;
  for (let i = 1; i < results.length; i++) {
    const match = results[i] === results[0];
    console.log(`Fetch #1 vs #${i + 1}: ${match ? 'IDENTICAL' : 'DIFFERENT'}`);
    if (!match) {
      allIdentical = false;
      // Find first difference
      for (let j = 0; j < Math.max(results[0].length, results[i].length); j++) {
        if (results[0][j] !== results[i][j]) {
          console.log(`  First difference at char ${j}:`);
          console.log(`    #1: ...${results[0].substring(Math.max(0, j - 20), j + 20)}...`);
          console.log(`    #${i + 1}: ...${results[i].substring(Math.max(0, j - 20), j + 20)}...`);
          break;
        }
      }
    }
  }

  console.log(`\nVerdict: ${allIdentical ? 'DETERMINISTIC (same IL every time — compiled/obfuscated, potentially reversible)' : 'NON-DETERMINISTIC (different IL each time — encrypted, NOT reversible)'}`);

  // Also test with built-in RSI for comparison
  console.log('\n\n=== IL Determinism Test: Built-in RSI ===\n');
  const rsiId = 'STD;RSI';
  const rsiResults = [];
  for (let i = 1; i <= 3; i++) {
    console.log(`Fetch #${i}...`);
    const il = await fetchIL(rsiId);
    rsiResults.push(il);
    console.log(`  Length: ${il.length}`);
    console.log(`  First 80 chars: ${il.substring(0, 80)}`);
    await new Promise(r => setTimeout(r, 500));
  }

  const rsiIdentical = rsiResults.every(r => r === rsiResults[0]);
  console.log(`\nRSI verdict: ${rsiIdentical ? 'DETERMINISTIC' : 'NON-DETERMINISTIC'}`);
})();
