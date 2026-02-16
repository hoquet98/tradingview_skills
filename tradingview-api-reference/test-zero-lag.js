const TradingView = require('./main');

const SESSION = process.env.TV_SESSION;
const SIGNATURE = process.env.TV_SIGNATURE;

if (!SESSION || !SIGNATURE) {
  throw new Error('Missing required environment variables: TV_SESSION and TV_SIGNATURE must be set.');
}

console.log('=== Zero Lag Strategy Backtest Test ===\n');

(async () => {
  try {
    // Get your private Zero Lag strategy
    console.log('Fetching Zero Lag strategy details...');
    const privateIndicators = await TradingView.getPrivateIndicators(SESSION, SIGNATURE);
    const zeroLag = privateIndicators.find(i => i.name.includes('Zero Lag'));

    if (!zeroLag) {
      console.error('Zero Lag strategy not found in private indicators');
      return;
    }

    console.log(`Found: ${zeroLag.name}`);
    console.log(`Type: ${zeroLag.type}, Access: ${zeroLag.access}`);
    console.log(`ID: ${zeroLag.id}`);

    // Get the full indicator data
    console.log('\nLoading full strategy data...');
    const strategyData = await zeroLag.get();
    console.log(`Description: ${strategyData.description}`);
    console.log(`Short: ${strategyData.shortDescription}`);
    console.log(`Inputs:`, Object.keys(strategyData.inputs).length, 'parameters');

    // Print some inputs
    console.log('\nStrategy inputs:');
    for (const [key, input] of Object.entries(strategyData.inputs)) {
      if (!input.isHidden) {
        console.log(`  ${input.name}: ${input.value} (${input.type})`);
      }
    }

    // Now create a chart and load the strategy
    console.log('\n--- Creating chart ---');
    const client = new TradingView.Client({
      token: SESSION,
      signature: SIGNATURE,
    });

    const chart = new client.Session.Chart();
    chart.setMarket('BINANCE:BTCUSDT', {
      timeframe: 'D',
      range: 300,
    });

    chart.onError((...err) => {
      console.error('Chart error:', ...err);
    });

    chart.onSymbolLoaded(() => {
      console.log(`Symbol loaded: ${chart.infos.description}`);
    });

    let studyCreated = false;
    chart.onUpdate(() => {
      if (studyCreated) return;
      studyCreated = true;

      console.log(`Price: $${chart.periods[0]?.close}, Candles: ${chart.periods.length}`);
      console.log('\nLoading Zero Lag strategy on chart...');

      const study = new chart.Study(strategyData);

      study.onReady(() => {
        console.log('Strategy study is READY!');
      });

      study.onUpdate(() => {
        console.log('\n=== STRATEGY UPDATE ===');
        console.log('Has strategyReport:', !!study.strategyReport);
        console.log('Periods count:', study.periods?.length || 0);

        if (study.strategyReport) {
          const report = study.strategyReport;
          console.log('\n=== BACKTEST REPORT ===');
          console.log(JSON.stringify(report, null, 2).substring(0, 5000));
        }

        if (study.periods && study.periods.length > 0) {
          console.log('\nLatest strategy period:');
          console.log(JSON.stringify(study.periods[0], null, 2).substring(0, 1000));
        }

        // Close after getting data
        console.log('\n--- Done, closing ---');
        chart.delete();
        client.end();
      });

      study.onError((...err) => {
        console.error('Study error:', ...err);
        chart.delete();
        client.end();
      });
    });

    // Safety timeout
    setTimeout(() => {
      console.log('\n--- Timeout after 30s ---');
      try { chart.delete(); } catch (e) {}
      client.end();
    }, 30000);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
})();
