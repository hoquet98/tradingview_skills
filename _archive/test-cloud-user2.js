/**
 * Test the Cloud Optimizer API with user 2's cookies and VECTOR Pattern Strategy on GC1!.
 * Sweeps Stop Ticks 100-225 (6 combos) with full user defaults applied.
 * Uses the actual defaultParams format that the extension sends.
 */
const crypto = require('crypto');
const axios = require('axios');

const API_BASE = 'https://206719f8-e5c1-4d9e-a176-e3114dab4cda-00-58sb0p0xpu9.spock.replit.dev';
const HMAC_SECRET = '5b499ac1b78863f45c6bdefafa01de9d1aba3346e2cfb17da5403f7bdfa207f6';

// User 2 cookies
const sessionid = 'fz0yr0ific7wlzn67mxyfd9w8drwqtfq';
const sessionid_sign = 'v3:0jUqzLW/FX0HgyaDPE/CWa4vaVK3b3YEuBwabrduiQY=';

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
    console.log('=== Cloud Optimizer API Test — User 2, VECTOR Pattern Strategy on GC1! ===\n');
    const start = Date.now();

    console.log('Submitting job...');
    const submitRes = await axios.post(`${API_BASE}/api/cloud/submit`, {
      auth: makeAuth(),
      strategyName: 'VECTOR Pattern Strategy',
      scriptId: 'USER;34ff38db513545229104a7d6b4ceecc5',
      instrument: 'COMEX:GC1!',
      timeframe: '1',
      tvCookies: { sessionid, sessionid_sign },
      isDeepBacktesting: true,
      dateRange: '2026-01-23—2026-02-22',
      parameters: [
        {
          name: 'Stop Ticks',
          dataType: 'integer',
          defaultValue: 150,
          input: { mode: 'single', start: '100', end: '225', increment: '25' },
        },
      ],
      totalCombinations: 6,
      defaultParams: [
        { name: 'Pattern Mode', type: 'text', currentValue: 'Expansion', isOptimized: false, index: '0' },
        { name: 'Session Enable', type: 'bool', currentValue: false, isOptimized: false, index: '1' },
        { name: 'Timezone', type: 'text', currentValue: 'America/New_York', isOptimized: false, index: '2' },
        { name: 'Trading Hours', type: 'session', currentValue: '0930-1600', isOptimized: false, index: '3' },
        { name: 'Exclude Enable', type: 'bool', currentValue: true, isOptimized: false, index: '4' },
        { name: 'Exclude Hours 1', type: 'session', currentValue: '1445-1800', isOptimized: false, index: '5' },
        { name: 'Exclude 2 Enable', type: 'bool', currentValue: true, isOptimized: false, index: '6' },
        { name: 'Exclude Hours 2', type: 'session', currentValue: '0600-0630', isOptimized: false, index: '7' },
        { name: 'EOD Close Enable', type: 'bool', currentValue: true, isOptimized: false, index: '8' },
        { name: 'EOD Hour', type: 'integer', currentValue: 15, isOptimized: false, index: '9' },
        { name: 'EOD Minute', type: 'integer', currentValue: 50, isOptimized: false, index: '10' },
        { name: 'Stop Ticks', type: 'integer', currentValue: 150, isOptimized: true, index: '11' },
        { name: 'Target Ticks', type: 'integer', currentValue: 150, isOptimized: false, index: '12' },
        { name: 'Trail Enable', type: 'bool', currentValue: true, isOptimized: false, index: '13' },
        { name: 'Trail Trigger', type: 'integer', currentValue: 110, isOptimized: false, index: '14' },
        { name: 'Trail Offset', type: 'integer', currentValue: 10, isOptimized: false, index: '15' },
        { name: 'BE Enable', type: 'bool', currentValue: true, isOptimized: false, index: '16' },
        { name: 'BE Trigger', type: 'integer', currentValue: 75, isOptimized: false, index: '17' },
        { name: 'BE Offset', type: 'integer', currentValue: 15, isOptimized: false, index: '18' },
        { name: 'Profit Lock Enable', type: 'bool', currentValue: true, isOptimized: false, index: '19' },
        { name: 'MFE Lock Threshold (Ticks)', type: 'integer', currentValue: 65, isOptimized: false, index: '20' },
        { name: 'Min Profit Lock (Ticks)', type: 'integer', currentValue: 15, isOptimized: false, index: '21' },
        { name: 'Profit Floor Enable', type: 'bool', currentValue: true, isOptimized: false, index: '22' },
        { name: 'Floor Trigger (Ticks)', type: 'integer', currentValue: 65, isOptimized: false, index: '23' },
        { name: 'Floor Lock (Ticks)', type: 'integer', currentValue: 15, isOptimized: false, index: '24' },
        { name: 'Adverse Regime Enable', type: 'bool', currentValue: false, isOptimized: false, index: '25' },
        { name: 'Activation Mode', type: 'text', currentValue: 'VAR Only', isOptimized: false, index: '26' },
        { name: 'Response Mode', type: 'text', currentValue: 'Block Longs Only', isOptimized: false, index: '27' },
        { name: 'VAR Threshold', type: 'float', currentValue: 1.4, isOptimized: false, index: '28' },
        { name: 'DSI Threshold', type: 'float', currentValue: 0.65, isOptimized: false, index: '29' },
        { name: 'DSI Lookback', type: 'integer', currentValue: 10, isOptimized: false, index: '30' },
        { name: 'MAP Threshold', type: 'float', currentValue: 1.4, isOptimized: false, index: '31' },
        { name: 'MAP Lookback', type: 'integer', currentValue: 10, isOptimized: false, index: '32' },
        { name: 'Lockout Bars', type: 'integer', currentValue: 10, isOptimized: false, index: '33' },
        { name: 'Allow Longs', type: 'bool', currentValue: true, isOptimized: false, index: '34' },
        { name: 'Allow Shorts', type: 'bool', currentValue: true, isOptimized: false, index: '35' },
        { name: 'Squeeze Filter Enable', type: 'bool', currentValue: true, isOptimized: false, index: '36' },
        { name: 'Daily Loss Cap Enable', type: 'bool', currentValue: true, isOptimized: false, index: '37' },
        { name: 'Daily Loss Cap (Ticks)', type: 'integer', currentValue: 160, isOptimized: false, index: '38' },
        { name: 'Cross Enable', type: 'bool', currentValue: true, isOptimized: false, index: '39' },
        { name: 'Cross Priority', type: 'integer', currentValue: 55, isOptimized: false, index: '40' },
        { name: 'Cross Min Penetration', type: 'float', currentValue: 1, isOptimized: false, index: '41' },
        { name: 'Cross Max Penetration', type: 'float', currentValue: 46, isOptimized: false, index: '42' },
        { name: 'Cross Bar Filter', type: 'bool', currentValue: false, isOptimized: false, index: '43' },
        { name: 'Cross Min Bar Ticks', type: 'float', currentValue: 4, isOptimized: false, index: '44' },
        { name: 'Cross Body Filter', type: 'bool', currentValue: true, isOptimized: false, index: '45' },
        { name: 'Cross Min Body Ratio', type: 'float', currentValue: 0.05, isOptimized: false, index: '46' },
        { name: 'Cross Close Filter', type: 'bool', currentValue: true, isOptimized: false, index: '47' },
        { name: 'Cross Close Strength', type: 'float', currentValue: 0.5, isOptimized: false, index: '48' },
        { name: 'Cross Slope Filter', type: 'bool', currentValue: true, isOptimized: false, index: '49' },
        { name: 'Cross Min Slope Ticks', type: 'float', currentValue: 19, isOptimized: false, index: '50' },
        { name: 'Bounce Enable', type: 'bool', currentValue: true, isOptimized: false, index: '51' },
        { name: 'Bounce Priority', type: 'integer', currentValue: 40, isOptimized: false, index: '52' },
        { name: 'Bounce Touch Zone Ticks', type: 'float', currentValue: 2, isOptimized: false, index: '53' },
        { name: 'Bounce Min Reversal Ticks', type: 'float', currentValue: 2, isOptimized: false, index: '54' },
        { name: 'Bounce Bar Filter', type: 'bool', currentValue: false, isOptimized: false, index: '55' },
        { name: 'Bounce Min Bar Ticks', type: 'float', currentValue: 5, isOptimized: false, index: '56' },
        { name: 'Bounce Close Filter', type: 'bool', currentValue: true, isOptimized: false, index: '57' },
        { name: 'Bounce Close Strength', type: 'float', currentValue: 0.9, isOptimized: false, index: '58' },
        { name: 'Bounce Slope Filter', type: 'bool', currentValue: true, isOptimized: false, index: '59' },
        { name: 'Bounce Min Slope Ticks', type: 'float', currentValue: 26, isOptimized: false, index: '60' },
        { name: 'Cont Enable', type: 'bool', currentValue: true, isOptimized: false, index: '61' },
        { name: 'Cont Priority', type: 'integer', currentValue: 80, isOptimized: false, index: '62' },
        { name: 'Cont Window Bars', type: 'integer', currentValue: 16, isOptimized: false, index: '63' },
        { name: 'Cont Min Distance Ticks', type: 'float', currentValue: 1, isOptimized: false, index: '64' },
        { name: 'Cont Max Distance Ticks', type: 'float', currentValue: 17, isOptimized: false, index: '65' },
        { name: 'Cont Slope Filter', type: 'bool', currentValue: true, isOptimized: false, index: '66' },
        { name: 'Cont Min Slope Ticks', type: 'float', currentValue: 17, isOptimized: false, index: '67' },
      ],
    });

    const jobId = submitRes.data.jobId;
    console.log(`Job created: ${jobId}\n`);

    // Poll every 3s until complete
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

      for (const r of results || []) {
        if (printedIndices.has(r.index)) continue;
        printedIndices.add(r.index);

        const p = r.performance || {};
        const combo = r.combination || {};
        const comboStr = Object.entries(combo).map(([k, v]) => `${k}=${v}`).join(', ');
        console.log(
          `[${r.index + 1}/${totalCombinations}] ${comboStr} | ` +
          `Trades: ${p.totalTrades || p._totalTrades || '?'} | ` +
          `P&L: ${p.netProfit || p._netProfit || '?'} | ` +
          `WR: ${p.winRate || p._winRate || '?'} | ` +
          `PF: ${p.profitFactor || p._profitFactor || '?'} | ` +
          `DD: ${p.maxDrawdown || p._maxDrawdown || '?'}`
        );
      }

      if (newNextIndex != null) nextIndex = newNextIndex;

      if (results && results.length > 0) {
        console.log(`  Progress: ${currentIndex}/${totalCombinations} (${status})\n`);
      }

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

    // Cleanup
    try {
      await axios.post(`${API_BASE}/api/cloud/control`, {
        auth: makeAuth(),
        jobId,
        action: 'sync_complete',
      });
      console.log('\nJob data cleaned up.');
    } catch (e) {}
  } catch (e) {
    if (e.response) {
      console.error('API Error:', e.response.status, JSON.stringify(e.response.data).slice(0, 500));
    } else {
      console.error('Error:', e.message);
    }
    process.exit(1);
  }
})();
