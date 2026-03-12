/**
 * Compare API trades vs user's CSV side by side for Zero Lag Pattern Strategy.
 */
const fs = require('fs');
const { fetchStrategyReport, getClient, close } = require('../lib/ws-client');

const SCRIPT = 'USER;f3f18d701c0a4c62b4296ec92e8acff4';
const SYMBOL = 'COMEX:GC1!';

const params = {
  'ZLEMA Length': 12, 'ZLEMA Source': 'close', 'Pattern Mode': 'Expansion',
  'Session Enable': false, 'Timezone': 'America/New_York', 'Trading Hours': '0930-1600',
  'Exclude Enable': true, 'Exclude Hours 1': '1545-1800', 'Exclude 2 Enable': false,
  'Exclude Hours 2': '0500-0700', 'EOD Close Enable': true, 'EOD Hour': 15, 'EOD Minute': 50,
  'Stop Ticks': 250, 'Target Ticks': 150, 'Trail Enable': true, 'Trail Trigger': 95,
  'Trail Offset': 1, 'BE Enable': true, 'BE Trigger': 45, 'BE Offset': 3,
  'Profit Lock Enable': true, 'MFE Lock Threshold (Ticks)': 40, 'Min Profit Lock (Ticks)': 20,
  'Profit Floor Enable': true, 'Floor Trigger (Ticks)': 40, 'Floor Lock (Ticks)': 10,
  'Adverse Regime Enable': false, 'Activation Mode': 'Any Two', 'Response Mode': 'Block All',
  'VAR Threshold': 1.4, 'DSI Threshold': 0.65, 'DSI Lookback': 10, 'MAP Threshold': 1.4,
  'MAP Lookback': 10, 'Lockout Bars': 10, 'Allow Longs': true, 'Allow Shorts': true,
  'Squeeze Filter Enable': false, 'Daily Loss Cap Enable': true, 'Daily Loss Cap (Ticks)': 140,
  'Cross Enable': true, 'Cross Priority': 50, 'Cross Min Penetration': 10,
  'Cross Max Penetration': 37.5, 'Cross Bar Filter': true, 'Cross Min Bar Ticks': 4,
  'Cross Body Filter': false, 'Cross Min Body Ratio': 0.3, 'Cross Close Filter': false,
  'Cross Close Strength': 0.6, 'Cross Slope Filter': true, 'Cross Min Slope Ticks': 24,
  'Bounce Enable': true, 'Bounce Priority': 65, 'Bounce Touch Zone Ticks': 2.5,
  'Bounce Min Reversal Ticks': 15, 'Bounce Bar Filter': false, 'Bounce Min Bar Ticks': 5,
  'Bounce Close Filter': false, 'Bounce Close Strength': 0.6, 'Bounce Slope Filter': true,
  'Bounce Min Slope Ticks': 20, 'Cont Enable': true, 'Cont Priority': 80,
  'Cont Window Bars': 19, 'Cont Min Distance Ticks': 0.5, 'Cont Max Distance Ticks': 40,
  'Cont Slope Filter': true, 'Cont Min Slope Ticks': 23,
};

// Parse CSV into trades
function parseCSV(filepath) {
  const lines = fs.readFileSync(filepath, 'utf8').trim().split('\n');
  const trades = [];
  // Each trade = 2 lines (exit then entry), grouped by Trade #
  for (let i = 1; i < lines.length; i += 2) {
    const exitLine = lines[i].split(',');
    const entryLine = lines[i + 1].split(',');
    trades.push({
      num: parseInt(entryLine[0]),
      type: entryLine[1].replace('Entry ', ''),  // "Entry short" -> "short"
      entryDate: entryLine[2],
      entryPrice: parseFloat(entryLine[4]),
      exitDate: exitLine[2],
      exitPrice: parseFloat(exitLine[4]),
      pnl: parseFloat(entryLine[7]),
      cumPnl: parseFloat(entryLine[13]),
    });
  }
  return trades;
}

// Convert ms timestamp to NY time string (approx: UTC-5)
function toNY(ms) {
  // Use Intl for proper NY time
  return new Date(ms).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

(async () => {
  try {
    // Parse user CSV
    const csvTrades = parseCSV('ZERO_LAG_Pattern_Strategy_COMEX_GC1!_2026-02-24.csv');
    console.log(`CSV: ${csvTrades.length} trades\n`);

    // Fetch API trades
    await getClient();
    const report = await fetchStrategyReport(SCRIPT, SYMBOL, {
      timeframe: '1', range: 20000, params,
    });

    const apiTrades = (report.trades || []).slice().reverse(); // chronological order
    console.log(`API: ${apiTrades.length} trades\n`);

    // Side by side comparison
    const maxLen = Math.max(csvTrades.length, apiTrades.length);
    let matches = 0;
    let mismatches = 0;

    console.log('#    | CSV Entry              Price   PnL   | API Entry              Price   PnL   | Match?');
    console.log('-----|----------------------------------------|----------------------------------------|-------');

    for (let i = 0; i < maxLen; i++) {
      const csv = csvTrades[i];
      const api = apiTrades[i];

      let csvStr = '(no trade)'.padEnd(38);
      let apiStr = '(no trade)'.padEnd(38);
      let match = '-';

      if (csv) {
        csvStr = `${csv.type.padEnd(6)} ${csv.entryDate.padEnd(17)} ${String(csv.entryPrice).padStart(7)} ${String(csv.pnl).padStart(7)}`;
      }
      if (api) {
        const pnl = typeof api.profit === 'object' ? api.profit.v : api.profit;
        apiStr = `${api.entry.type.padEnd(6)} ${toNY(api.entry.time).padEnd(17)} ${String(api.entry.value).padStart(7)} ${String(pnl).padStart(7)}`;
      }

      if (csv && api) {
        const pnl = typeof api.profit === 'object' ? api.profit.v : api.profit;
        const priceMatch = csv.entryPrice === api.entry.value;
        const pnlMatch = csv.pnl === pnl;
        if (priceMatch && pnlMatch) { match = 'OK'; matches++; }
        else { match = `DIFF price:${priceMatch} pnl:${pnlMatch}`; mismatches++; }
      }

      console.log(`${String(i + 1).padStart(4)} | ${csvStr} | ${apiStr} | ${match}`);
    }

    console.log(`\nMatches: ${matches}, Mismatches: ${mismatches}, CSV-only: ${Math.max(0, csvTrades.length - apiTrades.length)}, API-only: ${Math.max(0, apiTrades.length - csvTrades.length)}`);

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await close();
    process.exit(0);
  }
})();
