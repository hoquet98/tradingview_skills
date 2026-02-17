/**
 * Script Management Workflow
 * List saved scripts, inspect details, and manage invite-only permissions.
 *
 * Usage:
 *   node workflows/script-management.js                     # List all scripts
 *   node workflows/script-management.js inspect USER;abc123  # Inspect a script
 *   node workflows/script-management.js perms PUB;abc123     # List permissions
 *   node workflows/script-management.js grant PUB;abc123 username [expiration]
 *   node workflows/script-management.js revoke PUB;abc123 username
 */
const { getSavedScripts } = require('../skills/get-saved-scripts');
const { getIndicatorDetails } = require('../skills/get-indicator-details');
const { managePinePermissions } = require('../skills/manage-pine-permissions');

async function scriptManagement(action = 'list', ...args) {
  switch (action) {
    case 'list': {
      const scripts = await getSavedScripts();
      if (!scripts.success) return scripts;

      return {
        success: true,
        message: `${scripts.count} saved scripts`,
        scripts: scripts.scripts.map(s => ({
          id: s.id,
          name: s.name,
          type: s.type,
          version: s.version,
          access: s.access,
        })),
      };
    }

    case 'inspect': {
      const scriptId = args[0];
      if (!scriptId) return { success: false, message: 'Script ID required. Usage: inspect <scriptId>' };

      const details = await getIndicatorDetails(scriptId);
      if (!details.success) return details;

      return {
        success: true,
        message: `Details for ${details.indicator.shortDescription || scriptId}`,
        indicator: {
          id: details.indicator.id,
          name: details.indicator.description,
          shortName: details.indicator.shortDescription,
          version: details.indicator.version,
          inputs: details.indicator.inputs
            .filter(i => !i.isHidden)
            .map(i => ({ name: i.name, type: i.type, default: i.value, options: i.options })),
          plots: details.indicator.plots,
        },
      };
    }

    case 'perms': {
      const pineId = args[0];
      if (!pineId) return { success: false, message: 'Pine ID required. Usage: perms <pineId>' };
      return managePinePermissions('list', pineId);
    }

    case 'grant': {
      const [pineId, username, expiration] = args;
      if (!pineId || !username) {
        return { success: false, message: 'Usage: grant <pineId> <username> [expiration]' };
      }
      return managePinePermissions('add', pineId, { username, expiration });
    }

    case 'revoke': {
      const [pineId, username] = args;
      if (!pineId || !username) {
        return { success: false, message: 'Usage: revoke <pineId> <username>' };
      }
      return managePinePermissions('remove', pineId, { username });
    }

    default:
      return { success: false, message: `Unknown action "${action}". Use: list, inspect, perms, grant, revoke` };
  }
}

async function main() {
  const action = process.argv[2] || 'list';
  const args = process.argv.slice(3);

  try {
    const result = await scriptManagement(action, ...args);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, message: 'Workflow error', error: error.message }, null, 2));
  }
}

module.exports = { scriptManagement };
if (require.main === module) main();
