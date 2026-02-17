const fs = require('fs');
const path = require('path');

const CORPUS_DIR = path.join(__dirname, 'corpus');

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

function isPrintable(byte) {
  return byte >= 0x20 && byte <= 0x7e;
}

function printableRatio(buffer) {
  let count = 0;
  for (const b of buffer) if (isPrintable(b)) count++;
  return count / buffer.length;
}

function main() {
  console.log('=== Differential Cryptanalysis ===\n');

  // Load all corpus entries with source + IL
  const files = fs.readdirSync(CORPUS_DIR).filter(f => f.endsWith('.json'));
  const entries = [];
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(CORPUS_DIR, file), 'utf8'));
    if (data.source && data.il && data.ilTemplate) {
      entries.push(data);
    }
  }
  console.log(`Entries with source + IL + ilTemplate: ${entries.length}\n`);

  // === Test 1: XOR IL with ilTemplate for same script ===
  console.log('=== Test 1: IL XOR ilTemplate (same script) ===\n');
  console.log('If stream cipher with same key but different IV:');
  console.log('  XOR = plaintext XOR (keystream1 XOR keystream2)\n');

  for (const e of entries.slice(0, 3)) {
    const il = parseIL(e.il);
    const ilT = parseIL(e.ilTemplate);
    const xor = xorBuffers(il.bodyBytes, ilT.bodyBytes);

    console.log(`${e.name}:`);
    console.log(`  Body size: ${il.bodyBytes.length}`);
    console.log(`  XOR entropy: ${computeEntropy(xor).toFixed(4)}`);
    console.log(`  XOR printable ratio: ${(printableRatio(xor) * 100).toFixed(1)}%`);
    console.log(`  XOR hex (first 64 bytes): ${xor.slice(0, 64).toString('hex')}`);
    console.log(`  XOR ascii attempt: ${xor.slice(0, 64).toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);
    console.log();
  }

  // === Test 2: XOR two different scripts' IL (same field) ===
  console.log('=== Test 2: Script A IL XOR Script B IL ===\n');
  console.log('If same key+IV for all scripts (unlikely but testing):');
  console.log('  XOR = plaintext_A XOR plaintext_B\n');

  // Find pairs of similar-sized scripts
  const sorted = [...entries].sort((a, b) => {
    const aSize = parseIL(a.il).bodyBytes.length;
    const bSize = parseIL(b.il).bodyBytes.length;
    return aSize - bSize;
  });

  for (let i = 0; i < Math.min(5, sorted.length - 1); i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const ilA = parseIL(a.il);
    const ilB = parseIL(b.il);
    const xor = xorBuffers(ilA.bodyBytes, ilB.bodyBytes);

    console.log(`"${a.name}" (${ilA.bodyBytes.length}b) XOR "${b.name}" (${ilB.bodyBytes.length}b):`);
    console.log(`  XOR length: ${xor.length}`);
    console.log(`  XOR entropy: ${computeEntropy(xor).toFixed(4)}`);
    console.log(`  XOR printable: ${(printableRatio(xor) * 100).toFixed(1)}%`);
    console.log(`  XOR ascii: ${xor.slice(0, 80).toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);
    console.log(`  Hashes same? ${ilA.hash === ilB.hash}`);
    console.log();
  }

  // === Test 3: Same-hash analysis ===
  console.log('=== Test 3: Scripts sharing the same hash ===\n');
  const hashMap = new Map();
  for (const e of entries) {
    const il = parseIL(e.il);
    if (!hashMap.has(il.hash)) hashMap.set(il.hash, []);
    hashMap.get(il.hash).push(e);
  }

  let sharedHashes = 0;
  for (const [hash, scripts] of hashMap) {
    if (scripts.length > 1) {
      sharedHashes++;
      console.log(`Hash ${hash} shared by ${scripts.length} scripts:`);
      for (const s of scripts) {
        console.log(`  - ${s.name} (${parseIL(s.il).bodyBytes.length} bytes)`);
      }

      // XOR these scripts — if same hash means same keystream, XOR = plaintext XOR
      if (scripts.length >= 2) {
        const xor = xorBuffers(
          parseIL(scripts[0].il).bodyBytes,
          parseIL(scripts[1].il).bodyBytes,
        );
        console.log(`  XOR entropy: ${computeEntropy(xor).toFixed(4)}`);
        console.log(`  XOR printable: ${(printableRatio(xor) * 100).toFixed(1)}%`);
        console.log(`  XOR ascii: ${xor.slice(0, 80).toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);
      }
      console.log();
    }
  }
  console.log(`Total hashes shared by 2+ scripts: ${sharedHashes}\n`);

  // === Test 4: Known plaintext — try to find the bytecode format ===
  console.log('=== Test 4: Looking for patterns in encrypted data ===\n');

  // If stream cipher: ciphertext = plaintext XOR keystream
  // For two scripts with same hash (same keystream):
  // C1 XOR C2 = P1 XOR P2
  // If we know P1 (source), we know P1 XOR P2, and if we can guess P2...

  // Let's look for common byte patterns in the encrypted IL
  // Group ILs by their hash (same hash = same keystream)
  console.log('Looking for structural patterns...\n');

  // Check if the first few bytes of IL body follow a pattern
  const firstBytes = new Map();
  for (const e of entries) {
    const il = parseIL(e.il);
    const first4 = il.bodyBytes.slice(0, 4).toString('hex');
    firstBytes.set(first4, (firstBytes.get(first4) || 0) + 1);
  }

  console.log('Most common first 4 bytes of IL body:');
  const sortedFirst = [...firstBytes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [hex, count] of sortedFirst) {
    console.log(`  ${hex}: ${count} times`);
  }

  // === Test 5: Check if hash is the IV for AES-CTR ===
  console.log('\n=== Test 5: Hash as IV — counter mode check ===\n');

  // In AES-CTR, if two scripts use different IVs (hashes) but same key,
  // XOR of first blocks = XOR of AES(key, IV1) XOR AES(key, IV2)
  // This should look random. But if hash IS the IV and key is global...

  // Take two scripts, XOR their IVs, then XOR their first block
  for (let i = 0; i < Math.min(3, entries.length - 1); i++) {
    const a = entries[i], b = entries[i + 1];
    const ilA = parseIL(a.il), ilB = parseIL(b.il);
    const ivXor = xorBuffers(ilA.hashBytes, ilB.hashBytes);
    const bodyXor = xorBuffers(ilA.bodyBytes.slice(0, 16), ilB.bodyBytes.slice(0, 16));

    console.log(`"${a.name}" vs "${b.name}":`);
    console.log(`  IV XOR:   ${ivXor.toString('hex')}`);
    console.log(`  Body XOR: ${bodyXor.toString('hex')}`);
    console.log(`  IV XOR === Body XOR: ${ivXor.toString('hex') === bodyXor.toString('hex')}`);
    console.log();
  }
}

main();
