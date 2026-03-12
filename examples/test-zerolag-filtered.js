/**
 * Test date-range filtering of regular backtest results.
 * Run full backtest, then filter trades to Feb 1 - Feb 24 and recalculate metrics.
 */
const { fetchStrategyReport, getClient, close } = require('../lib/ws-client');

const SCRIPT = 'USER;f3f18d701c0a4c62b4296ec92e8acff4';
const SYMBOL = 'COMEX:GC1!';

// Use NY timezone boundaries (strategy timezone is America/New_York)
// Feb 1 00:00 NY = Feb 1 05:00 UTC
const fromTs = new Date('2026-02-01T05:00:00Z').getTime();  // ms
// Feb 24 23:59:59 NY = Feb 25 04:59:59 UTC
const toTs = new Date('2026-02-25T04:59:59Z').getTime();  // ms

// Also test with the exact trade window from user's CSV (trade #1 to #150)
// First trade: Feb 1 17:20 NY = Feb 1 22:20 UTC
// Last trade entry: ~Feb 24 01:32 NY = Feb 24 06:32 UTC
const csvFromTs = new Date('2026-02-01T22:20:00Z').getTime();
const csvToTs = new Date('2026-02-24T06:32:00Z').getTime();

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

(async () => {
  try {
    await getClient();
    console.log('Running full backtest...\n');

    const report = await fetchStrategyReport(SCRIPT, SYMBOL, {
      timeframe: '1', range: 20000, params,
    });

    const allTrades = report.trades || [];
    const p = report.performance.all || {};
    console.log(`=== UNFILTERED ===`);
    console.log(`Trades: ${p.totalTrades}, PnL: ${p.netProfit}, DD: ${report.performance.maxStrategyDrawDown}, WR: ${((p.percentProfitable||0)*100).toFixed(2)}%, PF: ${(p.profitFactor||0).toFixed(3)}`);

    // Debug: show boundary trades
    console.log(`\nfromTs=${fromTs} (${new Date(fromTs).toISOString()}), toTs=${toTs} (${new Date(toTs).toISOString()})`);
    console.log(`Total trades: ${allTrades.length}`);
    // Show first 5 and last 5 trades (list is reverse chrono)
    console.log('\nNewest trades:');
    for (let i = 0; i < Math.min(5, allTrades.length); i++) {
      const t = allTrades[i];
      console.log(`  [${i}] ${new Date(t.entry.time).toISOString().slice(0,16)} ${t.entry.type} pnl=${t.profit.v}`);
    }
    console.log('Oldest trades:');
    for (let i = Math.max(0, allTrades.length - 5); i < allTrades.length; i++) {
      const t = allTrades[i];
      console.log(`  [${i}] ${new Date(t.entry.time).toISOString().slice(0,16)} ${t.entry.type} pnl=${t.profit.v}`);
    }

    // Filter trades by date range
    const filtered = allTrades.filter(t => t.entry.time >= fromTs && t.entry.time <= toTs);

    // Recalculate metrics
    const totalTrades = filtered.length;
    let grossProfit = 0;
    let grossLoss = 0;
    let wins = 0;
    let cumPnL = 0;
    let peak = 0;
    let maxDD = 0;

    for (const t of filtered) {
      const pnl = typeof t.profit === 'object' ? t.profit.v : t.profit;
      cumPnL += pnl;
      if (pnl > 0) { grossProfit += pnl; wins++; }
      else { grossLoss += Math.abs(pnl); }
      if (cumPnL > peak) peak = cumPnL;
      const dd = peak - cumPnL;
      if (dd > maxDD) maxDD = dd;
    }

    const netProfit = cumPnL;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

    console.log(`\n=== FILTERED (${new Date(fromTs).toISOString().slice(0,10)} to ${new Date(toTs).toISOString().slice(0,10)}) ===`);
    console.log(`Trades: ${totalTrades}`);
    console.log(`PnL: ${netProfit}`);
    console.log(`Max DD: ${maxDD}`);
    console.log(`WR: ${winRate.toFixed(2)}%`);
    console.log(`PF: ${profitFactor.toFixed(3)}`);
    console.log(`Wins: ${wins}, Losses: ${totalTrades - wins}`);

    // Also filter with CSV exact window
    const csvFiltered = allTrades.filter(t => t.entry.time >= csvFromTs && t.entry.time <= csvToTs);
    let gp2=0, gl2=0, w2=0, cum2=0, pk2=0, dd2=0;
    for (const t of csvFiltered) {
      const pnl = typeof t.profit === 'object' ? t.profit.v : t.profit;
      cum2 += pnl;
      if (pnl > 0) { gp2 += pnl; w2++; } else { gl2 += Math.abs(pnl); }
      if (cum2 > pk2) pk2 = cum2;
      const d = pk2 - cum2;
      if (d > dd2) dd2 = d;
    }
    console.log(`\n=== CSV WINDOW (${new Date(csvFromTs).toISOString().slice(0,16)} to ${new Date(csvToTs).toISOString().slice(0,16)}) ===`);
    console.log(`Trades: ${csvFiltered.length}, PnL: ${cum2}, DD: ${dd2}, WR: ${(csvFiltered.length>0?(w2/csvFiltered.length)*100:0).toFixed(2)}%, PF: ${(gl2>0?gp2/gl2:0).toFixed(3)}`);

    console.log(`\n=== YOUR CHART ===`);
    console.log(`Trades: 150`);
    console.log(`PnL: 10,040`);
    console.log(`Max DD: 12,805`);
    console.log(`WR: 73.33%`);
    console.log(`PF: 1.202`);

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await close();
    process.exit(0);
  }
})();
