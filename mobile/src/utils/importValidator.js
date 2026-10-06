function validateBackupJson(fileString) {
  if (!fileString || typeof fileString !== 'string') {
    throw new Error("Invalid file content.");
  }

  let data;
  try {
    data = JSON.parse(fileString);
  } catch (e) {
    if (fileString.startsWith('SQLite format 3')) {
      throw new Error("This backup came from the server and can't be restored on the mobile app.");
    }
    throw new Error("File is not valid JSON.");
  }

  if (typeof data !== 'object' || data === null) {
    throw new Error("Invalid backup format.");
  }

  // Detect server JSON export markers
  if (data.payments || data.entry_medicine) {
    throw new Error("This backup came from the server and can't be restored on the mobile app.");
  }

  if (!data.customers || !Array.isArray(data.customers)) {
    throw new Error("Missing or invalid customers array.");
  }

  if (!data.entries || !Array.isArray(data.entries)) {
    throw new Error("Missing or invalid entries array.");
  }

  if (!data.entryMedicines || !Array.isArray(data.entryMedicines)) {
    throw new Error("Missing or invalid entryMedicines array.");
  }

  // Validate customers
  const phoneSet = new Set();
  const customerIdSet = new Set();
  for (const c of data.customers) {
    if (!c.customer_id) throw new Error("Customer missing customer_id.");
    if (!c.phone_number) throw new Error("Customer missing phone_number.");
    
    if (phoneSet.has(c.phone_number)) {
      throw new Error(`Duplicate phone number found: ${c.phone_number}`);
    }
    phoneSet.add(c.phone_number);
    customerIdSet.add(c.customer_id);
  }

  // Validate entries
  for (const e of data.entries) {
    if (!e.entry_id) throw new Error("Entry missing entry_id.");
    if (!e.customer_id) throw new Error("Entry missing customer_id.");
    if (!customerIdSet.has(e.customer_id)) {
      throw new Error(`Entry references missing customer_id: ${e.customer_id}`);
    }

    if (e.total_amount !== undefined && (typeof e.total_amount !== 'number' || !Number.isFinite(e.total_amount) || e.total_amount < 0)) {
      throw new Error(`Invalid total_amount on entry ${e.entry_id}`);
    }
    if (e.amount_paid !== undefined && (typeof e.amount_paid !== 'number' || !Number.isFinite(e.amount_paid) || e.amount_paid < 0)) {
      throw new Error(`Invalid amount_paid on entry ${e.entry_id}`);
    }
    if (e.due_amount !== undefined && (typeof e.due_amount !== 'number' || !Number.isFinite(e.due_amount))) {
      throw new Error(`Invalid due_amount on entry ${e.entry_id}`);
    }

    if (e.entry_date) {
      if (isNaN(Date.parse(e.entry_date))) {
        throw new Error(`Invalid entry_date on entry ${e.entry_id}`);
      }
    }
  }

  // Validate entryMedicines
  for (const m of data.entryMedicines) {
    if (!m.id) throw new Error("Medicine missing id.");
    if (!m.entry_id) throw new Error("Medicine missing entry_id.");
    if (!m.medicine_name) throw new Error("Medicine missing medicine_name.");
    
    if (m.price !== undefined && (typeof m.price !== 'number' || !Number.isFinite(m.price) || m.price < 0)) {
      throw new Error(`Invalid price on medicine ${m.id}`);
    }
    if (m.discount !== undefined && (typeof m.discount !== 'number' || !Number.isFinite(m.discount) || m.discount < 0)) {
      throw new Error(`Invalid discount on medicine ${m.id}`);
    }
  }

  return true;
}

function verifyImport(expected, actual) {
  // 1. Verify row counts
  if (expected.customers.length !== actual.customers.length) {
    throw new Error(`Customer count mismatch: expected ${expected.customers.length}, got ${actual.customers.length}`);
  }
  if (expected.entries.length !== actual.entries.length) {
    throw new Error(`Entry count mismatch: expected ${expected.entries.length}, got ${actual.entries.length}`);
  }
  if (expected.entryMedicines.length !== actual.entryMedicines.length) {
    throw new Error(`Medicine count mismatch: expected ${expected.entryMedicines.length}, got ${actual.entryMedicines.length}`);
  }

  // 2. Compare per-customer derived due
  // We use the same business logic for both expected and actual to prevent SQL SUM() float issues
  const { calculateCustomerTotalDue } = require('./khataLogic');
  
  const expectedDues = {};
  for (const c of expected.customers) {
    const custEntries = expected.entries.filter(e => e.customer_id === c.customer_id);
    expectedDues[c.customer_id] = calculateCustomerTotalDue(custEntries);
  }

  const actualDues = {};
  for (const c of actual.customers) {
    const custEntries = actual.entries.filter(e => e.customer_id === c.customer_id);
    actualDues[c.customer_id] = calculateCustomerTotalDue(custEntries);
  }

  for (const [customerId, expectedDue] of Object.entries(expectedDues)) {
    const actualDue = actualDues[customerId];
    if (Math.abs(expectedDue - actualDue) > 0.01) {
      throw new Error(`Customer ${customerId} due mismatch: expected ${expectedDue}, got ${actualDue}`);
    }
  }

  return true;
}

module.exports = { validateBackupJson, verifyImport };
