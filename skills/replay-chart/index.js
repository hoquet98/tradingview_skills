const { getClient, close } = require('../../lib/ws-client');

/**
 * Replay historical chart data from a specific timestamp.
 * Uses WebSocket replay mode to step through bars or auto-play.
 *
 * @param {string} symbol - Market symbol (e.g. 'BINANCE:BTCUSDT')
 * @param {Object} [options]
 * @param {string} [options.timeframe='D'] - Chart timeframe
 * @param {number} [options.range=100] - Number of candles to load before replay point
 * @param {number} options.replayFrom - Timestamp to start replay from
 * @param {number} [options.steps=10] - Number of bars to step forward
 * @returns {Promise<{success:boolean, message:string, bars?:Array}>}
 */
async function replayChart(symbol = 'BINANCE:BTCUSDT', options = {}) {
  const { timeframe = 'D', range = 100, replayFrom, steps = 10 } = options;

  if (!replayFrom) {
    return { success: false, message: 'replayFrom timestamp is required' };
  }

  try {
    const client = await getClient();

    return new Promise((resolve, reject) => {
      const chart = new client.Session.Chart();
      let resolved = false;
      let replayLoaded = false;
      let stepsCompleted = 0;
      const collectedBars = [];

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          chart.delete();
          reject(new Error('Replay timed out (30s)'));
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

      chart.onReplayLoaded(() => {
        replayLoaded = true;
      });

      chart.onUpdate(() => {
        if (resolved) return;

        // Collect current periods on each update
        const periods = chart.periods;
        if (periods.length > 0 && replayLoaded) {
          // Record the latest bar
          const latest = periods[0];
          collectedBars.push({
            time: latest.time,
            open: latest.open,
            high: latest.max,
            low: latest.min,
            close: latest.close,
            volume: latest.volume,
          });

          stepsCompleted++;

          if (stepsCompleted >= steps) {
            resolved = true;
            clearTimeout(timeout);

            const allBars = periods.map(p => ({
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
              message: `Replayed ${stepsCompleted} bars from ${new Date(replayFrom * 1000).toISOString()}`,
              symbol,
              timeframe,
              replayFrom,
              stepsCompleted,
              bars: allBars,
              barCount: allBars.length,
            });
            return;
          }

          // Step forward
          chart.replayStep(1).catch(() => {});
        }
      });

      chart.onReplayEnd(() => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);

          const allBars = chart.periods.map(p => ({
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
            message: `Replay ended after ${stepsCompleted} bars (reached end of data)`,
            symbol,
            timeframe,
            replayFrom,
            stepsCompleted,
            bars: allBars,
            barCount: allBars.length,
          });
        }
      });

      // Start chart in replay mode
      chart.setMarket(symbol, { timeframe, range, replay: replayFrom });

      // Wait for replay to be ready, then start stepping
      const waitForReplay = setInterval(() => {
        if (replayLoaded && !resolved) {
          clearInterval(waitForReplay);
          chart.replayStep(1).catch(() => {});
        }
      }, 200);
    });
  } catch (error) {
    return { success: false, message: 'Error replaying chart', error: error.message };
  }
}

async function main() {
  const symbol = process.argv[2] || 'BINANCE:BTCUSDT';
  const timeframe = process.argv[3] || 'D';
  const replayFrom = parseInt(process.argv[4]) || Math.floor(Date.now() / 1000) - 86400 * 30; // 30 days ago
  const steps = parseInt(process.argv[5]) || 10;

  try {
    const result = await replayChart(symbol, { timeframe, replayFrom, steps });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await close();
  }
}

module.exports = { replayChart };
if (require.main === module) main();
