import { Platform } from 'react-native';
import { getCurrentLocalIso } from '../utils/dateUtils';
import {
  cleanPhoneNumber,
  calculateEntryDue,
  calculatePaymentDue,
  calculateCustomerTotalDue,
  isValidMedicineName,
  cleanMedicineName,
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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
      entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
      entry_date TEXT DEFAULT CURRENT_TIMESTAMP,
      subtotal REAL NOT NULL DEFAULT 0,
      discount_percent REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      amount_paid REAL NOT NULL DEFAULT 0,
      due_amount REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS entry_medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL REFERENCES entries(entry_id),
      medicine_name TEXT NOT NULL,
      price REAL DEFAULT 0,
      discount REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS shop_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      shop_name TEXT DEFAULT '',
      shop_license_no TEXT DEFAULT '',
      shop_license_validity TEXT DEFAULT '',
      shop_phone TEXT DEFAULT '',
      pharmacist_name TEXT DEFAULT '',
      pharmacist_phone TEXT DEFAULT '',
      pharmacist_license_validity TEXT DEFAULT '',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO shop_profile (id) VALUES (1);

    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_number);
    CREATE INDEX IF NOT EXISTS idx_customers_deleted ON customers(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_entries_customer ON entries(customer_id);
    CREATE INDEX IF NOT EXISTS idx_entry_meds_entry ON entry_medicines(entry_id);

    -- Purge junk test entries to protect suggestion data quality
    DELETE FROM entry_medicines 
    WHERE LENGTH(TRIM(medicine_name)) < 3 
       OR LOWER(TRIM(medicine_name)) IN ('it is', 'yu', 'test', 'testing', 'asdf', 'qwerty', 'temp', 'junk', 'sample', 'na', 'n/a', 'none', 'null', 'undefined', 'foo', 'bar', 'xx');
  `);

  // Schema migration: guarantee discount column exists on entry_medicines for existing databases
  try {
    const tableInfo = db.getAllSync(`PRAGMA table_info(entry_medicines);`);
    const hasDiscount = tableInfo.some((col) => col.name === 'discount');
    if (!hasDiscount) {
      db.execSync(`ALTER TABLE entry_medicines ADD COLUMN discount REAL DEFAULT 0;`);
    }
  } catch (migErr) {
    console.warn('[MedTrack] Migration check for discount column:', migErr);
  }

  // Schema migration: guarantee deleted_at column exists on customers for existing databases
  try {
    const custInfo = db.getAllSync(`PRAGMA table_info(customers);`);
    const hasDeletedAt = custInfo.some((col) => col.name === 'deleted_at');
    if (!hasDeletedAt) {
      db.execSync(`ALTER TABLE customers ADD COLUMN deleted_at TEXT DEFAULT NULL;`);
    }
  } catch (migErr) {
    console.warn('[MedTrack] Migration check for deleted_at column:', migErr);
  }

  // Schema migration: guarantee subtotal, discount_percent, discount_amount exist on entries
  try {
    const entriesInfo = db.getAllSync(`PRAGMA table_info(entries);`);
    const hasSubtotal = entriesInfo.some((col) => col.name === 'subtotal');
    if (!hasSubtotal) {
      db.execSync(`ALTER TABLE entries ADD COLUMN subtotal REAL DEFAULT 0;`);
    }
    const hasDiscountPercent = entriesInfo.some((col) => col.name === 'discount_percent');
    if (!hasDiscountPercent) {
      db.execSync(`ALTER TABLE entries ADD COLUMN discount_percent REAL DEFAULT 0;`);
    }
    const hasDiscountAmount = entriesInfo.some((col) => col.name === 'discount_amount');
    if (!hasDiscountAmount) {
      db.execSync(`ALTER TABLE entries ADD COLUMN discount_amount REAL DEFAULT 0;`);
    }

    // Backfill legacy rows where subtotal is 0 or null
    db.execSync(`
      UPDATE entries 
      SET subtotal = total_amount 
      WHERE (subtotal = 0 OR subtotal IS NULL) AND total_amount > 0;
    `);
  } catch (migErr) {
    console.warn('[MedTrack] Migration check for entries discount columns:', migErr);
  }
}

// ─────────────────────────────────────────────────────────────
// 2. WEB FALLBACK DRIVER (localStorage simulation)
// ─────────────────────────────────────────────────────────────
const WEB_STORAGE_KEY = 'medtrack_khata_web_state_v1';

function getWebState() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data = window.localStorage.getItem(WEB_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (!parsed.customers) parsed.customers = [];
        if (!parsed.entries) parsed.entries = [];
        if (!parsed.entry_medicines) parsed.entry_medicines = [];
        if (!parsed.shop_profile) parsed.shop_profile = {};
        if (!parsed.nextCustomerId) parsed.nextCustomerId = parsed.customers.length + 1;
        if (!parsed.nextEntryId) parsed.nextEntryId = parsed.entries.length + 1;
        if (!parsed.nextMedicineId) parsed.nextMedicineId = parsed.entry_medicines.length + 1;
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read web localStorage:', e);
  }

  return {
    customers: [],
    entries: [],
    entry_medicines: [],
    shop_profile: {},
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
    purgeExpiredTrash();
    return;
  }

  initNativeDatabase();
  purgeExpiredTrash();
}

export function searchCustomers(query = '') {
  if (Platform.OS === 'web') {
    const state = getWebState();
    const trimmed = query.trim().toLowerCase();

    const activeCustomers = state.customers.filter((c) => !c.deleted_at);
    const results = activeCustomers.map((c) => {
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
            c.name.toLowerCase().includes(trimmed) ||
            c.phone_number.includes(trimmed) ||
            (c.village && c.village.toLowerCase().includes(trimmed))
        )
      : results;

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
    WHERE c.deleted_at IS NULL AND (c.phone_number LIKE ? OR c.name LIKE ? OR c.village LIKE ?)
    GROUP BY c.customer_id
    ORDER BY c.name ASC
    LIMIT 50;
  `, [pattern, pattern, pattern]);
}

