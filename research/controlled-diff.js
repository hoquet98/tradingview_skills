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
const DIFF_DIR = path.join(__dirname, 'diffs');

if (!fs.existsSync(DIFF_DIR)) fs.mkdirSync(DIFF_DIR, { recursive: true });

function parseIL(ilString) {
  const parts = ilString.split('_');
  return {
    prefix: parts[0],
    hash: parts[1],
    hashBytes: Buffer.from(parts[1], 'base64'),
    bodyBytes: Buffer.from(parts.slice(2).join('_'), 'base64'),
  };
}

function computeEntropy(buffer) {
  if (buffer.length === 0) return 0;
  const freq = new Map();
  for (const b of buffer) freq.set(b, (freq.get(b) || 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / buffer.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function xorBuffers(a, b) {
  const len = Math.min(a.length, b.length);
  const result = Buffer.alloc(len);
  for (let i = 0; i < len; i++) result[i] = a[i] ^ b[i];
  return result;
}

function hammingDistance(a, b) {
  const len = Math.min(a.length, b.length);
  let bits = 0;
  for (let i = 0; i < len; i++) {
    let xor = a[i] ^ b[i];
    while (xor) { bits += xor & 1; xor >>= 1; }
  }
  return bits;
}

function countChangedBytes(a, b) {
  const len = Math.min(a.length, b.length);
  let changed = 0;
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) changed++;
  }
  return changed;
}

function findFirstDifference(a, b) {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return i;
  }
  return len < Math.max(a.length, b.length) ? len : -1;
}

function findAllDifferences(a, b) {
  const len = Math.min(a.length, b.length);
  const diffs = [];
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) diffs.push(i);
  }
  // Also count extra bytes if sizes differ
  if (a.length !== b.length) {
    for (let i = len; i < Math.max(a.length, b.length); i++) {
      diffs.push(i);
    }
  }
  return diffs;
}

function diffRegions(diffs) {
  if (diffs.length === 0) return [];
  const regions = [];
  let start = diffs[0], end = diffs[0];
  for (let i = 1; i < diffs.length; i++) {
    if (diffs[i] <= end + 4) { // gap of 3 or less = same region
      end = diffs[i];
    } else {
      regions.push({ start, end, length: end - start + 1 });
      start = diffs[i];
      end = diffs[i];
    }
  }
  regions.push({ start, end, length: end - start + 1 });
  return regions;
}

async function fetchScriptData(scriptId) {
  const [getResp, translateResp] = await Promise.all([
    axios.get(`https://pine-facade.tradingview.com/pine-facade/get/${scriptId}/last`, {
      headers: { cookie }, validateStatus: () => true,
    }),
    axios.get(`https://pine-facade.tradingview.com/pine-facade/translate/${scriptId}/last`, {
      headers: { cookie }, validateStatus: () => true,
    }),
  ]);

  return {
    source: getResp.data?.source || null,
    il: translateResp.data?.result?.ilTemplate || null,
    rawIL: translateResp.data?.result?.IL || null,
    name: getResp.data?.scriptName || translateResp.data?.result?.metaInfo?.description || 'unknown',
    inputs: translateResp.data?.result?.metaInfo?.inputs?.length || 0,
  };
}

async function fetchAllVersions(scriptId) {
  // Try to get version list
  const { data } = await axios.get(
    `https://pine-facade.tradingview.com/pine-facade/list/${scriptId}`,
    { headers: { cookie }, validateStatus: () => true }
  );
  return data;
}

