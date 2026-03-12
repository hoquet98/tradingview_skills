/**
 * Example 6 (API version): EMA/RSI Scalper — same 36 combos via Cloud Optimizer API
 *
 * Submits the job to quanttradingpro.com and polls for results.
 * Compare timing with example6.js (local WS) to measure API overhead.
 *
 * Fast EMA:  5-8  step 1  (4 values)
 * Med EMA:   10, 20, 30   (3 values)
 * Slow EMA:  30, 40, 50   (3 values)
 * = 36 combos
 */
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE = process.env.CLOUD_API_URL || 'https://quanttradingpro.com';
const HMAC_SECRET = '5b499ac1b78863f45c6bdefafa01de9d1aba3346e2cfb17da5403f7bdfa207f6';
const POLL_INTERVAL = 2000;

// Get TV cookies from env or cookies file
let sessionid = process.env.TV_SESSION;
let sessionid_sign = process.env.TV_SIGNATURE;

if (!sessionid) {
  const cookiesPath = path.join(__dirname, '..', 'www.tradingview.com_cookies.json');
  if (fs.existsSync(cookiesPath)) {
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
    sessionid = cookies.find(c => c.name === 'sessionid')?.value;
    sessionid_sign = cookies.find(c => c.name === 'sessionid_sign')?.value || '';
  }
}

if (!sessionid) {
  console.error('No TV credentials found. Set TV_SESSION/TV_SIGNATURE env vars or provide cookies.json');
  process.exit(1);
}

function makeAuth() {
  const email = 'test@test.com';
  const memberId = 'mem_test123';
  const timestamp = Date.now();
  const message = `${email}|${memberId}|${timestamp}`;
  const signature = crypto.createHmac('sha256', HMAC_SECRET).update(message).digest('hex');
  return { email, memberId, timestamp, signature };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const totalStart = Date.now();

  try {
    console.log(`=== Example 6 — Cloud API (${API_BASE}) ===\n`);

    // --- Submit ---
    const submitStart = Date.now();
    console.log('Submitting 36-combo job...');

    const submitRes = await axios.post(`${API_BASE}/api/cloud/submit`, {
      auth: makeAuth(),
      strategyName: 'EMA/RSI Scalper',
      scriptId: 'USER;3f778e242a9b42d7992cd31da1320432',
      instrument: 'CME_MINI:ES1!',
      timeframe: '1',
      tvCookies: { sessionid, sessionid_sign },
      parameters: [
        {
          name: 'Fast EMA Length',
          dataType: 'integer',
          defaultValue: '8',
          input: { mode: 'single', start: '5', end: '8', increment: '1' },
        },
        {
          name: 'Medium EMA Length',
          dataType: 'integer',
          defaultValue: '21',
          input: { mode: 'specific', specificValues: ['10', '20', '30'] },
        },
        {
          name: 'Slow EMA Length',
          dataType: 'integer',
          defaultValue: '50',
          input: { mode: 'specific', specificValues: ['30', '40', '50'] },
        },
      ],
      totalCombinations: 36,
    });

    const jobId = submitRes.data.jobId;
    const submitElapsed = ((Date.now() - submitStart) / 1000).toFixed(2);
    console.log(`Job created: ${jobId} (submit took ${submitElapsed}s)\n`);

    // --- Poll ---
    let nextIndex = 0;
    let done = false;
    let printedIndices = new Set();
    let resultCount = 0;
    let firstResultTime = null;
    const resultTimes = []; // track when each result arrives

    while (!done) {
      await sleep(POLL_INTERVAL);

      const pollRes = await axios.post(`${API_BASE}/api/cloud/poll`, {
        auth: makeAuth(),
        jobId,
        lastResultIndex: nextIndex,
      });

      const { status, totalCombinations, currentIndex, results, bestMetrics, nextIndex: newNextIndex, error } = pollRes.data;

      for (const r of results || []) {
        if (printedIndices.has(r.index)) continue;
        printedIndices.add(r.index);
        resultCount++;

        const elapsed = ((Date.now() - totalStart) / 1000).toFixed(1);
        if (!firstResultTime) firstResultTime = parseFloat(elapsed);
        resultTimes.push(parseFloat(elapsed));

        const p = r.performance || {};
        const combo = r.combination || {};
        const comboStr = Object.entries(combo).map(([k, v]) => `${k}=${v}`).join(', ');

        console.log(
          `  [${String(resultCount).padStart(2)}/36] ${comboStr} | ` +
          `Trades: ${p.totalTrades || p._totalTrades || '?'} | ` +
          `P&L: ${p.netProfit || p._netProfit || '?'} | ` +
          `WR: ${p.winRate || p._winRate || '?'}${typeof p.winRate === 'string' ? '' : '%'} | ` +
          `PF: ${p.profitFactor || p._profitFactor || '?'} ` +
          `(+${elapsed}s)`
        );
      }

      if (newNextIndex != null) nextIndex = newNextIndex;

      if (['completed', 'stopped', 'error'].includes(status)) {
        done = true;
        if (error) console.log(`\nError: ${error}`);

        // Best metrics summary
        if (bestMetrics) {
          console.log('\n--- Best by Profit Factor ---');
          const pf = bestMetrics.profitFactor;
          if (pf) {
            const comboStr = Object.entries(pf.combination || {}).map(([k, v]) => `${k}=${v}`).join(', ');
            console.log(`  PF ${pf.value} — ${comboStr}`);
          }
          const pnl = bestMetrics.totalPnLAmount;
          if (pnl) {
            const comboStr = Object.entries(pnl.combination || {}).map(([k, v]) => `${k}=${v}`).join(', ');
            console.log(`  Best P&L: $${pnl.value} — ${comboStr}`);
          }
        }
      }
    }

    // --- Timing Summary ---
    const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);
    const lastResultTime = resultTimes.length > 0 ? resultTimes[resultTimes.length - 1] : 0;

    console.log(`\n=== Timing Summary ===`);
    console.log(`Submit:           ${submitElapsed}s`);
    console.log(`First result at:  ${firstResultTime}s`);
    console.log(`Last result at:   ${lastResultTime}s`);
    console.log(`Total wall time:  ${totalElapsed}s`);
    console.log(`Results:          ${resultCount}/36`);
    if (resultCount > 0) {
      console.log(`Throughput:       ${(resultCount / lastResultTime).toFixed(1)} combos/sec`);
    }
    console.log(`Poll interval:    ${POLL_INTERVAL / 1000}s`);

    // Cleanup
    try {
      await axios.post(`${API_BASE}/api/cloud/control`, {
        auth: makeAuth(),
        jobId,
        action: 'sync_complete',
      });
    } catch (e) { /* ignore cleanup errors */ }

  } catch (e) {
    if (e.response) {
      console.error('API Error:', e.response.status, JSON.stringify(e.response.data).slice(0, 500));
    } else {
      console.error('Error:', e.message);
    }
    process.exit(1);
  }
})();
