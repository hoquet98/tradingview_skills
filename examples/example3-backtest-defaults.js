/**
 * Example 3: Backtest the invite-only strategy with default parameters
 */
const tv = require('../index');
const { close } = require('../lib/ws-client');

const SCRIPT_ID = 'PUB;58c41e796e954b6a8644bc37b6493a61';
const SYMBOL = 'COMEX:GC1!';

(async () => {
  try {
    const result = await tv.backtest(SCRIPT_ID, SYMBOL, {
      timeframe: '1',
      range: 20000,
      params: { 'Use Bar Magnifier': false, 'Initial Capital': 500000 },
    });

    if (!result.success) {
      console.log('FAILED:', result.message, result.error || '');
      return;
    }

    const p = result.report.performance.all || {};
    const pLong = result.report.performance.long || {};
    const pShort = result.report.performance.short || {};

    console.log(`Strategy: QTP201 Super RSI Scalper [Elite]`);
    console.log(`Symbol:   ${SYMBOL} | Timeframe: 1m | Mode: ${result.mode}`);
    console.log('─'.repeat(50));

    console.log('\n  ALL TRADES');
    console.log(`  Trades:        ${p.totalTrades}`);
    console.log(`  Net P&L:       ${p.netProfit}`);
    console.log(`  Win Rate:      ${((p.percentProfitable || 0) * 100).toFixed(1)}%`);
    console.log(`  Profit Factor: ${(p.profitFactor || 0).toFixed(3)}`);
    console.log(`  Max Drawdown:  ${result.report.performance.maxStrategyDrawDown}`);

    console.log('\n  LONG');
    console.log(`  Trades:        ${pLong.totalTrades || 0}`);
    console.log(`  Net P&L:       ${pLong.netProfit || 0}`);
    console.log(`  Win Rate:      ${((pLong.percentProfitable || 0) * 100).toFixed(1)}%`);
    console.log(`  Profit Factor: ${(pLong.profitFactor || 0).toFixed(3)}`);

    console.log('\n  SHORT');
    console.log(`  Trades:        ${pShort.totalTrades || 0}`);
    console.log(`  Net P&L:       ${pShort.netProfit || 0}`);
    console.log(`  Win Rate:      ${((pShort.percentProfitable || 0) * 100).toFixed(1)}%`);
    console.log(`  Profit Factor: ${(pShort.profitFactor || 0).toFixed(3)}`);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await close();
  }
})();
