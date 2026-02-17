const TradingView = require('./main');

const SESSION = process.env.TV_SESSION;
const SIGNATURE = process.env.TV_SIGNATURE;

if (!SESSION || !SIGNATURE) {
  throw new Error('Missing required environment variables: TV_SESSION and TV_SIGNATURE must be set.');
}

(async () => {
  try {
    // 1. Your private Zero Lag — check for source code
    console.log('=== Private: Zero Lag ===');
    const privateIndicators = await TradingView.getPrivateIndicators(SESSION, SIGNATURE);
    const zeroLag = privateIndicators.find(i => i.name.includes('Zero Lag'));
    console.log('searchResult.source:', zeroLag.source ? `${zeroLag.source.substring(0, 200)}...` : '(empty)');

    const zlData = await zeroLag.get();
    console.log('\n.script type:', typeof zlData.script);
    console.log('.script length:', zlData.script?.length || 0);
    console.log('.script preview (first 500 chars):');
    console.log(zlData.script?.substring(0, 500) || '(null)');

    // 2. Open source community indicator
    console.log('\n\n=== Open Source: Stochastic RSI ===');
    const results = await TradingView.searchIndicator('Stochastic RSI');
    const stochRSI = results.find(r => r.name === 'Stochastic RSI' && r.author.username === '@TRADINGVIEW@');
    if (stochRSI) {
      console.log('searchResult.source:', stochRSI.source ? `${stochRSI.source.substring(0, 300)}...` : '(empty)');
      const data = await stochRSI.get();
      console.log('\n.script type:', typeof data.script);
      console.log('.script length:', data.script?.length || 0);
      console.log('.script preview (first 500 chars):');
      console.log(data.script?.substring(0, 500) || '(null)');
    }

    // 3. A community open_source indicator
    console.log('\n\n=== Community Open Source ===');
    const vecResults = await TradingView.searchIndicator('Vector Candles');
    const vec = vecResults.find(r => r.access === 'open_source');
    if (vec) {
      console.log(`Name: ${vec.name} by ${vec.author.username}`);
      console.log('Access:', vec.access);
      console.log('searchResult.source:', vec.source ? `${vec.source.substring(0, 300)}...` : '(empty)');
      const data = await vec.get();
      console.log('\n.script type:', typeof data.script);
      console.log('.script length:', data.script?.length || 0);
      console.log('.script preview (first 500 chars):');
      console.log(data.script?.substring(0, 500) || '(null)');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
})();
