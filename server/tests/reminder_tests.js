/**
 * Due Reminder Engine Test Suite — MedTrack Pharmacy
 * 
 * Tests covering:
 * 1. Schedule stages logic (T+3, T+7, T+14)
 * 2. Quiet hours enforcement (20:00 - 09:00 window)
 * 3. Max reminder cutoff (hard stop at 3)
 * 4. Message templates rendering (Hinglish, Hindi, English, Courtesy Call)
 * 5. Opt-out & Hardship pause handling
 * 6. Payment link generation & auto-reconciliation
 */

const path = require('path');
const fs = require('fs');

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.log(`  ❌ ${message}`);
  }
}

function section(name) {
  console.log(`\n━━━ ${name} ━━━`);
}

// Set up isolated test database
const testDbPath = path.join(__dirname, '..', 'db', 'test_reminders.sqlite');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const config = require('../config');
config.DB_PATH = testDbPath;

const {
  getDb,
  getCustomerDue,
  addEntry,
  recordPayment,
  getOldestUnpaidEntry,
  getReminderSettings,
  upsertReminderSettings,
  logReminder,
  getReminderHistory,
  getRemindersSentForDueCycle,
  getShopReminderSummary,
} = require('../db/database');

const reminderConfig = require('../services/reminderConfig');
const { renderMessage, templates, formatCurrency, formatDate } = require('../services/reminderTemplates');
const { generatePaymentLink, sendWhatsAppMessage, sendSmsFallback, dispatchReminder } = require('../services/reminderProvider');
const {
  isQuietHours,
  isCustomerPaused,
  determineNextStage,
  processCustomerReminder,
  runReminderCycle,
} = require('../services/reminderScheduler');

