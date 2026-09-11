const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

let dbInstance = null;

function getDb() {
  if (dbInstance) return dbInstance;

  const dbDir = path.dirname(config.DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new Database(config.DB_PATH);

  // Performance and integrity pragma settings
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('synchronous = NORMAL');

  // Initialize schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    dbInstance.exec(schemaSql);
  }

  return dbInstance;
}

/**
 * Calculates customer's exact total due from ledger data:
 * total_due = SUM(entries.due_amount) - SUM(payments.amount)
 */
function getCustomerDue(customerId) {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      ROUND(COALESCE(SUM(e.due_amount), 0) - (
        SELECT COALESCE(SUM(p.amount), 0)
        FROM payments p
        WHERE p.customer_id = ?
      ), 2) AS total_due
    FROM entries e
    WHERE e.customer_id = ?
  `).get(customerId, customerId);

  return row ? Math.max(0, row.total_due || 0) : 0;
}

/**
 * Records a purchase entry atomically in a SQLite transaction
 * Inserts into `entries` and `entry_medicine`
 */
function addEntry({ customerId, totalAmount, amountPaid, medicines, entryDate }) {
  const db = getDb();

  if (!medicines || !Array.isArray(medicines) || medicines.length === 0) {
    throw new Error('Entry requires at least one medicine item');
  }

  const cleanTotal = Math.round(parseFloat(totalAmount) * 100) / 100;
  if (isNaN(cleanTotal) || cleanTotal <= 0) {
    throw new Error('Total amount must be greater than 0');
  }

  const cleanPaid = Math.round(parseFloat(amountPaid || 0) * 100) / 100;
  if (isNaN(cleanPaid) || cleanPaid < 0) {
    throw new Error('Amount paid cannot be negative');
  }

  if (cleanPaid > cleanTotal) {
    throw new Error(`Amount paid (₹${cleanPaid}) cannot exceed total amount (₹${cleanTotal})`);
  }

  const dueCreated = Math.round((cleanTotal - cleanPaid) * 100) / 100;

  const tx = db.transaction(() => {
    // 1. Verify customer
    const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // 2. Insert entry
    const insertEntryStmt = db.prepare(`
      INSERT INTO entries (customer_id, entry_date, total_amount, amount_paid, due_amount)
      VALUES (?, COALESCE(?, datetime('now')), ?, ?, ?)
    `);

    const entryResult = insertEntryStmt.run(
      customerId,
      entryDate || null,
      cleanTotal,
      cleanPaid,
      dueCreated
    );
    const entryId = entryResult.lastInsertRowid;

    // 3. Insert line items into entry_medicine
    const insertMedStmt = db.prepare(`
      INSERT INTO entry_medicine (entry_id, medicine_name, price)
      VALUES (?, ?, ?)
    `);

    const insertedMeds = [];
    for (const med of medicines) {
      const name = (med.name || med.medicine_name || '').trim();
      if (!name) continue;
      const price = Math.round(parseFloat(med.price || 0) * 100) / 100;
      insertMedStmt.run(entryId, name, price);
      insertedMeds.push({ medicine_name: name, price });
    }

    if (insertedMeds.length === 0) {
      throw new Error('At least one medicine name must be specified');
    }

    // 4. Update customer updated_at
    db.prepare(`UPDATE customers SET updated_at = datetime('now') WHERE customer_id = ?`).run(customerId);

    // 5. Get refreshed total due
    const newTotalDue = getCustomerDue(customerId);

    return {
      entryId,
      customerId,
      customerName: customer.name,
      phone: customer.phone_number,
      village: customer.village,
      totalAmount: cleanTotal,
      amountPaid: cleanPaid,
      dueAmount: dueCreated,
      totalDue: newTotalDue,
      medicines: insertedMeds,
      entryDate: entryDate || new Date().toISOString(),
    };
  });

  return tx();
}

/**
 * Record a payment towards customer dues
 */
function recordPayment({ customerId, amount, note }) {
  const db = getDb();
  const cleanAmount = Math.round(parseFloat(amount) * 100) / 100;

  if (isNaN(cleanAmount) || cleanAmount <= 0) {
    throw new Error('Payment amount must be greater than 0');
  }

  const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  const previousDue = getCustomerDue(customerId);

  const insertStmt = db.prepare(`
    INSERT INTO payments (customer_id, amount, note)
    VALUES (?, ?, ?)
  `);

  const result = insertStmt.run(customerId, cleanAmount, note || 'Cash counter settlement');
  const remainingDue = getCustomerDue(customerId);

  // Update customer updated_at
  db.prepare(`UPDATE customers SET updated_at = datetime('now') WHERE customer_id = ?`).run(customerId);

  return {
    paymentId: result.lastInsertRowid,
    customerId,
    customerName: customer.name,
    amount: cleanAmount,
    note: note || 'Cash counter settlement',
    previousDue,
    remainingDue,
    payDate: new Date().toISOString(),
  };
}

/**
 * Get customer stats: computed due, last visit, and recently bought distinct medicines
 */
function getCustomerStats(customerId) {
  const db = getDb();

  const totalDue = getCustomerDue(customerId);

  const lastEntry = db.prepare(`
    SELECT entry_date
    FROM entries
    WHERE customer_id = ?
    ORDER BY entry_date DESC, entry_id DESC
    LIMIT 1
  `).get(customerId);

  const aggregates = db.prepare(`
    SELECT
      COUNT(*) AS total_visits,
      COALESCE(SUM(total_amount), 0) AS total_spent
    FROM entries
    WHERE customer_id = ?
  `).get(customerId);

  // Last 5 distinct medicines with frequency
  const recentMeds = db.prepare(`
    SELECT
      em.medicine_name,
      COUNT(*) AS frequency,
      MAX(e.entry_date) AS last_date,
      ROUND(julianday('now') - julianday(MAX(e.entry_date))) AS days_ago
    FROM entries e
    JOIN entry_medicine em ON e.entry_id = em.entry_id
    WHERE e.customer_id = ?
    GROUP BY LOWER(em.medicine_name)
    ORDER BY last_date DESC
    LIMIT 5
  `).all(customerId);

  return {
    total_due: totalDue,
    last_visit: lastEntry ? lastEntry.entry_date : null,
    total_visits: aggregates ? aggregates.total_visits : 0,
    total_spent: aggregates ? Math.round(aggregates.total_spent * 100) / 100 : 0,
    recently_bought: recentMeds.map((m) => ({
      name: m.medicine_name,
      frequency: m.frequency,
      lastDate: m.last_date,
      daysAgo: Math.max(0, parseInt(m.days_ago, 10) || 0),
    })),
  };
}

/**
 * Autocomplete medicine names based on past purchases
 */
function autocompleteMedicines(query) {
  const db = getDb();
  const q = (query || '').trim();
  if (!q) {
    return db.prepare(`
      SELECT DISTINCT medicine_name
      FROM entry_medicine
      ORDER BY id DESC
      LIMIT 10
    `).all().map((r) => r.medicine_name);
  }

  return db.prepare(`
    SELECT DISTINCT medicine_name
    FROM entry_medicine
    WHERE medicine_name LIKE ?
    ORDER BY medicine_name ASC
    LIMIT 10
  `).all(`%${q}%`).map((r) => r.medicine_name);
}

// ══════════════════════════════════════════════════════════
// AI Revenue Recovery — Case State Machine & Data Access
// ══════════════════════════════════════════════════════════

const crypto = require('crypto');

function generateId(prefix = '') {
  return prefix + crypto.randomUUID();
}

// Valid state transitions
const STATE_TRANSITIONS = {
  'NEW': ['CONTACTED'],
  'CONTACTED': ['PROMISED', 'CONTACTED'],  // CONTACTED → CONTACTED if re-called
  'PROMISED': ['RECOVERED', 'PARTIAL', 'PROMISE_BROKEN'],
  'PARTIAL': ['RECOVERED', 'CONTACTED'],   // Partial can get more payments or re-call
  'PROMISE_BROKEN': ['CONTACTED'],          // Back to call queue
  'RECOVERED': [],                          // Terminal state
};

/**
 * Validate a state transition.
 * @param {string} fromState
 * @param {string} toState
 * @returns {boolean}
 */
function isValidTransition(fromState, toState) {
  const allowed = STATE_TRANSITIONS[fromState];
  return allowed && allowed.includes(toState);
}

/**
 * Write an entry to the tamper-evident audit trail.
 */
function writeAuditTrail({ entityType, entityId, action, oldState, newState, details }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO audit_trail (entity_type, entity_id, action, old_state, new_state, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(entityType, entityId, action, oldState || null, newState || null, details || null);
}

/**
 * Create a new recovery case for a delinquent customer.
 */
function createCase(customerId, totalDue) {
  const db = getDb();
  const caseId = generateId('case_');

  db.prepare(`
    INSERT INTO cases (case_id, customer_id, total_due, state, created_at, updated_at)
    VALUES (?, ?, ?, 'NEW', datetime('now'), datetime('now'))
  `).run(caseId, customerId, totalDue);

  writeAuditTrail({
    entityType: 'case',
    entityId: caseId,
    action: 'CREATED',
    newState: 'NEW',
    details: JSON.stringify({ customer_id: customerId, total_due: totalDue }),
  });

  return db.prepare('SELECT * FROM cases WHERE case_id = ?').get(caseId);
}

/**
 * Update case state with validation and audit trail.
 * @param {string} caseId
 * @param {string} newState
 * @param {Object} extras - optional fields to update (promise_pay_by, amount_recovered, etc.)
 * @returns {Object} updated case
 */
function updateCaseState(caseId, newState, extras = {}) {
  const db = getDb();

  const current = db.prepare('SELECT * FROM cases WHERE case_id = ?').get(caseId);
  if (!current) throw new Error(`Case ${caseId} not found`);

  if (!isValidTransition(current.state, newState)) {
    throw new Error(`Invalid state transition: ${current.state} → ${newState}`);
  }

  const sets = ['state = ?', "updated_at = datetime('now')"];
  const params = [newState];

  if (extras.promise_pay_by !== undefined) {
    sets.push('promise_pay_by = ?');
    params.push(extras.promise_pay_by);
  }
  if (extras.amount_recovered !== undefined) {
    sets.push('amount_recovered = ?');
    params.push(extras.amount_recovered);
  }
  if (extras.priority_score !== undefined) {
    sets.push('priority_score = ?');
    params.push(extras.priority_score);
  }

  params.push(caseId);
  db.prepare(`UPDATE cases SET ${sets.join(', ')} WHERE case_id = ?`).run(...params);

  writeAuditTrail({
    entityType: 'case',
    entityId: caseId,
    action: 'STATE_CHANGE',
    oldState: current.state,
    newState,
    details: JSON.stringify(extras),
  });

  return db.prepare('SELECT * FROM cases WHERE case_id = ?').get(caseId);
}

/**
 * Get cases filtered by state.
 */
function getCasesByState(state, limit = 100) {
  const db = getDb();
  if (state) {
    return db.prepare(`
      SELECT c.*, cu.name, cu.phone_number, cu.village
      FROM cases c
      JOIN customers cu ON c.customer_id = cu.customer_id
      WHERE c.state = ?
      ORDER BY c.priority_score DESC, c.created_at ASC
      LIMIT ?
    `).all(state, limit);
  }
  return db.prepare(`
    SELECT c.*, cu.name, cu.phone_number, cu.village
    FROM cases c
    JOIN customers cu ON c.customer_id = cu.customer_id
    ORDER BY c.updated_at DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Get a single case with full details.
 */
function getCaseById(caseId) {
  const db = getDb();
  const caseData = db.prepare(`
    SELECT c.*, cu.name, cu.phone_number, cu.village, cu.address
    FROM cases c
    JOIN customers cu ON c.customer_id = cu.customer_id
    WHERE c.case_id = ?
  `).get(caseId);

  if (!caseData) return null;

  const callLogs = db.prepare(`
    SELECT * FROM call_logs WHERE case_id = ? ORDER BY started_at DESC
  `).all(caseId);

  const paymentEvents = db.prepare(`
    SELECT * FROM payment_events WHERE case_id = ? ORDER BY received_at DESC
  `).all(caseId);

  const auditTrail = db.prepare(`
    SELECT * FROM audit_trail WHERE entity_type = 'case' AND entity_id = ? ORDER BY created_at DESC
  `).all(caseId);

  return { ...caseData, call_logs: callLogs, payment_events: paymentEvents, audit_trail: auditTrail };
}

/**
 * Get PROMISED cases past their follow-up deadline.
 */
function getPromisedCasesPastDeadline() {
  const db = getDb();
  return db.prepare(`
    SELECT c.*, cu.name, cu.phone_number
    FROM cases c
    JOIN customers cu ON c.customer_id = cu.customer_id
    WHERE c.state = 'PROMISED'
      AND c.promise_pay_by IS NOT NULL
      AND c.promise_pay_by < datetime('now')
  `).all();
}

/**
 * Create a call log entry.
 */
function createCallLog({ caseId, outcome, transcriptRef, sentimentScore, aiDisclosed, complianceFlags, startedAt, endedAt }) {
  const db = getDb();
  const callId = generateId('call_');

  db.prepare(`
    INSERT INTO call_logs (call_id, case_id, started_at, ended_at, outcome, transcript_ref, sentiment_score, ai_disclosed_at_start, compliance_flags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    callId,
    caseId,
    startedAt || new Date().toISOString(),
    endedAt || null,
    outcome || null,
    transcriptRef || null,
    sentimentScore || null,
    aiDisclosed ? 1 : 0,
    JSON.stringify(complianceFlags || [])
  );

  writeAuditTrail({
    entityType: 'call_log',
    entityId: callId,
    action: 'CREATED',
    details: JSON.stringify({ case_id: caseId, outcome }),
  });

  return db.prepare('SELECT * FROM call_logs WHERE call_id = ?').get(callId);
}

/**
 * Create a payment event (idempotent on event_id).
 * Returns { created: boolean, paymentEvent: Object }
 */
function createPaymentEvent({ eventId, caseId, provider, amount, status, receivedAt, rawPayloadRef }) {
  const db = getDb();

  // Idempotency check
  const existing = db.prepare('SELECT * FROM payment_events WHERE event_id = ?').get(eventId);
  if (existing) {
    return { created: false, paymentEvent: existing };
  }

  db.prepare(`
    INSERT INTO payment_events (event_id, case_id, provider, amount, status, received_at, raw_payload_ref)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(eventId, caseId, provider, amount, status, receivedAt || new Date().toISOString(), rawPayloadRef || null);

  writeAuditTrail({
    entityType: 'payment_event',
    entityId: eventId,
    action: 'CREATED',
    details: JSON.stringify({ case_id: caseId, provider, amount, status }),
  });

  const event = db.prepare('SELECT * FROM payment_events WHERE event_id = ?').get(eventId);
  return { created: true, paymentEvent: event };
}

/**
 * Bulk-generate cases from customers with outstanding dues.
 * Skips customers who already have an active (non-RECOVERED) case.
 */
function generateCasesFromDues() {
  const db = getDb();
  const customers = db.prepare('SELECT customer_id FROM customers').all();
  const created = [];

  for (const { customer_id } of customers) {
    const due = getCustomerDue(customer_id);
    if (due <= 0) continue;

    // Check for existing active case
    const existingCase = db.prepare(`
      SELECT case_id FROM cases
      WHERE customer_id = ? AND state NOT IN ('RECOVERED')
      LIMIT 1
    `).get(customer_id);

    if (existingCase) continue;

    const newCase = createCase(customer_id, due);
    created.push(newCase);
  }

  return created;
}

/**
 * Get state counts for the recovery funnel.
 */
function getCaseStateCounts() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT state, COUNT(*) as count, COALESCE(SUM(total_due), 0) as total_amount
    FROM cases
    GROUP BY state
  `).all();

  const result = {};
  for (const row of rows) {
    result[row.state] = { count: row.count, total_amount: Math.round(row.total_amount * 100) / 100 };
  }
  return result;
}

/**
 * Get recovery rate data over time.
 */
function getRecoveryRateOverTime(days = 30) {
  const db = getDb();
  return db.prepare(`
    SELECT
      DATE(pe.received_at) as date,
      SUM(CASE WHEN pe.status = 'SUCCESS' THEN pe.amount ELSE 0 END) as recovered,
      COUNT(CASE WHEN pe.status = 'SUCCESS' THEN 1 END) as success_count
    FROM payment_events pe
    WHERE pe.received_at >= datetime('now', '-' || ? || ' days')
    GROUP BY DATE(pe.received_at)
    ORDER BY date ASC
  `).all(days);
}

/**
 * Get escalated calls with transcript refs.
 */
function getEscalatedCalls(limit = 50) {
  const db = getDb();
  return db.prepare(`
    SELECT cl.*, c.customer_id, cu.name, cu.phone_number
    FROM call_logs cl
    JOIN cases c ON cl.case_id = c.case_id
    JOIN customers cu ON c.customer_id = cu.customer_id
    WHERE cl.outcome = 'ESCALATED_TO_HUMAN'
    ORDER BY cl.started_at DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Get compliance audit log (filterable).
 */
function getComplianceAuditLog({ fromDate, toDate, outcomeFilter, limit = 200 }) {
  const db = getDb();
  let query = `
    SELECT cl.*, c.customer_id, cu.name, cu.phone_number, c.state as case_state
    FROM call_logs cl
    JOIN cases c ON cl.case_id = c.case_id
    JOIN customers cu ON c.customer_id = cu.customer_id
    WHERE 1=1
  `;
  const params = [];

  if (fromDate) {
    query += ` AND cl.started_at >= ?`;
    params.push(fromDate);
  }
  if (toDate) {
    query += ` AND cl.started_at <= ?`;
    params.push(toDate);
  }
  if (outcomeFilter) {
    query += ` AND cl.outcome = ?`;
    params.push(outcomeFilter);
  }

  query += ` ORDER BY cl.started_at DESC LIMIT ?`;
  params.push(limit);

  return db.prepare(query).all(...params);
}

// ══════════════════════════════════════════════════════════
// Courtesy Due Reminder Engine Helpers
// ══════════════════════════════════════════════════════════

/**
 * Calculates customer's oldest unpaid entry using FIFO offset against payments
 */
function getOldestUnpaidEntry(customerId) {
  const db = getDb();
  const payRow = db.prepare('SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE customer_id = ?').get(customerId);
  let remainingPaid = payRow ? payRow.total_paid : 0;

  const entries = db.prepare('SELECT entry_id, entry_date, due_amount FROM entries WHERE customer_id = ? ORDER BY entry_date ASC').all(customerId);

  for (const entry of entries) {
    if (remainingPaid >= entry.due_amount) {
      remainingPaid = Math.round((remainingPaid - entry.due_amount) * 100) / 100;
    } else {
      const unpaidAmount = Math.round((entry.due_amount - remainingPaid) * 100) / 100;
      const entryTime = new Date(entry.entry_date).getTime();
      const daysSinceDue = isNaN(entryTime) ? 0 : Math.max(0, Math.floor((Date.now() - entryTime) / (1000 * 60 * 60 * 24)));
      return {
        entryId: entry.entry_id,
        entryDate: entry.entry_date,
        unpaidAmount,
        daysSinceDue,
      };
    }
  }

  return null;
}

/**
 * Gets reminder settings for customer (defaults enabled=1, paused_until=null)
 */
function getReminderSettings(customerId) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM reminder_settings WHERE customer_id = ?').get(customerId);
  if (!row) {
    return { customer_id: customerId, reminders_enabled: 1, paused_until: null };
  }
  return {
    customer_id: row.customer_id,
    reminders_enabled: row.reminders_enabled === 1 ? 1 : 0,
    paused_until: row.paused_until,
  };
}

/**
 * Upsert reminder settings for a customer
 */
function upsertReminderSettings({ customerId, remindersEnabled, pausedUntil }) {
  const db = getDb();
  const existing = db.prepare('SELECT customer_id FROM reminder_settings WHERE customer_id = ?').get(customerId);
  if (existing) {
    db.prepare(`
      UPDATE reminder_settings
      SET reminders_enabled = CASE WHEN ? IS NOT NULL THEN ? ELSE reminders_enabled END,
          paused_until = ?
      WHERE customer_id = ?
    `).run(
      remindersEnabled !== undefined ? (remindersEnabled ? 1 : 0) : null,
      remindersEnabled !== undefined ? (remindersEnabled ? 1 : 0) : null,
      pausedUntil !== undefined ? pausedUntil : null,
      customerId
    );
  } else {
    db.prepare(`
      INSERT INTO reminder_settings (customer_id, reminders_enabled, paused_until)
      VALUES (?, ?, ?)
    `).run(customerId, remindersEnabled ? 1 : 0, pausedUntil || null);
  }
  return getReminderSettings(customerId);
}

/**
 * Logs a sent courtesy reminder
 */
function logReminder({
  reminderId,
  customerId,
  channel,
  messageText,
  paymentLink,
  dueAmountAtSend,
  scheduledStage,
  deliveryStatus = 'SENT',
  providerMessageId = null,
}) {
  const db = getDb();
  const id = reminderId || `rem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  db.prepare(`
    INSERT INTO reminder_log (
      reminder_id, customer_id, channel, message_text, payment_link,
      due_amount_at_send, scheduled_stage, sent_at, delivery_status, provider_message_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)
  `).run(
    id,
    customerId,
    channel,
    messageText,
    paymentLink || null,
    dueAmountAtSend,
    scheduledStage,
    deliveryStatus,
    providerMessageId
  );
  return db.prepare('SELECT * FROM reminder_log WHERE reminder_id = ?').get(id);
}

/**
 * Get reminder history for a customer
 */
function getReminderHistory(customerId, limit = 50) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM reminder_log
    WHERE customer_id = ?
    ORDER BY sent_at DESC
    LIMIT ?
  `).all(customerId, limit);
}

