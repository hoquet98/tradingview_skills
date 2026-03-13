/**
 * Compare API trades vs user's CSV — output side-by-side CSV file.
 * Matches trades by entry price + type when aligned, flags extras/mismatches.
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

function parseCSV(filepath) {
  const lines = fs.readFileSync(filepath, 'utf8').trim().split('\n');
  const trades = [];
  for (let i = 1; i < lines.length; i += 2) {
    const exitLine = lines[i].split(',');
    const entryLine = lines[i + 1].split(',');
    trades.push({
      num: parseInt(entryLine[0]),
      type: entryLine[1].replace('Entry ', ''),
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

function toNY(ms) {
  const d = new Date(ms);
  const y = d.toLocaleString('en-US', { timeZone: 'America/New_York', year: 'numeric' });
  const m = d.toLocaleString('en-US', { timeZone: 'America/New_York', month: '2-digit' });
  const day = d.toLocaleString('en-US', { timeZone: 'America/New_York', day: '2-digit' });
  const h = d.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
  return `${y}-${m}-${day} ${h}`;
}

(async () => {
  try {
    const csvTrades = parseCSV('ZERO_LAG_Pattern_Strategy_COMEX_GC1!_2026-02-24.csv');
    await getClient();
    const report = await fetchStrategyReport(SCRIPT, SYMBOL, { timeframe: '1', range: 20000, params });
    const apiAll = (report.trades || []).slice().reverse(); // chronological

    // Build aligned rows using two-pointer matching
    const rows = [];
    let ci = 0, ai = 0;

    while (ci < csvTrades.length || ai < apiAll.length) {
      const csv = csvTrades[ci];
      const api = apiAll[ai];

      if (csv && api) {
        const apiPnl = api.profit.v;
        const apiEntryDate = toNY(api.entry.time);
        const apiExitDate = toNY(api.exit.time);

        // Check if they match (same price + type)
        if (csv.entryPrice === api.entry.value && csv.type === api.entry.type) {
          rows.push({
            csvNum: csv.num, csvType: csv.type, csvEntryDate: csv.entryDate,
            csvEntryPrice: csv.entryPrice, csvExitDate: csv.exitDate,
            csvExitPrice: csv.exitPrice, csvPnl: csv.pnl, csvCumPnl: csv.cumPnl,
            apiType: api.entry.type, apiEntryDate, apiEntryPrice: api.entry.value,
            apiExitDate, apiExitPrice: api.exit.value, apiPnl,
            match: csv.pnl === apiPnl ? 'MATCH' : 'PNL_DIFF',
          });
          ci++; ai++;
        } else {
          // Try to find the CSV trade in upcoming API trades (lookahead 5)
          let found = false;
          for (let look = 1; look <= 5 && ai + look < apiAll.length; look++) {
            const ahead = apiAll[ai + look];
            if (csv.entryPrice === ahead.entry.value && csv.type === ahead.entry.type) {
              // API has extra trades before this match — emit them as API-only
              for (let k = 0; k < look; k++) {
                const extra = apiAll[ai + k];
                rows.push({
                  csvNum: '', csvType: '', csvEntryDate: '', csvEntryPrice: '',
                  csvExitDate: '', csvExitPrice: '', csvPnl: '', csvCumPnl: '',
                  apiType: extra.entry.type, apiEntryDate: toNY(extra.entry.time),
                  apiEntryPrice: extra.entry.value, apiExitDate: toNY(extra.exit.time),
                  apiExitPrice: extra.exit.value, apiPnl: extra.profit.v,
                  match: 'API_ONLY',
                });
              }
              ai += look;
              found = true;
              break;
            }
          }
          if (!found) {
            // Try to find the API trade in upcoming CSV trades (lookahead 5)
            let found2 = false;
            for (let look = 1; look <= 5 && ci + look < csvTrades.length; look++) {
              const ahead = csvTrades[ci + look];
              if (ahead.entryPrice === api.entry.value && ahead.type === api.entry.type) {
                // CSV has extra trades before this match — emit them as CSV-only
                for (let k = 0; k < look; k++) {
                  const extra = csvTrades[ci + k];
                  rows.push({
                    csvNum: extra.num, csvType: extra.type, csvEntryDate: extra.entryDate,
                    csvEntryPrice: extra.entryPrice, csvExitDate: extra.exitDate,
                    csvExitPrice: extra.exitPrice, csvPnl: extra.pnl, csvCumPnl: extra.cumPnl,
                    apiType: '', apiEntryDate: '', apiEntryPrice: '', apiExitDate: '',
                    apiExitPrice: '', apiPnl: '', match: 'CSV_ONLY',
                  });
                }
                ci += look;
                found2 = true;
                break;
              }
            }
            if (!found2) {
              // No match in lookahead — emit both as misaligned
              rows.push({
                csvNum: csv.num, csvType: csv.type, csvEntryDate: csv.entryDate,
                csvEntryPrice: csv.entryPrice, csvExitDate: csv.exitDate,
                csvExitPrice: csv.exitPrice, csvPnl: csv.pnl, csvCumPnl: csv.cumPnl,
                apiType: api.entry.type, apiEntryDate, apiEntryPrice: api.entry.value,
                apiExitDate, apiExitPrice: api.exit.value, apiPnl,
                match: 'MISALIGNED',
              });
              ci++; ai++;
            }
          }
        }
      } else if (csv && !api) {
        rows.push({
          csvNum: csv.num, csvType: csv.type, csvEntryDate: csv.entryDate,
          csvEntryPrice: csv.entryPrice, csvExitDate: csv.exitDate,
          csvExitPrice: csv.exitPrice, csvPnl: csv.pnl, csvCumPnl: csv.cumPnl,
          apiType: '', apiEntryDate: '', apiEntryPrice: '', apiExitDate: '',
          apiExitPrice: '', apiPnl: '', match: 'CSV_ONLY',
        });
        ci++;
      } else if (!csv && api) {
        const apiPnl = api.profit.v;
        rows.push({
          csvNum: '', csvType: '', csvEntryDate: '', csvEntryPrice: '',
          csvExitDate: '', csvExitPrice: '', csvPnl: '', csvCumPnl: '',
          apiType: api.entry.type, apiEntryDate: toNY(api.entry.time),
          apiEntryPrice: api.entry.value, apiExitDate: toNY(api.exit.time),
          apiExitPrice: api.exit.value, apiPnl, match: 'API_ONLY',
        });
        ai++;
      }
    }

    // Write CSV
    const header = 'Row,CSV#,CSV_Type,CSV_EntryDate,CSV_EntryPrice,CSV_ExitDate,CSV_ExitPrice,CSV_PnL,CSV_CumPnL,API_Type,API_EntryDate,API_EntryPrice,API_ExitDate,API_ExitPrice,API_PnL,Match';
    const lines = rows.map((r, i) =>
      `${i+1},${r.csvNum},${r.csvType},${r.csvEntryDate},${r.csvEntryPrice},${r.csvExitDate},${r.csvExitPrice},${r.csvPnl},${r.csvCumPnl},${r.apiType},${r.apiEntryDate},${r.apiEntryPrice},${r.apiExitDate},${r.apiExitPrice},${r.apiPnl},${r.match}`
    );
    const out = [header, ...lines].join('\n');
    fs.writeFileSync('zerolag-comparison.csv', out);

    // Summary
    const counts = {};
    for (const r of rows) counts[r.match] = (counts[r.match] || 0) + 1;
    console.log(`\nWritten ${rows.length} rows to zerolag-comparison.csv`);
    console.log('Summary:', JSON.stringify(counts));

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await close();
    process.exit(0);
  }
})();
