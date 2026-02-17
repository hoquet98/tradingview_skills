const { TradingView } = require('../../lib/ws-client');

/**
 * Search for market symbols.
 * Uses HTTP API — no browser needed.
 *
 * @param {string} query - Search keywords (e.g. 'AAPL', 'Bitcoin', 'BINANCE:')
 * @param {Object} [options]
 * @param {string} [options.filter] - Category: 'stock','futures','forex','cfd','crypto','index','economic'
 * @param {number} [options.offset=0] - Pagination offset
 * @returns {Promise<{success:boolean, message:string, results?:Array, count?:number}>}
 */
async function searchMarket(query = '', options = {}) {
  const { filter = '', offset = 0 } = options;

  try {
    const results = await TradingView.searchMarketV3(query, filter, offset);
    return {
      success: true,
      message: `Found ${results.length} markets for "${query}"`,
      results: results.map(r => ({
        id: r.id,
        symbol: r.symbol,
        exchange: r.exchange,
        description: r.description,
        type: r.type,
      })),
      count: results.length,
    };
  } catch (error) {
    return { success: false, message: 'Error searching markets', error: error.message };
  }
}

async function main() {
  const query = process.argv[2] || 'BTC';
  const filter = process.argv[3] || '';

  try {
    const result = await searchMarket(query, { filter });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  }
}

module.exports = { searchMarket };
if (require.main === module) main();