export function getCustomerById(customerId, includeDeleted = false) {
  const numericId = parseInt(customerId, 10);

  if (Platform.OS === 'web') {
    const state = getWebState();
    const cust = state.customers.find((c) => c.customer_id === numericId && (includeDeleted || !c.deleted_at));
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
      c.deleted_at,
      ROUND(COALESCE(SUM(e.due_amount), 0), 2) AS total_due,
      COUNT(e.entry_id) AS total_entries
    FROM customers c
    LEFT JOIN entries e ON c.customer_id = e.customer_id
    WHERE c.customer_id = ? AND (? = 1 OR c.deleted_at IS NULL)
    GROUP BY c.customer_id;
  `, [numericId, includeDeleted ? 1 : 0]);
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
    SELECT customer_id, phone_number, name, village, address, created_at, deleted_at
    FROM customers
    WHERE phone_number = ?;
  `, [cleaned]);
}

export function addCustomer({ phone_number, name, village = '', address = '' }) {
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
      deleted_at: null,
    };
    state.customers.push(newCustomer);
    saveWebState(state);
    return newCustomer.customer_id;
  }

  // Native expo-sqlite
  const db = getNativeDb();
  const result = db.runSync(`
    INSERT INTO customers (phone_number, name, village, address, created_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, NULL);
  `, [cleanedPhone, name.trim(), village ? village.trim() : null, address ? address.trim() : null, now]);

  return result.lastInsertRowId;
}

export function updateCustomer({ customerId, name, village = '', address = '' }) {
  const numericId = parseInt(customerId, 10);
  if (!numericId) return false;

  if (Platform.OS === 'web') {
    const state = getWebState();
    const cust = state.customers.find((c) => c.customer_id === numericId);
    if (!cust) return false;
    cust.name = name.trim();
    cust.village = village ? village.trim() : null;
    cust.address = address ? address.trim() : null;
    saveWebState(state);
    return true;
  }

  // Native expo-sqlite
  const db = getNativeDb();
  const result = db.runSync(`
    UPDATE customers 
    SET name = ?, village = ?, address = ?
    WHERE customer_id = ?;
  `, [name.trim(), village ? village.trim() : null, address ? address.trim() : null, numericId]);

  return (result.changes || 0) > 0;
}

