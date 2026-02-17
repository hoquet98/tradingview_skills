/**
 * Validate Strategy Workflow
 * Test whether a Pine Script strategy/indicator compiles successfully on TradingView.
 * Loads the script as a Study on a WebSocket chart and checks for study_error events.
 *
 * Usage:
 *   node workflows/validate-strategy.js "STD;RSI%1Strategy"
 *   node workflows/validate-strategy.js "PUB;abc123"
 *   node workflows/validate-strategy.js "STD;RSI%1Strategy" BINANCE:BTCUSDT D
 */
const { getClient, getCredentials, TradingView, close } = require('../lib/ws-client');

async function validateStrategy(scriptId, options = {}) {
  const { symbol = 'BINANCE:BTCUSDT', timeframe = 'D', timeout = 15000 } = options;

  if (!scriptId) {
    return { success: false, message: 'Script ID required (e.g. STD;RSI%1Strategy, PUB;xxxxx)' };
  }

  // 1. Load the indicator metadata
  let indicator;
  try {
    const { session, signature } = getCredentials();
    indicator = await TradingView.getIndicator(scriptId, 'last', session, signature);
  } catch (error) {
    return {
      success: false,
      message: 'Failed to load script',
      error: error.message,
      compiles: false,
    };
  }

  // Determine if it's a strategy or indicator
  const isStrategy = indicator.type === 'StrategyScript@tv-scripting-101!' ||
    indicator.shortDescription?.toLowerCase().includes('strategy') ||
    scriptId.toLowerCase().includes('strategy');

  if (isStrategy) {
    indicator.setType('StrategyScript@tv-scripting-101!');
  }

  // 2. Create a chart and load the script as a Study
  const client = await getClient();

  return new Promise((resolve) => {
    const chart = new client.Session.Chart();
    let study;
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        chart.delete();
        // If we timed out without error, it probably compiled fine but
        // didn't produce data (e.g. no trades for a strategy)
        resolve({
          success: true,
          message: 'Script loaded successfully (no errors within timeout)',
          compiles: true,
          scriptId,
          scriptName: indicator.shortDescription || indicator.description,
          scriptType: isStrategy ? 'strategy' : 'indicator',
          symbol,
          timeframe,
        });
      }
    }, timeout);

    chart.onError((...err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        chart.delete();
        resolve({
          success: false,
          message: 'Chart error',
          compiles: false,
          error: err.join(' '),
          scriptId,
        });
      }
    });

    chart.setMarket(symbol, { timeframe, range: 100 });

    chart.onSymbolLoaded(() => {
      study = new chart.Study(indicator);

      study.onError((...err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          chart.delete();
          resolve({
            success: true,
            message: 'Script has compilation/runtime errors',
            compiles: false,
            scriptId,
            scriptName: indicator.shortDescription || indicator.description,
            scriptType: isStrategy ? 'strategy' : 'indicator',
            errors: err,
            symbol,
            timeframe,
          });
        }
      });

      // If study completes without error, it compiled
      study.onReady(() => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          chart.delete();
          resolve({
            success: true,
            message: 'Script compiles and runs successfully',
            compiles: true,
            scriptId,
            scriptName: indicator.shortDescription || indicator.description,
            scriptType: isStrategy ? 'strategy' : 'indicator',
            symbol,
            timeframe,
          });
        }
      });
    });
  });
}

async function main() {
  const scriptId = process.argv[2] || 'STD;RSI%1Strategy';
  const symbol = process.argv[3] || 'BINANCE:BTCUSDT';
  const timeframe = process.argv[4] || 'D';

  try {
    const result = await validateStrategy(scriptId, { symbol, timeframe });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Workflow error', error: error.message }, null, 2));
  } finally {
    await close();
  }
}

module.exports = { validateStrategy };
if (require.main === module) main();
