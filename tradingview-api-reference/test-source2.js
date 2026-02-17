const axios = require('axios');

const SESSION = process.env.TV_SESSION;
const SIGNATURE = process.env.TV_SIGNATURE;

if (!SESSION || !SIGNATURE) {
  throw new Error('Missing required environment variables: TV_SESSION and TV_SIGNATURE must be set.');
}

const cookie = `sessionid=${SESSION};sessionid_sign=${SIGNATURE}`;

(async () => {
  // 1. Your private script — /get/ returned source!
  console.log('=== Your Private Script Source Code ===\n');
  const scriptId = 'USER;5f943e0581f844078b9a06ce1e42cb04';
  const { data } = await axios.get(
    `https://pine-facade.tradingview.com/pine-facade/get/${scriptId}/last`,
    { headers: { cookie } }
  );

  console.log('Keys:', Object.keys(data));
  console.log('Script name:', data.scriptName);
  console.log('Version:', data.version);
  console.log('Source type:', typeof data.source);
  console.log('Source length:', data.source?.length || 0);
  console.log('\n--- FIRST 2000 CHARS OF SOURCE ---\n');
  console.log(data.source?.substring(0, 2000));
  console.log('\n--- END ---');

  // 2. Try a public open source indicator
  console.log('\n\n=== Public Open Source Indicator ===\n');
  const pubId = 'PUB;53c1c277a2b64c6496b53b2a85ca68dc';
  try {
    const { data: pubData } = await axios.get(
      `https://pine-facade.tradingview.com/pine-facade/get/${pubId}/last`,
      { headers: { cookie } }
    );
    console.log('Keys:', Object.keys(pubData));
    if (pubData.source) {
      console.log('Source length:', pubData.source.length);
      console.log('\n--- FIRST 1000 CHARS ---\n');
      console.log(pubData.source.substring(0, 1000));
    } else {
      console.log('No source field. Full response:');
      console.log(JSON.stringify(pubData, null, 2).substring(0, 1000));
    }
  } catch (err) {
    console.log('Error:', err.message);
  }

  // 3. Try a built-in TradingView indicator (RSI)
  console.log('\n\n=== Built-in RSI ===\n');
  try {
    const { data: rsiData } = await axios.get(
      `https://pine-facade.tradingview.com/pine-facade/get/STD;RSI/last`,
      { headers: { cookie } }
    );
    console.log('Keys:', Object.keys(rsiData));
    if (rsiData.source) {
      console.log('Source length:', rsiData.source.length);
      console.log('\n--- FIRST 1000 CHARS ---\n');
      console.log(rsiData.source.substring(0, 1000));
    } else {
      console.log('No source. Response:', JSON.stringify(rsiData, null, 2).substring(0, 500));
    }
  } catch (err) {
    console.log('Error:', err.message);
  }
})();
