/**
 * Debug: what does TradingView send back for a zero-trade combo?
 * Tests F=10 M=10 S=30 which produces 0 trades.
 */
const TradingView = require('../tradingview-api-reference/main');
const { getClient, getCredentials, close } = require('../lib/ws-client');
const { applyParams } = require('../lib/params');

(async () => {
  try {
    const { session, signature } = getCredentials();
    const indicator = await TradingView.getIndicator('USER;3f778e242a9b42d7992cd31da1320432', 'last', session, signature);
    indicator.setType('StrategyScript@tv-scripting-101!');
    applyParams(indicator, { 'Fast EMA Length': 10, 'Medium EMA Length': 10, 'Slow EMA Length': 30 });

    const client = await getClient();
    const chart = new client.Session.Chart();

    setTimeout(() => { console.log('TIMEOUT 15s'); chart.delete(); close().then(() => process.exit(1)); }, 15000);

    chart.onError((...err) => console.log('CHART ERROR:', ...err));

    chart.onSymbolLoaded(() => {
      console.log('Symbol loaded, attaching study...');
      const study = new chart.Study(indicator);

      study.onError((...err) => console.log('STUDY ERROR:', ...err));

      study.onUpdate((changes) => {
        console.log('Study update, changes:', changes);
        const report = study.strategyReport;
        console.log('  trades:', report.trades?.length || 0);
        console.log('  performance.all:', report.performance?.all ? 'yes' : 'no');
        console.log('  performance keys:', Object.keys(report.performance || {}));
        console.log('  report keys:', Object.keys(report));
        if (report.performance?.all) {
          console.log('  totalTrades:', report.performance.all.totalTrades);
          console.log('  netProfit:', report.performance.all.netProfit);
        }
        console.log('  RAW report:', JSON.stringify(report, null, 2).slice(0, 2000));
        // Exit after first meaningful update
        if (changes.includes('report.trades') || changes.includes('report.perf')) {
          chart.delete();
          close().then(() => process.exit(0));
        }
      });
    });

    chart.setMarket('CME_MINI:ES1!', { timeframe: '1', range: 20000 });
  } catch (e) {
    console.error('Error:', e.message);
    await close();
    process.exit(1);
  }
})();
