/**
 * Due Reminder Scheduler — MedTrack Pharmacy
 * 
 * Evaluates pending khata dues against the courtesy reminder schedule:
 * - Checks customer dues > 0
 * - Enforces quiet hours (20:00 - 09:00 IST)
 * - Checks reminder_settings (enabled, paused_until)
 * - Determines days since oldest unpaid entry (FIFO)
 * - Triggers stages (T+3, T+7, T+14)
 * - Enforces maxRemindersPerDue hard cutoff (default 3)
 * - Logs all attempts to reminder_log
 */

const reminderConfig = require('./reminderConfig');
const { renderMessage } = require('./reminderTemplates');
const { dispatchReminder, generatePaymentLink, placeCourtesyCall } = require('./reminderProvider');
const {
  getDb,
  getCustomerDue,
  getOldestUnpaidEntry,
  getReminderSettings,
  logReminder,
  getRemindersSentForDueCycle,
} = require('../db/database');

/**
 * Checks if a given time falls within quiet hours (e.g. 20:00 - 09:00)
 */
function isQuietHours(date = new Date()) {
  const [startH, startM] = reminderConfig.quietHours.start.split(':').map(Number);
  const [endH, endM] = reminderConfig.quietHours.end.split(':').map(Number);

  const currentH = date.getHours();
  const currentM = date.getMinutes();
  const currentMinutes = currentH * 60 + currentM;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes > endMinutes) {
    // Overnight quiet hours (e.g. 20:00 to 09:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  } else {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
}

/**
 * Checks if a customer's reminders are paused until a future date
 */
function isCustomerPaused(settings) {
  if (!settings || !settings.paused_until) return false;
  const pauseEnd = new Date(settings.paused_until).getTime();
  return !isNaN(pauseEnd) && pauseEnd > Date.now();
}

/**
 * Determines which stage (if any) should be sent for a customer
 */
function determineNextStage({ daysSinceDue, sentStages, maxReminders }) {
  if (sentStages.length >= maxReminders) {
    return null; // Hard stop
  }

  // Sorted stages e.g. T+3 (3 days), T+7 (7 days), T+14 (14 days)
  const stages = reminderConfig.scheduleStages;

  for (const s of stages) {
    if (daysSinceDue >= s.daysAfterDue && !sentStages.includes(s.stage)) {
      return s.stage;
    }
  }

  return null;
}

/**
 * Evaluates a single customer and sends a reminder if eligible
 */
