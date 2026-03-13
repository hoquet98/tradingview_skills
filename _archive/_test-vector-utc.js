/**
 * Test VECTOR with TZ=UTC to simulate Railway timezone.
 * Run: TZ=UTC node examples/_test-vector-utc.js
 */
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE = process.env.CLOUD_API_URL || 'http://localhost:3000';
const HMAC_SECRET = '5b499ac1b78863f45c6bdefafa01de9d1aba3346e2cfb17da5403f7bdfa207f6';

const cookiesPath = path.join(__dirname, '..', 'www.tradingview.com_cookies_QTP.json');
const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
const sessionid = cookies.find(c => c.name === 'sessionid')?.value;
const sessionid_sign = cookies.find(c => c.name === 'sessionid_sign')?.value || '';

function makeAuth() {
  const email = 'test@test.com';
  const memberId = 'mem_test123';
  const timestamp = Date.now();
  const message = `${email}|${memberId}|${timestamp}`;
  const signature = crypto.createHmac('sha256', HMAC_SECRET).update(message).digest('hex');
  return { email, memberId, timestamp, signature };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const defaultParams = [
  { name: '_Symbol', index: 'in_0', type: 'dropdown', currentValue: 'COMEX:GC1!' },
  { name: '_Timeframe', index: 'in_1', type: 'dropdown', currentValue: '1 minute' },
  { name: 'VECTOR Length', index: 'in_0', type: 'integer', currentValue: '20' },
  { name: 'DTFV Enable', index: 'in_1', type: 'checkbox', currentValue: false },
  { name: 'HTF Timeframe', index: 'in_2', type: 'dropdown', currentValue: '60' },
  { name: 'DTFV Mode', index: 'in_3', type: 'dropdown', currentValue: 'Standard' },
  { name: 'DTFV Neutral Zone (Ticks)', index: 'in_4', type: 'float', currentValue: '0' },
  { name: 'Pattern Mode', index: 'in_5', type: 'dropdown', currentValue: 'Expansion' },
  { name: 'Session Enable', index: 'in_6', type: 'checkbox', currentValue: false },
  { name: 'Timezone', index: 'in_7', type: 'dropdown', currentValue: 'America/New_York' },
  { name: 'Trading Hours', index: 'in_8', type: 'session', currentValue: '0930-1600' },
  { name: 'Exclude Enable', index: 'in_9', type: 'checkbox', currentValue: true },
  { name: 'Exclude Hours 1', index: 'in_10', type: 'session', currentValue: '1445-1800' },
  { name: 'Exclude 2 Enable', index: 'in_11', type: 'checkbox', currentValue: true },
  { name: 'Exclude Hours 2', index: 'in_12', type: 'session', currentValue: '0600-0630' },
  { name: 'EOD Close Enable', index: 'in_13', type: 'checkbox', currentValue: true },
  { name: 'EOD Hour', index: 'in_14', type: 'integer', currentValue: '15' },
  { name: 'EOD Minute', index: 'in_15', type: 'integer', currentValue: '50' },
  { name: 'Stop Ticks', index: 'in_16', type: 'integer', currentValue: '150' },
  { name: 'Target Ticks', index: 'in_17', type: 'integer', currentValue: '150' },
  { name: 'Trail Enable', index: 'in_18', type: 'checkbox', currentValue: true },
  { name: 'Trail Trigger', index: 'in_19', type: 'integer', currentValue: '110' },
  { name: 'Trail Offset', index: 'in_20', type: 'integer', currentValue: '10' },
  { name: 'BE Enable', index: 'in_21', type: 'checkbox', currentValue: true },
  { name: 'BE Trigger', index: 'in_22', type: 'integer', currentValue: '65' },
  { name: 'BE Offset', index: 'in_23', type: 'integer', currentValue: '15' },
  { name: 'Profit Lock Enable', index: 'in_24', type: 'checkbox', currentValue: false },
  { name: 'MFE Lock Threshold (Ticks)', index: 'in_25', type: 'integer', currentValue: '40' },
  { name: 'Min Profit Lock (Ticks)', index: 'in_26', type: 'integer', currentValue: '20' },
  { name: 'Profit Floor Enable', index: 'in_27', type: 'checkbox', currentValue: true },
  { name: 'Floor Trigger (Ticks)', index: 'in_28', type: 'integer', currentValue: '65' },
  { name: 'Floor Lock (Ticks)', index: 'in_29', type: 'integer', currentValue: '15' },
  { name: 'Adverse Regime Enable', index: 'in_30', type: 'checkbox', currentValue: true },
  { name: 'Activation Mode', index: 'in_31', type: 'dropdown', currentValue: 'VAR Only' },
  { name: 'Response Mode', index: 'in_32', type: 'dropdown', currentValue: 'Block Longs Only' },
  { name: 'VAR Threshold', index: 'in_33', type: 'float', currentValue: '1.4' },
  { name: 'DSI Threshold', index: 'in_34', type: 'float', currentValue: '0.65' },
  { name: 'DSI Lookback', index: 'in_35', type: 'integer', currentValue: '10' },
  { name: 'MAP Threshold', index: 'in_36', type: 'float', currentValue: '1.4' },
  { name: 'MAP Lookback', index: 'in_37', type: 'integer', currentValue: '10' },
  { name: 'Lockout Bars', index: 'in_38', type: 'integer', currentValue: '10' },
  { name: 'Allow Longs', index: 'in_39', type: 'checkbox', currentValue: true },
  { name: 'Allow Shorts', index: 'in_40', type: 'checkbox', currentValue: true },
  { name: 'Squeeze Filter Enable', index: 'in_41', type: 'checkbox', currentValue: true },
  { name: 'Daily Loss Cap Enable', index: 'in_42', type: 'checkbox', currentValue: true },
  { name: 'Daily Loss Cap (Ticks)', index: 'in_43', type: 'integer', currentValue: '150' },
  { name: 'Cross Enable', index: 'in_44', type: 'checkbox', currentValue: false },
  { name: 'Cross Priority', index: 'in_45', type: 'integer', currentValue: '65' },
  { name: 'Cross Min Penetration', index: 'in_46', type: 'float', currentValue: '1' },
  { name: 'Cross Max Penetration', index: 'in_47', type: 'float', currentValue: '46' },
  { name: 'Cross Bar Filter', index: 'in_48', type: 'checkbox', currentValue: false },
  { name: 'Cross Min Bar Ticks', index: 'in_49', type: 'float', currentValue: '4' },
  { name: 'Cross Body Filter', index: 'in_50', type: 'checkbox', currentValue: true },
  { name: 'Cross Min Body Ratio', index: 'in_51', type: 'float', currentValue: '0.5' },
  { name: 'Cross Close Filter', index: 'in_52', type: 'checkbox', currentValue: true },
  { name: 'Cross Close Strength', index: 'in_53', type: 'float', currentValue: '0.5' },
  { name: 'Cross Slope Filter', index: 'in_54', type: 'checkbox', currentValue: true },
  { name: 'Cross Min Slope Ticks', index: 'in_55', type: 'float', currentValue: '18' },
  { name: 'Bounce Enable', index: 'in_56', type: 'checkbox', currentValue: false },
  { name: 'Bounce Priority', index: 'in_57', type: 'integer', currentValue: '50' },
  { name: 'Bounce Touch Zone Ticks', index: 'in_58', type: 'float', currentValue: '2' },
  { name: 'Bounce Min Reversal Ticks', index: 'in_59', type: 'float', currentValue: '2' },
  { name: 'Bounce Bar Filter', index: 'in_60', type: 'checkbox', currentValue: false },
  { name: 'Bounce Min Bar Ticks', index: 'in_61', type: 'float', currentValue: '5' },
  { name: 'Bounce Close Filter', index: 'in_62', type: 'checkbox', currentValue: true },
  { name: 'Bounce Close Strength', index: 'in_63', type: 'float', currentValue: '0.9' },
  { name: 'Bounce Slope Filter', index: 'in_64', type: 'checkbox', currentValue: true },
  { name: 'Bounce Min Slope Ticks', index: 'in_65', type: 'float', currentValue: '18' },
  { name: 'Cont Enable', index: 'in_66', type: 'checkbox', currentValue: true },
  { name: 'Cont Priority', index: 'in_67', type: 'integer', currentValue: '85' },
  { name: 'Cont Window Bars', index: 'in_68', type: 'integer', currentValue: '18' },
  { name: 'Cont Min Distance Ticks', index: 'in_69', type: 'float', currentValue: '1' },
  { name: 'Cont Max Distance Ticks', index: 'in_70', type: 'float', currentValue: '20' },
  { name: 'Cont Slope Filter', index: 'in_71', type: 'checkbox', currentValue: true },
  { name: 'Cont Min Slope Ticks', index: 'in_72', type: 'float', currentValue: '14', isOptimized: true },
  { name: 'Default entry/order Qty Type', index: 'in_73', type: 'dropdown', currentValue: 'fixed' },
  { name: 'Default entry/order Qty Value', index: 'in_74', type: 'float', currentValue: '1' },
  { name: 'pyramiding', index: 'in_75', type: 'integer', currentValue: '0' },
  { name: 'Process orders on bar Close', index: 'in_76', type: 'checkbox', currentValue: false },
  { name: 'Calculate Strategy on every Tick(s)', index: 'in_77', type: 'checkbox', currentValue: true },
  { name: "Calculate Strategy on Order's Fill(s)", index: 'in_78', type: 'checkbox', currentValue: false },
  { name: 'Use Bar Magnifier', index: 'in_79', type: 'checkbox', currentValue: true },
  { name: 'Commission Type', index: 'in_80', type: 'dropdown', currentValue: 'cash_per_contract' },
  { name: 'Commission Value', index: 'in_81', type: 'float', currentValue: '5' },
  { name: 'Backtesting slippage for market orders', index: 'in_82', type: 'integer', currentValue: '0' },
  { name: 'Backtesting Limit Order(s) fill assumption', index: 'in_83', type: 'integer', currentValue: '0' },
  { name: 'Initial Capital', index: 'in_84', type: 'float', currentValue: '1000000' },
  { name: 'Base Currency', index: 'in_85', type: 'dropdown', currentValue: 'NONE' },
  { name: 'Close entries rule', index: 'in_86', type: 'dropdown', currentValue: 'FIFO' },
  { name: 'Margin Long', index: 'in_87', type: 'float', currentValue: '100' },
  { name: 'Margin Short', index: 'in_88', type: 'float', currentValue: '100' },
  { name: 'Fill orders using standard OHLC', index: 'in_90', type: 'checkbox', currentValue: false },
];

(async () => {
  console.log('=== VECTOR test with TZ=' + (process.env.TZ || 'local') + ' ===');

  // Show how dates parse in current TZ
  const parts = 'Jan 20, 2026 — Mar 6, 2026'.split('—').map(s => s.trim());
  const fromDate = new Date(parts[0]);
  const toDate = new Date(parts[1]);
  toDate.setHours(23, 59, 59);
  console.log('from:', fromDate.toISOString(), 'unix:', Math.floor(fromDate.getTime() / 1000));
  console.log('to:  ', toDate.toISOString(), 'unix:', Math.floor(toDate.getTime() / 1000));
  console.log('');

  const submitRes = await axios.post(`${API_BASE}/api/cloud/submit`, {
    auth: makeAuth(),
    strategyName: 'VECTOR Pattern Strategy',
    scriptId: 'USER;34ff38db513545229104a7d6b4ceecc5',
    instrument: 'COMEX:GC1!',
    timeframe: '1',
    tvCookies: { sessionid, sessionid_sign },
    isDeepBacktesting: true,
    dateRange: process.env.DATE_RANGE || 'Jan 20, 2026 — Mar 6, 2026',
    parameters: [{
      name: 'Cont Min Slope Ticks',
      dataType: 'float',
      defaultValue: '14',
      input: { mode: 'single', start: '14', end: '14', increment: '1' },
    }],
    defaultParams,
    totalCombinations: 1,
  });

  const jobId = submitRes.data.jobId;
  console.log('Job:', jobId);

  let done = false, nextIndex = 0;
  while (!done) {
    await sleep(2000);
    const pollRes = await axios.post(`${API_BASE}/api/cloud/poll`, {
      auth: makeAuth(), jobId, lastResultIndex: nextIndex,
    });
    const { status, results, nextIndex: ni, error } = pollRes.data;
    if (ni != null) nextIndex = ni;
    for (const r of results || []) {
      const p = r.performance || {};
      console.log(`Result: PnL=${p.netProfit}, Trades=${p.totalTrades}, WR=${p.winRate}%, PF=${p.profitFactor}, DD=${p.maxDrawdown}`);
    }
    if (['completed', 'stopped', 'error'].includes(status)) {
      done = true;
      if (error) console.log('Error:', error);
    }
  }
  try { await axios.post(`${API_BASE}/api/cloud/control`, { auth: makeAuth(), jobId, action: 'sync_complete' }); } catch (e) {}
})();
