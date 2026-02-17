/**
 * Portfolio Monitor Workflow
 * Get real-time quotes and TA for a list of symbols. No browser needed.
 *
 * Usage:
 *   node workflows/portfolio-monitor.js NASDAQ:AAPL,NASDAQ:GOOGL,NASDAQ:MSFT
 *   node workflows/portfolio-monitor.js BINANCE:BTCUSDT,BINANCE:ETHUSDT,BINANCE:SOLUSDT
 */
const { getQuote } = require('../skills/get-quote');
const { getTechnicalAnalysis } = require('../skills/get-technical-analysis');
const { close } = require('../lib/ws-client');

async function portfolioMonitor(symbols, options = {}) {
  const { includeTA = true } = options;
  const portfolio = [];

  for (const symbol of symbols) {
    const entry = { symbol };

    // Get quote
    try {
      const quoteResult = await getQuote(symbol);
      if (quoteResult.success) {
        const q = quoteResult.quote;
        entry.price = q.lastPrice;
        entry.change = q.change;
        entry.changePercent = q.changePercent;
        entry.volume = q.volume;
        entry.marketCap = q.marketCap;
        entry.peRatio = q.peRatio;
        entry.sector = q.sector;
      }
    } catch (e) {
      entry.quoteError = e.message;
    }

    // Get daily TA
    if (includeTA) {
      try {
        const taResult = await getTechnicalAnalysis(symbol);
        if (taResult.success && taResult.analysis['1D']) {
          entry.dailyTA = taResult.analysis['1D'].overall;
          entry.weeklyTA = taResult.analysis['1W']?.overall;
        }
      } catch (e) {
        entry.taError = e.message;
      }
    }

    portfolio.push(entry);
  }

  // Summary
  const withPrices = portfolio.filter(p => p.price != null);
  const gainers = withPrices.filter(p => p.changePercent > 0).length;
  const losers = withPrices.filter(p => p.changePercent < 0).length;
  const totalMarketCap = withPrices.reduce((sum, p) => sum + (p.marketCap || 0), 0);

  return {
    success: true,
    message: `Portfolio: ${symbols.length} symbols | ${gainers} up, ${losers} down`,
    portfolio,
    summary: {
      symbols: symbols.length,
      gainers,
      losers,
      unchanged: withPrices.length - gainers - losers,
      totalMarketCap,
    },
  };
}

async function main() {
  const symbols = (process.argv[2] || 'NASDAQ:AAPL,NASDAQ:GOOGL,NASDAQ:MSFT,BINANCE:BTCUSDT').split(',');

  try {
    const result = await portfolioMonitor(symbols);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Workflow error', error: error.message }, null, 2));
  } finally {
    await close();
  }
}

module.exports = { portfolioMonitor };
if (require.main === module) main();