export function deleteCustomer(customerId) {
  const numericId = parseInt(customerId, 10);
  if (!numericId) {
    throw new Error(`Invalid customer ID: "${customerId}"`);
  }
  const now = getCurrentLocalIso();

  let changes = 0;
  if (Platform.OS === 'web') {
    const state = getWebState();
    const cust = state.customers.find((c) => c.customer_id === numericId);
    if (!cust) {
      throw new Error(`Customer with ID ${numericId} not found in database (0 rows changed).`);
    }
    cust.deleted_at = now;
    saveWebState(state);
    changes = 1;
  } else {
    // Native expo-sqlite
    const db = getNativeDb();
    const result = db.runSync(`
      UPDATE customers SET deleted_at = ? WHERE customer_id = ?;
    `, [now, numericId]);
    changes = result.changes || 0;
  }

  if (changes === 0) {
    throw new Error(`Customer ID ${numericId} update matched 0 rows (customer not found).`);
  }

  return { success: true, changes };
}

export function getTrashCustomers() {
  if (Platform.OS === 'web') {
    const state = getWebState();
    return state.customers
      .filter((c) => Boolean(c.deleted_at))
      .map((c) => ({ ...c }))
      .sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));
  }

  // Native expo-sqlite
  const db = getNativeDb();
  return db.getAllSync(`
    SELECT customer_id, phone_number, name, village, address, created_at, deleted_at
    FROM customers
    WHERE deleted_at IS NOT NULL
    ORDER BY deleted_at DESC;
  `);
}

export function restoreCustomer(customerId) {
  const numericId = parseInt(customerId, 10);
  if (!numericId) return false;

  if (Platform.OS === 'web') {
    const state = getWebState();
    const cust = state.customers.find((c) => c.customer_id === numericId);
    if (!cust) return false;
    cust.deleted_at = null;
    saveWebState(state);
    return true;
  }

  // Native expo-sqlite
  const db = getNativeDb();
  const result = db.runSync(`
    UPDATE customers SET deleted_at = NULL WHERE customer_id = ?;
  `, [numericId]);

  return (result.changes || 0) > 0;
}

export function permanentDeleteCustomer(customerId) {
  const numericId = parseInt(customerId, 10);
  if (!numericId) return false;

  if (Platform.OS === 'web') {
    const state = getWebState();
    const customerEntries = state.entries.filter((e) => e.customer_id === numericId);
    const entryIds = new Set(customerEntries.map((e) => e.entry_id));

    state.entry_medicines = state.entry_medicines.filter((m) => !entryIds.has(m.entry_id));
    state.entries = state.entries.filter((e) => e.customer_id !== numericId);
    state.customers = state.customers.filter((c) => c.customer_id !== numericId);

    saveWebState(state);
    return true;
  }

  // Native expo-sqlite: atomic cascade delete
  const db = getNativeDb();
  db.withTransactionSync(() => {
    // 1. Cascade delete entry_medicines for all entries of this customer
    db.runSync(`
      DELETE FROM entry_medicines 
      WHERE entry_id IN (SELECT entry_id FROM entries WHERE customer_id = ?);
    `, [numericId]);

    // 2. Cascade delete entries
    db.runSync(`
      DELETE FROM entries WHERE customer_id = ?;
    `, [numericId]);

    // 3. Delete customer
    db.runSync(`
      DELETE FROM customers WHERE customer_id = ?;
    `, [numericId]);
  });

  return true;
}

/**
 * Auto-purges customers deleted over 30 days ago in one atomic cascade transaction
 * (entries, medicine lines, payments).
 * Accepts an optional simulatedCurrentDate for testing retention boundaries (29-day keep vs 31-day purge).
 */
