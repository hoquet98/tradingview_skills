const { getCredentials, TradingView } = require('../../lib/ws-client');

/**
 * Get chart drawings from a saved TradingView layout.
 * Uses HTTP API to fetch drawings (trendlines, horizontals, shapes, etc.)
 *
 * @param {string} layoutId - The layout ID from the chart URL (e.g. 'XXXXXXXX')
 * @param {Object} [options]
 * @param {string} [options.symbol=''] - Filter drawings by symbol (e.g. 'BINANCE:BTCUSDT')
 * @param {string} [options.chartId='_shared'] - Chart ID within the layout
 * @returns {Promise<{success:boolean, message:string, drawings?:Array, count?:number}>}
 */
async function getChartDrawings(layoutId, options = {}) {
  if (!layoutId) {
    return { success: false, message: 'layoutId is required (found in chart URL)' };
  }

  try {
    const { session, signature } = getCredentials();

    // getUser to get user ID needed for credentials
    const user = await TradingView.getUser(session, signature);

    const credentials = {
      id: parseInt(user.id),
      session,
      signature,
    };

    const { symbol = '', chartId = '_shared' } = options;
    const drawings = await TradingView.getDrawings(layoutId, symbol, credentials, chartId);

    return {
      success: true,
      message: `Found ${drawings.length} drawing(s) in layout ${layoutId}`,
      layoutId,
      symbol: symbol || 'all',
      drawings: drawings.map(d => ({
        id: d.id,
        type: d.type,
        symbol: d.symbol,
        ownerSource: d.ownerSource,
        serverUpdateTime: d.serverUpdateTime,
        currencyId: d.currencyId,
        points: d.points,
        zorder: d.zorder,
        linkKey: d.linkKey,
      })),
      count: drawings.length,
    };
  } catch (error) {
    return { success: false, message: 'Error getting chart drawings', error: error.message };
  }
}

async function main() {
  const layoutId = process.argv[2];
  const symbol = process.argv[3] || '';

  if (!layoutId) {
    console.log(JSON.stringify({
      success: false,
      message: 'Usage: node index.js <layoutId> [symbol]',
    }, null, 2));
    return;
  }

  try {
    const result = await getChartDrawings(layoutId, { symbol });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  }
}

module.exports = { getChartDrawings };
if (require.main === module) main();