async function runAllTests() {
  console.log(`\n======================================================`);
  console.log(`  MedTrack Courtesy Due Reminder Engine — Test Suite  `);
  console.log(`======================================================`);

  const db = getDb();

  // ══════════════════════════════════════════════════════════
  // Section 1: Template Rendering & Language Selection
  // ══════════════════════════════════════════════════════════
  section('1. Message Template Rendering & Tone Compliance');

  const sampleCustomer = { name: 'Ramesh Patel', amount: 450, date: '2026-09-01', link: 'http://localhost:4000/pay' };

  // Hinglish
  const hinglishMsg = renderMessage({
    language: 'hinglish',
    customerName: sampleCustomer.name,
    amount: sampleCustomer.amount,
    date: sampleCustomer.date,
    paymentLink: sampleCustomer.link,
  });
  assert(hinglishMsg.includes('Namaste Ramesh Patel ji') || hinglishMsg.includes('Namaste Ramesh Patel'), 'Hinglish template addresses customer politely');
  assert(hinglishMsg.includes('MedTrack Pharmacy'), 'Hinglish template includes shop name');
  assert(hinglishMsg.includes('450'), 'Hinglish template includes amount');
  assert(hinglishMsg.includes('counter par baat kar sakte hain'), 'Hinglish template includes counter contact option');
  assert(!hinglishMsg.toLowerCase().includes('immediately'), 'Hinglish template avoids aggressive urgency words');
  assert(!hinglishMsg.toLowerCase().includes('overdue'), 'Hinglish template avoids debt-collection framing');

  // Hindi
  const hindiMsg = renderMessage({
    language: 'hindi',
    customerName: sampleCustomer.name,
    amount: sampleCustomer.amount,
    date: sampleCustomer.date,
    paymentLink: sampleCustomer.link,
  });
  assert(hindiMsg.includes('नमस्ते'), 'Hindi template renders Hindi greeting');
  assert(hindiMsg.includes('काउंटर पर संपर्क करें'), 'Hindi template includes counter contact');

  // English
  const englishMsg = renderMessage({
    language: 'english',
    customerName: sampleCustomer.name,
    amount: sampleCustomer.amount,
    date: sampleCustomer.date,
    paymentLink: sampleCustomer.link,
  });
  assert(englishMsg.includes('gentle reminder'), 'English template sets polite tone');
  assert(englishMsg.includes('speak with us at the counter'), 'English template provides counter query option');

  // Courtesy Call Script
  const callScript = templates.courtesyCall.render({
    customerName: sampleCustomer.name,
    shopName: 'MedTrack Pharmacy',
    amount: sampleCustomer.amount,
  });
  assert(callScript.includes('automated reminder call'), 'Courtesy call script clearly identifies as automated');
  assert(callScript.includes('Dhanyavaad'), 'Courtesy call script ends gracefully without dialogue or negotiation');

  // ══════════════════════════════════════════════════════════
  // Section 2: Quiet Hours Logic
  // ══════════════════════════════════════════════════════════
  section('2. Quiet Hours Enforcement (20:00 - 09:00 IST)');

  // Test quiet hour dates
  const lateNight = new Date('2026-09-10T22:30:00'); // 10:30 PM -> Quiet
  const earlyMorning = new Date('2026-09-10T07:15:00'); // 7:15 AM -> Quiet
  const workingDay = new Date('2026-09-10T14:30:00'); // 2:30 PM -> Allowed

  assert(isQuietHours(lateNight) === true, 'Late night (22:30) is inside quiet hours');
  assert(isQuietHours(earlyMorning) === true, 'Early morning (07:15) is inside quiet hours');
  assert(isQuietHours(workingDay) === false, 'Afternoon (14:30) is within allowed calling window');

  // ══════════════════════════════════════════════════════════
  // Section 3: Customer Setup & Oldest Unpaid Due (FIFO)
  // ══════════════════════════════════════════════════════════
  section('3. Ledger Dues & FIFO Oldest Unpaid Entry');

  // Insert customer 1
  const custRes = db.prepare(`
    INSERT INTO customers (name, phone_number, village)
    VALUES ('Suresh Kumar', '9811122233', 'Kishanpur')
  `).run();
  const c1Id = custRes.lastInsertRowid;

  // Add older entry 1: ₹500 total, ₹0 paid, 10 days ago
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  addEntry({
    customerId: c1Id,
    totalAmount: 500,
    amountPaid: 0,
    medicines: [{ name: 'Paracetamol 650', price: 500 }],
    entryDate: tenDaysAgo,
  });

  // Add newer entry 2: ₹300 total, ₹0 paid, 2 days ago
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  addEntry({
    customerId: c1Id,
    totalAmount: 300,
    amountPaid: 0,
    medicines: [{ name: 'Amoxicillin 500', price: 300 }],
    entryDate: twoDaysAgo,
  });

  const dueBefore = getCustomerDue(c1Id);
  assert(dueBefore === 800, `Total due is correctly ₹800 (actual: ${dueBefore})`);

  let oldest = getOldestUnpaidEntry(c1Id);
  assert(oldest !== null, 'Oldest unpaid entry found');
  assert(oldest.unpaidAmount === 500, `Oldest unpaid due amount is ₹500 (actual: ${oldest.unpaidAmount})`);
  assert(oldest.daysSinceDue >= 9, `Days since due is ~10 days (actual: ${oldest.daysSinceDue})`);

  // Now record partial payment of ₹500 (clearing entry 1)
  recordPayment({ customerId: c1Id, amount: 500, note: 'Partial payment' });
  const dueAfterPay = getCustomerDue(c1Id);
  assert(dueAfterPay === 300, `Total due reduced to ₹300 (actual: ${dueAfterPay})`);

  // FIFO check: oldest unpaid entry should now be Entry 2 (from 2 days ago)!
  oldest = getOldestUnpaidEntry(c1Id);
  assert(oldest !== null, 'Oldest unpaid entry found after partial clearance');
  assert(oldest.unpaidAmount === 300, `Oldest unpaid due is now Entry 2 with ₹300 (actual: ${oldest.unpaidAmount})`);
  assert(oldest.daysSinceDue <= 3, `Days since due shifted to Entry 2 (~2 days) (actual: ${oldest.daysSinceDue})`);

  // ══════════════════════════════════════════════════════════
  // Section 4: Stage Detection & Max Reminders Cutoff
  // ══════════════════════════════════════════════════════════
  section('4. Stage Triggering & Max Reminder Cutoff');

  // Stage test cases:
  // At 2 days: none
  assert(determineNextStage({ daysSinceDue: 2, sentStages: [], maxReminders: 3 }) === null, 'No stage triggered at 2 days (< 3 days)');
  // At 4 days: T+3
  assert(determineNextStage({ daysSinceDue: 4, sentStages: [], maxReminders: 3 }) === 'T+3', 'T+3 triggered at 4 days');
  // At 8 days: if T+3 already sent -> T+7
  assert(determineNextStage({ daysSinceDue: 8, sentStages: ['T+3'], maxReminders: 3 }) === 'T+7', 'T+7 triggered after T+3');
  // At 15 days: if T+3 and T+7 sent -> T+14
  assert(determineNextStage({ daysSinceDue: 15, sentStages: ['T+3', 'T+7'], maxReminders: 3 }) === 'T+14', 'T+14 triggered after T+7');
  // Hard stop: if maxReminders (3) reached -> null
  assert(determineNextStage({ daysSinceDue: 20, sentStages: ['T+3', 'T+7', 'T+14'], maxReminders: 3 }) === null, 'Hard stop: no stage after max 3 reminders');

  // ══════════════════════════════════════════════════════════
  // Section 5: Reminder Settings, Opt-Out & Hardship Pause
  // ══════════════════════════════════════════════════════════
  section('5. Pharmacist Settings, 1-Click Opt-Out & Temporary Pause');

  // Default settings
  let settings = getReminderSettings(c1Id);
  assert(settings.reminders_enabled === 1, 'Reminders enabled by default');
  assert(settings.paused_until === null, 'No pause set by default');

  // 1-Click Disable
  upsertReminderSettings({ customerId: c1Id, remindersEnabled: 0 });
  settings = getReminderSettings(c1Id);
  assert(settings.reminders_enabled === 0, '1-click disable successfully updated setting to 0');

  // Scheduler respect for disabled customer
  let procResult = await processCustomerReminder(
    { customer_id: c1Id, phone_number: '9811122233', name: 'Suresh Kumar' },
    { bypassQuietHours: true }
  );
  assert(procResult.eligible === false && procResult.reason === 'OPTED_OUT', 'Disabled customer is skipped with reason OPTED_OUT');

  // Re-enable and Pause for 7 days
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  upsertReminderSettings({ customerId: c1Id, remindersEnabled: 1, pausedUntil: nextWeek });
  settings = getReminderSettings(c1Id);
  assert(settings.reminders_enabled === 1, 'Re-enabled successfully');
  assert(isCustomerPaused(settings) === true, 'Customer recognized as temporarily paused');

  // Scheduler respect for paused customer
  procResult = await processCustomerReminder(
    { customer_id: c1Id, phone_number: '9811122233', name: 'Suresh Kumar' },
    { bypassQuietHours: true }
  );
  assert(procResult.eligible === false && procResult.reason === 'PAUSED', 'Paused customer is skipped with reason PAUSED');

  // Clear pause
  upsertReminderSettings({ customerId: c1Id, pausedUntil: null });
  settings = getReminderSettings(c1Id);
  assert(isCustomerPaused(settings) === false, 'Pause cleared successfully');

  // ══════════════════════════════════════════════════════════
  // Section 6: Provider Dispatch & Logging
  // ══════════════════════════════════════════════════════════
  section('6. Provider Dispatch & Append-Only Log');

  const sendResult = await processCustomerReminder(
    { customer_id: c1Id, phone_number: '9811122233', name: 'Suresh Kumar' },
    { bypassQuietHours: true, forceStage: 'T+3' }
  );
  assert(sendResult.eligible === true, 'Eligible customer received reminder');
  assert(sendResult.stage === 'T+3', 'Correct stage logged in send result');
  assert(sendResult.channel === 'whatsapp', 'Dispatched via primary channel (WhatsApp)');

  // Verify DB log
  const history = getReminderHistory(c1Id);
  assert(history.length === 1, 'Reminder logged in database');
  assert(history[0].scheduled_stage === 'T+3', 'Logged stage is T+3');
  assert(history[0].delivery_status === 'DELIVERED', 'Delivery status is DELIVERED');
  assert(history[0].payment_link.includes('customer_id='), 'Payment link embedded customer_id');

  // ══════════════════════════════════════════════════════════
  // Section 7: Payment Link & Webhook Reconciliation
  // ══════════════════════════════════════════════════════════
  section('7. Payment Link & Webhook Auto-Reconciliation');

  const payLinkData = generatePaymentLink({
    customerId: c1Id,
    amount: 300,
    customerName: 'Suresh Kumar',
  });
  assert(payLinkData.upiLink.startsWith('upi://pay?'), 'UPI deep link generated with standard protocol');
  assert(payLinkData.paymentUrl.includes(`customer_id=${c1Id}`), 'Web payment link embeds customer_id');

  // Simulate payment webhook receipt for this customer
  recordPayment({
    customerId: c1Id,
    amount: 300,
    note: 'Online Payment (Razorpay: rzp_test_12345)',
  });

  const finalDue = getCustomerDue(c1Id);
  assert(finalDue === 0, `Customer khata balance is now completely settled (₹0, actual: ${finalDue})`);

  // Once due is 0, scheduler skips customer
  const afterZeroResult = await processCustomerReminder(
    { customer_id: c1Id, phone_number: '9811122233', name: 'Suresh Kumar' },
    { bypassQuietHours: true }
  );
  assert(afterZeroResult.eligible === false && afterZeroResult.reason === 'NO_DUE', 'Customer with zero due is skipped');

  // ══════════════════════════════════════════════════════════
  // Section 8: Shop-Wide Summary Metrics
  // ══════════════════════════════════════════════════════════
  section('8. Shop-Wide Reminder Summary');

  const summary = getShopReminderSummary();
  assert(summary.totalRemindersSent >= 1, `Total reminders logged: ${summary.totalRemindersSent}`);
  assert(summary.remindersSentThisWeek >= 1, `Sent this week: ${summary.remindersSentThisWeek}`);
  assert(summary.deliverySuccessRate > 0, `Delivery success rate: ${summary.deliverySuccessRate}%`);
  assert(summary.responseRate48h === 100, `48h payment response rate: ${summary.responseRate48h}% (payment reconciled within 48h!)`);

  // Summary Report
  console.log(`\n======================================================`);
  console.log(`  Tests Passed: ${passed}`);
  console.log(`  Tests Failed: ${failed}`);
  if (failed > 0) {
    console.log(`  Failures:`);
    failures.forEach((f) => console.log(`    ❌ ${f}`));
    process.exit(1);
  } else {
    console.log(`  🎉 ALL REMINDER ENGINE TESTS PASSED!`);
    console.log(`======================================================\n`);
  }
}

runAllTests().catch((err) => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
