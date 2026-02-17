const axios = require('axios');
const TradingView = require('./main');

const SESSION = process.env.TV_SESSION;
const SIGNATURE = process.env.TV_SIGNATURE;

if (!SESSION || !SIGNATURE) {
  throw new Error('Missing required environment variables: TV_SESSION and TV_SIGNATURE must be set.');
}

const cookie = `sessionid=${SESSION};sessionid_sign=${SIGNATURE}`;

async function getSourceAndIL(scriptId) {
  const [getResp, translateResp] = await Promise.all([
    axios.get(`https://pine-facade.tradingview.com/pine-facade/get/${scriptId}/last`, {
      headers: { cookie }, validateStatus: () => true
    }),
    axios.get(`https://pine-facade.tradingview.com/pine-facade/translate/${scriptId}/last`, {
      headers: { cookie }, validateStatus: () => true
    }),
  ]);

  return {
    source: getResp.data?.source || null,
    il: translateResp.data?.result?.ilTemplate || null,
    rawIL: translateResp.data?.result?.IL || null,
    name: getResp.data?.scriptName || translateResp.data?.result?.metaInfo?.description || 'unknown',
  };
}

(async () => {
  // 1. Analyze IL format structure
  console.log('=== IL Format Analysis ===\n');

  // Get a very simple indicator first - let's write minimal Pine scripts and see
  // For now, compare known open-source scripts of varying complexity

  // Simple: RSI (built-in)
  const rsi = await getSourceAndIL('STD;RSI');
  console.log(`RSI: source=${rsi.source?.length || 0} chars, IL=${rsi.il?.length || 0} chars`);

  // Very simple: Volume
  const vol = await getSourceAndIL('STD;Volume');
  console.log(`Volume: source=${vol.source?.length || 0} chars, IL=${vol.il?.length || 0} chars`);

  // Medium: MACD
  const macd = await getSourceAndIL('STD;MACD');
  console.log(`MACD: source=${macd.source?.length || 0} chars, IL=${macd.il?.length || 0} chars`);

  // Your Zero Lag (complex)
  const zl = await getSourceAndIL('USER;5f943e0581f844078b9a06ce1e42cb04');
  console.log(`Zero Lag: source=${zl.source?.length || 0} chars, IL=${zl.il?.length || 0} chars`);

  // 2. Analyze the IL prefix pattern
  console.log('\n\n=== IL Prefix Analysis ===\n');
  for (const { name, il } of [
    { name: 'RSI', il: rsi.il },
    { name: 'Volume', il: vol.il },
    { name: 'MACD', il: macd.il },
    { name: 'Zero Lag', il: zl.il },
  ]) {
    if (!il) { console.log(`${name}: no IL`); continue; }
    const parts = il.split('_');
    console.log(`${name}:`);
    console.log(`  Part 1 (prefix): ${parts[0]}`);
    console.log(`  Part 2 (hash?):  ${parts[1]}`);
    console.log(`  Part 3 length:   ${parts.slice(2).join('_').length} chars`);

    // Check if the body is valid base64
    const body = parts.slice(2).join('_');
    try {
      const decoded = Buffer.from(body, 'base64');
      console.log(`  Decoded bytes:   ${decoded.length}`);
      console.log(`  First 20 bytes:  ${Array.from(decoded.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      console.log(`  Printable?:      ${decoded.toString('utf8', 0, 50).replace(/[^\x20-\x7e]/g, '.')}`);

      // Check entropy (high entropy = encrypted, low = compressed/bytecode)
      const freq = new Map();
      for (const b of decoded) freq.set(b, (freq.get(b) || 0) + 1);
      let entropy = 0;
      for (const count of freq.values()) {
        const p = count / decoded.length;
        entropy -= p * Math.log2(p);
      }
      console.log(`  Entropy:         ${entropy.toFixed(4)} bits/byte (8.0 = perfectly random/encrypted, <6 = structured)`);
    } catch (e) {
      console.log(`  Not valid base64: ${e.message}`);
    }
    console.log();
  }

  // 3. Check if there's also a raw IL field
  console.log('\n=== Raw IL field check ===\n');
  const translateResp = await axios.get(
    `https://pine-facade.tradingview.com/pine-facade/translate/STD;RSI/last`,
    { headers: { cookie } }
  );
  const result = translateResp.data.result;
  console.log('Result keys:', Object.keys(result));
  if (result.IL) {
    console.log(`IL field type: ${typeof result.IL}`);
    console.log(`IL field length: ${result.IL.length}`);
    console.log(`IL first 200 chars: ${result.IL.substring(0, 200)}`);

    // Check if IL is different from ilTemplate
    console.log(`\nIL === ilTemplate? ${result.IL === result.ilTemplate}`);
  }

  // 4. Compare source/IL ratio
  console.log('\n\n=== Source to IL Compression Ratio ===\n');
  const scripts = ['STD;RSI', 'STD;Volume', 'STD;MACD', 'STD;Stochastic', 'STD;Bollinger_Bands', 'STD;EMA', 'STD;SMA'];
  for (const id of scripts) {
    try {
      const data = await getSourceAndIL(id);
      if (data.source && data.il) {
        const ratio = (data.il.length / data.source.length).toFixed(2);
        console.log(`${id.padEnd(25)} source: ${String(data.source.length).padStart(6)} → IL: ${String(data.il.length).padStart(6)} (ratio: ${ratio}x)`);
      }
    } catch (e) {
      console.log(`${id}: ${e.message}`);
    }
  }
})();
