/**
 * Optimization sweep: Cont Window Bars × Cont Max Distance Ticks × Cont Min Slope Ticks
 * Regular backtest, range from chart (20000 bars), 1-min, COMEX:GC1!
 * 144 combinations, fire 6 concurrent charts, pause 2s between batches.
 */
const TradingView = require('../tradingview-api-reference/main');
const { applyParams } = require('../lib/params');

const SCRIPT = 'USER;34ff38db513545229104a7d6b4ceecc5';
const SYMBOL = 'COMEX:GC1!';
const SESSION = 'fz0yr0ific7wlzn67mxyfd9w8drwqtfq';
const SIGNATURE = 'v3:0jUqzLW/FX0HgyaDPE/CWa4vaVK3b3YEuBwabrduiQY=';

const USER_DEFAULTS = {
  'Pattern Mode': 'Expansion', 'Session Enable': false,
  'Timezone': 'America/New_York', 'Trading Hours': '0930-1600',
  'Exclude Enable': true, 'Exclude Hours 1': '1445-1800',
  'Exclude 2 Enable': true, 'Exclude Hours 2': '0600-0630',
  'EOD Close Enable': true, 'EOD Hour': 15, 'EOD Minute': 50,
  'Stop Ticks': 150, 'Target Ticks': 150,
  'Trail Enable': true, 'Trail Trigger': 110, 'Trail Offset': 10,
  'BE Enable': true, 'BE Trigger': 75, 'BE Offset': 15,
  'Profit Lock Enable': true, 'MFE Lock Threshold (Ticks)': 65, 'Min Profit Lock (Ticks)': 15,
  'Profit Floor Enable': true, 'Floor Trigger (Ticks)': 65, 'Floor Lock (Ticks)': 15,
  'Adverse Regime Enable': false, 'Activation Mode': 'VAR Only', 'Response Mode': 'Block Longs Only',
  'VAR Threshold': 1.4, 'DSI Threshold': 0.65, 'DSI Lookback': 10,
  'MAP Threshold': 1.4, 'MAP Lookback': 10, 'Lockout Bars': 10,
  'Allow Longs': true, 'Allow Shorts': true,
  'Squeeze Filter Enable': true, 'Daily Loss Cap Enable': true, 'Daily Loss Cap (Ticks)': 160,
  'Cross Enable': true, 'Cross Priority': 55, 'Cross Min Penetration': 1, 'Cross Max Penetration': 46,
  'Cross Bar Filter': false, 'Cross Min Bar Ticks': 4,
  'Cross Body Filter': true, 'Cross Min Body Ratio': 0.05,
  'Cross Close Filter': true, 'Cross Close Strength': 0.5,
  'Cross Slope Filter': true, 'Cross Min Slope Ticks': 19,
  'Bounce Enable': true, 'Bounce Priority': 40, 'Bounce Touch Zone Ticks': 2, 'Bounce Min Reversal Ticks': 2,
  'Bounce Bar Filter': false, 'Bounce Min Bar Ticks': 5,
  'Bounce Close Filter': true, 'Bounce Close Strength': 0.9,
  'Bounce Slope Filter': true, 'Bounce Min Slope Ticks': 26,
  'Cont Enable': true, 'Cont Priority': 80, 'Cont Window Bars': 16,
  'Cont Min Distance Ticks': 1, 'Cont Max Distance Ticks': 17,
  'Cont Slope Filter': true, 'Cont Min Slope Ticks': 17,
};

// Sweep ranges
const CONT_WINDOW_BARS = [10, 12, 14, 16, 18, 20];        // 6 values
const CONT_MAX_DISTANCE = [10, 13, 16, 19];                // 4 values
const CONT_MIN_SLOPE = [10, 12, 14, 16, 18, 20];           // 6 values

const BATCH_SIZE = 6;
const BATCH_PAUSE_MS = 2000;
const TIMEOUT_MS = 45000;