/**
 * Get all reminders sent for the current active due cycle
 */
function getRemindersSentForDueCycle(customerId) {
  const db = getDb();
  const oldest = getOldestUnpaidEntry(customerId);
  if (!oldest) return [];
  return db.prepare(`
    SELECT * FROM reminder_log
    WHERE customer_id = ? AND sent_at >= ?
    ORDER BY sent_at ASC
  `).all(customerId, oldest.entryDate);
}

/**
 * Shop-wide reminder statistics for Dues Report dashboard
 */
function getShopReminderSummary() {
  const db = getDb();

  // Sent this week (last 7 days)
  const weekRow = db.prepare(`
    SELECT COUNT(*) AS count
    FROM reminder_log
    WHERE sent_at >= datetime('now', '-7 days')
  `).get();

  // Total sent and delivery status counts
  const statusRows = db.prepare(`
    SELECT delivery_status, COUNT(*) as count
    FROM reminder_log
    GROUP BY delivery_status
  `).all();

  let totalSent = 0;
  let deliveredCount = 0;
  let failedCount = 0;
  for (const r of statusRows) {
    totalSent += r.count;
    if (r.delivery_status === 'DELIVERED' || r.delivery_status === 'READ' || r.delivery_status === 'SENT') {
      deliveredCount += r.count;
    }
    if (r.delivery_status === 'FAILED') {
      failedCount += r.count;
    }
  }

  const deliverySuccessRate = totalSent > 0 ? Math.round((deliveredCount / totalSent) * 100) : 100;

  // 48h payment response rate:
  // Customers who made a payment within 48h of receiving a reminder
  const responseRow = db.prepare(`
    SELECT COUNT(DISTINCT r.reminder_id) AS responded_count
    FROM reminder_log r
    JOIN payments p ON p.customer_id = r.customer_id
      AND p.pay_date >= r.sent_at
      AND p.pay_date <= datetime(r.sent_at, '+48 hours')
  `).get();

  const responseRate48h = totalSent > 0
    ? Math.round(((responseRow?.responded_count || 0) / totalSent) * 100)
    : 0;

  // Settings counts
  const settingsRows = db.prepare(`
    SELECT
      COUNT(CASE WHEN reminders_enabled = 1 AND (paused_until IS NULL OR paused_until <= datetime('now')) THEN 1 END) as active,
      COUNT(CASE WHEN reminders_enabled = 1 AND paused_until > datetime('now') THEN 1 END) as paused,
      COUNT(CASE WHEN reminders_enabled = 0 THEN 1 END) as disabled
    FROM reminder_settings
  `).get();

  // Recent logs
  const recentLogs = db.prepare(`
    SELECT r.*, c.name AS customer_name, c.phone_number
    FROM reminder_log r
    JOIN customers c ON c.customer_id = r.customer_id
    ORDER BY r.sent_at DESC
    LIMIT 10
  `).all();

  return {
    remindersSentThisWeek: weekRow?.count || 0,
    totalRemindersSent: totalSent,
    deliverySuccessRate,
    failedCount,
    responseRate48h,
    activeSettings: {
      active: settingsRows?.active || 0,
      paused: settingsRows?.paused || 0,
      disabled: settingsRows?.disabled || 0,
    },
    recentLogs,
  };
}

module.exports = {
  getDb,
  getCustomerDue,
  addEntry,
  recordPayment,
  getCustomerStats,
  autocompleteMedicines,
  // Recovery system exports
  generateId,
  isValidTransition,
  writeAuditTrail,
  createCase,
  updateCaseState,
  getCasesByState,
  getCaseById,
  getPromisedCasesPastDeadline,
  createCallLog,
  createPaymentEvent,
  generateCasesFromDues,
  getCaseStateCounts,
  getRecoveryRateOverTime,
  getEscalatedCalls,
  getComplianceAuditLog,
  // Courtesy reminder exports
  getOldestUnpaidEntry,
  getReminderSettings,
  upsertReminderSettings,
  logReminder,
  getReminderHistory,
  getRemindersSentForDueCycle,
  getShopReminderSummary,
};
