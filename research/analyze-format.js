const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CORPUS_DIR = path.join(__dirname, 'corpus');

function parseIL(ilString) {
  const parts = ilString.split('_');
  const prefix = parts[0]; // bmI9Ks46
  const hash = parts[1];   // base64 hash (24 chars = 16 bytes)
  const body = parts.slice(2).join('_'); // base64 body (may contain _ chars)

  const hashBytes = Buffer.from(hash, 'base64');
  const bodyBytes = Buffer.from(body, 'base64');

  return { prefix, hash, hashBytes, body, bodyBytes };
}

function computeEntropy(buffer) {
  const freq = new Map();
  for (const b of buffer) freq.set(b, (freq.get(b) || 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / buffer.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function findRepeatedBlocks(buffer, blockSize) {
  const blocks = new Map();
  let repeated = 0;
  for (let i = 0; i <= buffer.length - blockSize; i += blockSize) {
    const block = buffer.slice(i, i + blockSize).toString('hex');
    blocks.set(block, (blocks.get(block) || 0) + 1);
  }
  for (const [block, count] of blocks) {
    if (count > 1) repeated += count - 1;
  }
  return { totalBlocks: Math.floor(buffer.length / blockSize), repeatedBlocks: repeated, uniqueBlocks: blocks.size };
}

function main() {
  console.log('=== Pine Script IL Format Analysis ===\n');

  // Load all corpus files
  const files = fs.readdirSync(CORPUS_DIR).filter(f => f.endsWith('.json'));
  console.log(`Loaded ${files.length} corpus files\n`);

  const entries = [];
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(CORPUS_DIR, file), 'utf8'));
    if (data.il && data.ilTemplate) {
      entries.push(data);
    }
  }
  console.log(`Entries with IL + ilTemplate: ${entries.length}`);
  const withSource = entries.filter(e => e.source);
  console.log(`Entries with source + IL: ${withSource.length}\n`);

  if (entries.length === 0) {
    console.log('No corpus data yet. Run collect-corpus.js first.');
    return;
  }

  // 1. Prefix analysis
  console.log('=== 1. Prefix Analysis ===\n');
  const prefixes = new Set();
  for (const e of entries) {
    const il = parseIL(e.il);
    const ilT = parseIL(e.ilTemplate);
    prefixes.add(il.prefix);
    prefixes.add(ilT.prefix);
  }
  console.log(`Unique prefixes: ${[...prefixes].join(', ')}`);

  // 2. Hash field analysis
  console.log('\n=== 2. Hash Field Analysis ===\n');
  let sameHash = 0, diffHash = 0;
  for (const e of entries) {
    const il = parseIL(e.il);
    const ilT = parseIL(e.ilTemplate);
    if (il.hash === ilT.hash) sameHash++;
    else diffHash++;
  }
  console.log(`IL hash === ilTemplate hash: ${sameHash} / ${entries.length}`);
  console.log(`IL hash !== ilTemplate hash: ${diffHash} / ${entries.length}`);

  // Check hash lengths
  const hashLengths = new Set();
  for (const e of entries) {
    hashLengths.add(parseIL(e.il).hashBytes.length);
    hashLengths.add(parseIL(e.ilTemplate).hashBytes.length);
  }
  console.log(`Hash byte lengths: ${[...hashLengths].join(', ')}`);

  // Check if hash is derived from source
  if (withSource.length > 0) {
    console.log('\nChecking if hash is derived from source code...');
    for (const e of withSource.slice(0, 5)) {
      const il = parseIL(e.il);
      const md5 = crypto.createHash('md5').update(e.source).digest('base64');
      const sha1 = crypto.createHash('sha1').update(e.source).digest('base64').substring(0, 24);
      const sha256 = crypto.createHash('sha256').update(e.source).digest('base64').substring(0, 24);
      console.log(`  ${e.name}:`);
      console.log(`    IL hash:    ${il.hash}`);
      console.log(`    MD5(src):   ${md5}`);
      console.log(`    SHA1(src):  ${sha1}`);
      console.log(`    SHA256(src): ${sha256}`);
      console.log(`    Match: ${il.hash === md5 ? 'MD5!' : il.hash === sha1 ? 'SHA1!' : il.hash === sha256 ? 'SHA256!' : 'NONE'}`);
    }
  }

  // 3. Body analysis
  console.log('\n=== 3. Body Size Analysis ===\n');
  const sizes = entries.map(e => ({
    name: e.name,
    sourceLen: e.source?.length || 0,
    ilBodyLen: parseIL(e.il).bodyBytes.length,
    ilTBodyLen: parseIL(e.ilTemplate).bodyBytes.length,
  }));

  // Check if IL and ilTemplate body sizes are same or different
  let sameSizeCount = 0;
  for (const s of sizes) {
    if (s.ilBodyLen === s.ilTBodyLen) sameSizeCount++;
  }
  console.log(`IL body size === ilTemplate body size: ${sameSizeCount} / ${sizes.length}`);

  // Size distribution
  if (withSource.length > 0) {
    console.log('\nSource vs IL body size (first 20 with source):');
    for (const s of sizes.filter(s => s.sourceLen > 0).slice(0, 20)) {
      const ratio = (s.ilBodyLen / s.sourceLen).toFixed(3);
      console.log(`  ${s.name.substring(0, 40).padEnd(40)} src:${String(s.sourceLen).padStart(6)} → il:${String(s.ilBodyLen).padStart(6)} ilT:${String(s.ilTBodyLen).padStart(6)} ratio:${ratio}`);
    }
  }

  // 4. Block size analysis (detect AES block mode)
  console.log('\n=== 4. Block Size Analysis (AES detection) ===\n');
  const blockMultipleOf16 = { il: 0, ilT: 0, total: 0 };
  for (const e of entries) {
    const il = parseIL(e.il);
    const ilT = parseIL(e.ilTemplate);
    blockMultipleOf16.total++;
    if (il.bodyBytes.length % 16 === 0) blockMultipleOf16.il++;
    if (ilT.bodyBytes.length % 16 === 0) blockMultipleOf16.ilT++;
  }
  console.log(`IL body length divisible by 16 (AES block): ${blockMultipleOf16.il} / ${blockMultipleOf16.total}`);
  console.log(`ilTemplate body length divisible by 16:     ${blockMultipleOf16.ilT} / ${blockMultipleOf16.total}`);

  // Check other block sizes
  for (const bs of [8, 12, 16, 32]) {
    let count = 0;
    for (const e of entries) {
      if (parseIL(e.il).bodyBytes.length % bs === 0) count++;
    }
    console.log(`  IL body % ${bs} === 0: ${count} / ${entries.length}`);
  }

  // 5. Entropy analysis
  console.log('\n=== 5. Entropy Analysis ===\n');
  const entropies = [];
  for (const e of entries.slice(0, 50)) {
    const il = parseIL(e.il);
    const ilT = parseIL(e.ilTemplate);
    const ilEntropy = computeEntropy(il.bodyBytes);
    const ilTEntropy = computeEntropy(ilT.bodyBytes);
    entropies.push({ name: e.name, il: ilEntropy, ilT: ilTEntropy, size: il.bodyBytes.length });
  }

  const avgIL = entropies.reduce((s, e) => s + e.il, 0) / entropies.length;
  const avgILT = entropies.reduce((s, e) => s + e.ilT, 0) / entropies.length;
  console.log(`Average IL entropy:         ${avgIL.toFixed(4)} bits/byte`);
  console.log(`Average ilTemplate entropy:  ${avgILT.toFixed(4)} bits/byte`);
  console.log(`(8.0 = perfectly random, <6 = structured)`);

  // 6. ECB mode detection (repeated 16-byte blocks)
  console.log('\n=== 6. ECB Mode Detection (repeated 16-byte blocks) ===\n');
  let scriptsWithRepeats = 0;
  for (const e of entries) {
    const il = parseIL(e.il);
    const result = findRepeatedBlocks(il.bodyBytes, 16);
    if (result.repeatedBlocks > 0) {
      scriptsWithRepeats++;
      if (scriptsWithRepeats <= 5) {
        console.log(`  ${e.name}: ${result.repeatedBlocks} repeated blocks out of ${result.totalBlocks}`);
      }
    }
  }
  console.log(`\nScripts with repeated 16-byte blocks: ${scriptsWithRepeats} / ${entries.length}`);
  console.log(scriptsWithRepeats > entries.length * 0.3 ? '→ Likely ECB mode (vulnerable!)' : '→ Likely CBC/CTR mode (no ECB patterns)');

  // 7. XOR analysis: compare IL vs ilTemplate
  console.log('\n=== 7. IL vs ilTemplate XOR Analysis ===\n');
  for (const e of entries.slice(0, 5)) {
    const il = parseIL(e.il);
    const ilT = parseIL(e.ilTemplate);
    const minLen = Math.min(il.bodyBytes.length, ilT.bodyBytes.length);

    // XOR first 64 bytes
    const xorBytes = Buffer.alloc(Math.min(64, minLen));
    for (let i = 0; i < xorBytes.length; i++) {
      xorBytes[i] = il.bodyBytes[i] ^ ilT.bodyBytes[i];
    }

    const xorEntropy = computeEntropy(xorBytes);
    const zeroCount = Array.from(xorBytes).filter(b => b === 0).length;

    console.log(`  ${e.name.substring(0, 40)}:`);
    console.log(`    IL size: ${il.bodyBytes.length}, ilT size: ${ilT.bodyBytes.length}`);
    console.log(`    XOR first 64 bytes entropy: ${xorEntropy.toFixed(4)}`);
    console.log(`    Zero bytes in XOR: ${zeroCount}/64`);
    console.log(`    XOR hex: ${xorBytes.slice(0, 32).toString('hex')}`);
  }
}

main();
