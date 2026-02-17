const { getClient, close } = require('../../lib/ws-client');

/**
 * Get real-time quote data for a symbol (price, volume, bid/ask, fundamentals).
 * Uses WebSocket QuoteSession.
 *
 * @param {string} symbol - Market symbol (e.g. 'BINANCE:BTCUSDT', 'NASDAQ:AAPL')
 * @param {Object} [options]
 * @param {string} [options.session='regular'] - 'regular' or 'extended'
 * @returns {Promise<{success:boolean, message:string, quote?:Object}>}
 */
async function getQuote(symbol = 'BINANCE:BTCUSDT', options = {}) {
  const { session = 'regular' } = options;

  try {
    const client = await getClient();

    return new Promise((resolve, reject) => {
      let resolved = false;
      const quoteSession = new client.Session.Quote();
      const market = new quoteSession.Market(symbol, session);

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          market.close();
          quoteSession.delete();
          reject(new Error('Quote fetch timed out (10s)'));
        }
      }, 10000);

      market.onError((...err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          market.close();
          quoteSession.delete();
          reject(new Error(`Quote error: ${err.join(' ')}`));
        }
      });

      market.onData((data) => {
        if (resolved) return;
        // Wait until we have at least a last price
        if (data.lp !== undefined) {
          resolved = true;
          clearTimeout(timeout);
          market.close();
          quoteSession.delete();

          resolve({
            success: true,
            message: `Quote for ${symbol}`,
            symbol,
            quote: {
              lastPrice: data.lp,
              change: data.ch,
              changePercent: data.chp,
              volume: data.volume,
              open: data.open_price,
              high: data.high_price,
              low: data.low_price,
              prevClose: data.prev_close_price,
              bid: data.bid,
              ask: data.ask,
              description: data.description,
              exchange: data.exchange,
              type: data.type,
              currency: data.currency_code,
              isTradable: data.is_tradable,
              session: data.current_session,
              // Fundamentals (stocks)
              marketCap: data.market_cap_basic,
              peRatio: data.price_earnings_ttm,
              eps: data.earnings_per_share_basic_ttm,
              beta: data.beta_1_year,
              dividendYield: data.dividends_yield,
              sector: data.sector,
              industry: data.industry,
              country: data.country_code,
            },
          });
        }
      });
    });
  } catch (error) {
    return { success: false, message: 'Error getting quote', error: error.message };
  }
}

async function main() {
  const symbol = process.argv[2] || 'BINANCE:BTCUSDT';

  try {
    const result = await getQuote(symbol);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  } finally {
    await close();
  }
}

module.exports = { getQuote };
if (require.main === module) main();