// Compare two scripts side by side
function compareILs(nameA, ilA, nameB, ilB) {
  const a = parseIL(ilA);
  const b = parseIL(ilB);

  console.log(`\n--- "${nameA}" vs "${nameB}" ---`);
  console.log(`  Prefix: ${a.prefix} vs ${b.prefix} (${a.prefix === b.prefix ? 'SAME' : 'DIFF'})`);
  console.log(`  Hash: ${a.hash} vs ${b.hash} (${a.hash === b.hash ? 'SAME' : 'DIFF'})`);
  console.log(`  Body size: ${a.bodyBytes.length} vs ${b.bodyBytes.length} (delta: ${b.bodyBytes.length - a.bodyBytes.length})`);

  // Hash comparison
  const hashXor = xorBuffers(a.hashBytes, b.hashBytes);
  const hashHamming = hammingDistance(a.hashBytes, b.hashBytes);
  console.log(`  Hash XOR: ${hashXor.toString('hex')}`);
  console.log(`  Hash hamming distance: ${hashHamming} bits / ${a.hashBytes.length * 8} total (${(hashHamming / (a.hashBytes.length * 8) * 100).toFixed(1)}%)`);

  // Body comparison
  const bodyChanged = countChangedBytes(a.bodyBytes, b.bodyBytes);
  const bodyLen = Math.min(a.bodyBytes.length, b.bodyBytes.length);
  const bodyHamming = hammingDistance(a.bodyBytes, b.bodyBytes);
  console.log(`  Body bytes changed: ${bodyChanged} / ${bodyLen} (${(bodyChanged / bodyLen * 100).toFixed(1)}%)`);
  console.log(`  Body hamming distance: ${bodyHamming} bits / ${bodyLen * 8} (${(bodyHamming / (bodyLen * 8) * 100).toFixed(1)}%)`);

  // Find where changes are
  const diffs = findAllDifferences(a.bodyBytes, b.bodyBytes);
  const regions = diffRegions(diffs);

  if (bodyChanged < bodyLen) {
    console.log(`  First difference at byte: ${findFirstDifference(a.bodyBytes, b.bodyBytes)}`);
    console.log(`  Changed regions: ${regions.length}`);
    for (const r of regions.slice(0, 10)) {
      console.log(`    [${r.start}-${r.end}] (${r.length} bytes)`);
    }

    // XOR the bodies
    const xor = xorBuffers(a.bodyBytes, b.bodyBytes);
    console.log(`  XOR entropy: ${computeEntropy(xor).toFixed(4)}`);

    // Check if changes are localized or spread throughout
    const firstQuarter = diffs.filter(d => d < bodyLen / 4).length;
    const lastQuarter = diffs.filter(d => d >= bodyLen * 3 / 4).length;
    console.log(`  Changes in first quarter: ${firstQuarter}, last quarter: ${lastQuarter}`);
  } else {
    console.log(`  ALL bytes different → completely re-encrypted (new key/IV)`);

    // Even if all bytes differ, check hamming distance
    // If ~50% of bits differ, it's effectively random (new key)
    // If significantly less, there may be a relationship
    const expectedBits = bodyLen * 8 * 0.5;
    console.log(`  Expected random hamming: ${expectedBits.toFixed(0)}, actual: ${bodyHamming} (${(bodyHamming / expectedBits * 100).toFixed(1)}% of expected)`);
  }

  // Also compare IL (not ilTemplate)
  return { a, b, bodyChanged, bodyLen, regions };
}

// Also compare the raw IL field (not ilTemplate)
function compareRawILs(nameA, rawILA, nameB, rawILB) {
  if (!rawILA || !rawILB) return;
  const a = parseIL(rawILA);
  const b = parseIL(rawILB);

  console.log(`  [Raw IL] Hash same: ${a.hash === b.hash}, Body size: ${a.bodyBytes.length} vs ${b.bodyBytes.length}`);
  const bodyChanged = countChangedBytes(a.bodyBytes, b.bodyBytes);
  const bodyLen = Math.min(a.bodyBytes.length, b.bodyBytes.length);
  console.log(`  [Raw IL] Body bytes changed: ${bodyChanged} / ${bodyLen} (${(bodyChanged / bodyLen * 100).toFixed(1)}%)`);
}

