const axios = require('axios');

const SESSION = process.env.TV_SESSION;
const SIGNATURE = process.env.TV_SIGNATURE;

if (!SESSION || !SIGNATURE) {
  throw new Error('Missing required environment variables: TV_SESSION and TV_SIGNATURE must be set.');
}

const cookie = `sessionid=${SESSION};sessionid_sign=${SIGNATURE}`;
const headers = {
  cookie,
  origin: 'https://www.tradingview.com',
  referer: 'https://www.tradingview.com/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

(async () => {
  // Try various endpoints that might list favorites
  const endpoints = [
    // Favorites endpoints
    { url: 'https://www.tradingview.com/pine_perm/list_scripts/', method: 'GET' },
    { url: 'https://www.tradingview.com/api/v1/symbols/favorites/', method: 'GET' },
    { url: 'https://pine-facade.tradingview.com/pine-facade/list?filter=invite_only', method: 'GET' },
    { url: 'https://pine-facade.tradingview.com/pine-facade/list?filter=shared', method: 'GET' },
    { url: 'https://pine-facade.tradingview.com/pine-facade/list?filter=private', method: 'GET' },
    { url: 'https://pine-facade.tradingview.com/pine-facade/list?filter=granted', method: 'GET' },
    // Study template / favorites
    { url: 'https://charts-storage.tradingview.com/charts-storage/favoriteStudies', method: 'GET' },
    { url: 'https://www.tradingview.com/study-template/', method: 'GET' },
  ];

  for (const ep of endpoints) {
    console.log(`--- ${ep.method} ${ep.url} ---`);
    try {
      const { data, status } = await axios({
        method: ep.method,
        url: ep.url,
        headers,
        validateStatus: () => true,
      });
      console.log(`Status: ${status}`);
      if (Array.isArray(data)) {
        console.log(`Array of ${data.length} items`);
        for (const item of data.slice(0, 10)) {
          const name = item.scriptName || item.name || item.title || item.scriptIdPart || '';
          const id = item.scriptIdPart || item.id || '';
          console.log(`  ${name} — ${id} (${item.access || item.scriptAccess || ''})`);
        }
      } else if (typeof data === 'object' && !Buffer.isBuffer(data)) {
        const str = JSON.stringify(data, null, 2);
        console.log(str.substring(0, 500));
      } else {
        const str = String(data);
        if (str.includes('Dead Zone') || str.includes('dead_zone') || str.includes('deadzone')) {
          console.log('CONTAINS "Dead Zone"!');
        }
        console.log(`(${str.length} chars, HTML/other)`);
      }
    } catch (err) {
      console.log(`Error: ${err.message}`);
    }
    console.log();
  }

  // Try directly guessing with "Dead Zone" in pine-facade search
  console.log('\n=== Trying pubscripts search ===');
  try {
    const { data } = await axios.get('https://www.tradingview.com/pubscripts-suggest-json', {
      params: { search: 'Dead Zone' },
      headers,
      validateStatus: () => true,
    });
    console.log(`Results: ${data.results?.length || 0}`);
    for (const r of (data.results || []).slice(0, 10)) {
      console.log(`  [${r.access}] ${r.scriptName} by ${r.author?.username} — ${r.scriptIdPart}`);
    }
  } catch (err) {
    console.log(`Error: ${err.message}`);
  }
})();
