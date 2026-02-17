const { getCredentials, TradingView } = require('../../lib/ws-client');

/**
 * Get authenticated user profile info via HTTP API.
 * Returns user details: id, username, reputation, followers, auth token,
 * and membership/plan level decoded from the JWT auth_token.
 *
 * @returns {Promise<{success:boolean, message:string, user?:Object}>}
 */
async function getUserInfo() {
  try {
    const { session, signature } = getCredentials();
    const user = await TradingView.getUser(session, signature);

    // Decode membership info from the JWT auth_token
    let membership = null;
    if (user.authToken) {
      try {
        membership = decodeMembership(user.authToken);
      } catch (e) {
        // Non-fatal
      }
    }

    return {
      success: true,
      message: `User info for ${user.username}`,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        reputation: user.reputation,
        following: user.following,
        followers: user.followers,
        notifications: user.notifications,
        sessionHash: user.sessionHash,
        privateChannel: user.privateChannel,
        authToken: user.authToken,
        joinDate: user.joinDate,
        ...(membership || {}),
      },
    };
  } catch (error) {
    return { success: false, message: 'Error getting user info', error: error.message };
  }
}

/**
 * Decode membership/plan info from the TradingView JWT auth_token.
 * The JWT payload contains plan, prostatus, and account limits.
 */
function decodeMembership(jwt) {
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;

  // Base64url decode the payload (second part)
  const payload = JSON.parse(
    Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
  );

  const planMap = {
    '': 'Free / Basic',
    'pro': 'Pro',
    'pro_plus': 'Pro+',
    'pro_premium': 'Premium',
    'trial': 'Trial',
  };

  return {
    plan: payload.plan || 'free',
    planName: planMap[payload.plan] || payload.plan || 'Free / Basic',
    proStatus: payload.prostatus || 'non_pro',
    isPro: payload.prostatus !== 'non_pro',
    limits: {
      maxStudies: payload.max_studies,
      maxFundamentals: payload.max_fundamentals,
      maxCharts: payload.max_charts,
      maxActiveAlerts: payload.max_active_alerts,
      maxStudyOnStudy: payload.max_study_on_study,
      watchlistSymbolsLimit: payload.watchlist_symbols_limit,
      multipleWatchlists: payload.multiple_watchlists,
      maxConnections: payload.max_connections,
      maxOverallAlerts: payload.max_overall_alerts,
      extendedHours: !!payload.ext_hours,
    },
  };
}

async function main() {
  try {
    const result = await getUserInfo();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  }
}

module.exports = { getUserInfo, decodeMembership };
if (require.main === module) main();