async function main() {
  const mode = process.argv[2] || 'fetch';

  if (mode === 'fetch') {
    // === FETCH MODE: Collect scripts for comparison ===
    console.log('=== Controlled Differential Experiment — Fetch Mode ===\n');
    console.log('This will fetch your saved private scripts.\n');
    console.log('INSTRUCTIONS:');
    console.log('1. In TradingView Pine Editor, create and save these scripts:');
    console.log('   (Save each as a NEW script, not a new version)\n');

    const testScripts = [
      { name: 'diff_test_1', code: 'indicator("Test 1")\nplot(close)' },
      { name: 'diff_test_2', code: 'indicator("Test 2")\nplot(open)' },
      { name: 'diff_test_3', code: 'indicator("Test 3")\nplot(close + 1)' },
      { name: 'diff_test_4', code: 'indicator("Test 4")\nplot(close)\nplot(open)' },
      { name: 'diff_test_5', code: 'indicator("Test 5")\nplot(ta.sma(close, 14))' },
      { name: 'diff_test_6', code: 'indicator("Test 6")\nplot(ta.sma(close, 20))' },
      { name: 'diff_test_7', code: 'indicator("Test 7")\na = close\nplot(a)' },
      { name: 'diff_test_8', code: 'indicator("Test 8")\na = close\nb = open\nplot(a + b)' },
    ];

    console.log('Scripts to create:\n');
    for (const t of testScripts) {
      console.log(`--- ${t.name} ---`);
      console.log(t.code);
      console.log();
    }

    console.log('\nAfter creating them, run: node research/controlled-diff.js scan');
    console.log('This will find them in your private scripts and fetch their ILs.\n');

    // Also try listing current private scripts
    console.log('=== Your current private scripts ===\n');
    const { data: listData } = await axios.get(
      'https://pine-facade.tradingview.com/pine-facade/list?filter=saved',
      { headers: { cookie }, validateStatus: () => true }
    );

    if (Array.isArray(listData)) {
      for (const s of listData) {
        console.log(`  ${s.scriptIdPart} — ${s.scriptName} (v${s.version})`);
      }
    }

  } else if (mode === 'scan') {
    // === SCAN MODE: Find diff_test scripts and compare ===
    console.log('=== Scanning for diff_test scripts ===\n');

    const { data: listData } = await axios.get(
      'https://pine-facade.tradingview.com/pine-facade/list?filter=saved',
      { headers: { cookie }, validateStatus: () => true }
    );

    if (!Array.isArray(listData)) {
      console.log('Could not list scripts:', listData);
      return;
    }

    // Find any test scripts (look for ones named "Test" or "diff_test")
    const testScripts = listData.filter(s =>
      s.scriptName.toLowerCase().includes('test') ||
      s.scriptName.toLowerCase().includes('diff')
    );

    console.log(`Found ${testScripts.length} test scripts:\n`);

    const results = [];
    for (const s of testScripts) {
      const scriptId = `USER;${s.scriptIdPart}`;
      console.log(`Fetching ${s.scriptName} (${scriptId})...`);
      const data = await fetchScriptData(scriptId);
      results.push({
        id: scriptId,
        name: s.scriptName,
        version: s.version,
        ...data,
      });

      // Save to diffs dir
      fs.writeFileSync(
        path.join(DIFF_DIR, `${s.scriptName.replace(/[^a-zA-Z0-9]/g, '_')}.json`),
        JSON.stringify({ id: scriptId, ...data }, null, 2)
      );

      if (data.source) {
        console.log(`  Source: ${data.source.length} chars`);
        console.log(`  Source preview: ${data.source.substring(0, 80).replace(/\n/g, '\\n')}`);
      }
      if (data.il) {
        const il = parseIL(data.il);
        console.log(`  IL hash: ${il.hash}, body: ${il.bodyBytes.length} bytes`);
      }
      if (data.rawIL) {
        const rawIL = parseIL(data.rawIL);
        console.log(`  Raw IL hash: ${rawIL.hash}, body: ${rawIL.bodyBytes.length} bytes`);
      }
      console.log();

      await new Promise(r => setTimeout(r, 300));
    }

    // Now compare all pairs
    if (results.length >= 2) {
      console.log('\n=== Pairwise IL Comparisons ===\n');

      // Sort by name for consistent ordering
      results.sort((a, b) => a.name.localeCompare(b.name));

      // Compare consecutive pairs
      for (let i = 0; i < results.length - 1; i++) {
        const a = results[i], b = results[i + 1];
        if (a.il && b.il) {
          compareILs(a.name, a.il, b.name, b.il);
          compareRawILs(a.name, a.rawIL, b.name, b.rawIL);
        }
      }

      // Also compare first vs all others
      console.log('\n=== First script vs all others ===\n');
      const base = results[0];
      for (let i = 1; i < results.length; i++) {
        if (base.il && results[i].il) {
          compareILs(base.name, base.il, results[i].name, results[i].il);
        }
      }

      // === KEY TEST: Same script fetched twice — does IL change? ===
      console.log('\n=== Determinism check: re-fetch first script ===\n');
      const refetch = await fetchScriptData(results[0].id);
      if (refetch.il && results[0].il) {
        const match = refetch.il === results[0].il;
        console.log(`${results[0].name}: IL identical on re-fetch? ${match}`);
        if (!match) {
          compareILs(`${results[0].name} (fetch 1)`, results[0].il, `${results[0].name} (fetch 2)`, refetch.il);
        }
      }
    }

  } else if (mode === 'versions') {
    // === VERSION MODE: Compare versions of the same script ===
    console.log('=== Comparing versions of the same script ===\n');
    console.log('INSTRUCTIONS:');
    console.log('1. Create a script in Pine Editor: indicator("V1")\\nplot(close)');
    console.log('2. Save it');
    console.log('3. Change to: indicator("V1")\\nplot(open)');
    console.log('4. Save (creates version 2)');
    console.log('5. Run: node research/controlled-diff.js versions USER;{scriptIdPart}\n');

    const scriptId = process.argv[3];
    if (!scriptId) {
      console.log('Usage: node research/controlled-diff.js versions USER;{id}');
      return;
    }

    // Get version list
    const versions = await fetchAllVersions(scriptId);
    console.log('Version list response:', JSON.stringify(versions).substring(0, 500));

    // Try fetching specific versions
    console.log('\nFetching each version...\n');
    const versionData = [];
    for (let v = 1; v <= 20; v++) {
      try {
        const [getResp, translateResp] = await Promise.all([
          axios.get(`https://pine-facade.tradingview.com/pine-facade/get/${scriptId}/${v}`, {
            headers: { cookie }, validateStatus: () => true,
          }),
          axios.get(`https://pine-facade.tradingview.com/pine-facade/translate/${scriptId}/${v}`, {
            headers: { cookie }, validateStatus: () => true,
          }),
        ]);

        if (translateResp.status !== 200 || !translateResp.data?.success) {
          console.log(`  Version ${v}: not found`);
          break;
        }

        const source = getResp.data?.source || null;
        const il = translateResp.data?.result?.ilTemplate || null;
        const rawIL = translateResp.data?.result?.IL || null;

        console.log(`  Version ${v}: source=${source?.length || 0} chars, IL body=${il ? parseIL(il).bodyBytes.length : 0} bytes`);
        if (source) console.log(`    Source: ${source.substring(0, 100).replace(/\n/g, '\\n')}`);

        versionData.push({ version: v, source, il, rawIL });
      } catch (e) {
        console.log(`  Version ${v}: error — ${e.message}`);
        break;
      }
    }

    // Compare consecutive versions
    if (versionData.length >= 2) {
      console.log('\n=== Version-to-Version Comparisons ===\n');
      for (let i = 0; i < versionData.length - 1; i++) {
        const a = versionData[i], b = versionData[i + 1];
        if (a.il && b.il) {
          // Show source diff
          if (a.source && b.source) {
            console.log(`Source change v${a.version}→v${b.version}:`);
            console.log(`  v${a.version}: ${a.source.substring(0, 150).replace(/\n/g, '\\n')}`);
            console.log(`  v${b.version}: ${b.source.substring(0, 150).replace(/\n/g, '\\n')}`);
          }
          compareILs(`v${a.version}`, a.il, `v${b.version}`, b.il);
          compareRawILs(`v${a.version}`, a.rawIL, `v${b.version}`, b.rawIL);
        }
      }
    }

  } else if (mode === 'compare') {
    // === COMPARE MODE: Compare two specific script IDs ===
    const idA = process.argv[3];
    const idB = process.argv[4];
    if (!idA || !idB) {
      console.log('Usage: node research/controlled-diff.js compare SCRIPT_ID_A SCRIPT_ID_B');
      return;
    }

    console.log(`Fetching ${idA}...`);
    const a = await fetchScriptData(idA);
    console.log(`Fetching ${idB}...`);
    const b = await fetchScriptData(idB);

    if (a.il && b.il) {
      if (a.source) console.log(`A source: ${a.source.substring(0, 200).replace(/\n/g, '\\n')}`);
      if (b.source) console.log(`B source: ${b.source.substring(0, 200).replace(/\n/g, '\\n')}`);
      compareILs(a.name, a.il, b.name, b.il);
      compareRawILs(a.name, a.rawIL, b.name, b.rawIL);
    }
  }
}

main().catch(console.error);
