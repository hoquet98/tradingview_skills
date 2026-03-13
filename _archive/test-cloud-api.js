/**
 * Test the Cloud Optimizer API on Replit with a real 6-combo sweep.
 * Uses the EMA/RSI Scalper on ES1! 1-min, sweeping Fast EMA Length 5-10.
 */
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE = 'https://206719f8-e5c1-4d9e-a176-e3114dab4cda-00-58sb0p0xpu9.spock.replit.dev';
const HMAC_SECRET = '5b499ac1b78863f45c6bdefafa01de9d1aba3346e2cfb17da5403f7bdfa207f6';

// Get TV cookies from env or cookies.json
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
  console.error('No TV credentials found.');
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
  try {
    console.log('=== Cloud Optimizer API Test ===\n');
    const start = Date.now();

    // 1. Submit job — 6 combos: Fast EMA Length 5,6,7,8,9,10
    console.log('Submitting job...');
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
          defaultValue: 8,
          input: { mode: 'single', start: '5', end: '10', increment: '1' },
        },
      ],
      totalCombinations: 6,
    });

    const jobId = submitRes.data.jobId;
    console.log(`Job created: ${jobId}\n`);

    // 2. Poll every 3s until complete
    let nextIndex = 0;
    let done = false;
    let printedIndices = new Set();

    while (!done) {
      await sleep(3000);

      const pollRes = await axios.post(`${API_BASE}/api/cloud/poll`, {
        auth: makeAuth(),
        jobId,
        lastResultIndex: nextIndex,
      });

      const { status, totalCombinations, currentIndex, results, bestMetrics, nextIndex: newNextIndex, error } = pollRes.data;

      // Print new results — use display strings from performance
      for (const r of results || []) {
        if (printedIndices.has(r.index)) continue;
        printedIndices.add(r.index);

        const p = r.performance || {};
        const combo = r.combination || {};
        // Combo keys are in_X format; show all param values
        const comboStr = Object.entries(combo).map(([k, v]) => `${k}=${v}`).join(', ');
        console.log(
          `[${r.index + 1}/${totalCombinations}] ${comboStr} | ` +
          `Trades: ${p.totalTrades || p._totalTrades || '?'} | ` +
          `P&L: ${p.netProfit || p._netProfit || '?'} | ` +
          `WR: ${p.winRate || p._winRate || '?'}${typeof p.winRate === 'string' ? '' : '%'} | ` +
          `PF: ${p.profitFactor || p._profitFactor || '?'} | ` +
          `DD: ${p.maxDrawdown || p._maxDrawdown || '?'}`
        );
      }

      if (newNextIndex != null) nextIndex = newNextIndex;

      if (results && results.length > 0) {
        console.log(`  Progress: ${currentIndex}/${totalCombinations} (${status})\n`);
      }

      // Check terminal states
      if (['completed', 'stopped', 'error'].includes(status)) {
        done = true;
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`=== Job ${status} in ${elapsed}s ===`);
        if (error) console.log(`Error: ${error}`);

        // bestMetrics is per-metric: { totalPnLAmount: { value, combination, index }, ... }
        if (bestMetrics) {
          console.log('\n--- Best Metrics ---');
          const metricLabels = {
            totalPnLAmount: 'Net Profit ($)',
            totalPnLPercent: 'Net Profit (%)',
            maxDrawdownAmount: 'Max DD ($)',
            maxDrawdownPct: 'Max DD (%)',
            winRate: 'Win Rate',
            profitFactor: 'Profit Factor',
            totalTrades: 'Total Trades',
          };
          for (const [key, label] of Object.entries(metricLabels)) {
            const m = bestMetrics[key];
            if (!m) continue;
            const comboStr = Object.entries(m.combination || {}).map(([k, v]) => `${k}=${v}`).join(', ');
            console.log(`  ${label.padEnd(16)} ${String(m.value).padStart(10)}  (combo #${m.index + 1}: ${comboStr})`);
          }
        }
      }
    }

    // 3. Sync complete (cleanup)
    try {
      await axios.post(`${API_BASE}/api/cloud/control`, {
        auth: makeAuth(),
        jobId,
        action: 'sync_complete',
      });
      console.log('\nJob data cleaned up.');
    } catch (e) {
      // Don't fail on cleanup
    }
  } catch (e) {
    if (e.response) {
      console.error('API Error:', e.response.status, JSON.stringify(e.response.data).slice(0, 500));
    } else {
      console.error('Error:', e.message);
    }
    process.exit(1);
  }
})();
