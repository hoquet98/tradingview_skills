/**
 * Example 2: EMA/RSI Scalper on ES 1-min, range from chart
 */
const tv = require('../index');
const { close } = require('../lib/ws-client');

(async () => {
  try {
    const result = await tv.backtest('USER;3f778e242a9b42d7992cd31da1320432', 'CME_MINI:ES1!', {
      timeframe: '1',
      range: 'chart',
    });

    if (!result.success) {
      console.log('FAILED:', result.message, result.error || '');
      return;
    }

    const p = result.report.performance.all || {};
    console.log('Trades:', p.totalTrades);
    console.log('Net P&L:', p.netProfit);
    console.log('Win Rate:', ((p.percentProfitable || 0) * 100).toFixed(1) + '%');
    console.log('Profit Factor:', (p.profitFactor || 0).toFixed(3));
    console.log('Max DD:', result.report.performance.maxStrategyDrawDown);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await close();
  }
})();
