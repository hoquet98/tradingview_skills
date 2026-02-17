/**
 * DEMA ATR Strategy — Stop/Target Tick Sweep on NQ 1min
 *
 * Stop Ticks:  30–70 (step 5)  → 9 values
 * Target Ticks: 70–80 (step 5) → 3 values
 * Total: 27 combinations
 *
 * Usage: node backtest-dema-atr.js
 */
const { getClient, getCredentials, TradingView, close } = require('./lib/ws-client');
const { buildNameToIdMap, resolveParamIds } = require('./workflows/optimize-strategy');

const SCRIPT_ID = 'USER;141f0a3b0a9645ab9bee78dd7ec149af';
const SYMBOL = 'CME_MINI:NQ1!';
const TIMEFRAME = '1';
const RANGE = 5000; // bars of 1-min data

// Parameter ranges (using human-readable names — resolved to in_XX IDs at runtime)
const stopValues = [];
for (let s = 30; s <= 70; s += 5) stopValues.push(s);
const targetValues = [];
for (let t = 70; t <= 80; t += 5) targetValues.push(t);

async function runSingleBacktest(scriptId, symbol, timeframe, params, range) {
  const { session, signature } = getCredentials();
  const ind = await TradingView.getIndicator(scriptId, 'last', session, signature);
  ind.setType('StrategyScript@tv-scripting-101!');

  for (const [key, value] of Object.entries(params)) {
    ind.setOption(key, value);
  }

  const client = await getClient();

  return new Promise((resolve) => {
    const chart = new client.Session.Chart();
    let study;
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        chart.delete();
        resolve({ params, error: 'Timeout (60s — no trades)' });
      }
    }, 60000);

    chart.onError((...err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        chart.delete();
        resolve({ params, error: err.join(' ') });
      }
    });

    chart.onUpdate(() => {
      if (resolved || !study) return;
      const report = study.strategyReport;
      if (report && report.trades && report.trades.length > 0) {
        resolved = true;
        clearTimeout(timer);
        chart.delete();

        const perf = report.performance?.all || {};
        resolve({
          params,
          netProfit: perf.netProfit,
          totalTrades: perf.totalTrades,
          percentProfitable: perf.percentProfitable,
          profitFactor: perf.profitFactor,
          maxDrawdown: report.performance?.maxStrategyDrawDown,
          avgTrade: perf.avgTrade,
        });
      }
    });

    chart.setMarket(symbol, { timeframe, range });

    chart.onSymbolLoaded(() => {
      study = new chart.Study(ind);
      study.onError((...err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          chart.delete();
          resolve({ params, error: `Study error: ${err.join(' ')}` });
        }
      });
    });
  });
}

function fmt(val, decimals = 2) {
  if (val == null) return 'N/A';
  return typeof val === 'number' ? val.toFixed(decimals) : String(val);
}

async function main() {
  // Load indicator to build name→ID map
  const { session, signature } = getCredentials();
  const indicator = await TradingView.getIndicator(SCRIPT_ID, 'last', session, signature);
  const nameToId = buildNameToIdMap(indicator.inputs);

  // Resolve param names to IDs
  const stopId = nameToId['Stop Ticks'];
  const targetId = nameToId['Target Ticks'];
  if (!stopId || !targetId) {
    console.error('Could not resolve parameter names. Available params:');
    for (const [name, id] of Object.entries(nameToId)) {
      console.error(`  "${name}" → ${id}`);
    }
    process.exit(1);
  }

  // Generate combinations with resolved IDs
  const combos = [];
  for (const stop of stopValues) {
    for (const target of targetValues) {
      combos.push({ [stopId]: stop, [targetId]: target });
    }
  }

  console.log(`\nDEMA ATR Strategy — NQ 1min Backtest Sweep`);
  console.log(`Stop Ticks (${stopId}): ${stopValues.join(', ')}`);
  console.log(`Target Ticks (${targetId}): ${targetValues.join(', ')}`);
  console.log(`Total combinations: ${combos.length}\n`);
  console.log('─'.repeat(95));
  console.log(
    'Stop'.padStart(6) + '  ' +
    'Target'.padStart(6) + '  ' +
    'Net PnL'.padStart(12) + '  ' +
    'Max DD'.padStart(12) + '  ' +
    'Win%'.padStart(8) + '  ' +
    'PF'.padStart(6) + '  ' +
    'Trades'.padStart(6) + '  ' +
    'Avg Trade'.padStart(10) + '  ' +
    'Time'.padStart(8)
  );
  console.log('─'.repeat(95));

  const results = [];

  for (let i = 0; i < combos.length; i++) {
    const combo = combos[i];
    const startTime = Date.now();

    try {
      const result = await runSingleBacktest(SCRIPT_ID, SYMBOL, TIMEFRAME, combo, RANGE);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (result.error) {
        console.log(
          String(combo[stopId]).padStart(6) + '  ' +
          String(combo[targetId]).padStart(6) + '  ' +
          `ERROR: ${result.error}`.padStart(50) + '  ' +
          `${elapsed}s`.padStart(8)
        );
      } else {
        console.log(
          String(combo[stopId]).padStart(6) + '  ' +
          String(combo[targetId]).padStart(6) + '  ' +
          fmt(result.netProfit).padStart(12) + '  ' +
          fmt(result.maxDrawdown).padStart(12) + '  ' +
          (fmt(result.percentProfitable, 1) + '%').padStart(8) + '  ' +
          fmt(result.profitFactor).padStart(6) + '  ' +
          String(result.totalTrades || 0).padStart(6) + '  ' +
          fmt(result.avgTrade).padStart(10) + '  ' +
          `${elapsed}s`.padStart(8)
        );
        results.push({ ...result, elapsed: parseFloat(elapsed) });
      }
    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        String(combo[stopId]).padStart(6) + '  ' +
        String(combo[targetId]).padStart(6) + '  ' +
        `EXCEPTION: ${error.message}`.padStart(50) + '  ' +
        `${elapsed}s`.padStart(8)
      );
    }
  }

  console.log('─'.repeat(95));

  // Summary
  if (results.length > 0) {
    const avgTime = (results.reduce((s, r) => s + r.elapsed, 0) / results.length).toFixed(1);
    const best = [...results].sort((a, b) => (b.netProfit || 0) - (a.netProfit || 0))[0];
    const bestPF = [...results].sort((a, b) => (b.profitFactor || 0) - (a.profitFactor || 0))[0];

    console.log(`\nCompleted: ${results.length}/${combos.length} | Avg time per run: ${avgTime}s`);
    console.log(`\nBest by Net Profit: Stop=${best.params[stopId]} Target=${best.params[targetId]} → $${fmt(best.netProfit)} (PF ${fmt(best.profitFactor)}, ${fmt(best.percentProfitable, 1)}% win, DD $${fmt(best.maxDrawdown)})`);
    console.log(`Best by Profit Factor: Stop=${bestPF.params[stopId]} Target=${bestPF.params[targetId]} → PF ${fmt(bestPF.profitFactor)} ($${fmt(bestPF.netProfit)}, ${fmt(bestPF.percentProfitable, 1)}% win)`);
  }

  await close();
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
