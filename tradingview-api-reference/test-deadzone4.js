const axios = require('axios');

const SESSION = process.env.TV_SESSION;
const SIGNATURE = process.env.TV_SIGNATURE;

if (!SESSION || !SIGNATURE) {
  throw new Error('Missing required environment variables: TV_SESSION and TV_SIGNATURE must be set.');
}

const cookie = `sessionid=${SESSION};sessionid_sign=${SIGNATURE}`;

const scripts = [
  "PUB;06cc78b63db840a5a559fd76b10c1667",
  "PUB;09ae4cddb3f648d6b5a56960816131db",
  "PUB;0a64bb2740aa49f5ab8ae97d3856d4cc",
  "PUB;1140af4777d7460a89e29ea643a18df8",
  "PUB;15a0607859834804927d10c0a4e549e5",
  "PUB;3fd9d591d3d64a5ea953ec8fac25db27",
  "PUB;4ac2aba7efc5495ebc01cf3322c00d31",
  "PUB;52753993461a40e697e9cfcda1e47b3c",
  "PUB;542852434e9340e3a9bcf9c5a157dba4",
  "PUB;8b6f8d73bb0e47caa9f9e77440e203de",
  "PUB;b4b97de902c34d5189877458ca94056f",
  "PUB;c959043d157e4dbea23f72f12db2374d",
  "PUB;d1d8c1a4c5574872af6cd76103d4b36e",
  "PUB;f3ef671729284ea994b647be799464e9",
  "PUB;f8fed9d3ed154b8eaaf95b2c44fc37db",
];

(async () => {
  console.log('=== Resolving your 15 invite-only scripts via /translate/ ===\n');

  for (const id of scripts) {
    try {
      const { data, status } = await axios.get(
        `https://pine-facade.tradingview.com/pine-facade/translate/${id}/last`,
        { headers: { cookie }, validateStatus: () => true }
      );
      if (status === 200 && data.success) {
        const meta = data.result.metaInfo;
        console.log(`${id}`);
        console.log(`  Name: ${meta.description}`);
        console.log(`  Short: ${meta.shortDescription}`);
        console.log(`  Type: ${meta.isTVScriptStrategy ? 'strategy' : 'study'}`);
        console.log(`  Inputs: ${meta.inputs?.length || 0}`);
        console.log();
      } else {
        console.log(`${id} — Status: ${status}, Reason: ${data.reason || 'unknown'}`);
      }
    } catch (err) {
      console.log(`${id} — Error: ${err.message}`);
    }
  }
})();
