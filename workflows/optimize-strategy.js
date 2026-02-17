/**
 * Optimize Strategy Workflow
 * Backtest a strategy across parameter ranges to find optimal settings.
 * Generates all combinations of parameter values and runs backtests for each.
 *
 * Usage:
 *   node workflows/optimize-strategy.js "STD;RSI%1Strategy" BINANCE:BTCUSDT D '{"RSI Length":[7,14,21]}'
 *   node workflows/optimize-strategy.js "STD;RSI%1Strategy" BINANCE:BTCUSDT D '{"RSI Length":[7,14,21],"RSI Upper Band":[70,80]}'
 *   node workflows/optimize-strategy.js "PUB;abc123" NQ1! 1 '{"Fast":[5,8,13],"Slow":[21,34,55]}'
 */
const { getClient, getCredentials, TradingView, close } = require('../lib/ws-client');
const { getIndicatorDetails } = require('../skills/get-indicator-details');

/**
 * Build a map from human-readable input names to their in_XX IDs.
 * Allows users to pass {"Stop Ticks": 50} instead of {"in_20": 50}.
 * @param {Object} inputs - The indicator's inputs object (keyed by in_XX)
 * @returns {Object<string, string>} Map of name → in_XX id
 */
function buildNameToIdMap(inputs) {
  const map = {};
  for (const [id, input] of Object.entries(inputs)) {
    if (input.name) {
      map[input.name] = id;
      // Also map trimmed version (some names have leading spaces like "  Sunday")
      map[input.name.trim()] = id;
    }
  }
  return map;
}

/**
 * Resolve parameter keys from human-readable names to in_XX IDs.
 * Accepts either format: {"Stop Ticks": 50} or {"in_20": 50}.
 * @param {Object} params - Parameters with name or ID keys
 * @param {Object<string, string>} nameToId - Name-to-ID map from buildNameToIdMap
 * @returns {Object} Parameters with in_XX keys
 */
function resolveParamIds(params, nameToId) {
  const resolved = {};
  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith('in_')) {
      // Already an ID
      resolved[key] = value;
    } else if (nameToId[key]) {
      resolved[nameToId[key]] = value;
    } else if (nameToId[key.trim()]) {
      resolved[nameToId[key.trim()]] = value;
    } else {
      throw new Error(`Unknown parameter "${key}". Use get-indicator-details to list available parameters.`);
    }
  }
  return resolved;
}

/**
 * Generate all combinations from parameter ranges.
 * @param {Object<string, any[]>} ranges - { "Param Name": [val1, val2, ...], ... }
 * @returns {Object[]} Array of param combinations
 */
function generateCombinations(ranges) {
  const keys = Object.keys(ranges);
  if (keys.length === 0) return [{}];

  const combos = [];
  const values = keys.map(k => ranges[k]);

  function recurse(depth, current) {
    if (depth === keys.length) {
      combos.push({ ...current });
      return;
    }
    for (const val of values[depth]) {
      current[keys[depth]] = val;
      recurse(depth + 1, current);
    }
  }

  recurse(0, {});
  return combos;
}

/**
 * Run a single backtest with specific parameters.
 * @param {string} scriptId - Script ID
 * @param {Object} indicator - Indicator template (unused, kept for compat)
 * @param {string} symbol - Market symbol
 * @param {string} timeframe - Timeframe
 * @param {Object} params - Parameters with in_XX keys (already resolved)
 * @param {number} range - Bar range
 */
async function runSingleBacktest(scriptId, indicator, symbol, timeframe, params, range) {
  const { session, signature } = getCredentials();

  // Clone the indicator for this run
  const ind = await TradingView.getIndicator(scriptId, 'last', session, signature);
  ind.setType('StrategyScript@tv-scripting-101!');

  // Apply parameters (must use in_XX keys — use resolveParamIds() before calling this)
  for (const [key, value] of Object.entries(params)) {
    ind.setOption(key, value);
  }

  const client = await getClient();

  return new Promise((resolve) => {
    const chart = new client.Session.Chart();
    let study;
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        chart.delete();
        resolve({ params, error: 'Timeout (no trades)' });
      }
    }, 30000);

    chart.onError((...err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        chart.delete();
        resolve({ params, error: err.join(' ') });
      }
    });

    chart.onUpdate(() => {
      if (resolved || !study) return;
      const report = study.strategyReport;
      if (report && report.trades && report.trades.length > 0) {
        resolved = true;
        clearTimeout(timer);
        chart.delete();

        const perf = report.performance?.all || {};
        resolve({
          params,
          netProfit: perf.netProfit,
          netProfitPercent: perf.netProfitPercent,
          totalTrades: perf.totalTrades,
          percentProfitable: perf.percentProfitable,
          profitFactor: perf.profitFactor,
          maxDrawdown: report.performance?.maxDrawDown,
          maxDrawdownPercent: report.performance?.maxDrawDownPercent,
          sharpeRatio: report.performance?.sharpeRatio,
          sortinoRatio: report.performance?.sortinoRatio,
          avgTrade: perf.avgTrade,
        });
      }
    });

    chart.setMarket(symbol, { timeframe, range });

    chart.onSymbolLoaded(() => {
      study = new chart.Study(ind);
      study.onError((...err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          chart.delete();
          resolve({ params, error: `Study error: ${err.join(' ')}` });
        }
      });
    });
  });
}

