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
}

// ─────────────────────────────────────────────────────────────
// 2. WEB PERSISTENT DRIVER (Localhost browser fallback only)
// ─────────────────────────────────────────────────────────────
const WEB_STORAGE_KEY = 'medtrack_web_db_v1';

function getWebState() {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(WEB_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.shop_profile) {
        parsed.shop_profile = {
          id: 1,
          shop_name: '',
          shop_license_no: '',
          shop_license_validity: '',
          shop_phone: '',
          pharmacist_name: '',
          pharmacist_phone: '',
          pharmacist_license_validity: '',
        };
      }
      if (Array.isArray(parsed.entry_medicines)) {
        parsed.entry_medicines.forEach((m) => {
          if (m.discount === undefined) m.discount = 0;
        });
      }
      return parsed;
    }
  } catch (e) {
    console.warn('Could not read web localStorage:', e);
  }
  return {
    customers: [],
    entries: [],
    entry_medicines: [],
    shop_profile: {
      id: 1,
      shop_name: '',
      shop_license_no: '',
      shop_license_validity: '',
      shop_phone: '',
      pharmacist_name: '',
      pharmacist_phone: '',
      pharmacist_license_validity: '',
    },
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
            c.name.toLowerCase().includes(trimmed) ||
            c.phone_number.includes(trimmed)
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
    WHERE c.phone_number LIKE ? OR c.name LIKE ?
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
    WHERE c.customer_id = ?
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

export function deleteCustomer(customerId) {
  const numericId = parseInt(customerId, 10);
  if (!numericId) return false;

  if (Platform.OS === 'web') {
    const state = getWebState();
    // 1. Identify all entries belonging to this customer
    const customerEntries = state.entries.filter((e) => e.customer_id === numericId);
    const entryIds = new Set(customerEntries.map((e) => e.entry_id));

    // 2. Cascade delete related medicines
    state.entry_medicines = state.entry_medicines.filter((m) => !entryIds.has(m.entry_id));

    // 3. Cascade delete entries
    state.entries = state.entries.filter((e) => e.customer_id !== numericId);

    // 4. Delete the customer
    state.customers = state.customers.filter((c) => c.customer_id !== numericId);

    saveWebState(state);
    return true;
  }

  // Native expo-sqlite
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
      INSERT INTO entries (customer_id, entry_date, total_amount, amount_paid, due_amount)
      VALUES (?, ?, ?, ?, ?);
    `, [numericId, now, parsedTotal, parsedPaid, dueAmount]);

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
    INSERT INTO entries (customer_id, entry_date, total_amount, amount_paid, due_amount)
    VALUES (?, ?, 0, ?, ?);
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
      customers: state.customers,
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

