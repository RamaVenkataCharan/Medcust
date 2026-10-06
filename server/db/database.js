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

function closeDb() {
  if (dbInstance) {
    try {
      dbInstance.pragma('wal_checkpoint(TRUNCATE)');
      dbInstance.close();
    } catch (e) {
      console.warn('DB close notice:', e.message);
    }
    dbInstance = null;
  }
}

/**
 * Calculates customer's exact total due from ledger data:
 * total_due = SUM(entries.due_amount) - SUM(payments.amount)
 */
function getCustomerDue(customerId) {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      (
        COALESCE(SUM(CAST(ROUND(e.due_amount * 100) AS INTEGER)), 0) -
        (
          SELECT COALESCE(SUM(CAST(ROUND(p.amount * 100) AS INTEGER)), 0)
          FROM payments p
          WHERE p.customer_id = ?
        )
      ) AS total_paise
    FROM entries e
    WHERE e.customer_id = ?
  `).get(customerId, customerId);

  return row ? Math.round(row.total_paise) : 0;
}

/**
 * Records a purchase entry atomically in a SQLite transaction
 * Inserts into `entries` and `entry_medicine`
 */
function addEntry({ customerId, totalAmount, amountPaid, medicines, entryDate }) {
  const db = getDb();
  const { computeBill, toEntryPayload } = require('../services/discountEngine');

  if (!medicines || !Array.isArray(medicines) || medicines.length === 0) {
    throw new Error('Entry requires at least one medicine item');
  }

  const currentDue = getCustomerDue(customerId) / 100;
  const bill = computeBill({
    lines: medicines.map(m => ({ name: m.name || m.medicine_name, price: m.price, discount: m.discount, mode: m.discount_mode || 'amount' })),
    paidNow: amountPaid,
    currentDue
  });

  if (!bill.ok) {
    const errorMsg = bill.errors.join(', ');
    const err = new Error(`Bill calculation error: ${errorMsg}`);
    err.code = 'BILL_COMPUTE_ERROR';
    err.errors = bill.errors;
    throw err;
  }

  const payload = toEntryPayload(bill);

  if (totalAmount !== undefined && totalAmount !== null) {
    const clientTotal = Math.round(parseFloat(totalAmount) * 100) / 100;
    if (clientTotal !== payload.total_amount) {
      const err = new Error(`Total amount mismatch. Expected ${payload.total_amount}, got ${clientTotal}`);
      err.code = 'TOTAL_MISMATCH';
      err.expected = payload.total_amount;
      throw err;
    }
  }

  const tx = db.transaction(() => {
    // 1. Verify customer
    const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    let finalEntryDate = null;
    if (entryDate) {
      try {
        finalEntryDate = new Date(entryDate).toISOString();
      } catch (e) {
        // Fallback to SQLite default if invalid date
      }
    }

    // 2. Insert entry
    const insertEntryStmt = db.prepare(`
      INSERT INTO entries (customer_id, entry_date, total_amount, amount_paid, due_amount)
      VALUES (?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ','now')), ?, ?, ?)
    `);

    const entryResult = insertEntryStmt.run(
      customerId,
      finalEntryDate,
      payload.total_amount,
      payload.amount_paid,
      payload.due_amount
    );
    const entryId = entryResult.lastInsertRowid;

    // 3. Insert line items into entry_medicine
    const insertMedStmt = db.prepare(`
      INSERT INTO entry_medicine (entry_id, medicine_name, price, discount)
      VALUES (?, ?, ?, ?)
    `);

    const insertedMeds = [];
    for (const med of payload.items) {
      if (!med.name) continue;
      insertMedStmt.run(entryId, med.name, med.price, med.discount);
      insertedMeds.push(med);
    }

    if (insertedMeds.length === 0) {
      throw new Error('At least one medicine name must be specified');
    }

    // 4. Update customer updated_at
    db.prepare(`UPDATE customers SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE customer_id = ?`).run(customerId);

    // 5. Get refreshed total due
    const newTotalDue = getCustomerDue(customerId);

    return {
      entryId,
      customerId,
      customerName: customer.name,
      phone: customer.phone_number,
      village: customer.village,
      totalAmount: payload.total_amount,
      amountPaid: payload.amount_paid,
      dueAmount: payload.due_amount,
      totalDue: newTotalDue / 100,
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

  const previousDue = getCustomerDue(customerId) / 100;

  const insertStmt = db.prepare(`
    INSERT INTO payments (customer_id, amount, note)
    VALUES (?, ?, ?)
  `);

  const result = insertStmt.run(customerId, cleanAmount, note || 'Cash counter settlement');
  const remainingDue = getCustomerDue(customerId);

  // Update customer updated_at
  db.prepare(`UPDATE customers SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE customer_id = ?`).run(customerId);

  return {
    paymentId: result.lastInsertRowid,
    customerId,
    customerName: customer.name,
    amount: cleanAmount,
    note: note || 'Cash counter settlement',
    previousDue,
    remainingDue: remainingDue / 100,
    payDate: new Date().toISOString(),
  };
}

/**
 * Get customer stats: computed due, last visit, and recently bought distinct medicines
 */
function getCustomerStats(customerId) {
  const db = getDb();

  const totalDue = getCustomerDue(customerId) / 100;

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

module.exports = {
  getDb,
  closeDb,
  getCustomerDue,
  addEntry,
  recordPayment,
  getCustomerStats,
  autocompleteMedicines,
};
