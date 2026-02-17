/**
 * Data Export Workflow
 * Export OHLCV data to CSV or JSON files. Supports extended history via fetchMore.
 *
 * Usage:
 *   node workflows/data-export.js BINANCE:BTCUSDT D 500 csv
 *   node workflows/data-export.js NASDAQ:AAPL 60 1000 json
 *   node workflows/data-export.js BINANCE:ETHUSDT D 2000 csv   # Uses fetchMore for >300 bars
 */
const fs = require('fs');
const path = require('path');
const { getChartData } = require('../skills/get-chart-data');
const { fetchMoreData } = require('../skills/fetch-more-data');
const { close } = require('../lib/ws-client');

async function dataExport(symbol, options = {}) {
  const {
    timeframe = 'D',
    count = 500,
    format = 'csv',
    outputDir = '.',
    filename = null,
  } = options;

  let bars;

  // Use fetchMore for large requests (>300 bars)
  if (count > 300) {
    const initialRange = 100;
    const additional = count - initialRange;
    const result = await fetchMoreData(symbol, { timeframe, initialRange, additional });
    if (!result.success) return result;
    bars = result.bars;
  } else {
    const result = await getChartData(symbol, { timeframe, count });
    if (!result.success) return result;
    bars = result.data;
  }

  // Sort oldest first for export
  bars.sort((a, b) => a.time - b.time);

  // Generate filename
  const safeName = symbol.replace(':', '_');
  const outFile = filename || `${safeName}_${timeframe}_${bars.length}.${format}`;
  const outPath = path.resolve(outputDir, outFile);

  if (format === 'csv') {
    const header = 'timestamp,date,open,high,low,close,volume';
    const rows = bars.map(bar => {
      const date = new Date(bar.time * 1000).toISOString().split('T')[0];
      return `${bar.time},${date},${bar.open},${bar.high},${bar.low},${bar.close},${bar.volume}`;
    });
    fs.writeFileSync(outPath, [header, ...rows].join('\n'));
  } else {
    fs.writeFileSync(outPath, JSON.stringify({
      symbol,
      timeframe,
      exportedAt: new Date().toISOString(),
      count: bars.length,
      bars: bars.map(bar => ({
        ...bar,
        date: new Date(bar.time * 1000).toISOString(),
      })),
    }, null, 2));
  }

  const firstDate = new Date(bars[0].time * 1000).toISOString().split('T')[0];
  const lastDate = new Date(bars[bars.length - 1].time * 1000).toISOString().split('T')[0];

  return {
    success: true,
    message: `Exported ${bars.length} bars to ${outFile}`,
    file: outPath,
    symbol,
    timeframe,
    format,
    barCount: bars.length,
    dateRange: { from: firstDate, to: lastDate },
  };
}

async function main() {
  const symbol = process.argv[2] || 'BINANCE:BTCUSDT';
  const timeframe = process.argv[3] || 'D';
  const count = parseInt(process.argv[4]) || 500;
  const format = process.argv[5] || 'csv';

  try {
    const result = await dataExport(symbol, { timeframe, count, format });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Workflow error', error: error.message }, null, 2));
  } finally {
    await close();
  }
}

module.exports = { dataExport };
if (require.main === module) main();
