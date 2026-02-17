const { TradingView } = require('../../lib/ws-client');

/**
 * Get technical analysis recommendations for a symbol across all timeframes.
 * Uses HTTP API — no browser or WebSocket connection needed.
 *
 * @param {string} symbol - Full market ID (e.g. 'BINANCE:BTCUSDT', 'NASDAQ:AAPL')
 * @returns {Promise<{success:boolean, message:string, analysis?:Object}>}
 */
async function getTechnicalAnalysis(symbol = 'BINANCE:BTCUSDT') {
  try {
    const analysis = await TradingView.getTA(symbol);
    if (!analysis) {
      return { success: false, message: `No technical analysis data for ${symbol}` };
    }

    // Interpret recommendation values: >1 = Buy, <-1 = Sell, between = Neutral
    const interpret = (val) => {
      if (val >= 1) return 'Strong Buy';
      if (val > 0) return 'Buy';
      if (val <= -1) return 'Strong Sell';
      if (val < 0) return 'Sell';
      return 'Neutral';
    };

    const summary = {};
    for (const [tf, data] of Object.entries(analysis)) {
      summary[tf] = {
        overall: interpret(data.All),
        movingAverages: interpret(data.MA),
        oscillators: interpret(data.Other),
        raw: data,
      };
    }

    return {
      success: true,
      message: `Technical analysis for ${symbol}`,
      symbol,
      analysis: summary,
    };
  } catch (error) {
    return { success: false, message: 'Error getting technical analysis', error: error.message };
  }
}

async function main() {
  const symbol = process.argv[2] || 'BINANCE:BTCUSDT';

  try {
    const result = await getTechnicalAnalysis(symbol);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  }
}

module.exports = { getTechnicalAnalysis };
if (require.main === module) main();