export function purgeExpiredTrash(simulatedCurrentDate = new Date()) {
  const cutoffTime = new Date(simulatedCurrentDate).getTime() - 30 * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffTime).toISOString();

  if (Platform.OS === 'web') {
    const state = getWebState();
    const expiredCustomers = state.customers.filter((c) => {
      if (!c.deleted_at) return false;
      const t = new Date(c.deleted_at).getTime();
      return t < cutoffTime;
    });

    if (expiredCustomers.length === 0) {
      return { purgedCount: 0, customerIds: [] };
    }

    const expiredIds = new Set(expiredCustomers.map((c) => c.customer_id));
    const customerEntries = state.entries.filter((e) => expiredIds.has(e.customer_id));
    const entryIds = new Set(customerEntries.map((e) => e.entry_id));

    // Atomically cascade delete in web state
    state.entry_medicines = state.entry_medicines.filter((m) => !entryIds.has(m.entry_id));
    state.entries = state.entries.filter((e) => !expiredIds.has(e.customer_id));
    state.customers = state.customers.filter((c) => !expiredIds.has(c.customer_id));

    saveWebState(state);
    return { purgedCount: expiredCustomers.length, customerIds: Array.from(expiredIds) };
  }

  // Native expo-sqlite: atomic cascade delete inside one transaction
  const db = getNativeDb();
  let purgedCount = 0;
  let purgedIds = [];

  db.withTransactionSync(() => {
    const rows = db.getAllSync(`
      SELECT customer_id FROM customers 
      WHERE deleted_at IS NOT NULL AND deleted_at < ?;
    `, [cutoffIso]);

    purgedIds = rows.map((r) => r.customer_id);
    purgedCount = purgedIds.length;

    if (purgedCount > 0) {
      // 1. Cascade delete entry_medicines
      db.runSync(`
        DELETE FROM entry_medicines 
        WHERE entry_id IN (
          SELECT entry_id FROM entries 
          WHERE customer_id IN (SELECT customer_id FROM customers WHERE deleted_at IS NOT NULL AND deleted_at < ?)
        );
      `, [cutoffIso]);

      // 2. Cascade delete entries (purchases and payment entries)
      db.runSync(`
        DELETE FROM entries 
        WHERE customer_id IN (SELECT customer_id FROM customers WHERE deleted_at IS NOT NULL AND deleted_at < ?);
      `, [cutoffIso]);

      // 3. Delete customers
      db.runSync(`
        DELETE FROM customers 
        WHERE deleted_at IS NOT NULL AND deleted_at < ?;
      `, [cutoffIso]);
    }
  });

  return { purgedCount, customerIds: purgedIds };
}

