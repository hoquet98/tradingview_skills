/**
 * Indicator Analysis Workflow
 * Search for indicators, get full details, and compare parameters.
 *
 * Usage:
 *   node workflows/indicator-analysis.js "RSI"
 *   node workflows/indicator-analysis.js "MACD"
 *   node workflows/indicator-analysis.js "STD;RSI"          # Direct ID lookup
 */
const { getIndicatorList } = require('../skills/get-indicator-list');
const { getIndicatorDetails } = require('../skills/get-indicator-details');

async function indicatorAnalysis(query) {
  const results = { query };

  // 1. If it looks like a script ID, get details directly
  if (query.includes(';')) {
    try {
      const details = await getIndicatorDetails(query);
      if (details.success) {
        results.indicator = formatIndicator(details.indicator);
        return { success: true, ...results };
      }
    } catch (e) {
      // Fall through to search
    }
  }

  // 2. Search for indicators matching the query
  const search = await getIndicatorList(query);
  if (!search.success || search.count === 0) {
    return { success: false, message: `No indicators found for "${query}"` };
  }

  results.searchResults = search.indicators.slice(0, 10).map(i => ({
    id: i.id,
    name: i.name,
    type: i.type,
    author: i.author,
    access: i.access,
  }));
  results.totalFound = search.count;

  // 3. Get full details for the top result
  const topId = search.indicators[0].id;
  const topVersion = search.indicators[0].version;
  try {
    const details = await getIndicatorDetails(topId, { version: topVersion });
    if (details.success) {
      results.topResult = formatIndicator(details.indicator);
    }
  } catch (e) {
    results.topResult = { id: topId, error: e.message };
  }

  return { success: true, ...results };
}

function formatIndicator(ind) {
  return {
    id: ind.id,
    name: ind.description,
    shortName: ind.shortDescription,
    version: ind.version,
    inputs: ind.inputs
      .filter(i => !i.isHidden && !i.isFake)
      .map(i => {
        const entry = { name: i.name, type: i.type, default: i.value };
        if (i.options) entry.options = i.options;
        if (i.tooltip) entry.tooltip = i.tooltip;
        return entry;
      }),
    plots: ind.plots,
    inputCount: ind.inputCount,
    plotCount: ind.plotCount,
  };
}

async function main() {
  const query = process.argv[2] || 'RSI';

  try {
    const result = await indicatorAnalysis(query);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Workflow error', error: error.message }, null, 2));
  }
}

module.exports = { indicatorAnalysis };
if (require.main === module) main();
