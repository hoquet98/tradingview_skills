/**
 * Example 1: RSI Strategy on BTC Daily, range from chart
 */
const tv = require('../index');
const { close } = require('../lib/ws-client');

(async () => {
  try {
    const result = await tv.backtest('STD;RSI%1Strategy', 'BINANCE:BTCUSDT', {
      timeframe: 'D',
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
