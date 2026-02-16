const TradingView = require('./main');

const SESSION = process.env.TV_SESSION;
const SIGNATURE = process.env.TV_SIGNATURE;

if (!SESSION || !SIGNATURE) {
  throw new Error('Missing required environment variables: TV_SESSION and TV_SIGNATURE must be set.');
}

console.log('=== Full Strategy Report Structure ===\n');

(async () => {
  const privateIndicators = await TradingView.getPrivateIndicators(SESSION, SIGNATURE);
  const zeroLag = privateIndicators.find(i => i.name.includes('Zero Lag'));
  const strategyData = await zeroLag.get();

  const client = new TradingView.Client({ token: SESSION, signature: SIGNATURE });
  const chart = new client.Session.Chart();
  chart.setMarket('BINANCE:BTCUSDT', { timeframe: 'D', range: 300 });

  chart.onError((...err) => console.error('Chart error:', ...err));

  let done = false;
  chart.onUpdate(() => {
    if (done) return;
    done = true;

    const study = new chart.Study(strategyData);

    study.onUpdate(() => {
      const report = study.strategyReport;
      if (!report) {
        console.log('No strategy report yet');
        return;
      }

      // Print all top-level keys
      console.log('=== strategyReport top-level keys ===');
      console.log(Object.keys(report));

      // Print each key separately (excluding trades array which is huge)
      for (const [key, val] of Object.entries(report)) {
        if (key === 'trades') {
          console.log(`\ntrades: ${val.length} trades`);
          console.log('First trade structure:', JSON.stringify(val[0], null, 2));
        } else if (key === 'history') {
          console.log(`\nhistory: ${Array.isArray(val) ? val.length + ' entries' : typeof val}`);
          if (Array.isArray(val) && val.length > 0) {
            console.log('First history entry:', JSON.stringify(val[0], null, 2));
            console.log('Last history entry:', JSON.stringify(val[val.length - 1], null, 2));
          } else if (typeof val === 'object') {
            console.log(JSON.stringify(val, null, 2).substring(0, 2000));
          }
        } else {
          const str = JSON.stringify(val, null, 2);
          if (str && str.length > 3000) {
            console.log(`\n${key} (truncated):`, str.substring(0, 3000));
          } else {
            console.log(`\n${key}:`, str);
          }
        }
      }

      chart.delete();
      client.end();
    });

    study.onError((...err) => {
      console.error('Study error:', ...err);
      chart.delete();
      client.end();
    });
  });

  setTimeout(() => {
    console.log('\n--- Timeout ---');
    try { chart.delete(); } catch (e) {}
    client.end();
  }, 30000);
})();
