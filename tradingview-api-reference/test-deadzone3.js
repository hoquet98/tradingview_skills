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
};

(async () => {
  // 1. Look at the full pine_perm/list_scripts response
  console.log('=== pine_perm/list_scripts (your granted scripts) ===\n');
  const { data: scripts } = await axios.get('https://www.tradingview.com/pine_perm/list_scripts/', { headers });
  console.log(JSON.stringify(scripts, null, 2));

  // 2. For each script ID found, try /get/ to see if Dead Zone is there
  if (Array.isArray(scripts)) {
    console.log(`\n\n=== Resolving ${scripts.length} granted scripts ===\n`);
    for (const script of scripts) {
      const id = script.pine_id || script.id || script.scriptIdPart || script;
      console.log(`\nScript: ${JSON.stringify(script)}`);
      if (typeof id === 'string' && id.length > 3) {
        try {
          const { data, status } = await axios.get(
            `https://pine-facade.tradingview.com/pine-facade/get/${id}/last`,
            { headers: { cookie }, validateStatus: () => true }
          );
          if (status === 200) {
            console.log(`  Name: ${data.scriptName || data.scriptTitle || 'unknown'}`);
            console.log(`  Access: ${data.scriptAccess || 'N/A'}`);
            console.log(`  Has source: ${!!data.source} (${data.source?.length || 0} chars)`);
          } else {
            console.log(`  Status: ${status}`);
          }
        } catch (err) {
          console.log(`  Error: ${err.message}`);
        }
      }
    }
  }
})();
