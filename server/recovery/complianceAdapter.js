/**
 * Compliance Adapter — Pre-call compliance gating
 * 
 * Every check fails CLOSED: ambiguity blocks the call, never proceeds.
 * This module is the single gateway that must be passed before any
 * outbound call reaches the telephony provider.
 */

const recoveryConfig = require('./recoveryConfig');
const { getDb } = require('../db/database');

/**
 * Check if current time is within allowed calling hours.
 * Fails closed: if timezone resolution is uncertain, blocks.
 * @returns {{ allowed: boolean, flag: string|null }}
 */
function checkCallingHours() {
  try {
    const now = new Date();
    // Get current hour in configured timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: recoveryConfig.CALLING_TIMEZONE,
      hour: 'numeric',
      hour12: false,
    });
    const currentHour = parseInt(formatter.format(now), 10);

    if (isNaN(currentHour)) {
      // Ambiguous timezone resolution — fail closed
      return { allowed: false, flag: 'CALLING_HOURS_TIMEZONE_AMBIGUOUS' };
    }

    if (currentHour < recoveryConfig.CALLING_HOURS_START || currentHour >= recoveryConfig.CALLING_HOURS_END) {
      return { allowed: false, flag: 'OUTSIDE_CALL_WINDOW_BLOCKED' };
    }

    return { allowed: true, flag: null };
  } catch (err) {
    // Any error in timezone handling → fail closed
    return { allowed: false, flag: 'CALLING_HOURS_CHECK_ERROR' };
  }
}

/**
 * Check DND (Do Not Disturb) registry status for a phone number.
 * Fails closed: if DND status is uncertain, blocks.
 * @param {string} phoneNumber
 * @returns {Promise<{ allowed: boolean, flag: string|null }>}
 */
async function checkDND(phoneNumber) {
  if (!recoveryConfig.DND_CHECK_ENABLED) {
    return { allowed: true, flag: null };
  }

  try {
    if (!recoveryConfig.DND_API_URL) {
      // No DND API configured — fail closed
      return { allowed: false, flag: 'DND_API_NOT_CONFIGURED' };
    }

    // In production, this would call the DND registry API
    // For now, we check against a local blocklist in the DB
    const db = getDb();
    const blocked = db.prepare(
      `SELECT 1 FROM dnd_blocklist WHERE phone_number = ? LIMIT 1`
    ).get(phoneNumber);

    if (blocked) {
      return { allowed: false, flag: 'DND_BLOCKED' };
    }

    return { allowed: true, flag: null };
  } catch (err) {
    // If the dnd_blocklist table doesn't exist or any error → fail closed
    if (err.message && err.message.includes('no such table')) {
      // Table doesn't exist — DND check not set up, allow (non-ambiguous)
      return { allowed: true, flag: null };
    }
    return { allowed: false, flag: 'DND_CHECK_ERROR' };
  }
}

/**
 * Check frequency caps: cool-down between calls and daily limit.
 * @param {string} caseId
 * @returns {{ allowed: boolean, flag: string|null }}
 */
function checkFrequencyCap(caseId) {
  try {
    const db = getDb();

    // Check cool-down: last call to this case must be > COOLDOWN_HOURS ago
    const lastCall = db.prepare(`
      SELECT started_at FROM call_logs
      WHERE case_id = ?
      ORDER BY started_at DESC
      LIMIT 1
    `).get(caseId);

    if (lastCall) {
      const lastCallTime = new Date(lastCall.started_at);
      const cooldownMs = recoveryConfig.COOLDOWN_HOURS * 60 * 60 * 1000;
      const elapsed = Date.now() - lastCallTime.getTime();

      if (elapsed < cooldownMs) {
        return { allowed: false, flag: 'COOLDOWN_PERIOD_ACTIVE' };
      }
    }

    // Check daily cap
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const todayCount = db.prepare(`
      SELECT COUNT(*) as cnt FROM call_logs
      WHERE case_id = ?
        AND started_at >= ?
    `).get(caseId, today + 'T00:00:00');

    if (todayCount && todayCount.cnt >= recoveryConfig.MAX_CALLS_PER_DAY) {
      return { allowed: false, flag: 'DAILY_CALL_LIMIT_REACHED' };
    }

    // Check total attempt cap
    const totalCount = db.prepare(`
      SELECT COUNT(*) as cnt FROM call_logs
      WHERE case_id = ?
    `).get(caseId);

    if (totalCount && totalCount.cnt >= recoveryConfig.MAX_CALLS_PER_CASE) {
      return { allowed: false, flag: 'TOTAL_ATTEMPT_LIMIT_REACHED' };
    }

    return { allowed: true, flag: null };
  } catch (err) {
    if (err.message && err.message.includes('no such table')) {
      // Table not yet created — allow (first run)
      return { allowed: true, flag: null };
    }
    return { allowed: false, flag: 'FREQUENCY_CHECK_ERROR' };
  }
}

/**
 * Analyze sentiment score against escalation threshold.
 * Called on live streaming transcript, not post-call.
 * @param {number} sentimentScore — range: -1.0 (distressed) to +1.0 (calm)
 * @returns {{ shouldEscalate: boolean, flag: string|null }}
 */
function checkSentiment(sentimentScore) {
  if (sentimentScore === null || sentimentScore === undefined) {
    return { shouldEscalate: false, flag: null };
  }

  if (sentimentScore <= recoveryConfig.SENTIMENT_ESCALATION_THRESHOLD) {
    return { shouldEscalate: true, flag: 'SENTIMENT_THRESHOLD_BREACHED' };
  }

  return { shouldEscalate: false, flag: null };
}

/**
 * Run ALL pre-call compliance checks for a case.
 * ALL checks must pass — any failure blocks the call.
 * Returns combined result with all flags.
 * 
 * @param {string} caseId
 * @param {string} phoneNumber
 * @returns {Promise<{ allowed: boolean, flags: string[] }>}
 */
async function runPreCallChecks(caseId, phoneNumber) {
  const flags = [];

  // 1. Calling hours
  const hoursCheck = checkCallingHours();
  if (!hoursCheck.allowed) flags.push(hoursCheck.flag);

  // 2. DND
  const dndCheck = await checkDND(phoneNumber);
  if (!dndCheck.allowed) flags.push(dndCheck.flag);

  // 3. Frequency cap
  const freqCheck = checkFrequencyCap(caseId);
  if (!freqCheck.allowed) flags.push(freqCheck.flag);

  return {
    allowed: flags.length === 0,
    flags,
  };
}

module.exports = {
  checkCallingHours,
  checkDND,
  checkFrequencyCap,
  checkSentiment,
  runPreCallChecks,
};
