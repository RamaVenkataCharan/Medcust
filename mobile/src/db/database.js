import { Platform } from 'react-native';
import { getCurrentLocalIso } from '../utils/dateUtils';
import {
  cleanPhoneNumber,
  calculateEntryDue,
  calculatePaymentDue,
  calculateCustomerTotalDue,
} from '../utils/khataLogic';

// ─────────────────────────────────────────────────────────────
// 1. NATIVE SQLITE DRIVER (Android / iOS)
// ─────────────────────────────────────────────────────────────
let nativeDb = null;

function getNativeDb() {
  if (!nativeDb) {
    const SQLite = require('expo-sqlite');
    nativeDb = SQLite.openDatabaseSync('medtrack_mobile.db');
  }
  return nativeDb;
}

function initNativeDatabase() {
  const db = getNativeDb();
  db.execSync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS customers (
      customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      village TEXT,
      address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS entries (
      entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
      entry_date TEXT DEFAULT CURRENT_TIMESTAMP,
      total_amount REAL NOT NULL DEFAULT 0,
      amount_paid REAL NOT NULL DEFAULT 0,
      due_amount REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS entry_medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL REFERENCES entries(entry_id),
      medicine_name TEXT NOT NULL,
      price REAL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_number);
    CREATE INDEX IF NOT EXISTS idx_entries_customer ON entries(customer_id);
    CREATE INDEX IF NOT EXISTS idx_entry_meds_entry ON entry_medicines(entry_id);
  `);

  // Idempotent migration: Add 'note' column to entries if it doesn't exist
  try {
    db.execSync("ALTER TABLE entries ADD COLUMN note TEXT;");
  } catch (e) {
    if (!e.message.includes("duplicate column name")) {
      console.warn("Could not add 'note' column to entries:", e);
    }
  }

  // Idempotent migration: Add 'discount' column to entry_medicines if it doesn't exist
  try {
    db.execSync("ALTER TABLE entry_medicines ADD COLUMN discount REAL DEFAULT 0;");
  } catch (e) {
    if (!e.message.includes("duplicate column name")) {
      console.warn("Could not add 'discount' column to entry_medicines:", e);
    }
  }

  // Idempotent migration: Add 'deleted_at' column to customers if it doesn't exist
  try {
    db.execSync("ALTER TABLE customers ADD COLUMN deleted_at TEXT DEFAULT NULL;");
  } catch (e) {
    if (!e.message.includes("duplicate column name")) {
      console.warn("Could not add 'deleted_at' column to customers:", e);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 2. WEB PERSISTENT DRIVER (Localhost browser fallback only)
// ─────────────────────────────────────────────────────────────
const WEB_STORAGE_KEY = 'medtrack_web_db_v1';

function getWebState() {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(WEB_STORAGE_KEY) : null;
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Could not read web localStorage:', e);
  }
  return {
    customers: [],
    entries: [],
    entry_medicines: [],
    nextCustomerId: 1,
    nextEntryId: 1,
    nextMedicineId: 1,
  };
}

function saveWebState(state) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(state));
    }
  } catch (e) {
    console.warn('Could not save web localStorage:', e);
  }
}

// ─────────────────────────────────────────────────────────────
// 3. UNIFIED OPERATIONS LAYER
// ─────────────────────────────────────────────────────────────

export function getActiveDriverName() {
  return Platform.OS === 'web' ? 'WEB_FALLBACK (localStorage)' : 'NATIVE_EXPO_SQLITE (SQLite file)';
}

export function initDatabase() {
  const driver = getActiveDriverName();
  console.log(`[MedTrack] Initializing database layer using driver: ${driver}`);

  if (Platform.OS === 'web') {
    const state = getWebState();
    saveWebState(state);
    return;
  }

  initNativeDatabase();
}

export function searchCustomers(query = '') {
  if (Platform.OS === 'web') {
    const state = getWebState();
    const trimmed = query.trim().toLowerCase();

    const results = state.customers.map((c) => {
      const customerEntries = state.entries.filter((e) => e.customer_id === c.customer_id);
      const totalDue = calculateCustomerTotalDue(customerEntries);
      const lastEntry = customerEntries[customerEntries.length - 1];
      return {
        ...c,
        total_due: totalDue,
        last_activity: lastEntry ? lastEntry.entry_date : c.created_at,
      };
    });

    const filtered = trimmed
      ? results.filter(
          (c) =>
            !c.deleted_at &&
            (c.name.toLowerCase().includes(trimmed) ||
             c.phone_number.includes(trimmed))
        )
      : results.filter((c) => !c.deleted_at);

    return filtered.sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity));
  }

  // Native expo-sqlite
  const db = getNativeDb();
  const trimmed = query.trim();

  if (!trimmed) {
    return db.getAllSync(`
      SELECT 
        c.customer_id, 
        c.phone_number, 
        c.name, 
        c.village, 
        c.address, 
        c.created_at,
        ROUND(COALESCE(SUM(e.due_amount), 0), 2) AS total_due,
        MAX(e.entry_date) AS last_activity
      FROM customers c
      LEFT JOIN entries e ON c.customer_id = e.customer_id
      WHERE c.deleted_at IS NULL
      GROUP BY c.customer_id
      ORDER BY COALESCE(MAX(e.entry_date), c.created_at) DESC
      LIMIT 100;
    `);
  }

  const pattern = `%${trimmed}%`;
  return db.getAllSync(`
    SELECT 
      c.customer_id, 
      c.phone_number, 
      c.name, 
      c.village, 
      c.address, 
      c.created_at,
      ROUND(COALESCE(SUM(e.due_amount), 0), 2) AS total_due,
      MAX(e.entry_date) AS last_activity
    FROM customers c
    LEFT JOIN entries e ON c.customer_id = e.customer_id
    WHERE c.deleted_at IS NULL AND (c.phone_number LIKE ? OR c.name LIKE ?)
    GROUP BY c.customer_id
    ORDER BY c.name ASC
    LIMIT 50;
  `, [pattern, pattern]);
}

export function getCustomerById(customerId) {
  const numericId = parseInt(customerId, 10);

  if (Platform.OS === 'web') {
    const state = getWebState();
    const cust = state.customers.find((c) => c.customer_id === numericId);
    if (!cust) return null;

    const custEntries = state.entries.filter((e) => e.customer_id === numericId);
    const totalDue = calculateCustomerTotalDue(custEntries);

    return {
      ...cust,
      total_due: totalDue,
      total_entries: custEntries.length,
    };
  }

  // Native expo-sqlite
  const db = getNativeDb();
  return db.getFirstSync(`
    SELECT 
      c.customer_id, 
      c.phone_number, 
      c.name, 
      c.village, 
      c.address, 
      c.created_at,
      ROUND(COALESCE(SUM(e.due_amount), 0), 2) AS total_due,
      COUNT(e.entry_id) AS total_entries
    FROM customers c
    LEFT JOIN entries e ON c.customer_id = e.customer_id
    WHERE c.customer_id = ? AND c.deleted_at IS NULL
    GROUP BY c.customer_id;
  `, [numericId]);
}

export function getCustomerByPhone(phoneNumber) {
  const cleaned = cleanPhoneNumber(phoneNumber);

  if (Platform.OS === 'web') {
    const state = getWebState();
    return state.customers.find((c) => c.phone_number === cleaned) || null;
  }

  // Native expo-sqlite
  const db = getNativeDb();
  return db.getFirstSync(`
    SELECT * FROM customers 
    WHERE phone_number = ? OR phone_number LIKE ?
    LIMIT 1;
  `, [cleaned, `%${cleaned}`]);
}

export function addCustomer({ name, phone_number, village, address }) {
  const cleanedPhone = cleanPhoneNumber(phone_number);
  const now = getCurrentLocalIso();

  if (Platform.OS === 'web') {
    const state = getWebState();
    const newCustomer = {
      customer_id: state.nextCustomerId++,
      phone_number: cleanedPhone,
      name: name.trim(),
      village: village ? village.trim() : null,
      address: address ? address.trim() : null,
      created_at: now,
    };
    state.customers.push(newCustomer);
    saveWebState(state);
    return newCustomer.customer_id;
  }

  // Native expo-sqlite
  const db = getNativeDb();
  const result = db.runSync(`
    INSERT INTO customers (phone_number, name, village, address, created_at)
    VALUES (?, ?, ?, ?, ?);
  `, [cleanedPhone, name.trim(), village ? village.trim() : null, address ? address.trim() : null, now]);

  return result.lastInsertRowId;
}

export function getCustomerLedger(customerId) {
  const numericId = parseInt(customerId, 10);

  if (Platform.OS === 'web') {
    const state = getWebState();
    const custEntries = state.entries
      .filter((e) => e.customer_id === numericId)
      .sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date));

    return custEntries.map((entry) => {
      const meds = state.entry_medicines.filter((m) => m.entry_id === entry.entry_id);
      return {
        ...entry,
        medicines: meds,
      };
    });
  }

  // Native expo-sqlite
  const db = getNativeDb();
  const entries = db.getAllSync(`
    SELECT 
      entry_id, 
      customer_id, 
      entry_date, 
      total_amount, 
      amount_paid, 
      due_amount
    FROM entries
    WHERE customer_id = ?
    ORDER BY entry_date DESC, entry_id DESC;
  `, [numericId]);

  const entryIds = entries.map((e) => e.entry_id);
  if (entryIds.length === 0) return [];

  const placeholders = entryIds.map(() => '?').join(',');
  const allMeds = db.getAllSync(`
    SELECT id, entry_id, medicine_name, price 
    FROM entry_medicines 
    WHERE entry_id IN (${placeholders})
    ORDER BY id ASC;
  `, entryIds);

  const medsByEntry = {};
  allMeds.forEach((m) => {
    if (!medsByEntry[m.entry_id]) medsByEntry[m.entry_id] = [];
    medsByEntry[m.entry_id].push(m);
  });

  return entries.map((entry) => ({
    ...entry,
    medicines: medsByEntry[entry.entry_id] || [],
  }));
}

export function addPurchaseEntry({ customerId, medicines = [], totalAmount = 0, amountPaid = 0 }) {
  const numericId = parseInt(customerId, 10);
  const now = getCurrentLocalIso();
  const parsedTotal = parseFloat(totalAmount) || 0;
  const parsedPaid = parseFloat(amountPaid) || 0;
  const dueAmount = calculateEntryDue(parsedTotal, parsedPaid);

  if (Platform.OS === 'web') {
    const state = getWebState();
    const entryId = state.nextEntryId++;
    const newEntry = {
      entry_id: entryId,
      customer_id: numericId,
      entry_date: now,
      total_amount: parsedTotal,
      amount_paid: parsedPaid,
      due_amount: dueAmount,
    };
    state.entries.push(newEntry);

    for (const med of medicines) {
      if (med.name && med.name.trim()) {
        state.entry_medicines.push({
          id: state.nextMedicineId++,
          entry_id: entryId,
          medicine_name: med.name.trim(),
          price: parseFloat(med.price) || 0,
          discount: parseFloat(med.discount) || 0,
        });
      }
    }

    saveWebState(state);
    return entryId;
  }

  // Native expo-sqlite
  const db = getNativeDb();
  let insertedEntryId = null;

  db.withTransactionSync(() => {
    const res = db.runSync(`
      INSERT INTO entries (customer_id, entry_date, total_amount, amount_paid, due_amount)
      VALUES (?, ?, ?, ?, ?);
    `, [numericId, now, parsedTotal, parsedPaid, dueAmount]);

    insertedEntryId = res.lastInsertRowId;

    for (const med of medicines) {
      if (med.name && med.name.trim()) {
        const medPrice = parseFloat(med.price) || 0;
        const medDiscount = parseFloat(med.discount) || 0;
        db.runSync(`
          INSERT INTO entry_medicines (entry_id, medicine_name, price, discount)
          VALUES (?, ?, ?, ?);
        `, [insertedEntryId, med.name.trim(), medPrice, medDiscount]);
      }
    }
  });

  return insertedEntryId;
}

export function addDuePayment({ customerId, amountPaid, note = null }) {
  const numericId = parseInt(customerId, 10);
  const now = getCurrentLocalIso();
  const parsedPaid = parseFloat(amountPaid) || 0;
  const dueAmount = calculatePaymentDue(parsedPaid);

  if (Platform.OS === 'web') {
    const state = getWebState();
    const entryId = state.nextEntryId++;
    state.entries.push({
      entry_id: entryId,
      customer_id: numericId,
      entry_date: now,
      total_amount: 0,
      amount_paid: parsedPaid,
      due_amount: dueAmount,
      note: note,
    });
    saveWebState(state);
    return entryId;
  }

  // Native expo-sqlite
  const db = getNativeDb();
  const res = db.runSync(`
    INSERT INTO entries (customer_id, entry_date, total_amount, amount_paid, due_amount, note)
    VALUES (?, ?, 0, ?, ?, ?);
  `, [numericId, now, parsedPaid, dueAmount, note]);

  return res.lastInsertRowId;
}

export function getPastMedicineNames() {
  if (Platform.OS === 'web') {
    const state = getWebState();
    const names = Array.from(new Set(state.entry_medicines.map((m) => m.medicine_name)));
    return names.sort().slice(0, 100);
  }

  // Native expo-sqlite
  const db = getNativeDb();
  const rows = db.getAllSync(`
    SELECT DISTINCT medicine_name 
    FROM entry_medicines 
    ORDER BY medicine_name ASC 
    LIMIT 100;
  `);
  return rows.map((r) => r.medicine_name);
}

export function exportAllData() {
  if (Platform.OS === 'web') {
    const state = getWebState();
    return {
      version: '1.0',
      exportedAt: getCurrentLocalIso(),
      customers: state.customers,
      entries: state.entries,
      entryMedicines: state.entry_medicines,
    };
  }

  // Native expo-sqlite
  const db = getNativeDb();
  const customers = db.getAllSync(`SELECT * FROM customers ORDER BY customer_id ASC;`);
  const entries = db.getAllSync(`SELECT * FROM entries ORDER BY entry_id ASC;`);
  const entryMedicines = db.getAllSync(`SELECT * FROM entry_medicines ORDER BY id ASC;`);

  return {
    version: '1.0',
    exportedAt: getCurrentLocalIso(),
    customers,
    entries,
    entryMedicines,
  };
}

export async function restoreDatabaseFromJson(data) {
  const { verifyImport } = require('../utils/importValidator');

  if (Platform.OS === 'web') {
    // Web fallback (Atomic by definition via localStorage.setItem)
    const newState = {
      customers: data.customers || [],
      entries: data.entries || [],
      entry_medicines: data.entryMedicines || [],
      nextCustomerId: Math.max(1, ...(data.customers || []).map(c => c.customer_id)) + 1,
      nextEntryId: Math.max(1, ...(data.entries || []).map(e => e.entry_id)) + 1,
      nextMedicineId: Math.max(1, ...(data.entryMedicines || []).map(m => m.id)) + 1,
    };
    
    // Verify first, swap only after passes
    // Map web keys for verifyImport which expects entryMedicines
    const actualForVerify = {
      customers: newState.customers,
      entries: newState.entries,
      entryMedicines: newState.entry_medicines
    };
    verifyImport(data, actualForVerify);
    
    saveWebState(newState);
    return true;
  }

  // Native expo-sqlite
  const db = getNativeDb();
  
  await db.withExclusiveTransactionAsync(async () => {
    // 1. Delete child rows first (replace only)
    await db.runAsync(`DELETE FROM entry_medicines;`);
    await db.runAsync(`DELETE FROM entries;`);
    await db.runAsync(`DELETE FROM customers;`);

    // (If shop_profile exists in the future, we don't delete it because it's not in the backup)

    // 2. Insert customers
    for (const c of data.customers) {
      await db.runAsync(
        `INSERT INTO customers (customer_id, phone_number, name, village, address, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [c.customer_id, c.phone_number, c.name, c.village || '', c.address || '', c.created_at || getCurrentLocalIso(), c.deleted_at || null]
      );
    }

    // 3. Insert entries (with defaults, so deleted_at can be added later)
    for (const e of data.entries) {
      await db.runAsync(
        `INSERT INTO entries (entry_id, customer_id, entry_date, total_amount, amount_paid, due_amount, note) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [e.entry_id, e.customer_id, e.entry_date || getCurrentLocalIso(), e.total_amount || 0, e.amount_paid || 0, e.due_amount || 0, e.note || null]
      );
    }

    // 4. Insert entryMedicines
    for (const m of data.entryMedicines) {
      await db.runAsync(
        `INSERT INTO entry_medicines (id, entry_id, medicine_name, price, discount) VALUES (?, ?, ?, ?, ?)`,
        [m.id, m.entry_id, m.medicine_name, m.price || 0, m.discount || 0]
      );
    }

    // 5. Verify import integrity
    const actualCustomers = await db.getAllAsync(`SELECT * FROM customers`);
    const actualEntries = await db.getAllAsync(`SELECT * FROM entries`);
    const actualEntryMedicines = await db.getAllAsync(`SELECT * FROM entry_medicines`);
    
    verifyImport(data, {
      customers: actualCustomers,
      entries: actualEntries,
      entryMedicines: actualEntryMedicines
    });
  });

  return true;
}

// ─────────────────────────────────────────────────────────────
// RECYCLE BIN OPERATIONS
// ─────────────────────────────────────────────────────────────

export function getDeletedCustomers() {
  if (Platform.OS === 'web') {
    const state = getWebState();
    return state.customers.filter(c => c.deleted_at).map(c => {
      const custEntries = state.entries.filter(e => e.customer_id === c.customer_id);
      return {
        ...c,
        total_due: calculateCustomerTotalDue(custEntries),
        total_entries: custEntries.length
      };
    });
  }

  const db = getNativeDb();
  return db.getAllSync(`
    SELECT c.*,
           ROUND(COALESCE(SUM(e.due_amount), 0), 2) AS total_due,
           COUNT(e.entry_id) AS total_entries
    FROM customers c
    LEFT JOIN entries e ON c.customer_id = e.customer_id
    WHERE c.deleted_at IS NOT NULL
    GROUP BY c.customer_id
    ORDER BY c.deleted_at DESC;
  `);
}

export function softDeleteCustomer(customerId) {
  const numericId = parseInt(customerId, 10);
  const now = getCurrentLocalIso();
  
  if (Platform.OS === 'web') {
    const state = getWebState();
    const cust = state.customers.find((c) => c.customer_id === numericId);
    if (cust) {
      cust.deleted_at = now;
      saveWebState(state);
      return true;
    }
    return false;
  }
  
  const db = getNativeDb();
  const res = db.runSync(`UPDATE customers SET deleted_at = ? WHERE customer_id = ?;`, [now, numericId]);
  return res.changes > 0;
}

export function restoreDeletedCustomer(customerId) {
  const numericId = parseInt(customerId, 10);
  
  if (Platform.OS === 'web') {
    const state = getWebState();
    const cust = state.customers.find((c) => c.customer_id === numericId);
    if (cust) {
      cust.deleted_at = null;
      saveWebState(state);
      return true;
    }
    return false;
  }
  
  const db = getNativeDb();
  const res = db.runSync(`UPDATE customers SET deleted_at = NULL WHERE customer_id = ?;`, [numericId]);
  return res.changes > 0;
}

export async function permanentlyDeleteCustomer(customerId) {
  const numericId = parseInt(customerId, 10);
  
  if (Platform.OS === 'web') {
    const state = getWebState();
    state.customers = state.customers.filter(c => c.customer_id !== numericId);
    const entryIds = state.entries.filter(e => e.customer_id === numericId).map(e => e.entry_id);
    state.entries = state.entries.filter(e => e.customer_id !== numericId);
    state.entry_medicines = state.entry_medicines.filter(m => !entryIds.includes(m.entry_id));
    saveWebState(state);
    return true;
  }

  const db = getNativeDb();
  await db.withExclusiveTransactionAsync(async () => {
    // 1. Delete entry medicines
    await db.runAsync(`
      DELETE FROM entry_medicines 
      WHERE entry_id IN (SELECT entry_id FROM entries WHERE customer_id = ?);
    `, [numericId]);
    
    // 2. Delete entries
    await db.runAsync(`DELETE FROM entries WHERE customer_id = ?;`, [numericId]);
    
    // 3. Delete customer
    await db.runAsync(`DELETE FROM customers WHERE customer_id = ?;`, [numericId]);
  });
  return true;
}
