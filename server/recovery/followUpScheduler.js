/**
 * Follow-up Scheduler — Promise-to-Pay Timeout Job
 * 
 * Background job that checks PROMISED cases past their deadline
 * and transitions them to PROMISE_BROKEN, re-queuing for calls.
 * 
 * Runs on a configurable interval (default: every 15 minutes).
 */

const recoveryConfig = require('./recoveryConfig');
const {
  getPromisedCasesPastDeadline,
  updateCaseState,
} = require('../db/database');
const { liveEvents } = require('./telephonyBridge');

let intervalHandle = null;

/**
 * Check for PROMISED cases past their deadline and transition to PROMISE_BROKEN.
 * @returns {{ processed: number, errors: number }}
 */
function checkPromisedCases() {
  let processed = 0;
  let errors = 0;

  try {
    const overdues = getPromisedCasesPastDeadline();

    for (const caseData of overdues) {
      try {
        // Transition: PROMISED → PROMISE_BROKEN
        updateCaseState(caseData.case_id, 'PROMISE_BROKEN');

        console.log(
          `[FollowUp] Case ${caseData.case_id} (${caseData.name}): ` +
          `PROMISED → PROMISE_BROKEN (deadline was ${caseData.promise_pay_by})`
        );

        liveEvents.emit('case_update', {
          type: 'PROMISE_BROKEN',
          caseId: caseData.case_id,
          customerName: caseData.name,
          phoneNumber: caseData.phone_number,
          deadline: caseData.promise_pay_by,
          timestamp: new Date().toISOString(),
        });

        processed++;
      } catch (err) {
        console.error(`[FollowUp] Failed to process case ${caseData.case_id}:`, err.message);
        errors++;
      }
    }

    if (processed > 0) {
      console.log(`[FollowUp] Processed ${processed} overdue promises, ${errors} errors`);
    }
  } catch (err) {
    console.error('[FollowUp] Check cycle failed:', err.message);
  }

  return { processed, errors };
}

/**
 * Start the follow-up scheduler.
 */
function startScheduler() {
  if (intervalHandle) {
    console.warn('[FollowUp] Scheduler already running');
    return;
  }

  const intervalMs = recoveryConfig.FOLLOWUP_CHECK_INTERVAL_MS;

  // Run immediately on start
  checkPromisedCases();

  // Then run on interval
  intervalHandle = setInterval(checkPromisedCases, intervalMs);

  console.log(`[FollowUp] Scheduler started (checking every ${intervalMs / 1000}s)`);
}

/**
 * Stop the follow-up scheduler.
 */
function stopScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[FollowUp] Scheduler stopped');
  }
}

module.exports = {
  checkPromisedCases,
  startScheduler,
  stopScheduler,
};
