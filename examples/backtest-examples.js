/**
 * Backtest examples — DEMA ATR Strategy on NQ 1-min
 *
 * Shows all the ways to call the unified backtest() function.
 * Run: node examples/backtest-examples.js [example-number]
 *
 * Examples:
 *   node examples/backtest-examples.js 1   # Range from chart (default)
 *   node examples/backtest-examples.js 2   # Last 30 days
 *   node examples/backtest-examples.js 3   # Custom date range
 *   node examples/backtest-examples.js 4   # With optimized parameters
 *   node examples/backtest-examples.js 5   # Discover parameters first
 *   node examples/backtest-examples.js 6   # Compare across timeframes
 *   node examples/backtest-examples.js     # Run all examples
 */

const tv = require('../index');
const { close } = require('../lib/ws-client');

const DEMA_SCRIPT = 'USER;141f0a3b0a9645ab9bee78dd7ec149af';
const RSI_SCRIPT = 'STD;RSI%1Strategy';
const SYMBOL = 'CME_MINI:NQ1!';

// Optimized DEMA parameters
const DEMA_PARAMS = {
  'MA Period': 145,
  'ATR Factor': 1.93,
  'ATR Period': 4,
  'DEMA Period': 3,
  'Stop Ticks': 85,
  'Target Ticks': 125,
  'Allow Longs': true,
  'Allow Shorts': false,
  'Trail Enable': true,
  'Trail Offset': 1,
  'Trail Trigger': 85,
  'Lockout Bars': 10,
  'Max Bars Exit': true,
  'Max Bars in Trade': 12,
  'BE Enable': true,
  'BE Offset': 5,
  'BE Trigger': 25,
  'MA Type': 'Ema',
  'Lookback Bars': 5,
  'Trading Hours': '0930-1600',
  'Day Filter Enable': true,
  'Friday': true,
  'Monday': true,
  'Tuesday': true,
  'Wednesday': true,
  'Thursday': true,
  'Saturday': true,
  'Sunday': true,
  'Timezone': 'America/New_York',
  'Displacement Filter': true,
  'Max Displacement Ticks': 190,
  'Min Confluence Distance': true,
  'Require Confluence MA Filter': true,
  'Min Distance Ticks': 85,
  'Exclude 1 Enable': true,
  'Exclude Hours 1': '1545-1800',
  'Session Enable': false,
  'EOD Close Enable': false,
  'Duration BE Enable': false,
};

function printReport(label, result) {
  if (!result.success) {
    console.log(`  ${label}: FAILED — ${result.message} ${result.error || ''}`);
    return;
  }
  const p = result.report.performance.all || {};
  console.log(`  ${label}:`);
  console.log(`    Mode: ${result.mode} | Trades: ${p.totalTrades} | Net P&L: $${p.netProfit}`);
  console.log(`    Win Rate: ${((p.percentProfitable || 0) * 100).toFixed(1)}% | PF: ${(p.profitFactor || 0).toFixed(3)} | Max DD: $${result.report.performance.maxStrategyDrawDown}`);
}

// --- Example 1: Range from chart ---
async function example1() {
  console.log('\n=== Example 1: Range from chart (default) ===');
  console.log('Matches what you see on TradingView. Premium=20K bars, Pro=10K, Free=5K.');
  const result = await tv.backtest(RSI_SCRIPT, 'BINANCE:BTCUSDT', {
    timeframe: 'D',
    range: 'chart',
  });
  printReport('RSI on BTC Daily', result);
}

// --- Example 2: Day-based range ---
async function example2() {
  console.log('\n=== Example 2: Last 30 days ===');
  console.log('Calculates bar count from days automatically.');
  const result = await tv.backtest(RSI_SCRIPT, 'BINANCE:BTCUSDT', {
    timeframe: 'D',
    range: '30d',
  });
  printReport('RSI on BTC Daily (30d)', result);
}

// --- Example 3: Custom date range ---
async function example3() {
  console.log('\n=== Example 3: Custom date range ===');
  console.log('Auto-routes to deep backtest. Premium plan required.');
  const result = await tv.backtest(RSI_SCRIPT, 'BINANCE:BTCUSDT', {
    timeframe: 'D',
    range: { from: '2024-01-01', to: '2025-01-01' },
  });
  printReport('RSI on BTC Daily (2024)', result);
}

// --- Example 4: With optimized parameters ---
async function example4() {
  console.log('\n=== Example 4: DEMA with optimized parameters ===');
  console.log('String params are auto-coerced. "145" → 145 for integer inputs.');
  const result = await tv.backtest(DEMA_SCRIPT, SYMBOL, {
    timeframe: '1',
    range: 'chart',
    params: DEMA_PARAMS,
  });
  printReport('DEMA on NQ 1-min (chart range)', result);
}

// --- Example 5: Discover parameters first ---
async function example5() {
  console.log('\n=== Example 5: Discover parameters ===');
  console.log('Use getStrategyParams() to see all available parameters.\n');
  const params = await tv.getStrategyParams(RSI_SCRIPT);
  const visible = params.filter(p => !p.isHidden);
  console.log(`  ${visible.length} visible parameters for RSI Strategy:`);
  visible.slice(0, 10).forEach(p => {
    const opts = p.options ? ` [${p.options.join(', ')}]` : '';
    console.log(`    ${p.name} (${p.type}): default=${p.defaultValue}${opts}`);
  });
  if (visible.length > 10) console.log(`    ... and ${visible.length - 10} more`);
}

// --- Example 6: Compare across timeframes ---
async function example6() {
  console.log('\n=== Example 6: Compare across timeframes ===');
  const timeframes = ['5', '15', '60', 'D'];
  for (const tf of timeframes) {
    const result = await tv.backtest(RSI_SCRIPT, 'BINANCE:BTCUSDT', {
      timeframe: tf,
      range: 'chart',
    });
    printReport(`RSI on BTC ${tf}`, result);
  }
}

// --- Main ---
(async () => {
  const selected = process.argv[2];
  const examples = { 1: example1, 2: example2, 3: example3, 4: example4, 5: example5, 6: example6 };

  try {
    if (selected && examples[selected]) {
      await examples[selected]();
    } else {
      // Run all examples
      for (const fn of Object.values(examples)) {
        await fn();
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await close();
  }
})();