export function getCustomerLedger(customerId) {
  const numericId = parseInt(customerId, 10);

  if (Platform.OS === 'web') {
    const state = getWebState();
    const custEntries = state.entries
      .filter((e) => e.customer_id === numericId)
      .sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date));

    return custEntries.map((entry) => {
      const meds = state.entry_medicines
        .filter((m) => m.entry_id === entry.entry_id)
        .map((m) => ({
          ...m,
          discount: parseFloat(m.discount) || 0,
        }));
      return {
        ...entry,
        subtotal: entry.subtotal != null ? entry.subtotal : entry.total_amount,
        discount_percent: entry.discount_percent || 0,
        discount_amount: entry.discount_amount || 0,
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
      COALESCE(subtotal, total_amount) AS subtotal,
      COALESCE(discount_percent, 0) AS discount_percent,
      COALESCE(discount_amount, 0) AS discount_amount,
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
    SELECT id, entry_id, medicine_name, price, COALESCE(discount, 0) AS discount 
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

export function addPurchaseEntry({
  customerId,
  medicines = [],
  subtotal = 0,
  discountPercent = 0,
  discountAmount = 0,
  totalAmount = 0,
  amountPaid = 0,
}) {
  const numericId = parseInt(customerId, 10);
  const now = getCurrentLocalIso();
  const parsedSubtotal = parseFloat(subtotal) || parseFloat(totalAmount) || 0;
  const parsedPercent = Math.max(0, parseFloat(discountPercent) || 0);
  const parsedDiscountAmount = Math.max(0, parseFloat(discountAmount) || 0);
  const parsedTotal = parseFloat(totalAmount) || Math.max(0, parsedSubtotal - parsedDiscountAmount);
  const parsedPaid = parseFloat(amountPaid) || 0;
  const dueAmount = calculateEntryDue(parsedTotal, parsedPaid);

  if (Platform.OS === 'web') {
    const state = getWebState();
    const entryId = state.nextEntryId++;
    state.entries.push({
      entry_id: entryId,
      customer_id: numericId,
      entry_date: now,
      subtotal: parsedSubtotal,
      discount_percent: parsedPercent,
      discount_amount: parsedDiscountAmount,
      total_amount: parsedTotal,
      amount_paid: parsedPaid,
      due_amount: dueAmount,
    });

    for (const med of medicines) {
      const cleaned = cleanMedicineName(med.name);
      if (cleaned && isValidMedicineName(cleaned)) {
        const medPrice = parseFloat(med.price) || 0;
        const medDiscount = Math.max(0, parseFloat(med.discount) || 0);
        state.entry_medicines.push({
          id: state.nextMedicineId++,
          entry_id: entryId,
          medicine_name: cleaned,
          price: medPrice,
          discount: medDiscount,
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
      INSERT INTO entries (customer_id, entry_date, subtotal, discount_percent, discount_amount, total_amount, amount_paid, due_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `, [numericId, now, parsedSubtotal, parsedPercent, parsedDiscountAmount, parsedTotal, parsedPaid, dueAmount]);

    insertedEntryId = res.lastInsertRowId;

    for (const med of medicines) {
      const cleaned = cleanMedicineName(med.name);
      if (cleaned && isValidMedicineName(cleaned)) {
        const medPrice = parseFloat(med.price) || 0;
        const medDiscount = Math.max(0, parseFloat(med.discount) || 0);
        db.runSync(`
          INSERT INTO entry_medicines (entry_id, medicine_name, price, discount)
          VALUES (?, ?, ?, ?);
        `, [insertedEntryId, cleaned, medPrice, medDiscount]);
      }
    }
  });

  return insertedEntryId;
}

export function addDuePayment({ customerId, amountPaid }) {
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
      subtotal: 0,
      discount_percent: 0,
      discount_amount: 0,
      total_amount: 0,
      amount_paid: parsedPaid,
      due_amount: dueAmount,
    });
    saveWebState(state);
    return entryId;
  }

  // Native expo-sqlite
  const db = getNativeDb();
  const res = db.runSync(`
    INSERT INTO entries (customer_id, entry_date, subtotal, discount_percent, discount_amount, total_amount, amount_paid, due_amount)
    VALUES (?, ?, 0, 0, 0, 0, ?, ?);
  `, [numericId, now, parsedPaid, dueAmount]);

  return res.lastInsertRowId;
}

export function getPastMedicineNames() {
  if (Platform.OS === 'web') {
    const state = getWebState();
    const names = Array.from(new Set(state.entry_medicines.map((m) => m.medicine_name)));
    return names.filter(isValidMedicineName).sort().slice(0, 100);
  }

  // Native expo-sqlite
  const db = getNativeDb();
  const rows = db.getAllSync(`
    SELECT DISTINCT medicine_name 
    FROM entry_medicines 
    WHERE LENGTH(TRIM(medicine_name)) >= 3
      AND LOWER(TRIM(medicine_name)) NOT IN ('it is', 'yu', 'test', 'testing', 'asdf', 'qwerty', 'temp', 'junk', 'sample', 'na', 'n/a', 'none', 'null', 'undefined', 'foo', 'bar', 'xx')
    ORDER BY medicine_name ASC 
    LIMIT 100;
  `);
  return rows.map((r) => r.medicine_name).filter(isValidMedicineName);
}

export function getShopProfile() {
  const defaultProfile = {
    id: 1,
    shop_name: '',
    shop_license_no: '',
    shop_license_validity: '',
    shop_phone: '',
    pharmacist_name: '',
    pharmacist_phone: '',
    pharmacist_license_validity: '',
  };

  if (Platform.OS === 'web') {
    const state = getWebState();
    return { ...defaultProfile, ...(state.shop_profile || {}) };
  }

  // Native expo-sqlite
  const db = getNativeDb();
  try {
    const row = db.getFirstSync(`SELECT * FROM shop_profile WHERE id = 1;`);
    return row ? { ...defaultProfile, ...row } : defaultProfile;
  } catch (e) {
    console.warn('Could not read shop_profile from SQLite:', e);
    return defaultProfile;
  }
}

export function saveShopProfile(profile = {}) {
  const sanitized = {
    shop_name: (profile.shop_name || '').trim(),
    shop_license_no: (profile.shop_license_no || '').trim(),
    shop_license_validity: (profile.shop_license_validity || '').trim(),
    shop_phone: (profile.shop_phone || '').trim(),
    pharmacist_name: (profile.pharmacist_name || '').trim(),
    pharmacist_phone: (profile.pharmacist_phone || '').trim(),
    pharmacist_license_validity: (profile.pharmacist_license_validity || '').trim(),
  };

  if (Platform.OS === 'web') {
    const state = getWebState();
    state.shop_profile = {
      id: 1,
      ...sanitized,
    };
    saveWebState(state);
    return state.shop_profile;
  }

  // Native expo-sqlite
  const db = getNativeDb();
  const now = getCurrentLocalIso();
  db.runSync(`
    INSERT INTO shop_profile (
      id,
      shop_name,
      shop_license_no,
      shop_license_validity,
      shop_phone,
      pharmacist_name,
      pharmacist_phone,
      pharmacist_license_validity,
      updated_at
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      shop_name = excluded.shop_name,
      shop_license_no = excluded.shop_license_no,
      shop_license_validity = excluded.shop_license_validity,
      shop_phone = excluded.shop_phone,
      pharmacist_name = excluded.pharmacist_name,
      pharmacist_phone = excluded.pharmacist_phone,
      pharmacist_license_validity = excluded.pharmacist_license_validity,
      updated_at = excluded.updated_at;
  `, [
    sanitized.shop_name,
    sanitized.shop_license_no,
    sanitized.shop_license_validity,
    sanitized.shop_phone,
    sanitized.pharmacist_name,
    sanitized.pharmacist_phone,
    sanitized.pharmacist_license_validity,
    now,
  ]);

  return getShopProfile();
}

export function exportAllData() {
  const shopProfile = getShopProfile();

  if (Platform.OS === 'web') {
    const state = getWebState();
    return {
      version: '1.0',
      exportedAt: getCurrentLocalIso(),
      customers: (state.customers || []).map((c) => ({
        ...c,
        deleted_at: c.deleted_at || null,
      })),
      entries: state.entries,
      entryMedicines: state.entry_medicines,
      shopProfile,
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
    shopProfile,
  };
}

export function importAllData(data) {
  if (!data || !Array.isArray(data.customers)) {
    throw new Error('Invalid backup file structure.');
  }

  // Ensure backward compatibility: if deleted_at is missing from an older backup, default to null
  const sanitizedCustomers = (data.customers || []).map((c) => ({
    customer_id: c.customer_id,
    phone_number: c.phone_number,
    name: c.name,
    village: c.village || null,
    address: c.address || null,
    created_at: c.created_at || getCurrentLocalIso(),
    deleted_at: c.deleted_at || null,
  }));

  if (Platform.OS === 'web') {
    const nextCustId = sanitizedCustomers.length > 0 ? Math.max(...sanitizedCustomers.map((c) => c.customer_id || 0)) + 1 : 1;
    const nextEntId = (data.entries || []).length > 0 ? Math.max(...(data.entries || []).map((e) => e.entry_id || 0)) + 1 : 1;
    const medsList = data.entryMedicines || data.entry_medicines || [];
    const nextMedId = medsList.length > 0 ? Math.max(...medsList.map((m) => m.id || 0)) + 1 : 1;

    const state = {
      customers: sanitizedCustomers,
      entries: (data.entries || []).map((e) => ({
        ...e,
        subtotal: e.subtotal != null ? e.subtotal : (e.total_amount || 0),
        discount_percent: e.discount_percent || 0,
        discount_amount: e.discount_amount || 0,
      })),
      entry_medicines: medsList,
      shop_profile: data.shopProfile || data.shop_profile || {},
      nextCustomerId: nextCustId,
      nextEntryId: nextEntId,
      nextMedicineId: nextMedId,
    };
    saveWebState(state);
    return true;
  }

  // Native expo-sqlite
  const db = getNativeDb();
  db.withTransactionSync(() => {
    db.runSync(`DELETE FROM entry_medicines;`);
    db.runSync(`DELETE FROM entries;`);
    db.runSync(`DELETE FROM customers;`);

    for (const c of sanitizedCustomers) {
      db.runSync(`
        INSERT INTO customers (customer_id, phone_number, name, village, address, created_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?);
      `, [c.customer_id, c.phone_number, c.name, c.village, c.address, c.created_at, c.deleted_at]);
    }

    for (const e of (data.entries || [])) {
      db.runSync(`
        INSERT INTO entries (entry_id, customer_id, entry_date, subtotal, discount_percent, discount_amount, total_amount, amount_paid, due_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        e.entry_id,
        e.customer_id,
        e.entry_date,
        e.subtotal != null ? e.subtotal : (e.total_amount || 0),
        e.discount_percent || 0,
        e.discount_amount || 0,
        e.total_amount || 0,
        e.amount_paid || 0,
        e.due_amount || 0,
      ]);
    }

    const meds = data.entryMedicines || data.entry_medicines || [];
    for (const m of meds) {
      db.runSync(`
        INSERT INTO entry_medicines (id, entry_id, medicine_name, price, discount)
        VALUES (?, ?, ?, ?, ?);
      `, [m.id, m.entry_id, m.medicine_name, m.price || 0, m.discount || 0]);
    }

    if (data.shopProfile || data.shop_profile) {
      saveShopProfile(data.shopProfile || data.shop_profile);
    }
  });

  return true;
}
