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
    case 'time': {
      // Time inputs (e.g. Start Date, End Date) expect Unix timestamps in milliseconds.
      // The extension/UI may send "YYYY-MM-DD" strings; convert to epoch ms.
      if (typeof value === 'number') return Math.floor(value);
      if (typeof value === 'string') {
        // Try "YYYY-MM-DD" format first
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return new Date(value + 'T00:00:00Z').getTime();
        }
        // Try parsing as a number string (already a timestamp)
        const n = Number(value);
        if (!Number.isNaN(n)) return Math.floor(n);
      }
      throw new Error(`Parameter "${name}": cannot convert ${JSON.stringify(value)} to timestamp`);
    }
    case 'session': {
      // Session inputs use "HHMM-HHMM" format (e.g. "0930-1600"), pass through as-is
      return String(value);
    }
    case 'resolution': {
      const s = String(value).trim();
      // Already in TV format (e.g. "60", "1D", "1W"), pass through
      if (/^(\d+[smhdwDWM]?|[DWMS])$/.test(s)) return s;
      const resMap = {
        '1 second': '1s', '5 seconds': '5s', '10 seconds': '10s',
        '15 seconds': '15s', '30 seconds': '30s',
        '1 minute': '1', '2 minutes': '2', '3 minutes': '3',
        '5 minutes': '5', '10 minutes': '10', '15 minutes': '15',
        '20 minutes': '20', '30 minutes': '30', '45 minutes': '45',
        '1 hour': '60', '2 hours': '120', '3 hours': '180', '4 hours': '240',
        '1 day': '1D', '1 week': '1W', '1 month': '1M',
        '2 months': '2M', '3 months': '3M', '6 months': '6M', '12 months': '12M',
      };
      const mapped = resMap[s.toLowerCase()];
      if (mapped) return mapped;
      // Generic pattern: "N unit" → TV format
      const m = s.match(/^(\d+)\s*(second|minute|hour|day|week|month)/i);
      if (m) {
        const num = parseInt(m[1], 10);
        const unit = m[2].toLowerCase();
        if (unit.startsWith('second')) return `${num}s`;
        if (unit.startsWith('minute')) return String(num);
        if (unit.startsWith('hour'))   return String(num * 60);
        if (unit.startsWith('day'))    return num === 1 ? '1D' : `${num}D`;
        if (unit.startsWith('week'))   return num === 1 ? '1W' : `${num}W`;
        if (unit.startsWith('month'))  return num === 1 ? '1M' : `${num}M`;
      }
      return s;
    }
    case 'source':
      return String(value).toLowerCase();
    case 'text':
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
 * @param {Object} [options]
 * @param {boolean} [options.strict=true] - If false, silently skip unresolved params
 */
function applyParams(indicator, params, options = {}) {
  if (!params || typeof params !== 'object') return;
  const strict = options.strict !== undefined ? options.strict : true;

  const keyMap = buildKeyMap(indicator.inputs);
  const skipped = [];
  let applied = 0;

  for (const [key, rawValue] of Object.entries(params)) {
    const inputId = keyMap.get(key.trim());
    if (!inputId) {
      skipped.push(key);
      if (!strict) continue;
      const available = Object.entries(indicator.inputs)
        .filter(([id, inp]) => !inp.isHidden && id !== 'pineFeatures' && id !== '__profile')
        .map(([id, inp]) => `  "${(inp.name || id).trim()}" (${id}, type: ${inp.type})`)
        .join('\n');
      throw new Error(
        `Parameter "${key}" not found.\nAvailable parameters:\n${available}`
      );
    }

    const input = indicator.inputs[inputId];
    const coerced = coerceValue(rawValue, input.type, (input.name || inputId).trim());

    // For dropdown inputs with options, resolve to exact option value
    if (input.options && input.options.length > 0) {
      if (input.options.includes(coerced)) {
        indicator.setOption(inputId, coerced);
      } else {
        // Try case-insensitive match
        const match = input.options.find(
          o => String(o).trim().toLowerCase() === String(coerced).trim().toLowerCase()
        );
        if (match) {
          indicator.setOption(inputId, match);
        } else {
          // No match — keep the indicator's existing default value
          console.warn(`[applyParams] Dropdown "${(input.name || inputId).trim()}" (${inputId}): value ${JSON.stringify(coerced)} not in options, keeping default ${JSON.stringify(input.value)}`);
          continue;
        }
      }
      applied++;
      continue;
    }

    indicator.setOption(inputId, coerced);
    applied++;
  }

  if (skipped.length > 0) {
    console.warn(`[applyParams] Skipped ${skipped.length} unresolved params: ${skipped.join(', ')}`);
  }
  if (!strict) {
    console.log(`[applyParams] Applied ${applied}/${Object.keys(params).length} params (${skipped.length} skipped)`);
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
