const { getCredentials, TradingView } = require('../../lib/ws-client');

/**
 * Get full indicator/strategy metadata: inputs, plots, description.
 * Uses HTTP API — no browser needed.
 *
 * @param {string} scriptId - Indicator ID (e.g. 'STD;RSI', 'PUB;xxxxx', 'USER;xxxxx')
 * @param {Object} [options]
 * @param {string} [options.version='last'] - Script version
 * @returns {Promise<{success:boolean, message:string, indicator?:Object}>}
 */
async function getIndicatorDetails(scriptId, options = {}) {
  const { version = 'last' } = options;

  if (!scriptId) {
    return { success: false, message: 'Script ID required (e.g. STD;RSI, PUB;xxxxx)' };
  }

  try {
    let session = '', signature = '';
    try {
      const creds = getCredentials();
      session = creds.session;
      signature = creds.signature;
    } catch {
      // No credentials — public scripts only
    }

    const indicator = await TradingView.getIndicator(scriptId, version, session, signature);

    return {
      success: true,
      message: `Indicator details for ${scriptId}`,
      indicator: {
        id: indicator.pineId,
        version: indicator.pineVersion,
        description: indicator.description,
        shortDescription: indicator.shortDescription,
        type: indicator.type,
        inputs: Object.entries(indicator.inputs).map(([id, input]) => ({
          id,
          name: input.name,
          type: input.type,
          value: input.value,
          isHidden: input.isHidden,
          options: input.options || undefined,
          tooltip: input.tooltip || undefined,
        })),
        plots: indicator.plots,
        inputCount: Object.keys(indicator.inputs).length,
        plotCount: Object.keys(indicator.plots).length,
      },
    };
  } catch (error) {
    return { success: false, message: 'Error getting indicator details', error: error.message };
  }
}

async function main() {
  const scriptId = process.argv[2] || 'STD;RSI';
  const version = process.argv[3] || 'last';

  try {
    const result = await getIndicatorDetails(scriptId, { version });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  }
}

module.exports = { getIndicatorDetails };
if (require.main === module) main();
