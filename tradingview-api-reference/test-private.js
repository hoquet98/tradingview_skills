const TradingView = require('./main');

const SESSION = process.env.TV_SESSION;
const SIGNATURE = process.env.TV_SIGNATURE;

if (!SESSION || !SIGNATURE) {
  throw new Error('Missing required environment variables: TV_SESSION and TV_SIGNATURE must be set.');
}

console.log('=== List Private Indicators + Search Zero Lag ===\n');

(async () => {
  try {
    // 1. Get user info
    console.log('--- Getting user info ---');
    const user = await TradingView.getUser(SESSION, SIGNATURE);
    console.log(`Logged in as: ${user.username} (ID: ${user.id})`);
    console.log(`Joined: ${user.joinDate}`);
    console.log(`Reputation: ${user.reputation}`);

    // 2. List private indicators
    console.log('\n--- Private Indicators ---');
    const privateIndicators = await TradingView.getPrivateIndicators(SESSION, SIGNATURE);
    if (privateIndicators.length === 0) {
      console.log('No private indicators found.');
    } else {
      for (const ind of privateIndicators) {
        console.log(`  [${ind.type}] ${ind.name} (${ind.access}) - ID: ${ind.id}`);
      }
    }

    // 3. Search for "Zero lag"
    console.log('\n--- Searching for "Zero lag" ---');
    const results = await TradingView.searchIndicator('Zero lag');
    const strategies = results.filter(r => r.type === 'strategy');
    const studies = results.filter(r => r.type === 'study');

    console.log(`Found ${results.length} results (${strategies.length} strategies, ${studies.length} studies)`);
    console.log('\nStrategies:');
    for (const s of strategies.slice(0, 10)) {
      console.log(`  [${s.access}] ${s.name} by ${s.author.username} - ID: ${s.id}`);
    }
    console.log('\nStudies (first 10):');
    for (const s of studies.slice(0, 10)) {
      console.log(`  [${s.access}] ${s.name} by ${s.author.username} - ID: ${s.id}`);
    }

    // 4. Search for "Dead Zone" too
    console.log('\n--- Searching for "Dead Zone" ---');
    const dzResults = await TradingView.searchIndicator('Dead Zone');
    console.log(`Found ${dzResults.length} results`);
    for (const s of dzResults.slice(0, 10)) {
      console.log(`  [${s.type}] [${s.access}] ${s.name} by ${s.author.username} - ID: ${s.id}`);
    }

    // 5. Search for "Vector"
    console.log('\n--- Searching for "Vector" ---');
    const vecResults = await TradingView.searchIndicator('Vector');
    console.log(`Found ${vecResults.length} results`);
    for (const s of vecResults.slice(0, 5)) {
      console.log(`  [${s.type}] [${s.access}] ${s.name} by ${s.author.username} - ID: ${s.id}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
})();