async function processCustomerReminder(customer, options = {}) {
  const db = getDb();
  const customerId = customer.customer_id;
  const totalDue = getCustomerDue(customerId);

  if (totalDue <= 0) {
    return { eligible: false, reason: 'NO_DUE' };
  }

  // 1. Settings check (enabled / paused)
  const settings = getReminderSettings(customerId);
  if (!settings.reminders_enabled) {
    return { eligible: false, reason: 'OPTED_OUT' };
  }

  if (isCustomerPaused(settings)) {
    return { eligible: false, reason: 'PAUSED', pausedUntil: settings.paused_until };
  }

  // 2. Quiet hours check (can be bypassed for explicit manual sends)
  if (!options.bypassQuietHours && isQuietHours()) {
    return { eligible: false, reason: 'QUIET_HOURS' };
  }

  // 3. Oldest unpaid entry calculation
  const oldestUnpaid = getOldestUnpaidEntry(customerId);
  if (!oldestUnpaid) {
    return { eligible: false, reason: 'NO_UNPAID_ENTRY' };
  }

  const daysSinceDue = oldestUnpaid.daysSinceDue;

  // 4. Sent reminders in this due cycle
  const cycleReminders = getRemindersSentForDueCycle(customerId);
  const sentStages = cycleReminders.map((r) => r.scheduled_stage);

  // 5. Check hard cutoff
  if (cycleReminders.length >= reminderConfig.maxRemindersPerDue) {
    // Optional courtesy call escalation if enabled and not yet made
    if (
      reminderConfig.enableCourtesyCallEscalation &&
      !sentStages.includes('COURTESY_CALL')
    ) {
      const callResult = await placeCourtesyCall({
        to: customer.phone_number,
        customerName: customer.name,
        amount: totalDue,
      });

      const log = logReminder({
        customerId,
        channel: 'courtesy_call',
        messageText: 'Automated courtesy reminder call placed',
        paymentLink: null,
        dueAmountAtSend: totalDue,
        scheduledStage: 'COURTESY_CALL',
        deliveryStatus: callResult.deliveryStatus,
        providerMessageId: callResult.providerMessageId,
      });

      return { eligible: true, stage: 'COURTESY_CALL', channel: 'courtesy_call', log };
    }

    return { eligible: false, reason: 'MAX_REMINDERS_REACHED', count: cycleReminders.length };
  }

  // 6. Stage matching
  const nextStage = options.forceStage || determineNextStage({
    daysSinceDue,
    sentStages,
    maxReminders: reminderConfig.maxRemindersPerDue,
  });

  if (!nextStage) {
    return { eligible: false, reason: 'NO_STAGE_MATCH', daysSinceDue, sentStages };
  }

  // 7. Generate Payment Link
  const paymentLinkInfo = generatePaymentLink({
    customerId,
    amount: totalDue,
    customerName: customer.name,
  });

  // 8. Render Message
  const messageText = renderMessage({
    language: options.language || 'hinglish',
    customerName: customer.name,
    amount: totalDue,
    date: oldestUnpaid.entryDate,
    paymentLink: paymentLinkInfo.paymentUrl,
  });

  // 9. Dispatch Message (WhatsApp primary with SMS fallback)
  const dispatchResult = await dispatchReminder({
    to: customer.phone_number,
    message: messageText,
    paymentLink: paymentLinkInfo.paymentUrl,
    customerId,
  });

  // 10. Record in Reminder Log
  const log = logReminder({
    customerId,
    channel: dispatchResult.channel,
    messageText,
    paymentLink: paymentLinkInfo.paymentUrl,
    dueAmountAtSend: totalDue,
    scheduledStage: nextStage,
    deliveryStatus: dispatchResult.deliveryStatus,
    providerMessageId: dispatchResult.providerMessageId,
  });

  return {
    eligible: true,
    stage: nextStage,
    channel: dispatchResult.channel,
    deliveryStatus: dispatchResult.deliveryStatus,
    log,
  };
}

/**
 * Runs the reminder evaluation across all customers with open khata dues
 */
async function runReminderCycle(options = {}) {
  const db = getDb();

  // Quiet hours check
  if (!options.bypassQuietHours && isQuietHours()) {
    console.log('[Reminder Scheduler] Currently in quiet hours (20:00 - 09:00). Skipping automated dispatch.');
    return { skipped: true, reason: 'QUIET_HOURS', processedCount: 0, sentCount: 0 };
  }

  const customers = db.prepare('SELECT customer_id, name, phone_number FROM customers').all();
  let processedCount = 0;
  let sentCount = 0;
  const results = [];

  for (const customer of customers) {
    try {
      processedCount++;
      const res = await processCustomerReminder(customer, options);
      if (res.eligible) {
        sentCount++;
        results.push({ customerId: customer.customer_id, ...res });
      }
    } catch (err) {
      console.error(`[Reminder Scheduler] Error processing customer ${customer.customer_id}:`, err.message);
    }
  }

  console.log(`[Reminder Scheduler] Completed cycle. Processed: ${processedCount}, Sent: ${sentCount}`);
  return {
    skipped: false,
    processedCount,
    sentCount,
    results,
  };
}

let schedulerTimer = null;

function startReminderScheduler() {
  if (schedulerTimer) return;
  const interval = reminderConfig.schedulerIntervalMs || 900000;
  schedulerTimer = setInterval(() => {
    runReminderCycle().catch((err) => {
      console.error('[Reminder Scheduler] Cycle execution error:', err);
    });
  }, interval);
  console.log(`[Reminder Scheduler] Started. Running every ${Math.round(interval / 1000)}s.`);
}

function stopReminderScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log('[Reminder Scheduler] Stopped.');
  }
}

module.exports = {
  isQuietHours,
  isCustomerPaused,
  determineNextStage,
  processCustomerReminder,
  runReminderCycle,
  startReminderScheduler,
  stopReminderScheduler,
};
