/**
 * Deep Analysis of TradingView Pine Script IL Format
 *
 * Analyzes 73 scripts with both source and encrypted IL to find
 * information leakage and structural patterns in the IL encoding.
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// UTILITIES
// ============================================================

function parseIL(ilString) {
  const parts = ilString.split('_');
  return {
    prefix: parts[0],
    hash: parts[1],
    hashBytes: Buffer.from(parts[1], 'base64'),
    bodyBytes: Buffer.from(parts.slice(2).join('_'), 'base64'),
  };
}

function pearsonCorrelation(xs, ys) {
  const n = xs.length;
  if (n === 0) return 0;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return 0;
  return num / Math.sqrt(denX * denY);
}

function entropy(values) {
  // Shannon entropy of a collection of discrete values (in bits)
  const freq = {};
  for (const v of values) {
    freq[v] = (freq[v] || 0) + 1;
  }
  const n = values.length;
  let h = 0;
  for (const k of Object.keys(freq)) {
    const p = freq[k] / n;
    if (p > 0) h -= p * Math.log2(p);
  }
  return h;
}

function chiSquaredUniformity(counts, expected) {
  // Chi-squared test statistic for uniformity
  let chi2 = 0;
  for (const c of counts) {
    chi2 += (c - expected) ** 2 / expected;
  }
  return chi2;
}

function textHistogram(values, label, bins = 20) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const binWidth = range / bins;
  const histogram = new Array(bins).fill(0);
  for (const v of values) {
    let bin = Math.floor((v - min) / binWidth);
    if (bin >= bins) bin = bins - 1;
    histogram[bin]++;
  }
  const maxCount = Math.max(...histogram);
  const barScale = 50 / (maxCount || 1);

  console.log(`\n  ${label}`);
  console.log('  ' + '-'.repeat(70));
  for (let i = 0; i < bins; i++) {
    const lo = (min + i * binWidth).toFixed(0);
    const hi = (min + (i + 1) * binWidth).toFixed(0);
    const bar = '#'.repeat(Math.round(histogram[i] * barScale));
    console.log(`  ${lo.padStart(6)}-${hi.padStart(6)} | ${bar} (${histogram[i]})`);
  }
}

function textScatterPlot(xs, ys, xLabel, yLabel, width = 70, height = 25) {
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  // Create grid
  const grid = [];
  for (let r = 0; r < height; r++) {
    grid.push(new Array(width).fill(' '));
  }

  // Plot points
  for (let i = 0; i < xs.length; i++) {
    const col = Math.min(width - 1, Math.floor((xs[i] - xMin) / xRange * (width - 1)));
    const row = Math.min(height - 1, height - 1 - Math.floor((ys[i] - yMin) / yRange * (height - 1)));
    if (grid[row][col] === ' ') grid[row][col] = '*';
    else if (grid[row][col] === '*') grid[row][col] = '2';
    else if (!isNaN(grid[row][col])) grid[row][col] = String(Math.min(9, Number(grid[row][col]) + 1));
  }

  console.log(`\n  ${yLabel} vs ${xLabel}`);
  console.log('  ' + '-'.repeat(width + 8));
  for (let r = 0; r < height; r++) {
    const yVal = yMax - r * yRange / (height - 1);
    console.log(`  ${yVal.toFixed(0).padStart(6)}| ${grid[r].join('')}`);
  }
  console.log(`  ${' '.repeat(6)}+${'-'.repeat(width)}`);
  console.log(`  ${' '.repeat(7)}${xMin.toFixed(0).padStart(1)}${' '.repeat(width - String(xMax.toFixed(0)).length - 1)}${xMax.toFixed(0)}`);
  console.log(`  ${' '.repeat(7)}${xLabel}`);
}

// ============================================================
// LOAD DATA
// ============================================================

const corpusDir = path.join(__dirname, 'corpus');
const files = fs.readdirSync(corpusDir).filter(f => f.endsWith('.json'));

const scripts = [];
for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(corpusDir, f), 'utf8'));
  if (data.source && data.source.trim().length > 0 && data.il) {
    try {
      const parsed = parseIL(data.il);
      scripts.push({
        name: data.name || f,
        source: data.source,
        il: data.il,
        ...parsed,
      });
    } catch (e) {
      // skip malformed
    }
  }
}

console.log('=' .repeat(80));
console.log('  DEEP ANALYSIS OF TRADINGVIEW PINE SCRIPT IL FORMAT');
console.log('=' .repeat(80));
console.log(`\n  Scripts with source + IL: ${scripts.length}`);
console.log(`  Total corpus files: ${files.length}`);

// Also load ALL scripts (including those without source) for byte analysis
const allScripts = [];
for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(corpusDir, f), 'utf8'));
  if (data.il) {
    try {
      const parsed = parseIL(data.il);
      allScripts.push({
        name: data.name || f,
        il: data.il,
        ...parsed,
      });
    } catch (e) {}
  }
}
console.log(`  Scripts with IL (for byte analysis): ${allScripts.length}`);

// ============================================================
// ANALYSIS 1: Source-to-IL Size Correlation
// ============================================================

console.log('\n\n' + '='.repeat(80));
console.log('  ANALYSIS 1: SOURCE-TO-IL SIZE CORRELATION');
console.log('='.repeat(80));

const sourceLengths = scripts.map(s => s.source.length);
const bodyLengths = scripts.map(s => s.bodyBytes.length);
const sourceLines = scripts.map(s => s.source.split('\n').length);

const r_chars = pearsonCorrelation(sourceLengths, bodyLengths);
const r_lines = pearsonCorrelation(sourceLines, bodyLengths);

console.log(`\n  Pearson correlation (source chars vs IL body bytes): r = ${r_chars.toFixed(6)}`);
console.log(`  Pearson correlation (source lines vs IL body bytes):  r = ${r_lines.toFixed(6)}`);
console.log(`  R-squared (chars): ${(r_chars ** 2).toFixed(6)}`);
console.log(`  R-squared (lines): ${(r_lines ** 2).toFixed(6)}`);

// Linear regression: bodyLen = a * sourceLen + b
const n = scripts.length;
const meanSrc = sourceLengths.reduce((a, b) => a + b, 0) / n;
const meanBody = bodyLengths.reduce((a, b) => a + b, 0) / n;
let ssXY = 0, ssXX = 0;
for (let i = 0; i < n; i++) {
  ssXY += (sourceLengths[i] - meanSrc) * (bodyLengths[i] - meanBody);
  ssXX += (sourceLengths[i] - meanSrc) ** 2;
}
const slope = ssXY / ssXX;
const intercept = meanBody - slope * meanSrc;
console.log(`\n  Linear regression: IL_bytes = ${slope.toFixed(4)} * source_chars + ${intercept.toFixed(1)}`);
console.log(`  Average expansion ratio (IL bytes / source chars): ${(meanBody / meanSrc).toFixed(3)}`);

// Compute residuals
const residuals = scripts.map((s, i) => ({
  name: s.name,
  source: sourceLengths[i],
  body: bodyLengths[i],
  predicted: slope * sourceLengths[i] + intercept,
  residual: bodyLengths[i] - (slope * sourceLengths[i] + intercept),
}));
residuals.sort((a, b) => Math.abs(b.residual) - Math.abs(a.residual));

console.log(`\n  Top 10 outliers (largest residuals from linear fit):`);
for (let i = 0; i < Math.min(10, residuals.length); i++) {
  const r = residuals[i];
  console.log(`    ${r.name.padEnd(40)} src=${r.source.toString().padStart(5)} body=${r.body.toString().padStart(5)} pred=${r.predicted.toFixed(0).padStart(5)} resid=${r.residual.toFixed(0).padStart(6)}`);
}

textScatterPlot(sourceLengths, bodyLengths, 'Source chars', 'IL body bytes');

// Size ranges
console.log(`\n  Source size range: ${Math.min(...sourceLengths)} - ${Math.max(...sourceLengths)} chars`);
console.log(`  IL body size range: ${Math.min(...bodyLengths)} - ${Math.max(...bodyLengths)} bytes`);

textHistogram(bodyLengths, 'Distribution of IL Body Sizes (bytes)');

// ============================================================
// ANALYSIS 2: Feature Extraction & Correlation
// ============================================================

console.log('\n\n' + '='.repeat(80));
console.log('  ANALYSIS 2: SOURCE FEATURE EXTRACTION & IL SIZE CORRELATION');
console.log('='.repeat(80));

function countFeatures(source) {
  return {
    plotCalls: (source.match(/\bplot\s*\(/g) || []).length,
    inputCalls: (source.match(/\binput\.\w+\s*\(/g) || []).length,
    taCalls: (source.match(/\bta\.\w+\s*\(/g) || []).length,
    ifElseBlocks: (source.match(/\bif\b/g) || []).length + (source.match(/\belse\b/g) || []).length,
    loops: (source.match(/\bfor\b/g) || []).length + (source.match(/\bwhile\b/g) || []).length,
    varDeclarations: (source.match(/^\s*\w+\s*=/gm) || []).length,
    totalLines: source.split('\n').length,
    // Additional features
    functionDefs: (source.match(/\b\w+\s*\(.*\)\s*=>/g) || []).length + (source.match(/^\s*\w+\s*\([^)]*\)\s*$/gm) || []).length,
    stringLiterals: (source.match(/"[^"]*"/g) || []).length,
    mathCalls: (source.match(/\bmath\.\w+\s*\(/g) || []).length,
    colorRefs: (source.match(/\bcolor\.\w+/g) || []).length,
    arrayOps: (source.match(/\barray\.\w+\s*\(/g) || []).length,
  };
}

const featureData = scripts.map(s => ({
  name: s.name,
  bodyLen: s.bodyBytes.length,
  features: countFeatures(s.source),
}));

console.log('\n  Feature correlations with IL body size:');
console.log('  ' + '-'.repeat(55));

const featureNames = Object.keys(featureData[0].features);
const correlations = [];

for (const feat of featureNames) {
  const xs = featureData.map(d => d.features[feat]);
  const ys = featureData.map(d => d.bodyLen);
  const r = pearsonCorrelation(xs, ys);
  correlations.push({ feat, r });
}

correlations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

for (const { feat, r } of correlations) {
  const bar = '#'.repeat(Math.round(Math.abs(r) * 40));
  const sign = r >= 0 ? '+' : '-';
  console.log(`  ${feat.padEnd(20)} r=${r.toFixed(4).padStart(8)}  ${sign} ${bar}`);
}

// Show feature stats
console.log('\n  Feature summary statistics:');
console.log('  ' + '-'.repeat(70));
console.log('  ' + 'Feature'.padEnd(20) + 'Min'.padStart(6) + 'Max'.padStart(6) + 'Mean'.padStart(8) + 'Median'.padStart(8));
for (const feat of featureNames) {
  const vals = featureData.map(d => d.features[feat]).sort((a, b) => a - b);
  const min = vals[0];
  const max = vals[vals.length - 1];
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const median = vals[Math.floor(vals.length / 2)];
  console.log(`  ${feat.padEnd(20)}${min.toString().padStart(6)}${max.toString().padStart(6)}${mean.toFixed(1).padStart(8)}${median.toString().padStart(8)}`);
}

// Multi-feature combined model (sum of all features weighted)
console.log('\n  Multi-feature linear model (feature count * weight = IL byte contribution):');
// Simple: just show which combo of features sum to approximate body length
// Use a simple approach: for each script, total_features = sum of all feature counts
const totalFeatures = featureData.map(d => {
  let sum = 0;
  for (const f of featureNames) sum += d.features[f];
  return sum;
});
const r_total = pearsonCorrelation(totalFeatures, bodyLengths);
console.log(`  Total feature count vs IL body size: r = ${r_total.toFixed(4)}`);

// ============================================================
// ANALYSIS 3: IL Body Byte Frequency Analysis
// ============================================================

console.log('\n\n' + '='.repeat(80));
console.log('  ANALYSIS 3: IL BODY BYTE FREQUENCY ANALYSIS');
console.log('='.repeat(80));

// Aggregate across ALL scripts (not just ones with source)
{
  const globalFreq = new Array(256).fill(0);
  let totalBytes = 0;

  for (const s of allScripts) {
    for (const b of s.bodyBytes) {
      globalFreq[b]++;
      totalBytes++;
    }
  }

  const expected = totalBytes / 256;
  const chi2 = chiSquaredUniformity(globalFreq, expected);
  // Degrees of freedom = 255, critical value at p=0.05 is ~293
  const pApprox = chi2 > 293 ? '< 0.05 (NON-UNIFORM)' : '>= 0.05 (consistent with uniform)';

  console.log(`\n  Total IL body bytes analyzed: ${totalBytes} (across ${allScripts.length} scripts)`);
  console.log(`  Expected count per byte value (if uniform): ${expected.toFixed(1)}`);
  console.log(`  Chi-squared statistic: ${chi2.toFixed(2)} (df=255)`);
  console.log(`  Chi-squared critical value (p=0.05, df=255): ~293`);
  console.log(`  Result: p ${pApprox}`);

  // Find most and least frequent bytes
  const indexed = globalFreq.map((count, byte) => ({ byte, count, deviation: (count - expected) / expected }));
  indexed.sort((a, b) => b.count - a.count);

  console.log('\n  Top 10 most frequent byte values:');
  for (let i = 0; i < 10; i++) {
    const d = indexed[i];
    console.log(`    0x${d.byte.toString(16).padStart(2, '0')} (${d.byte.toString().padStart(3)}): ${d.count} occurrences (${(d.deviation * 100).toFixed(2)}% deviation from expected)`);
  }

  console.log('\n  Top 10 least frequent byte values:');
  for (let i = indexed.length - 10; i < indexed.length; i++) {
    const d = indexed[i];
    console.log(`    0x${d.byte.toString(16).padStart(2, '0')} (${d.byte.toString().padStart(3)}): ${d.count} occurrences (${(d.deviation * 100).toFixed(2)}% deviation from expected)`);
  }

  // Standard deviation of counts
  const meanCount = totalBytes / 256;
  let variance = 0;
  for (const c of globalFreq) variance += (c - meanCount) ** 2;
  variance /= 256;
  const stdDev = Math.sqrt(variance);
  const coeffVar = stdDev / meanCount;

  console.log(`\n  Standard deviation of byte counts: ${stdDev.toFixed(2)}`);
  console.log(`  Coefficient of variation: ${(coeffVar * 100).toFixed(4)}%`);
  console.log(`  Expected std dev if uniform (sqrt(n*p*(1-p))): ${Math.sqrt(totalBytes * (1/256) * (255/256)).toFixed(2)}`);

  // Byte frequency histogram (binned by frequency)
  const minFreq = Math.min(...globalFreq);
  const maxFreq = Math.max(...globalFreq);
  console.log(`\n  Byte frequency range: ${minFreq} - ${maxFreq}`);

  // Per-script analysis
  console.log('\n  Per-script byte frequency chi-squared test (sample of 10):');
  const sampleScripts = allScripts.slice(0, 10);
  for (const s of sampleScripts) {
    const freq = new Array(256).fill(0);
    for (const b of s.bodyBytes) freq[b]++;
    const exp = s.bodyBytes.length / 256;
    const chi = chiSquaredUniformity(freq, exp);
    const uniform = chi < 293 ? 'UNIFORM' : 'NON-UNIFORM';
    console.log(`    ${s.name.padEnd(40)} ${s.bodyBytes.length.toString().padStart(5)} bytes  chi2=${chi.toFixed(1).padStart(8)}  ${uniform}`);
  }
}

// ============================================================
// ANALYSIS 4: Cross-Script Byte Position Analysis
// ============================================================

console.log('\n\n' + '='.repeat(80));
console.log('  ANALYSIS 4: CROSS-SCRIPT BYTE POSITION ANALYSIS');
console.log('='.repeat(80));

{
  // For each position, collect the byte value from all scripts that are long enough
  const maxPos = 200;
  const minScriptsForPosition = 20; // Need at least 20 scripts at this position

  console.log(`\n  Analyzing positions 0-${maxPos - 1} across all ${allScripts.length} scripts`);
  console.log(`  (Only positions with >= ${minScriptsForPosition} scripts contributing)\n`);

  const positionEntropies = [];
  const positionChiSquared = [];
  const positionMostCommon = [];

  for (let pos = 0; pos < maxPos; pos++) {
    const values = [];
    for (const s of allScripts) {
      if (s.bodyBytes.length > pos) {
        values.push(s.bodyBytes[pos]);
      }
    }
    if (values.length >= minScriptsForPosition) {
      const freq = new Array(256).fill(0);
      for (const v of values) freq[v]++;
      const exp = values.length / 256;
      const chi2 = chiSquaredUniformity(freq, exp);
      const ent = entropy(values);

      // Find most common byte
      let maxCount = 0, maxByte = 0;
      for (let b = 0; b < 256; b++) {
        if (freq[b] > maxCount) { maxCount = freq[b]; maxByte = b; }
      }

      positionEntropies.push({ pos, entropy: ent, n: values.length });
      positionChiSquared.push({ pos, chi2, n: values.length });
      positionMostCommon.push({ pos, byte: maxByte, count: maxCount, total: values.length, pct: maxCount / values.length * 100 });
    }
  }

  // Check if any position has a dominant byte value (same keystream reuse)
  console.log('  Positions with highest byte concentration (potential keystream reuse):');
  positionMostCommon.sort((a, b) => b.pct - a.pct);
  for (let i = 0; i < Math.min(20, positionMostCommon.length); i++) {
    const p = positionMostCommon[i];
    console.log(`    Position ${p.pos.toString().padStart(3)}: byte 0x${p.byte.toString(16).padStart(2, '0')} appears ${p.count}/${p.total} times (${p.pct.toFixed(1)}%)`);
  }

  // Check if same byte repeats at same position
  // In a proper cipher, each position should have ~uniform distribution
  const lowEntropyPositions = positionEntropies.filter(p => p.entropy < 7.0).sort((a, b) => a.entropy - b.entropy);
  console.log(`\n  Positions with entropy < 7.0 bits (out of max 8.0):  ${lowEntropyPositions.length}`);
  if (lowEntropyPositions.length > 0) {
    console.log('  (Lower entropy = more predictable = more structure leaking)');
    for (const p of lowEntropyPositions.slice(0, 20)) {
      console.log(`    Position ${p.pos.toString().padStart(3)}: entropy = ${p.entropy.toFixed(4)} bits (${p.n} scripts)`);
    }
  }

  // Average entropy across positions
  const avgEntropy = positionEntropies.reduce((a, b) => a + b.entropy, 0) / positionEntropies.length;
  const expectedEntropy = Math.log2(allScripts.length); // max possible with N scripts
  console.log(`\n  Average entropy per position: ${avgEntropy.toFixed(4)} bits`);
  console.log(`  Maximum possible entropy (log2(${allScripts.length})): ${expectedEntropy.toFixed(4)} bits`);
  console.log(`  Theoretical max for 256 values: 8.0 bits`);

  // Compare first 10 positions vs last 10 positions
  const first10 = positionEntropies.slice(0, 10);
  const last10 = positionEntropies.slice(-10);
  console.log(`\n  Avg entropy of first 10 positions: ${(first10.reduce((a, b) => a + b.entropy, 0) / 10).toFixed(4)}`);
  console.log(`  Avg entropy of last 10 positions:  ${(last10.reduce((a, b) => a + b.entropy, 0) / 10).toFixed(4)}`);
}

// ============================================================
// ANALYSIS 5: Hash Relationship Analysis
// ============================================================

console.log('\n\n' + '='.repeat(80));
console.log('  ANALYSIS 5: HASH RELATIONSHIP ANALYSIS');
console.log('='.repeat(80));

{
  const hashes = allScripts.map(s => ({ name: s.name, hash: s.hash, bytes: s.hashBytes }));

  console.log(`\n  Total hashes analyzed: ${hashes.length}`);
  console.log(`  Hash size: ${hashes[0].bytes.length} bytes (decoded from base64)`);

  // Check for duplicate hashes
  const hashSet = new Set(hashes.map(h => h.hash));
  console.log(`  Unique hashes: ${hashSet.size} (duplicates: ${hashes.length - hashSet.size})`);

  if (hashes.length > hashSet.size) {
    // Find duplicates
    const counts = {};
    for (const h of hashes) {
      counts[h.hash] = (counts[h.hash] || 0) + 1;
    }
    console.log('\n  Duplicate hashes:');
    for (const [hash, count] of Object.entries(counts)) {
      if (count > 1) {
        const names = hashes.filter(h => h.hash === hash).map(h => h.name);
        console.log(`    ${hash}: ${count} scripts - ${names.slice(0, 5).join(', ')}${names.length > 5 ? '...' : ''}`);
      }
    }
  }

  // Check if hashes are sequential
  console.log('\n  First 10 hashes (hex):');
  for (let i = 0; i < Math.min(10, hashes.length); i++) {
    console.log(`    ${hashes[i].name.padEnd(35)} ${hashes[i].bytes.toString('hex')}`);
  }

  // Sort hashes numerically (as big integers) and check for patterns
  const sortedHashes = [...hashes].sort((a, b) => Buffer.compare(a.bytes, b.bytes));
  console.log('\n  First 10 hashes sorted numerically:');
  for (let i = 0; i < Math.min(10, sortedHashes.length); i++) {
    console.log(`    ${sortedHashes[i].bytes.toString('hex')} - ${sortedHashes[i].name}`);
  }

  // XOR consecutive sorted hashes and look for patterns
  console.log('\n  XOR of consecutive sorted hashes (first 10):');
  for (let i = 0; i < Math.min(10, sortedHashes.length - 1); i++) {
    const xor = Buffer.alloc(sortedHashes[i].bytes.length);
    for (let j = 0; j < xor.length; j++) {
      xor[j] = sortedHashes[i].bytes[j] ^ sortedHashes[i + 1].bytes[j];
    }
    console.log(`    ${xor.toString('hex')}`);
  }

  // Check byte distribution within hashes
  const hashByteFreq = new Array(256).fill(0);
  let totalHashBytes = 0;
  for (const h of hashes) {
    for (const b of h.bytes) {
      hashByteFreq[b]++;
      totalHashBytes++;
    }
  }
  const hashExpected = totalHashBytes / 256;
  const hashChi2 = chiSquaredUniformity(hashByteFreq, hashExpected);
  console.log(`\n  Hash byte frequency analysis:`);
  console.log(`    Total hash bytes: ${totalHashBytes}`);
  console.log(`    Chi-squared: ${hashChi2.toFixed(2)} (expected ~255 for uniform, df=255)`);

  // Check if hash bytes appear at specific positions in the body
  console.log('\n  Hash-body byte overlap analysis:');
  let totalOverlaps = 0;
  let totalChecked = 0;
  const overlapByPosition = new Array(Math.min(50, hashes[0].bytes.length)).fill(0);

  for (const s of allScripts) {
    const hashLen = s.hashBytes.length;
    const bodyLen = s.bodyBytes.length;
    // Check if hash bytes match body bytes at various positions
    for (let offset = 0; offset < Math.min(bodyLen, 200); offset++) {
      for (let h = 0; h < hashLen && offset + h < bodyLen; h++) {
        totalChecked++;
        if (s.hashBytes[h] === s.bodyBytes[offset + h]) {
          totalOverlaps++;
        }
      }
    }
    // Check specifically: does XOR of hash with first N body bytes reveal a pattern?
  }
  const expectedOverlapRate = 1 / 256;
  const actualOverlapRate = totalOverlaps / totalChecked;
  console.log(`    Expected random byte match rate: ${(expectedOverlapRate * 100).toFixed(3)}%`);
  console.log(`    Actual hash-body byte match rate: ${(actualOverlapRate * 100).toFixed(3)}%`);
  console.log(`    ${Math.abs(actualOverlapRate - expectedOverlapRate) < 0.002 ? 'Consistent with random (no direct hash->body relationship)' : 'ANOMALOUS - potential relationship'}`);

  // XOR hash with first 12 bytes of body for each script, look for common result
  console.log('\n  XOR(hash, first 12 body bytes) for first 10 scripts:');
  for (let i = 0; i < Math.min(10, allScripts.length); i++) {
    const s = allScripts[i];
    const len = Math.min(s.hashBytes.length, s.bodyBytes.length, 12);
    const xor = Buffer.alloc(len);
    for (let j = 0; j < len; j++) {
      xor[j] = s.hashBytes[j] ^ s.bodyBytes[j];
    }
    console.log(`    ${s.name.padEnd(35)} ${xor.toString('hex')}`);
  }

  // Check if any XOR result matches across scripts
  const xorResults = allScripts.map(s => {
    const len = Math.min(s.hashBytes.length, s.bodyBytes.length);
    const xor = Buffer.alloc(len);
    for (let j = 0; j < len; j++) xor[j] = s.hashBytes[j] ^ s.bodyBytes[j];
    return xor.toString('hex');
  });
  const xorSet = new Set(xorResults);
  console.log(`\n  Unique XOR(hash, body_prefix) results: ${xorSet.size} / ${xorResults.length}`);
  if (xorSet.size < xorResults.length) {
    console.log('  DUPLICATE XOR results found! This means hash is related to body content.');
  }

  // Entropy of each byte position within the hash
  console.log('\n  Entropy of each byte position within hash:');
  const hashByteLen = hashes[0].bytes.length;
  for (let pos = 0; pos < hashByteLen; pos++) {
    const vals = hashes.map(h => h.bytes[pos]);
    const ent = entropy(vals);
    const bar = '#'.repeat(Math.round(ent * 5));
    console.log(`    Position ${pos.toString().padStart(2)}: entropy = ${ent.toFixed(4)} bits  ${bar}`);
  }
}

// ============================================================
// ANALYSIS 6: Entropy by Position (Across Scripts)
// ============================================================

console.log('\n\n' + '='.repeat(80));
console.log('  ANALYSIS 6: ENTROPY BY BYTE POSITION ACROSS SCRIPTS');
console.log('='.repeat(80));

{
  const maxPos = 200;
  const entropies = [];
  const scriptCounts = [];

  for (let pos = 0; pos < maxPos; pos++) {
    const values = [];
    for (const s of allScripts) {
      if (s.bodyBytes.length > pos) {
        values.push(s.bodyBytes[pos]);
      }
    }
    if (values.length >= 10) {
      entropies.push(entropy(values));
      scriptCounts.push(values.length);
    } else {
      entropies.push(null);
      scriptCounts.push(values.length);
    }
  }

  // Text-based entropy plot
  console.log(`\n  Entropy at each byte position (first ${maxPos} positions)`);
  console.log('  8.0 = perfectly random, lower = more structure\n');

  // Compact display: 10 positions per line
  for (let row = 0; row < maxPos; row += 10) {
    let line1 = `  ${row.toString().padStart(3)}-${(row + 9).toString().padStart(3)}: `;
    for (let col = 0; col < 10 && row + col < maxPos; col++) {
      const pos = row + col;
      if (entropies[pos] !== null) {
        line1 += entropies[pos].toFixed(2).padStart(6);
      } else {
        line1 += '   N/A';
      }
    }
    console.log(line1);
  }

  // Statistics
  const validEntropies = entropies.filter(e => e !== null);
  const avgEnt = validEntropies.reduce((a, b) => a + b, 0) / validEntropies.length;
  const minEnt = Math.min(...validEntropies);
  const maxEnt = Math.max(...validEntropies);
  const minEntPos = entropies.indexOf(minEnt);
  const maxEntPos = entropies.indexOf(maxEnt);

  console.log(`\n  Average entropy: ${avgEnt.toFixed(4)} bits`);
  console.log(`  Min entropy: ${minEnt.toFixed(4)} bits at position ${minEntPos}`);
  console.log(`  Max entropy: ${maxEnt.toFixed(4)} bits at position ${maxEntPos}`);
  console.log(`  Std deviation: ${Math.sqrt(validEntropies.reduce((a, e) => a + (e - avgEnt) ** 2, 0) / validEntropies.length).toFixed(4)} bits`);

  // Find positions where entropy deviates significantly from average
  const entStd = Math.sqrt(validEntropies.reduce((a, e) => a + (e - avgEnt) ** 2, 0) / validEntropies.length);
  const anomalous = [];
  for (let pos = 0; pos < maxPos; pos++) {
    if (entropies[pos] !== null && Math.abs(entropies[pos] - avgEnt) > 2 * entStd) {
      anomalous.push({ pos, entropy: entropies[pos], deviation: (entropies[pos] - avgEnt) / entStd });
    }
  }

  if (anomalous.length > 0) {
    console.log(`\n  Anomalous positions (> 2 std devs from mean):`);
    anomalous.sort((a, b) => a.entropy - b.entropy);
    for (const a of anomalous) {
      console.log(`    Position ${a.pos.toString().padStart(3)}: entropy = ${a.entropy.toFixed(4)} (${a.deviation.toFixed(2)} std devs)`);
    }
  } else {
    console.log('\n  No anomalous positions detected (all within 2 std devs)');
  }

  // Compare entropy of different regions
  const regions = [
    { name: 'Positions 0-19', start: 0, end: 20 },
    { name: 'Positions 20-49', start: 20, end: 50 },
    { name: 'Positions 50-99', start: 50, end: 100 },
    { name: 'Positions 100-149', start: 100, end: 150 },
    { name: 'Positions 150-199', start: 150, end: 200 },
  ];

  console.log('\n  Entropy by region:');
  for (const region of regions) {
    const regionEnts = validEntropies.slice(region.start, region.end);
    if (regionEnts.length > 0) {
      const avg = regionEnts.reduce((a, b) => a + b, 0) / regionEnts.length;
      console.log(`    ${region.name.padEnd(25)} avg entropy = ${avg.toFixed(4)} bits`);
    }
  }

  // Visual entropy map (text sparkline style)
  console.log('\n  Visual entropy map (each char = one position, darker = lower entropy):');
  const chars = ' .:-=+*#%@';
  let sparkline = '  ';
  for (let pos = 0; pos < maxPos; pos++) {
    if (entropies[pos] !== null) {
      // Map entropy 0-8 to char index 9-0 (inverted: high entropy = light)
      const idx = Math.max(0, Math.min(chars.length - 1, Math.floor((1 - entropies[pos] / 8) * chars.length)));
      sparkline += chars[idx];
    } else {
      sparkline += '?';
    }
  }
  console.log(sparkline);
  console.log('  ' + '|'.padEnd(1) + '0'.padEnd(49) + '50'.padEnd(48) + '100'.padEnd(48) + '150'.padEnd(3) + '200');
}

// ============================================================
// SUMMARY
// ============================================================

console.log('\n\n' + '='.repeat(80));
console.log('  SUMMARY OF FINDINGS');
console.log('='.repeat(80));

console.log(`
  1. SIZE CORRELATION: r = ${r_chars.toFixed(4)} between source chars and IL body bytes.
     ${Math.abs(r_chars) > 0.8 ? 'STRONG correlation - IL size directly leaks information about source complexity.' :
       Math.abs(r_chars) > 0.5 ? 'MODERATE correlation - IL size partially reveals source complexity.' :
       'WEAK correlation - IL size does not strongly predict source size.'}
     Linear model: IL_bytes ~ ${slope.toFixed(2)} * source_chars + ${intercept.toFixed(0)}

  2. FEATURE CORRELATIONS: The strongest predictors of IL size are:
     ${correlations.slice(0, 3).map(c => `${c.feat} (r=${c.r.toFixed(3)})`).join(', ')}
     ${correlations[0].r > 0.7 ? 'Feature counts can predict IL size, revealing source structure.' : 'Feature counts are moderate predictors.'}

  3. BYTE FREQUENCY: The IL body bytes are ${
    (() => {
      const gf = new Array(256).fill(0);
      let tb = 0;
      for (const s of allScripts) { for (const b of s.bodyBytes) { gf[b]++; tb++; } }
      const exp = tb / 256;
      const chi2 = chiSquaredUniformity(gf, exp);
      return chi2 < 293 ? 'consistent with UNIFORM distribution (good encryption).' :
        'NOT uniformly distributed (potential encryption weakness).';
    })()
  }

  4. CROSS-SCRIPT POSITION: Position-wise entropy analysis reveals ${
    (() => {
      let lowCount = 0;
      for (let pos = 0; pos < 200; pos++) {
        const values = [];
        for (const s of allScripts) { if (s.bodyBytes.length > pos) values.push(s.bodyBytes[pos]); }
        if (values.length >= 10 && entropy(values) < 7.0) lowCount++;
      }
      return lowCount > 0 ? `${lowCount} positions with entropy < 7.0 bits - STRUCTURE IS LEAKING.` :
        'all positions have high entropy - encryption appears strong at byte level.';
    })()
  }

  5. HASH ANALYSIS: ${
    (() => {
      const hs = new Set(allScripts.map(s => s.hash));
      return hs.size < allScripts.length ?
        'Duplicate hashes found - same key may be used for multiple scripts.' :
        `All ${hs.size} hashes are unique per script. No duplicates. XOR(hash, body) is unique per script.`;
    })()
  }

  6. POSITIONAL ENTROPY: ${
    (() => {
      const ents = [];
      for (let pos = 0; pos < 200; pos++) {
        const values = [];
        for (const s of allScripts) { if (s.bodyBytes.length > pos) values.push(s.bodyBytes[pos]); }
        if (values.length >= 10) ents.push(entropy(values));
      }
      const avg = ents.reduce((a, b) => a + b, 0) / ents.length;
      const std = Math.sqrt(ents.reduce((a, e) => a + (e - avg) ** 2, 0) / ents.length);
      return std < 0.1 ? 'Entropy is very uniform across positions - well-encrypted.' :
        `Entropy varies across positions (std=${std.toFixed(3)}) - position-dependent structure exists.`;
    })()
  }
`);

console.log('='.repeat(80));
console.log('  Analysis complete.');
console.log('='.repeat(80));
