const { getClient, close } = require('../../lib/ws-client');

/**
 * Fetch extended historical chart data by requesting additional candles beyond the initial range.
 * Uses WebSocket chart.fetchMore() to load older bars.
 *
 * @param {string} symbol - Market symbol (e.g. 'BINANCE:BTCUSDT')
 * @param {Object} [options]
 * @param {string} [options.timeframe='D'] - Chart timeframe
 * @param {number} [options.initialRange=100] - Number of candles in initial load
 * @param {number} [options.additional=500] - Number of additional older candles to fetch
 * @returns {Promise<{success:boolean, message:string, bars?:Array, totalBars?:number}>}
 */
async function fetchMoreData(symbol = 'BINANCE:BTCUSDT', options = {}) {
  const { timeframe = 'D', initialRange = 100, additional = 500 } = options;

  try {
    const client = await getClient();

    return new Promise((resolve, reject) => {
      const chart = new client.Session.Chart();
      let resolved = false;
      let initialLoaded = false;
      let fetchMoreSent = false;
      let initialCount = 0;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          chart.delete();
          reject(new Error('Fetch more data timed out (30s)'));
        }
      }, 30000);

      chart.onError((...err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          chart.delete();
          reject(new Error(`Chart error: ${err.join(' ')}`));
        }
      });

      chart.onUpdate(() => {
        if (resolved) return;

        const periods = chart.periods;
        if (periods.length > 0 && !initialLoaded) {
          initialLoaded = true;
          initialCount = periods.length;
        }

        // After initial load, request more data
        if (initialLoaded && !fetchMoreSent) {
          fetchMoreSent = true;
          chart.fetchMore(additional);
        }

        // Check if we got more data than initial load
        if (fetchMoreSent && periods.length > initialCount) {
          resolved = true;
          clearTimeout(timeout);

          const bars = periods.map(p => ({
            time: p.time,
            open: p.open,
            high: p.max,
            low: p.min,
            close: p.close,
            volume: p.volume,
          }));

          chart.delete();
          resolve({
            success: true,
            message: `Fetched ${bars.length} total bars (${initialCount} initial + ${bars.length - initialCount} additional)`,
            symbol,
            timeframe,
            initialBars: initialCount,
            additionalBars: bars.length - initialCount,
            totalBars: bars.length,
            bars,
          });
        }
      });

      chart.setMarket(symbol, { timeframe, range: initialRange });
    });
  } catch (error) {
    return { success: false, message: 'Error fetching more data', error: error.message };
  }
}

async function main() {
  const symbol = process.argv[2] || 'BINANCE:BTCUSDT';
  const timeframe = process.argv[3] || 'D';
  const additional = parseInt(process.argv[4]) || 500;

  try {
    const result = await fetchMoreData(symbol, { timeframe, additional });
    // Print summary without all bars for readability
    const { bars, ...summary } = result;
    if (bars) {
      summary.firstBar = bars[bars.length - 1];
      summary.lastBar = bars[0];
    }
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await close();
  }
}

module.exports = { fetchMoreData };
if (require.main === module) main();