async function optimizeStrategy(scriptId, options = {}) {
  const {
    symbol = 'BINANCE:BTCUSDT',
    timeframe = 'D',
    paramRanges = {},
    range = 1000,
    sortBy = 'netProfit',
  } = options;

  if (!scriptId) {
    return { success: false, message: 'Script ID required' };
  }

  if (Object.keys(paramRanges).length === 0) {
    return { success: false, message: 'Parameter ranges required. Format: {"Param Name": [val1, val2, ...]}' };
  }

  // 1. Get indicator details and build name→ID map
  let strategyName = scriptId;
  let defaults = {};
  let nameToId = {};
  try {
    const details = await getIndicatorDetails(scriptId);
    if (details.success) {
      strategyName = details.indicator.shortDescription || details.indicator.description;
      details.indicator.inputs
        .filter(i => !i.isHidden && !i.isFake)
        .forEach(i => { defaults[i.name] = i.value; });
    }
  } catch (e) {
    // Continue with scriptId as name
  }

  // 2. Load indicator template and build name→ID map for param resolution
  const { session, signature } = getCredentials();
  let indicator;
  try {
    indicator = await TradingView.getIndicator(scriptId, 'last', session, signature);
    nameToId = buildNameToIdMap(indicator.inputs);
  } catch (error) {
    return { success: false, message: 'Failed to load script', error: error.message };
  }

  // 3. Resolve parameter names to in_XX IDs and generate combinations
  let resolvedRanges;
  try {
    resolvedRanges = resolveParamIds(paramRanges, nameToId);
  } catch (error) {
    return { success: false, message: error.message };
  }
  const combinations = generateCombinations(resolvedRanges);

  // Also build a reverse map (in_XX → name) for readable output
  const idToName = {};
  for (const [name, id] of Object.entries(nameToId)) {
    if (!idToName[id]) idToName[id] = name;
  }

  // 4. Run backtests sequentially (WS sessions share a single client)
  const results = [];
  for (let i = 0; i < combinations.length; i++) {
    const combo = combinations[i];
    try {
      const result = await runSingleBacktest(scriptId, indicator, symbol, timeframe, combo, range);
      // Add human-readable param names to the result
      result.paramsNamed = {};
      for (const [id, val] of Object.entries(result.params)) {
        result.paramsNamed[idToName[id] || id] = val;
      }
      results.push(result);
    } catch (error) {
      results.push({ params: combo, error: error.message });
    }
  }

  // 5. Rank results
  const successful = results.filter(r => !r.error && r.totalTrades > 0);
  const failed = results.filter(r => r.error);

  // Sort by the requested metric
  const sorted = [...successful].sort((a, b) => {
    const aVal = a[sortBy] ?? -Infinity;
    const bVal = b[sortBy] ?? -Infinity;
    return bVal - aVal;
  });

  return {
    success: true,
    message: `Optimization complete: ${successful.length}/${combinations.length} configurations produced results`,
    strategy: {
      id: scriptId,
      name: strategyName,
    },
    symbol,
    timeframe,
    defaults,
    paramRanges,
    totalCombinations: combinations.length,
    successfulRuns: successful.length,
    failedRuns: failed.length,
    ranked: sorted.slice(0, 20).map((r, i) => ({
      rank: i + 1,
      ...r,
    })),
    best: sorted[0] || null,
    worst: sorted[sorted.length - 1] || null,
    errors: failed.length > 0 ? failed.slice(0, 5) : undefined,
  };
}

async function main() {
  const scriptId = process.argv[2] || 'STD;RSI%1Strategy';
  const symbol = process.argv[3] || 'BINANCE:BTCUSDT';
  const timeframe = process.argv[4] || 'D';
  const paramRanges = process.argv[5] ? JSON.parse(process.argv[5]) : { 'RSI Length': [7, 14, 21] };
  const sortBy = process.argv[6] || 'netProfit';

  try {
    const result = await optimizeStrategy(scriptId, { symbol, timeframe, paramRanges, sortBy });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Workflow error', error: error.message }, null, 2));
  } finally {
    await close();
  }
}

module.exports = { optimizeStrategy, buildNameToIdMap, resolveParamIds };
if (require.main === module) main();
