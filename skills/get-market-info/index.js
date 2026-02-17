const { getClient, close } = require('../../lib/ws-client');

/**
 * Get comprehensive market metadata for a symbol.
 * Uses WebSocket ChartSession — returns exchange, session info, currency, capabilities.
 *
 * @param {string} symbol - Market symbol (e.g. 'BINANCE:BTCUSDT', 'NASDAQ:AAPL')
 * @returns {Promise<{success:boolean, message:string, info?:Object}>}
 */
async function getMarketInfo(symbol = 'BINANCE:BTCUSDT') {
  try {
    const client = await getClient();

    return new Promise((resolve, reject) => {
      const chart = new client.Session.Chart();
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          chart.delete();
          reject(new Error('Market info fetch timed out (15s)'));
        }
      }, 15000);

      chart.onError((...err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          chart.delete();
          reject(new Error(`Chart error: ${err.join(' ')}`));
        }
      });

      chart.onSymbolLoaded(() => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          const infos = chart.infos;
          chart.delete();

          resolve({
            success: true,
            message: `Market info for ${symbol}`,
            symbol,
            info: {
              name: infos.name,
              fullName: infos.full_name,
              description: infos.description,
              exchange: infos.exchange,
              listedExchange: infos.listed_exchange,
              type: infos.type,
              currency: infos.currency_code,
              baseCurrency: infos.base_currency,
              timezone: infos.timezone,
              session: infos.session,
              sessionDisplay: infos.session_display,
              priceScale: infos.pricescale,
              pointValue: infos.pointvalue,
              minMove: infos.minmov,
              hasIntraday: infos.has_intraday,
              isTradable: infos.is_tradable,
              isReplayable: infos.is_replayable,
              hasAdjustment: infos.has_adjustment,
              hasExtendedHours: infos.has_extended_hours,
              fractional: infos.fractional,
              subsessions: infos.subsessions,
            },
          });
        }
      });

      chart.setMarket(symbol, { timeframe: 'D', range: 1 });
    });
  } catch (error) {
    return { success: false, message: 'Error getting market info', error: error.message };
  }
}

async function main() {
  const symbol = process.argv[2] || 'BINANCE:BTCUSDT';

  try {
    const result = await getMarketInfo(symbol);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await close();
  }
}

module.exports = { getMarketInfo };
if (require.main === module) main();
