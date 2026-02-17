const axios = require('axios');
const fs = require('fs');
const path = require('path');

const SESSION = process.env.TV_SESSION;
const SIGNATURE = process.env.TV_SIGNATURE;

if (!SESSION || !SIGNATURE) {
  throw new Error('Missing required environment variables: TV_SESSION and TV_SIGNATURE must be set.');
}

const cookie = `sessionid=${SESSION};sessionid_sign=${SIGNATURE}`;
const CORPUS_DIR = path.join(__dirname, 'corpus');

async function fetchSourceAndIL(scriptId) {
  const [getResp, translateResp] = await Promise.all([
    axios.get(`https://pine-facade.tradingview.com/pine-facade/get/${scriptId}/last`, {
      headers: { cookie }, validateStatus: () => true,
    }),
    axios.get(`https://pine-facade.tradingview.com/pine-facade/translate/${scriptId}/last`, {
      headers: { cookie }, validateStatus: () => true,
    }),
  ]);

  const source = getResp.status === 200 ? (getResp.data?.source || null) : null;
  const name = getResp.data?.scriptName || translateResp.data?.result?.metaInfo?.description || 'unknown';

  let il = null, ilTemplate = null, metaInfo = null;
  if (translateResp.status === 200 && translateResp.data?.success) {
    il = translateResp.data.result.IL || null;
    ilTemplate = translateResp.data.result.ilTemplate || null;
    metaInfo = {
      description: translateResp.data.result.metaInfo?.description,
      shortDescription: translateResp.data.result.metaInfo?.shortDescription,
      inputCount: translateResp.data.result.metaInfo?.inputs?.length || 0,
      plotCount: translateResp.data.result.metaInfo?.plots?.length || 0,
    };
  }

  return { scriptId, name, source, il, ilTemplate, metaInfo };
}

async function collectBuiltIns() {
  console.log('=== Collecting built-in indicators ===\n');

  const types = ['standard', 'candlestick', 'fundamental'];
  const allBuiltIns = [];

  for (const type of types) {
    const { data } = await axios.get('https://pine-facade.tradingview.com/pine-facade/list', {
      params: { filter: type },
    });
    console.log(`  ${type}: ${data.length} indicators`);
    allBuiltIns.push(...data);
  }

  console.log(`  Total built-in: ${allBuiltIns.length}\n`);
  return allBuiltIns;
}

async function collectPublicScripts(searchTerms) {
  console.log('=== Collecting public open-source scripts ===\n');
  const allResults = [];

  for (const term of searchTerms) {
    const { data } = await axios.get('https://www.tradingview.com/pubscripts-suggest-json', {
      params: { search: term },
      validateStatus: () => true,
    });
    const results = data.results || [];
    console.log(`  "${term}": ${results.length} results`);
    allResults.push(...results);
  }

  // Deduplicate by scriptIdPart
  const seen = new Set();
  const unique = allResults.filter(r => {
    if (seen.has(r.scriptIdPart)) return false;
    seen.add(r.scriptIdPart);
    return true;
  });

  console.log(`  Total unique public: ${unique.length}\n`);
  return unique;
}

async function main() {
  console.log('=== Pine Script IL Corpus Collector ===\n');

  // 1. Get all built-in indicators
  const builtIns = await collectBuiltIns();

  // 2. Get public open-source scripts via search
  const searchTerms = [
    'RSI', 'MACD', 'EMA', 'SMA', 'Bollinger', 'Stochastic', 'Volume',
    'ATR', 'ADX', 'CCI', 'Williams', 'Ichimoku', 'Fibonacci', 'VWAP',
    'Supertrend', 'Pivot', 'Moving Average', 'Momentum', 'Oscillator',
    'trend', 'scalping', 'swing', 'breakout', 'reversal', 'support',
    'resistance', 'channel', 'pattern', 'candle', 'divergence',
    'crossover', 'signal', 'alert', 'trailing stop', 'risk management',
  ];
  const publicScripts = await collectPublicScripts(searchTerms);

  // 3. Build the script ID list
  const scriptIds = [];

  // Add built-in IDs
  for (const bi of builtIns) {
    scriptIds.push({
      id: bi.scriptIdPart,
      type: 'builtin',
      name: bi.scriptName,
    });
  }

  // Add public open-source IDs
  for (const pub of publicScripts) {
    scriptIds.push({
      id: pub.scriptIdPart,
      type: pub.access === 1 ? 'open_source' : pub.access === 2 ? 'closed_source' : 'other',
      name: pub.scriptName,
    });
  }

  console.log(`Total scripts to fetch: ${scriptIds.length}\n`);

  // 4. Fetch source + IL for each, save to corpus
  let collected = 0;
  let withSource = 0;
  let withIL = 0;
  let withBoth = 0;
  let errors = 0;

  for (let i = 0; i < scriptIds.length; i++) {
    const { id, type, name } = scriptIds[i];
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(CORPUS_DIR, `${safeId}.json`);

    // Skip if already collected
    if (fs.existsSync(filePath)) {
      const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (existing.source) withSource++;
      if (existing.il) withIL++;
      if (existing.source && existing.il) withBoth++;
      collected++;
      continue;
    }

    try {
      const data = await fetchSourceAndIL(id);
      data.type = type;

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

      if (data.source) withSource++;
      if (data.il) withIL++;
      if (data.source && data.il) withBoth++;
      collected++;

      if ((i + 1) % 25 === 0) {
        console.log(`  Progress: ${i + 1}/${scriptIds.length} (${withBoth} with source+IL)`);
      }

      // Rate limit: 100ms between requests
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      errors++;
      if (errors < 5) console.error(`  Error for ${id}: ${err.message}`);
    }
  }

  console.log('\n=== Corpus Collection Complete ===');
  console.log(`  Total collected: ${collected}`);
  console.log(`  With source: ${withSource}`);
  console.log(`  With IL: ${withIL}`);
  console.log(`  With BOTH (source + IL): ${withBoth}`);
  console.log(`  Errors: ${errors}`);
}

main().catch(console.error);
