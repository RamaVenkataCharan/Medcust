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

module.exports = {
  getDb,
  getCustomerDue,
  addEntry,
  recordPayment,
  getCustomerStats,
  autocompleteMedicines,
};
