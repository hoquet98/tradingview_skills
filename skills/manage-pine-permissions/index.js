const { getCredentials, TradingView } = require('../../lib/ws-client');
const PinePermManager = require('../../tradingview-api-reference/src/classes/PinePermManager');

/**
 * Manage invite-only Pine script access permissions.
 * Supports listing, adding, modifying expiration, and removing authorized users.
 *
 * @param {string} action - 'list' | 'add' | 'modify' | 'remove'
 * @param {string} pineId - Script ID (e.g. 'PUB;XXXXXXXXXXXXXXXXXXXXX')
 * @param {Object} [options]
 * @param {string} [options.username] - Username for add/modify/remove actions
 * @param {string} [options.expiration] - Expiration date ISO string for add/modify
 * @param {number} [options.limit=50] - Limit for list action
 * @param {string} [options.order='-created'] - Sort order for list action
 * @returns {Promise<{success:boolean, message:string, users?:Array, status?:string}>}
 */
async function managePinePermissions(action = 'list', pineId, options = {}) {
  if (!pineId) {
    return { success: false, message: 'pineId is required' };
  }

  try {
    const { session, signature } = getCredentials();
    const manager = new PinePermManager(session, signature, pineId);

    switch (action) {
      case 'list': {
        const { limit = 50, order = '-created' } = options;
        const users = await manager.getUsers(limit, order);
        return {
          success: true,
          message: `Found ${users.length} authorized user(s) for ${pineId}`,
          pineId,
          users: users.map(u => ({
            id: u.id,
            username: u.username,
            userpic: u.userpic,
            expiration: u.expiration,
            created: u.created,
          })),
          count: users.length,
        };
      }

      case 'add': {
        if (!options.username) {
          return { success: false, message: 'username is required for add action' };
        }
        const expiration = options.expiration ? new Date(options.expiration) : null;
        const status = await manager.addUser(options.username, expiration);
        return {
          success: true,
          message: `User "${options.username}" added to ${pineId}`,
          pineId,
          username: options.username,
          status,
          expiration: expiration ? expiration.toISOString() : null,
        };
      }

      case 'modify': {
        if (!options.username) {
          return { success: false, message: 'username is required for modify action' };
        }
        const expiration = options.expiration ? new Date(options.expiration) : null;
        const status = await manager.modifyExpiration(options.username, expiration);
        return {
          success: true,
          message: `Expiration updated for "${options.username}" on ${pineId}`,
          pineId,
          username: options.username,
          status,
          expiration: expiration ? expiration.toISOString() : null,
        };
      }

      case 'remove': {
        if (!options.username) {
          return { success: false, message: 'username is required for remove action' };
        }
        const status = await manager.removeUser(options.username);
        return {
          success: true,
          message: `User "${options.username}" removed from ${pineId}`,
          pineId,
          username: options.username,
          status,
        };
      }

      default:
        return { success: false, message: `Unknown action "${action}". Use: list, add, modify, remove` };
    }
  } catch (error) {
    return { success: false, message: 'Error managing Pine permissions', error: error.message };
  }
}

async function main() {
  const action = process.argv[2] || 'list';
  const pineId = process.argv[3];
  const username = process.argv[4];
  const expiration = process.argv[5];

  if (!pineId) {
    console.log(JSON.stringify({
      success: false,
      message: 'Usage: node index.js <list|add|modify|remove> <pineId> [username] [expiration]',
    }, null, 2));
    return;
  }

  try {
    const result = await managePinePermissions(action, pineId, { username, expiration });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Unexpected error', error: error.message }, null, 2));
  }
}

module.exports = { managePinePermissions };
if (require.main === module) main();
