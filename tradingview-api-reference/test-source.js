const axios = require('axios');

const SESSION = process.env.TV_SESSION;
const SIGNATURE = process.env.TV_SIGNATURE;

if (!SESSION || !SIGNATURE) {
  throw new Error('Missing required environment variables: TV_SESSION and TV_SIGNATURE must be set.');
}

const cookie = `sessionid=${SESSION};sessionid_sign=${SIGNATURE}`;

(async () => {
  // 1. Try /pine-facade/get/ for your private script
  console.log('=== Testing pine-facade endpoints for source code ===\n');

  const scriptId = 'USER;5f943e0581f844078b9a06ce1e42cb04';
  const encodedId = scriptId.replace(/ |%/g, '%25');

  // Try different endpoints that might return source
  const endpoints = [
    { name: 'get (last)', url: `https://pine-facade.tradingview.com/pine-facade/get/${encodedId}/last` },
    { name: 'get (no version)', url: `https://pine-facade.tradingview.com/pine-facade/get/${encodedId}` },
    { name: 'sources/get', url: `https://pine-facade.tradingview.com/pine-facade/sources/get/${encodedId}/last` },
    { name: 'translate', url: `https://pine-facade.tradingview.com/pine-facade/translate/${encodedId}/last` },
  ];

  for (const ep of endpoints) {
    console.log(`--- ${ep.name} ---`);
    console.log(`URL: ${ep.url}`);
    try {
      const { data, status } = await axios.get(ep.url, {
        headers: { cookie },
        validateStatus: () => true,
      });

      console.log(`Status: ${status}`);

      if (typeof data === 'object' && data.success !== undefined) {
        console.log(`Success: ${data.success}`);
        if (data.result) {
          const keys = Object.keys(data.result);
          console.log(`Result keys: ${keys.join(', ')}`);

          // Check for source code
          if (data.result.source) {
            console.log(`\nSOURCE CODE FOUND! Length: ${data.result.source.length}`);
            console.log('First 500 chars:');
            console.log(data.result.source.substring(0, 500));
          }

          // Check metaInfo for source
          if (data.result.metaInfo) {
            const metaKeys = Object.keys(data.result.metaInfo);
            console.log(`MetaInfo keys: ${metaKeys.join(', ')}`);
            if (data.result.metaInfo.source) {
              console.log(`\nSOURCE in metaInfo! Length: ${data.result.metaInfo.source.length}`);
              console.log(data.result.metaInfo.source.substring(0, 500));
            }
          }

          // Check ilTemplate
          if (data.result.ilTemplate) {
            console.log(`ilTemplate: ${data.result.ilTemplate.substring(0, 100)}...`);
          }
        }
        if (data.reason) console.log(`Reason: ${data.reason}`);
      } else if (typeof data === 'string') {
        console.log(`Response: ${data.substring(0, 200)}`);
      } else {
        console.log(`Response keys: ${Object.keys(data).join(', ')}`);
      }
    } catch (err) {
      console.log(`Error: ${err.message}`);
    }
    console.log();
  }

  // 2. Try for a public open-source indicator
  console.log('\n=== Testing open source indicator ===\n');
  const pubId = 'PUB;53c1c277a2b64c6496b53b2a85ca68dc'; // Traders Reality Vector Candle Zones
  const pubEncoded = pubId.replace(/ |%/g, '%25');

  for (const epName of ['get', 'sources/get', 'translate']) {
    const url = `https://pine-facade.tradingview.com/pine-facade/${epName}/${pubEncoded}/last`;
    console.log(`--- ${epName} (public) ---`);
    try {
      const { data, status } = await axios.get(url, {
        headers: { cookie },
        validateStatus: () => true,
      });
      console.log(`Status: ${status}`);
      if (data.success && data.result) {
        const keys = Object.keys(data.result);
        console.log(`Result keys: ${keys.join(', ')}`);
        if (data.result.source) {
          console.log(`\nSOURCE CODE FOUND! Length: ${data.result.source.length}`);
          console.log('First 500 chars:');
          console.log(data.result.source.substring(0, 500));
        }
      } else {
        console.log(`Success: ${data.success}, Reason: ${data.reason || 'none'}`);
      }
    } catch (err) {
      console.log(`Error: ${err.message}`);
    }
    console.log();
  }
})();
