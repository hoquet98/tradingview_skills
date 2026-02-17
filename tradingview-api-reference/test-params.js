const TradingView = require('./main');

const SESSION = process.env.TV_SESSION;
const SIGNATURE = process.env.TV_SIGNATURE;

if (!SESSION || !SIGNATURE) {
  throw new Error('Missing required environment variables: TV_SESSION and TV_SIGNATURE must be set.');
}

(async () => {
  try {
    // 1. Your private Zero Lag strategy
    console.log('=== Your Private Strategy: Zero Lag ===\n');
    const privateIndicators = await TradingView.getPrivateIndicators(SESSION, SIGNATURE);
    const zeroLag = privateIndicators.find(i => i.name.includes('Zero Lag'));
    const zlData = await zeroLag.get();

    console.log(`Name: ${zlData.description}`);
    console.log(`Inputs: ${Object.keys(zlData.inputs).length} parameters\n`);

    for (const [id, input] of Object.entries(zlData.inputs)) {
      const hidden = input.isHidden ? ' [HIDDEN]' : '';
      const options = input.options ? ` options=[${input.options.join(', ')}]` : '';
      console.log(`  ${id}: "${input.name}" = ${JSON.stringify(input.value)} (${input.type})${hidden}${options}`);
    }

    console.log(`\nPlots: ${Object.keys(zlData.plots).length} outputs`);
    for (const [id, name] of Object.entries(zlData.plots)) {
      console.log(`  ${id}: ${name}`);
    }

    // 2. A built-in indicator — RSI
    console.log('\n\n=== Built-in Indicator: RSI ===\n');
    const rsiResults = await TradingView.searchIndicator('RSI');
    const rsi = rsiResults.find(r => r.name === 'Relative Strength Index' && r.author.username === '@TRADINGVIEW@');
    if (rsi) {
      const rsiData = await rsi.get();
      console.log(`Name: ${rsiData.description}`);
      console.log(`Inputs: ${Object.keys(rsiData.inputs).length} parameters\n`);
      for (const [id, input] of Object.entries(rsiData.inputs)) {
        const hidden = input.isHidden ? ' [HIDDEN]' : '';
        const options = input.options ? ` options=[${input.options.join(', ')}]` : '';
        console.log(`  ${id}: "${input.name}" = ${JSON.stringify(input.value)} (${input.type})${hidden}${options}`);
      }
      console.log(`\nPlots: ${Object.keys(rsiData.plots).length} outputs`);
      for (const [id, name] of Object.entries(rsiData.plots)) {
        console.log(`  ${id}: ${name}`);
      }
    }

    // 3. A community indicator — search "MACD"
    console.log('\n\n=== Community Indicator: MACD ===\n');
    const macdResults = await TradingView.searchIndicator('MACD');
    const macd = macdResults.find(r => r.name === 'MACD' || (r.name.includes('MACD') && r.author.username === '@TRADINGVIEW@'));
    if (macd) {
      const macdData = await macd.get();
      console.log(`Name: ${macdData.description}`);
      console.log(`Inputs: ${Object.keys(macdData.inputs).length} parameters\n`);
      for (const [id, input] of Object.entries(macdData.inputs)) {
        const hidden = input.isHidden ? ' [HIDDEN]' : '';
        const options = input.options ? ` options=[${input.options.join(', ')}]` : '';
        console.log(`  ${id}: "${input.name}" = ${JSON.stringify(input.value)} (${input.type})${hidden}${options}`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
})();
