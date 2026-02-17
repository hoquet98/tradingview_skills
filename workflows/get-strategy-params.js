/**
 * Get Strategy Parameters Workflow
 * Search for a strategy by name, retrieve its full parameter list with defaults.
 *
 * Usage:
 *   node workflows/get-strategy-params.js "RSI Strategy"
 *   node workflows/get-strategy-params.js "STD;RSI%1Strategy"
 *   node workflows/get-strategy-params.js "Bollinger Bands Strategy"
 *   node workflows/get-strategy-params.js "MACD Strategy" last
 */
const { getIndicatorList } = require('../skills/get-indicator-list');
const { getIndicatorDetails } = require('../skills/get-indicator-details');

async function getStrategyParams(query, options = {}) {
  const { version = 'last' } = options;

  if (!query) {
    return { success: false, message: 'Strategy name or ID required' };
  }

  let scriptId = null;
  let searchResults = null;

  // If it looks like a script ID (contains ';'), use it directly
  if (query.includes(';')) {
    scriptId = query;
  } else {
    // Search for the strategy by name
    const search = await getIndicatorList(query);
    if (!search.success || search.count === 0) {
      return { success: false, message: `No strategies found for "${query}"` };
    }

    searchResults = search.indicators.slice(0, 10);

    // Find the first result that looks like a strategy (name contains "strategy" or type matches)
    const strategyMatch = searchResults.find(i =>
      i.name?.toLowerCase().includes('strategy') ||
      i.type === 'strategy'
    ) || searchResults[0];

    scriptId = strategyMatch.id;
  }

  // Get full indicator details
  const details = await getIndicatorDetails(scriptId, { version });
  if (!details.success) {
    return { success: false, message: details.message || `Could not load details for ${scriptId}`, error: details.error };
  }

  const ind = details.indicator;

  // Filter to visible (non-hidden) inputs only
  const params = ind.inputs
    .filter(i => !i.isHidden && !i.isFake)
    .map(i => {
      const param = {
        id: i.id,
        name: i.name,
        type: i.type,
        default: i.value,
      };
      if (i.options) param.options = i.options;
      if (i.tooltip) param.tooltip = i.tooltip;
      return param;
    });

  return {
    success: true,
    message: `${params.length} parameters for "${ind.shortDescription || ind.description}"`,
    strategy: {
      id: ind.id,
      name: ind.description,
      shortName: ind.shortDescription,
      version: ind.version,
      type: ind.type,
    },
    params,
    paramCount: params.length,
    searchResults: searchResults ? searchResults.map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
    })) : undefined,
  };
}

async function main() {
  const query = process.argv[2] || 'RSI Strategy';
  const version = process.argv[3] || 'last';

  try {
    const result = await getStrategyParams(query, { version });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Workflow error', error: error.message }, null, 2));
  }
}

module.exports = { getStrategyParams };
if (require.main === module) main();
