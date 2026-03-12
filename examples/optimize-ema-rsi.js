/**
 * Optimization sweep: Stop Ticks × Target Ticks × BE Trigger
 * EMA/RSI Scalper on CME_MINI:ES1!, regular backtest, 20000 bars, 1-min.
 * 765 combinations, fire 6 concurrent charts, pause 2s between batches.
 */
const TradingView = require('../tradingview-api-reference/main');
const { applyParams } = require('../lib/params');
const PineIndicator = require('../tradingview-api-reference/src/classes/PineIndicator');

const SCRIPT = 'USER;55a96183655d4abe90f6e9668847b083';
const SYMBOL = 'CME_MINI:ES1!';
const SESSION = 'fz0yr0ific7wlzn67mxyfd9w8drwqtfq';
const SIGNATURE = 'v3:0jUqzLW/FX0HgyaDPE/CWa4vaVK3b3YEuBwabrduiQY=';

const USER_DEFAULTS = {
  'Fast EMA Length': 13,
  'Medium EMA Length': 21,
  'Slow EMA Length': 40,
  'RSI Length': 33,
  'RSI Upper Level': 25,
  'RSI Lower Level': 52,
  'Use Volume Confirmation': false,
  'Volume SMA Lookback': 25,
  'Volume Threshold Multiplier': 0.9,
  'Stop Ticks': 210,
  'Target Ticks': 99,
  'Trail Enable': true,
  'Trail Trigger': 55,
  'Trail Offset': 55,
  'BE Enable': true,
  'BE Trigger': 58,
  'BE Offset': 6,
  'Exit on EMA Cross (Stack Break)': false,
  'Restrict to Trading Hours': false,
  'Session Start Hour (CT)': 8,
  'Session End Hour (CT)': 15,
  'Block Lunch Hour (CT)': false,
  'Lunch Start Hour': 11,
  'Lunch Start Minute': 30,
  'Lunch End Hour': 13,
  'Lunch End Minute': 0,
  'Exclude Window 1': false,
  'Window 1 Start Hour': 0,
  'Window 1 Start Minute': 0,
  'Window 1 End Hour': 0,
  'Window 1 End Minute': 0,
  'Exclude Window 2': false,
  'Window 2 Start Hour': 0,
  'Window 2 Start Minute': 0,
  'Window 2 End Hour': 0,
  'Window 2 End Minute': 0,
  'Exclude Window 3': false,
  'Window 3 Start Hour': 0,
  'Window 3 Start Minute': 0,
  'Window 3 End Hour': 0,
  'Window 3 End Minute': 0,
  'Sunday': false,
  'Monday': true,
  'Tuesday': true,
  'Wednesday': true,
  'Thursday': true,
  'Friday': true,
  'Use Higher TF Trend Filter': true,
  'Higher Timeframe': '15',
  'Enable CrossTrade Alerts': false,
};

// Sweep ranges
const STOP_TICKS = [];
for (let v = 80; v <= 240; v += 10) STOP_TICKS.push(v);   // 17 values
const TARGET_TICKS = [];
for (let v = 140; v <= 220; v += 20) TARGET_TICKS.push(v); // 5 values
const BE_TRIGGER = [];
for (let v = 25; v <= 65; v += 5) BE_TRIGGER.push(v);      // 9 values

const BATCH_SIZE = 6;
const BATCH_PAUSE_MS = 2000;
const TIMEOUT_MS = 45000;

function cloneIndicator(base, overrides) {
  const ind = new PineIndicator({
    pineId: base.pineId,
    pineVersion: base.pineVersion,
    description: base.description,
    shortDescription: base.shortDescription,
    inputs: JSON.parse(JSON.stringify(base.inputs)),
    plots: base.plots,
    script: base.script,
  });
  ind.setType('StrategyScript@tv-scripting-101!');
  applyParams(ind, { ...USER_DEFAULTS, ...overrides });
  return ind;
}

