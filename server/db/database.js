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

  // Idempotent migration check: guarantee deleted_at column exists on customers for existing databases before executing schema.sql
  try {
    const tableInfo = dbInstance.pragma('table_info(customers)');
    const hasDeletedAt = tableInfo.some((col) => col.name === 'deleted_at');
    if (!hasDeletedAt && tableInfo.length > 0) {
      dbInstance.exec('ALTER TABLE customers ADD COLUMN deleted_at TEXT DEFAULT NULL;');
    }
  } catch (migErr) {
    console.warn('[MedTrack] Migration check for deleted_at column:', migErr.message);
  }

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
 * Calculates customer's exact net ledger balance (positive for dues, negative for credit/overpayment):
 * net_balance = SUM(entries.due_amount) - SUM(payments.amount)
 */
function getCustomerBalance(customerId) {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      ROUND(COALESCE(SUM(e.due_amount), 0) - (
        SELECT COALESCE(SUM(p.amount), 0)
        FROM payments p
        WHERE p.customer_id = ?
      ), 2) AS net_balance
    FROM entries e
    WHERE e.customer_id = ?
  `).get(customerId, customerId);

  return row ? (row.net_balance || 0) : 0;
}

/**
 * Calculates customer's exact total due from ledger data:
 * total_due = SUM(entries.due_amount) - SUM(payments.amount)
 */
function getCustomerDue(customerId) {
  const bal = getCustomerBalance(customerId);
  return Math.max(0, bal);
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
    if (!customer || customer.deleted_at) {
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
  if (!customer || customer.deleted_at) {
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

/**
 * Soft deletes a customer: sets deleted_at = CURRENT_TIMESTAMP
 * Strictly blocked if net balance != 0
 */
function softDeleteCustomer(customerId) {
  const db = getDb();
  const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customerId);
  if (!customer) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }

  if (customer.deleted_at) {
    const err = new Error('Customer is already in the Recycle Bin');
    err.status = 400;
    throw err;
  }

  const balance = getCustomerBalance(customerId);
  if (Math.abs(balance) > 0.001) {
    const err = new Error(
      balance > 0
        ? `Cannot delete customer with outstanding dues: currently ₹${balance.toFixed(2)} due.`
        : `Cannot delete customer with credit balance: currently ₹${Math.abs(balance).toFixed(2)} in credit.`
    );
    err.status = 409;
    err.due = balance;
    throw err;
  }

  db.prepare(`
    UPDATE customers
    SET deleted_at = datetime('now'), updated_at = datetime('now')
    WHERE customer_id = ?
  `).run(customerId);

  return { success: true, customerId, message: `Customer "${customer.name}" moved to Recycle Bin.` };
}

/**
 * Restores a soft-deleted customer from the Recycle Bin
 */
function restoreCustomer(customerId) {
  const db = getDb();
  const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customerId);
  if (!customer) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }

  if (!customer.deleted_at) {
    const err = new Error('Customer is not in the Recycle Bin');
    err.status = 400;
    throw err;
  }

  db.prepare(`
    UPDATE customers
    SET deleted_at = NULL, updated_at = datetime('now')
    WHERE customer_id = ?
  `).run(customerId);

  const restored = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customerId);
  return {
    ...restored,
    total_due: getCustomerDue(customerId),
  };
}

/**
 * Lists all customers currently in the Recycle Bin
 */
function getTrashCustomers() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      customer_id, phone_number, name, village, address, created_at, updated_at, deleted_at,
      ROUND(julianday('now') - julianday(deleted_at)) AS days_ago
    FROM customers
    WHERE deleted_at IS NOT NULL
    ORDER BY deleted_at DESC
  `).all();

  return rows.map((c) => ({
    ...c,
    total_due: getCustomerDue(c.customer_id),
    days_ago: Math.max(0, parseInt(c.days_ago, 10) || 0),
  }));
}

/**
 * Permanently deletes a customer and all their transaction history
 * Allowed ONLY if customer is already in the Recycle Bin
 * Takes a backup snapshot first, then executes in ONE transaction
 */
function permanentDeleteCustomer(customerId) {
  const db = getDb();
  const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customerId);
  if (!customer) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }

  if (!customer.deleted_at) {
    const err = new Error('Customer must be in the Recycle Bin before permanent deletion');
    err.status = 400;
    throw err;
  }

  // Pre-deletion safety backup snapshot
  const { performBackup } = require('../services/backupService');
  performBackup(true);

  // In ONE transaction: delete entry_medicine, entries, payments, and customer in order
  const tx = db.transaction(() => {
    db.prepare(`
      DELETE FROM entry_medicine
      WHERE entry_id IN (SELECT entry_id FROM entries WHERE customer_id = ?)
    `).run(customerId);

    db.prepare('DELETE FROM entries WHERE customer_id = ?').run(customerId);
    db.prepare('DELETE FROM payments WHERE customer_id = ?').run(customerId);
    db.prepare('DELETE FROM customers WHERE customer_id = ?').run(customerId);
  });

  tx();

  return { success: true, customerId, message: `Customer "${customer.name}" and all historical data permanently deleted.` };
}

/**
 * Auto-purges bin items older than retentionDays (default 30 days)
 * Takes a backup snapshot first, then permanently deletes expired items
 */
function autoPurgeTrash(retentionDays = config.TRASH_RETENTION_DAYS || 30) {
  const db = getDb();
  const days = parseInt(retentionDays, 10) || 30;

  const expiredCustomers = db.prepare(`
    SELECT customer_id, name, deleted_at
    FROM customers
    WHERE deleted_at IS NOT NULL
      AND deleted_at <= datetime('now', '-' || ? || ' days')
  `).all(days);

  if (expiredCustomers.length === 0) {
    return { purgedCount: 0 };
  }

  // Pre-purge safety backup snapshot
  const { performBackup } = require('../services/backupService');
  performBackup(true);

  const tx = db.transaction(() => {
    for (const c of expiredCustomers) {
      db.prepare(`
        DELETE FROM entry_medicine
        WHERE entry_id IN (SELECT entry_id FROM entries WHERE customer_id = ?)
      `).run(c.customer_id);

      db.prepare('DELETE FROM entries WHERE customer_id = ?').run(c.customer_id);
      db.prepare('DELETE FROM payments WHERE customer_id = ?').run(c.customer_id);
      db.prepare('DELETE FROM customers WHERE customer_id = ?').run(c.customer_id);
    }
  });

  tx();
  console.log(`[RecycleBin] Auto-purged ${expiredCustomers.length} customer(s) older than ${days} days.`);
  return { purgedCount: expiredCustomers.length };
}

module.exports = {
  getDb,
  closeDb,
  getCustomerDue,
  getCustomerBalance,
  addEntry,
  recordPayment,
  getCustomerStats,
  autocompleteMedicines,
  softDeleteCustomer,
  restoreCustomer,
  getTrashCustomers,
  permanentDeleteCustomer,
  autoPurgeTrash,
};
