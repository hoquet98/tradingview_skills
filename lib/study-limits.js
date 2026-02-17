/**
 * Study Limits Module
 * Checks TradingView plan limits before adding indicators/strategies to charts.
 * Free accounts: maxStudies=2, Pro: 5, Pro+: 10, Premium: 25.
 */

let _cachedLimits = null;

/**
 * Get the user's study limit from the JWT auth token.
 * Cached after first call — limits don't change during a session.
 * Falls back to maxStudies=2 (free tier) if JWT decode fails.
 * @returns {Promise<{maxStudies: number, plan: string, planName: string}>}
 */
async function getUserStudyLimits() {
  if (_cachedLimits) return _cachedLimits;

  try {
    const { getUserInfo } = require('../skills/get-user-info');
    const info = await getUserInfo();
    if (info.success && info.user?.limits) {
      _cachedLimits = {
        maxStudies: info.user.limits.maxStudies,
        plan: info.user.plan || 'free',
        planName: info.user.planName || 'Free / Basic',
      };
      return _cachedLimits;
    }
  } catch (e) {
    // Fall through to default
  }

  _cachedLimits = { maxStudies: 2, plan: 'free', planName: 'Free / Basic (assumed)' };
  return _cachedLimits;
}

/**
 * Count studies currently on a Playwright chart.
 * Uses the delete-button pattern: legend items with a delete button are studies,
 * the main symbol row does not have a delete button.
 * @param {import('playwright').Page} page
 * @returns {Promise<{studyCount: number, studies: string[]}>}
 */
async function countStudiesOnChart(page) {
  try {
    await page.waitForSelector('div[data-qa-id="legend-source-item"]', { timeout: 5000 }).catch(() => {});

    const result = await page.evaluate(() => {
      const items = document.querySelectorAll('div[data-qa-id="legend-source-item"]');
      const studies = [];

      for (const item of items) {
        const deleteBtn = item.querySelector('[data-qa-id="legend-delete-action"]');
        if (deleteBtn) {
          const titleEl = item.querySelector('[data-qa-id="legend-source-title"]');
          studies.push(titleEl?.textContent?.trim() || 'Unknown');
        }
      }

      return { studyCount: studies.length, studies };
    });

    return result;
  } catch (e) {
    return { studyCount: 0, studies: [] };
  }
}

/**
 * Check whether N additional studies can be added to the chart.
 * @param {import('playwright').Page} page
 * @param {number} [toAdd=1] - Number of studies the caller wants to add
 * @returns {Promise<{canAdd: boolean, canAddCount: number, available: number,
 *           currentCount: number, currentStudies: string[],
 *           maxStudies: number, plan: string, message: string}>}
 */
async function checkStudyCapacity(page, toAdd = 1) {
  const limits = await getUserStudyLimits();
  const chart = await countStudiesOnChart(page);

  const available = Math.max(0, limits.maxStudies - chart.studyCount);
  const canAddCount = Math.min(toAdd, available);
  const canAdd = canAddCount >= toAdd;

  let message;
  if (canAdd) {
    message = `OK: ${chart.studyCount}/${limits.maxStudies} study slots used, room for ${available} more`;
  } else {
    message = `Study limit reached: ${chart.studyCount}/${limits.maxStudies} slots used (${limits.planName} plan). ` +
              `Cannot add ${toAdd} ${toAdd === 1 ? 'study' : 'studies'}, only ${available} slot(s) available. ` +
              `Current studies: ${chart.studies.join(', ') || 'none'}`;
  }

  return {
    canAdd,
    canAddCount,
    available,
    currentCount: chart.studyCount,
    currentStudies: chart.studies,
    maxStudies: limits.maxStudies,
    plan: limits.planName,
    message,
  };
}

/**
 * Clear the cached limits (useful for testing or session changes).
 */
function clearLimitsCache() {
  _cachedLimits = null;
}

module.exports = {
  getUserStudyLimits,
  countStudiesOnChart,
  checkStudyCapacity,
  clearLimitsCache,
};