function runOne(client, indicator, label) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; try { chart.delete(); } catch(e) {} reject(new Error(`${label}: timeout`)); }
    }, TIMEOUT_MS);

    const chart = new client.Session.Chart();

    chart.onError((...err) => {
      if (!resolved) { resolved = true; clearTimeout(timeout); try { chart.delete(); } catch(e) {} reject(new Error(`${label}: chart error: ${err.join(' ')}`)); }
    });

    chart.setMarket(SYMBOL, { timeframe: '1', range: 20000 });

    chart.onSymbolLoaded(() => {
      const study = new chart.Study(indicator);

      study.onError((...err) => {
        if (!resolved) { resolved = true; clearTimeout(timeout); try { chart.delete(); } catch(e) {} reject(new Error(`${label}: study error: ${err.join(' ')}`)); }
      });

      study.onUpdate(() => {
        if (resolved) return;
        const report = study.strategyReport;
        if (report && report.performance && report.performance.all) {
          resolved = true;
          clearTimeout(timeout);
          try { chart.delete(); } catch(e) {}
          const elapsed = ((Date.now() - start) / 1000).toFixed(1);
          const p = report.performance.all;
          resolve({
            label,
            elapsed,
            trades: p.totalTrades,
            netProfit: p.netProfit,
            netProfitPct: p.netProfitPercent,
            winRate: p.percentProfitable,
            profitFactor: p.profitFactor,
            maxDD: report.performance.maxStrategyDrawDown,
            maxDDPct: report.performance.maxStrategyDrawDownPercent,
          });
        }
      });
    });
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('=== Optimization: Stop Ticks × Target Ticks × BE Trigger ===');
  console.log(`=== EMA/RSI Scalper, 20000 bars, 1-min, CME_MINI:ES1! ===\n`);

  // Build all combinations
  const combos = [];
  for (const st of STOP_TICKS) {
    for (const tt of TARGET_TICKS) {
      for (const be of BE_TRIGGER) {
        combos.push({ 'Stop Ticks': st, 'Target Ticks': tt, 'BE Trigger': be });
      }
    }
  }
  console.log(`Total combinations: ${combos.length}`);
  console.log(`Stop Ticks: ${STOP_TICKS.join(', ')} (${STOP_TICKS.length})`);
  console.log(`Target Ticks: ${TARGET_TICKS.join(', ')} (${TARGET_TICKS.length})`);
  console.log(`BE Trigger: ${BE_TRIGGER.join(', ')} (${BE_TRIGGER.length})\n`);

  // Fetch indicator once
  const base = await TradingView.getIndicator(SCRIPT, 'last', SESSION, SIGNATURE);
  console.log('Indicator fetched.');

  // Connect
  const client = new TradingView.Client({ token: SESSION, signature: SIGNATURE, server: 'prodata' });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Login timed out')), 10000);
    client.onLogged(() => { clearTimeout(timeout); resolve(); });
    client.onError((...err) => { clearTimeout(timeout); reject(new Error(err.join(' '))); });
  });
  console.log('Logged in to prodata server.\n');

  const results = [];
  const globalStart = Date.now();
  let completed = 0;

  for (let i = 0; i < combos.length; i += BATCH_SIZE) {
    const batch = combos.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(combos.length / BATCH_SIZE);

    const promises = batch.map((combo, j) => {
      const label = `ST=${combo['Stop Ticks']} TT=${combo['Target Ticks']} BE=${combo['BE Trigger']}`;
      const ind = cloneIndicator(base, combo);
      return runOne(client, ind, label).catch(err => ({
        label,
        elapsed: '?',
        trades: 0,
        netProfit: 0,
        netProfitPct: 0,
        winRate: 0,
        profitFactor: 0,
        maxDD: 0,
        maxDDPct: 0,
        error: err.message,
      }));
    });

    const batchResults = await Promise.all(promises);

    for (const r of batchResults) {
      completed++;
      results.push(r);
      const pf = typeof r.profitFactor === 'number' ? r.profitFactor.toFixed(3) : r.profitFactor;
      const wr = typeof r.winRate === 'number' ? (r.winRate * 100).toFixed(1) + '%' : r.winRate;
      console.log(
        `[${String(completed).padStart(3)}/${combos.length}] ${r.label.padEnd(22)} | ` +
        `${r.elapsed}s | Trades: ${String(r.trades).padStart(3)} | ` +
        `P&L: ${String(r.netProfit).padStart(10)} | WR: ${wr.padStart(6)} | PF: ${String(pf).padStart(7)} | DD: ${r.maxDD}` +
        (r.error ? ` | ERR: ${r.error}` : '')
      );
    }

    const elapsed = ((Date.now() - globalStart) / 1000).toFixed(0);
    process.stdout.write(`  --- Batch ${batchNum}/${totalBatches} (${elapsed}s) ---\r`);

    if (i + BATCH_SIZE < combos.length) {
      await sleep(BATCH_PAUSE_MS);
    }
  }

  const totalTime = ((Date.now() - globalStart) / 1000).toFixed(1);
  console.log(`\n\n=== COMPLETE: ${completed} combos in ${totalTime}s ===\n`);

  // Sort by net profit descending
  const sorted = results.filter(r => !r.error).sort((a, b) => b.netProfit - a.netProfit);

  console.log('--- TOP 20 by Net Profit ---');
  for (let i = 0; i < Math.min(20, sorted.length); i++) {
    const r = sorted[i];
    const pf = typeof r.profitFactor === 'number' ? r.profitFactor.toFixed(3) : r.profitFactor;
    const wr = typeof r.winRate === 'number' ? (r.winRate * 100).toFixed(1) + '%' : r.winRate;
    console.log(
      `  #${String(i + 1).padStart(2)} ${r.label.padEnd(22)} | Trades: ${String(r.trades).padStart(3)} | ` +
      `P&L: ${String(r.netProfit).padStart(10)} | WR: ${wr.padStart(6)} | PF: ${String(pf).padStart(7)} | DD: ${r.maxDD}`
    );
  }

  // CSV
  console.log('\n--- CSV ---');
  console.log('StopTicks,TargetTicks,BETrigger,Trades,NetProfit,NetProfitPct,WinRate,ProfitFactor,MaxDD,MaxDDPct');
  for (const r of results) {
    const m = r.label.match(/ST=(\d+) TT=(\d+) BE=(\d+)/);
    if (m) {
      const wr = typeof r.winRate === 'number' ? (r.winRate * 100).toFixed(2) : r.winRate;
      const pf = typeof r.profitFactor === 'number' ? r.profitFactor.toFixed(3) : r.profitFactor;
      console.log(`${m[1]},${m[2]},${m[3]},${r.trades},${r.netProfit},${r.netProfitPct},${wr},${pf},${r.maxDD},${r.maxDDPct}`);
    }
  }

  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    console.log(`\n--- ERRORS (${errors.length}) ---`);
    for (const r of errors) console.log(`  ${r.label}: ${r.error}`);
  }

  client.end();
  process.exit(0);
})();
