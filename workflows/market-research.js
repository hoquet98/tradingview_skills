/**
 * Market Research Workflow
 * Search for a symbol, get real-time quote, technical analysis, and market metadata.
 *
 * Usage:
 *   node workflows/market-research.js "AAPL"
 *   node workflows/market-research.js "BTC" crypto
 *   node workflows/market-research.js "NASDAQ:TSLA"
 */
const { searchMarket } = require('../skills/search-market');
const { getQuote } = require('../skills/get-quote');
const { getTechnicalAnalysis } = require('../skills/get-technical-analysis');
const { getMarketInfo } = require('../skills/get-market-info');
const { close } = require('../lib/ws-client');

async function marketResearch(query, filter = '') {
  const results = {};

  // 1. Resolve symbol — if it already contains ':', use it directly
  let symbol;
  if (query.includes(':')) {
    symbol = query;
  } else {
    const search = await searchMarket(query, { filter });
    if (!search.success || search.count === 0) {
      return { success: false, message: `No results for "${query}"` };
    }
    symbol = search.results[0].id;
    results.searchResults = search.results.slice(0, 5);
  }
  results.symbol = symbol;

  // 2. Run quote, TA, and market info in parallel
  const [quoteResult, taResult, infoResult] = await Promise.all([
    getQuote(symbol).catch(e => ({ success: false, error: e.message })),
    getTechnicalAnalysis(symbol).catch(e => ({ success: false, error: e.message })),
    getMarketInfo(symbol).catch(e => ({ success: false, error: e.message })),
  ]);

  // 3. Assemble report
  if (quoteResult.success) {
    const q = quoteResult.quote;
    results.price = {
      last: q.lastPrice,
      change: q.change,
      changePercent: q.changePercent,
      volume: q.volume,
      open: q.open,
      high: q.high,
      low: q.low,
      prevClose: q.prevClose,
    };
    results.fundamentals = {
      marketCap: q.marketCap,
      peRatio: q.peRatio,
      eps: q.eps,
      beta: q.beta,
      dividendYield: q.dividendYield,
      sector: q.sector,
      industry: q.industry,
      country: q.country,
    };
  }

  if (taResult.success) {
    results.technicalAnalysis = {};
    for (const [tf, data] of Object.entries(taResult.analysis)) {
      results.technicalAnalysis[tf] = data.overall;
    }
  }

  if (infoResult.success) {
    const i = infoResult.info;
    results.marketInfo = {
      exchange: i.exchange,
      type: i.type,
      currency: i.currency,
      timezone: i.timezone,
      session: i.session,
      isTradable: i.isTradable,
      isReplayable: i.isReplayable,
    };
  }

  return { success: true, ...results };
}

async function main() {
  const query = process.argv[2] || 'AAPL';
  const filter = process.argv[3] || '';

  try {
    const result = await marketResearch(query, filter);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Workflow error', error: error.message }, null, 2));
  } finally {
    await close();
  }
}

module.exports = { marketResearch };
if (require.main === module) main();
