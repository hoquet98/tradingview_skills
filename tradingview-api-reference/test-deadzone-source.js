const axios = require('axios');
const TradingView = require('./main');

const SESSION = process.env.TV_SESSION;
const SIGNATURE = process.env.TV_SIGNATURE;

if (!SESSION || !SIGNATURE) {
  throw new Error('Missing required environment variables: TV_SESSION and TV_SIGNATURE must be set.');
}

const cookie = `sessionid=${SESSION};sessionid_sign=${SIGNATURE}`;

(async () => {
  try {
    // 1. Search for Dead Zone
    console.log('=== Searching for "Dead Zone" ===\n');
    const results = await TradingView.searchIndicator('Dead Zone');
    console.log(`Found ${results.length} results`);
    for (const r of results.slice(0, 10)) {
      console.log(`  [${r.type}] [${r.access}] ${r.name} by ${r.author.username} — ID: ${r.id}`);
    }

    // 2. Try fetching source for each result
    for (const r of results.slice(0, 5)) {
      console.log(`\n--- Trying /get/ for: ${r.name} (${r.id}) ---`);
      try {
        const { data, status } = await axios.get(
          `https://pine-facade.tradingview.com/pine-facade/get/${r.id}/last`,
          { headers: { cookie }, validateStatus: () => true }
        );
        console.log(`Status: ${status}`);
        if (data.source) {
          console.log(`SOURCE FOUND! Length: ${data.source.length}`);
          console.log(`Access: ${data.scriptAccess || 'N/A'}`);
          console.log(`First 300 chars:\n${data.source.substring(0, 300)}`);
        } else if (typeof data === 'object') {
          console.log(`Keys: ${Object.keys(data).join(', ')}`);
          if (data.reason) console.log(`Reason: ${data.reason}`);
        }
      } catch (err) {
        console.log(`Error: ${err.message}`);
      }
    }

    // 3. Also try to find it in your favorites/saved lists
    console.log('\n\n=== Checking your private indicators ===');
    const privates = await TradingView.getPrivateIndicators(SESSION, SIGNATURE);
    const dz = privates.find(i => i.name.toLowerCase().includes('dead zone'));
    if (dz) {
      console.log(`Found in private: ${dz.name} — ID: ${dz.id}`);
    } else {
      console.log('Not in private indicators');
    }

    // 4. Try some likely IDs for invite-only scripts
    console.log('\n\n=== Trying favorites list endpoint ===');
    const favEndpoints = [
      'https://pine-facade.tradingview.com/pine-facade/list?filter=saved',
      'https://pine-facade.tradingview.com/pine-facade/list?filter=favorite',
      'https://www.tradingview.com/api/v1/study_favorites/',
      'https://www.tradingview.com/api/v1/script_favorites/',
    ];

    for (const url of favEndpoints) {
      console.log(`\n--- ${url} ---`);
      try {
        const { data, status } = await axios.get(url, {
          headers: { cookie, origin: 'https://www.tradingview.com' },
          validateStatus: () => true,
        });
        console.log(`Status: ${status}`);
        if (Array.isArray(data)) {
          console.log(`Array of ${data.length} items`);
          for (const item of data) {
            const name = item.scriptName || item.name || item.title || JSON.stringify(item).substring(0, 100);
            console.log(`  ${name}`);
          }
        } else if (typeof data === 'object') {
          console.log(JSON.stringify(data, null, 2).substring(0, 500));
        } else {
          console.log(`Response: ${String(data).substring(0, 200)}`);
        }
      } catch (err) {
        console.log(`Error: ${err.message}`);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
