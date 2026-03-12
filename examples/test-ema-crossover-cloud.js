/**
 * Test the Cloud Optimizer API on Railway.
 * EMA CROSSOVER SCALPER v1.0.0 on COINBASE:SOLUSD, 5min, 4 combos.
 * Sweeps Fast EMA Length (9-10) x Slow EMA Length (21-22).
 *
 * Uses QTP cookies (www.tradingview.com_cookies_QTP.json) since the
 * strategy belongs to that account.
 */
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE = process.env.CLOUD_API_URL || 'https://cloud-optimizer-production.up.railway.app';
const HMAC_SECRET = '5b499ac1b78863f45c6bdefafa01de9d1aba3346e2cfb17da5403f7bdfa207f6';

// Get TV cookies from QTP cookies file
const cookiesPath = path.join(__dirname, '..', 'www.tradingview.com_cookies_QTP.json');
const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
const sessionid = cookies.find(c => c.name === 'sessionid')?.value;
const sessionid_sign = cookies.find(c => c.name === 'sessionid_sign')?.value || '';

if (!sessionid) {
  console.error('No sessionid found in www.tradingview.com_cookies_QTP.json');
  process.exit(1);
}

function makeAuth() {
  const email = 'hoquet@yahoo.com';
  const memberId = 'mem_hoquet';
  const timestamp = Date.now();
  const message = `${email}|${memberId}|${timestamp}`;
  const signature = crypto.createHmac('sha256', HMAC_SECRET).update(message).digest('hex');
  return { email, memberId, timestamp, signature };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  try {
    console.log(`=== Cloud Optimizer API Test (${API_BASE}) ===\n`);
    const start = Date.now();

    // 1. Submit job — 4 combos: Fast EMA (9,10) x Slow EMA (21,22)
    console.log('Submitting job: EMA CROSSOVER SCALPER v1.0.0');
    console.log('  Symbol: COINBASE:SOLUSD, Timeframe: 5min');
    console.log('  Date Range: Dec 21, 2025 — Mar 1, 2026');
    console.log('  Params: Fast EMA 9-10, Slow EMA 21-22 (4 combos)\n');

    const submitRes = await axios.post(`${API_BASE}/api/cloud/submit`, {
      auth: makeAuth(),
      strategyName: 'EMA CROSSOVER SCALPER v1.0.0',
      scriptId: 'USER;a82eefb2c6334be68727d6957dc2c394',
      instrument: 'COINBASE:SOLUSD',
      timeframe: '5',
      dateRange: 'Dec 21, 2025 — Mar 1, 2026',
      isDeepBacktesting: false,
      tvCookies: { sessionid, sessionid_sign, email: 'hoquet@yahoo.com' },
      parameters: [
        {
          name: 'Fast EMA Length',
          dataType: 'integer',
          defaultValue: '9',
          input: { start: '9', end: '10', increment: '1', mode: 'single' },
        },
        {
          name: 'Slow EMA Length',
          dataType: 'integer',
          defaultValue: '21',
          input: { start: '21', end: '22', increment: '1', mode: 'single' },
        },
      ],
      totalCombinations: 4,
      defaultParams: [
        { name: '_Symbol', index: 'in_0', type: 'dropdown', currentValue: 'COINBASE:SOLUSD' },
        { name: '_Timeframe', index: 'in_1', type: 'dropdown', currentValue: '5 minutes' },
        { name: 'Session Enable', index: 'in_0', type: 'checkbox', currentValue: false },
        { name: 'Timezone', index: 'in_1', type: 'dropdown', currentValue: 'America/New_York' },
        { name: 'Trading Hours', index: 'in_2', type: 'session', currentValue: '0930-1600' },
        { name: 'Exclude 1 Enable', index: 'in_3', type: 'checkbox', currentValue: false },
        { name: 'Exclude Hours 1', index: 'in_4', type: 'session', currentValue: '1545-1800' },
        { name: 'Exclude 2 Enable', index: 'in_5', type: 'checkbox', currentValue: false },
        { name: 'Exclude Hours 2', index: 'in_6', type: 'session', currentValue: '0100-0400' },
        { name: 'Exclude 3 Enable', index: 'in_7', type: 'checkbox', currentValue: false },
        { name: 'Exclude Hours 3', index: 'in_8', type: 'session', currentValue: '1200-1300' },
        { name: 'CME Maintenance Window', index: 'in_9', type: 'checkbox', currentValue: true },
        { name: 'Day Filter Enable', index: 'in_10', type: 'checkbox', currentValue: false },
        { name: 'Sunday', index: 'in_11', type: 'checkbox', currentValue: true },
        { name: 'Monday', index: 'in_12', type: 'checkbox', currentValue: true },
        { name: 'Tuesday', index: 'in_13', type: 'checkbox', currentValue: true },
        { name: 'Wednesday', index: 'in_14', type: 'checkbox', currentValue: true },
        { name: 'Thursday', index: 'in_15', type: 'checkbox', currentValue: true },
        { name: 'Friday', index: 'in_16', type: 'checkbox', currentValue: true },
        { name: 'Saturday', index: 'in_17', type: 'checkbox', currentValue: false },
        { name: 'Stop Ticks', index: 'in_18', type: 'integer', currentValue: '100' },
        { name: 'Target Ticks', index: 'in_19', type: 'integer', currentValue: '150' },
        { name: 'Trail Enable', index: 'in_20', type: 'checkbox', currentValue: true },
        { name: 'Trail Trigger', index: 'in_21', type: 'integer', currentValue: '60' },
        { name: 'Trail Offset', index: 'in_22', type: 'integer', currentValue: '10' },
        { name: 'BE Enable', index: 'in_23', type: 'checkbox', currentValue: true },
        { name: 'BE Trigger', index: 'in_24', type: 'integer', currentValue: '40' },
        { name: 'BE Offset', index: 'in_25', type: 'integer', currentValue: '3' },
        { name: 'Max Bars Exit', index: 'in_26', type: 'checkbox', currentValue: false },
        { name: 'Max Bars in Trade', index: 'in_27', type: 'integer', currentValue: '60' },
        { name: 'Duration BE Enable', index: 'in_28', type: 'checkbox', currentValue: false },
        { name: 'Duration BE Bars', index: 'in_29', type: 'integer', currentValue: '10' },
        { name: 'Duration BE Offset', index: 'in_30', type: 'integer', currentValue: '3' },
        { name: 'Lockout Bars', index: 'in_31', type: 'integer', currentValue: '5' },
        { name: 'Allow Longs', index: 'in_32', type: 'checkbox', currentValue: true },
        { name: 'Allow Shorts', index: 'in_33', type: 'checkbox', currentValue: true },
        { name: 'Fast EMA Length', index: 'in_34', type: 'integer', currentValue: '9', isOptimized: true },
        { name: 'Slow EMA Length', index: 'in_35', type: 'integer', currentValue: '21', isOptimized: true },
        { name: 'Trend EMA Enable', index: 'in_36', type: 'checkbox', currentValue: false },
        { name: 'Trend EMA Length', index: 'in_37', type: 'integer', currentValue: '50' },
        { name: 'EMA Source', index: 'in_38', type: 'dropdown', currentValue: 'Close' },
        { name: 'EOD Close Enable', index: 'in_39', type: 'checkbox', currentValue: true },
        { name: 'EOD Hour', index: 'in_40', type: 'integer', currentValue: '15' },
        { name: 'EOD Minute', index: 'in_41', type: 'integer', currentValue: '50' },
      ],
    });

    if (!submitRes.data.success) {
      console.error('Submit failed:', submitRes.data);
      process.exit(1);
    }

    const jobId = submitRes.data.jobId;
    console.log(`Job created: ${jobId}\n`);

    // 2. Poll every 3s until complete
    let nextIndex = 0;
    let done = false;
    const printedIndices = new Set();

    while (!done) {
      await sleep(3000);

      const pollRes = await axios.post(`${API_BASE}/api/cloud/poll`, {
        auth: makeAuth(),
        jobId,
        lastResultIndex: nextIndex,
      });

      const { status, totalCombinations, currentIndex, results, bestMetrics, nextIndex: newNextIndex, error } = pollRes.data;

      // Print new results
      for (const r of results || []) {
        if (printedIndices.has(r.index)) continue;
        printedIndices.add(r.index);

        const p = r.performance || {};
        const combo = r.combination || {};
        const comboStr = Object.entries(combo).map(([k, v]) => `${k}=${v}`).join(', ');
        console.log(
          `[${r.index + 1}/${totalCombinations}] ${comboStr} | ` +
          `Trades: ${p.totalTrades || '?'} | ` +
          `P&L: ${p.netProfit || '?'} | ` +
          `WR: ${p.winRate || '?'} | ` +
          `PF: ${p.profitFactor || '?'} | ` +
          `DD: ${p.maxDrawdown || '?'}`
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

    // 3. Cleanup
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
