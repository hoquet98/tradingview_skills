/**
 * Shared parameter resolution, type coercion, and discovery for TradingView strategy inputs.
 * Used by both fetchStrategyReport and fetchDeepBacktest in ws-client.js.
 */

/**
 * Coerce a value to match the indicator input's expected type.
 * Handles common agent mistakes like passing "145" for an integer input.
 *
 * @param {*} value - The raw value from the caller
 * @param {string} type - Input type: 'integer' | 'float' | 'bool' | 'text' | 'color' | 'source' | 'resolution'
 * @param {string} name - Human-readable input name (for error messages)
 * @returns {*} The coerced value
 * @throws {Error} If the value cannot be coerced
 */
function coerceValue(value, type, name) {
  switch (type) {
    case 'integer': {
      if (typeof value === 'number') return Math.floor(value);
      const n = Number(value);
      if (Number.isNaN(n)) {
        throw new Error(`Parameter "${name}": cannot convert ${JSON.stringify(value)} to integer`);
      }
      return Math.floor(n);
    }
    case 'float': {
      if (typeof value === 'number') return value;
      const n = Number(value);
      if (Number.isNaN(n)) {
        throw new Error(`Parameter "${name}": cannot convert ${JSON.stringify(value)} to float`);
      }
      return n;
    }
    case 'bool': {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
      }
      if (typeof value === 'number') return value !== 0;
      throw new Error(`Parameter "${name}": cannot convert ${JSON.stringify(value)} to boolean`);
    }
    case 'text':
    case 'resolution':
    case 'source':
      return String(value);
    default:
      return value;
  }
}

/**
 * Build a map resolving all key formats to the canonical input ID (e.g. "in_0").
 * Supports: canonical ID, numeric shorthand, trimmed name, inline name, internalID.
 *
 * @param {Object} inputs - indicator.inputs object
 * @returns {Map<string, string>} key → canonical input ID
 */
function buildKeyMap(inputs) {
  const keyMap = new Map();
  for (const [id, input] of Object.entries(inputs)) {
    keyMap.set(id, id);
    if (id.startsWith('in_')) {
      keyMap.set(id.slice(3), id);
    }
    if (input.name) {
      keyMap.set(input.name.trim(), id);
    }
    if (input.inline) {
      keyMap.set(input.inline, id);
    }
    if (input.internalID) {
      keyMap.set(input.internalID, id);
    }
  }
  return keyMap;
}

/**
 * Apply parameter overrides to a PineIndicator with full key resolution and type coercion.
 * Replaces the duplicated param-setting blocks in fetchStrategyReport and fetchDeepBacktest.
 *
 * @param {Object} indicator - PineIndicator instance
 * @param {Object} params - Param overrides: { "any key format": value }
 */
function applyParams(indicator, params) {
  if (!params || typeof params !== 'object') return;

  const keyMap = buildKeyMap(indicator.inputs);

  for (const [key, rawValue] of Object.entries(params)) {
    const inputId = keyMap.get(key.trim());
    if (!inputId) {
      const available = Object.entries(indicator.inputs)
        .filter(([, inp]) => !inp.isHidden && !inp.isFake)
        .map(([id, inp]) => `  "${(inp.name || id).trim()}" (${id}, type: ${inp.type})`)
        .join('\n');
      throw new Error(
        `Parameter "${key}" not found.\nAvailable parameters:\n${available}`
      );
    }

    const input = indicator.inputs[inputId];
    const coerced = coerceValue(rawValue, input.type, (input.name || inputId).trim());
    indicator.setOption(inputId, coerced);
  }
}

/**
 * Get the full parameter list for a strategy script.
 * Returns a clean array suitable for agent consumption.
 *
 * @param {string} scriptId - e.g. 'PUB;xxxxx' or 'USER;abc123'
 * @returns {Promise<Array<{id, name, inline, type, defaultValue, options?, isHidden}>>}
 */
async function getStrategyParams(scriptId) {
  // Lazy require to avoid circular dependency with ws-client
  const { getCredentials, TradingView } = require('./ws-client');
  const { session, signature } = getCredentials();
  const indicator = await TradingView.getIndicator(scriptId, 'last', session, signature);

  return Object.entries(indicator.inputs)
    .filter(([id, input]) => !input.isHidden && id !== 'pineFeatures' && id !== '__profile')
    .map(([id, input]) => ({
      id,
      name: (input.name || '').trim(),
      inline: input.inline || '',
      type: input.type,
      defaultValue: input.value,
      ...(input.options ? { options: input.options } : {}),
      isHidden: !!input.isHidden,
    }));
}

module.exports = { coerceValue, buildKeyMap, applyParams, getStrategyParams };