const PineIndicator = require('../tradingview-api-reference/src/classes/PineIndicator');

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
  console.log('=== Optimization: Cont Window Bars × Cont Max Distance × Cont Min Slope ===');
  console.log(`=== Regular backtest, 20000 bars, 1-min, COMEX:GC1! ===\n`);

  // Build all 144 combinations
  const combos = [];
  for (const wb of CONT_WINDOW_BARS) {
    for (const md of CONT_MAX_DISTANCE) {
      for (const ms of CONT_MIN_SLOPE) {
        combos.push({ 'Cont Window Bars': wb, 'Cont Max Distance Ticks': md, 'Cont Min Slope Ticks': ms });
      }
    }
  }
  console.log(`Total combinations: ${combos.length}\n`);

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

  // Process in batches of 6
  for (let i = 0; i < combos.length; i += BATCH_SIZE) {
    const batch = combos.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(combos.length / BATCH_SIZE);

    const promises = batch.map((combo, j) => {
      const idx = i + j;
      const label = `WB=${combo['Cont Window Bars']} MD=${combo['Cont Max Distance Ticks']} MS=${combo['Cont Min Slope Ticks']}`;
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
        `P&L: ${String(r.netProfit).padStart(8)} | WR: ${wr.padStart(6)} | PF: ${String(pf).padStart(7)} | DD: ${r.maxDD}` +
        (r.error ? ` | ERR: ${r.error}` : '')
      );
    }

    const elapsed = ((Date.now() - globalStart) / 1000).toFixed(0);
    console.log(`  --- Batch ${batchNum}/${totalBatches} done (${elapsed}s elapsed) ---\n`);

    // Pause between batches (skip after last)
    if (i + BATCH_SIZE < combos.length) {
      await sleep(BATCH_PAUSE_MS);
    }
  }

  // Summary
  const totalTime = ((Date.now() - globalStart) / 1000).toFixed(1);
  console.log(`\n=== COMPLETE: ${completed} combos in ${totalTime}s ===\n`);

  // Sort by net profit descending
  const sorted = results
    .filter(r => !r.error)
    .sort((a, b) => b.netProfit - a.netProfit);

  console.log('--- TOP 10 by Net Profit ---');
  for (let i = 0; i < Math.min(10, sorted.length); i++) {
    const r = sorted[i];
    const pf = typeof r.profitFactor === 'number' ? r.profitFactor.toFixed(3) : r.profitFactor;
    const wr = typeof r.winRate === 'number' ? (r.winRate * 100).toFixed(1) + '%' : r.winRate;
    console.log(
      `  #${i + 1} ${r.label.padEnd(22)} | Trades: ${String(r.trades).padStart(3)} | ` +
      `P&L: ${String(r.netProfit).padStart(8)} | WR: ${wr.padStart(6)} | PF: ${String(pf).padStart(7)} | DD: ${r.maxDD}`
    );
  }

  // Also print best by profit factor (min 5 trades)
  const sortedPF = results
    .filter(r => !r.error && r.trades >= 5)
    .sort((a, b) => (b.profitFactor || 0) - (a.profitFactor || 0));

  console.log('\n--- TOP 10 by Profit Factor (min 5 trades) ---');
  for (let i = 0; i < Math.min(10, sortedPF.length); i++) {
    const r = sortedPF[i];
    const pf = typeof r.profitFactor === 'number' ? r.profitFactor.toFixed(3) : r.profitFactor;
    const wr = typeof r.winRate === 'number' ? (r.winRate * 100).toFixed(1) + '%' : r.winRate;
    console.log(
      `  #${i + 1} ${r.label.padEnd(22)} | Trades: ${String(r.trades).padStart(3)} | ` +
      `P&L: ${String(r.netProfit).padStart(8)} | WR: ${wr.padStart(6)} | PF: ${String(pf).padStart(7)} | DD: ${r.maxDD}`
    );
  }

  // CSV output for easy comparison
  console.log('\n--- CSV (all results) ---');
  console.log('ContWindowBars,ContMaxDistance,ContMinSlope,Trades,NetProfit,NetProfitPct,WinRate,ProfitFactor,MaxDD,MaxDDPct');
  for (const r of results) {
    const combo = r.label.match(/WB=(\d+) MD=(\d+) MS=(\d+)/);
    if (combo) {
      const wr = typeof r.winRate === 'number' ? (r.winRate * 100).toFixed(2) : r.winRate;
      const pf = typeof r.profitFactor === 'number' ? r.profitFactor.toFixed(3) : r.profitFactor;
      console.log(`${combo[1]},${combo[2]},${combo[3]},${r.trades},${r.netProfit},${r.netProfitPct},${wr},${pf},${r.maxDD},${r.maxDDPct}`);
    }
  }

  client.end();
  process.exit(0);
})();
