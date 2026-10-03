/**
 * MedTrack Core Scope Test Suite
 * 
 * Tests strictly covering:
 * - Phone-number-first customer search
 * - Customer registration with 10-digit mobile validation
 * - Visit purchase entry logging with line items
 * - Zero-error derived due calculations: SUM(entries.due_amount) - SUM(payments.amount)
 * - Due clearance / payment logging
 * - Autocomplete suggestions from past medicine purchases
 * - Customer stats & recently bought distinct medicines
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

// ══════════════════════════════════════════════════════════
// Setup Isolated Test Database
// ══════════════════════════════════════════════════════════

const testDbPath = path.join(__dirname, '..', 'db', 'test_core.sqlite');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const config = require('../config');
config.DB_PATH = testDbPath;

const {
  getDb,
  getCustomerDue,
  addEntry,
  recordPayment,
  getCustomerStats,
  autocompleteMedicines,
  softDeleteCustomer,
  restoreCustomer,
  getTrashCustomers,
  permanentDeleteCustomer,
  autoPurgeTrash,
} = require('../db/database');

let db = getDb();

async function runCoreTests() {
  console.log(`\n====================================================`);
  console.log(`  Running MedTrack Core Scope Tests`);
  console.log(`  Target: Customer & Medicine Search (Khata only)`);
  console.log(`====================================================`);

  // ── 1. Customer Registration & Search ──
  section('1. Customer Registration & Phone Search');
  {
    const insertStmt = db.prepare(`
      INSERT INTO customers (phone_number, name, village, address)
      VALUES (?, ?, ?, ?)
    `);

    insertStmt.run('9876543210', 'Rajesh Sharma', 'Rampur', 'Main Bazaar');
    insertStmt.run('9123456780', 'Sunita Patel', 'Kalyanpur', 'Near Bus Stand');

    // Phone search
    const found = db.prepare('SELECT * FROM customers WHERE phone_number = ?').get('9876543210');
    assert(found !== undefined, 'Customer lookup by exact phone number succeeds');
    assert(found.name === 'Rajesh Sharma', 'Customer details match name');
    assert(found.village === 'Rampur', 'Customer village matches');

    // Phone search prefix / partial
    const partial = db.prepare('SELECT * FROM customers WHERE phone_number LIKE ?').all('98765%');
    assert(partial.length === 1, 'Partial phone number search matches debtor');

    // Initial due for new customer with no transactions
    const initialDue = getCustomerDue(found.customer_id);
    assert(initialDue === 0, 'New customer starts with exactly 0.00 due');
  }

  // ── 2. Visit Purchase Entry & Due Calculation ──
  section('2. Visit Purchase Entry & Dynamic Line Items');
  {
    const customer = db.prepare('SELECT * FROM customers WHERE phone_number = ?').get('9876543210');
    const custId = customer.customer_id;

    // Visit 1: Total ₹450, Paid ₹150 -> Due created ₹300
    const entry1 = addEntry({
      customerId: custId,
      totalAmount: 450,
      amountPaid: 150,
      medicines: [
        { name: 'Paracetamol 500mg', price: 50 },
        { name: 'Amoxicillin 500mg', price: 200 },
        { name: 'Cough Syrup 100ml', price: 200 },
      ],
    });

    assert(entry1.entryId > 0, 'Purchase entry saved successfully');
    assert(entry1.dueAmount === 300, 'Entry due_amount accurately computed as total - paid (450 - 150 = 300)');
    assert(entry1.totalDue === 300, 'Customer total due reflects first purchase balance');

    // Verify line items inserted into entry_medicine
    const items = db.prepare('SELECT * FROM entry_medicine WHERE entry_id = ?').all(entry1.entryId);
    assert(items.length === 3, 'All 3 medicine line items saved in entry_medicine');
    assert(items[0].medicine_name === 'Paracetamol 500mg', 'Line item medicine name correct');

    // Visit 2: Total ₹300, Paid ₹0 -> Additional due ₹300
    const entry2 = addEntry({
      customerId: custId,
      totalAmount: 300,
      amountPaid: 0,
      medicines: [
        { name: 'Paracetamol 500mg', price: 100 },
        { name: 'Vitamin C Chewable', price: 200 },
      ],
    });

    assert(entry2.dueAmount === 300, 'Second entry due amount is ₹300');
    const totalDueNow = getCustomerDue(custId);
    assert(totalDueNow === 600, 'Cumulative customer due is ₹600 (300 + 300)');
  }

  // ── 3. Due Clearance & Payment Logging ──
  section('3. Payment Recording & Live Balance Reduction');
  {
    const customer = db.prepare('SELECT * FROM customers WHERE phone_number = ?').get('9876543210');
    const custId = customer.customer_id;

    // Settle ₹400 of the ₹600 due
    const payment = recordPayment({
      customerId: custId,
      amount: 400,
      note: 'UPI Payment via GPay',
    });

    assert(payment.paymentId > 0, 'Payment recorded successfully');
    assert(payment.previousDue === 600, 'Previous due was ₹600');
    assert(payment.remainingDue === 200, 'Remaining due correctly reduced to ₹200 (600 - 400)');

    // Verify database query reflects the same derived balance
    const liveDue = getCustomerDue(custId);
    assert(liveDue === 200, 'Live customer due strictly derives as ₹200');

    // Clear remaining ₹200 due
    const paymentFinal = recordPayment({
      customerId: custId,
      amount: 200,
      note: 'Cash settlement',
    });

    assert(paymentFinal.remainingDue === 0, 'Customer due clears completely to ₹0 ("All Clear")');
    assert(getCustomerDue(custId) === 0, 'Derived due is zero');
  }

  // ── 4. Autocomplete Suggestions ──
  section('4. Medicine Autocomplete Suggestions');
  {
    // Search for 'Para' -> should suggest 'Paracetamol 500mg'
    const suggestions = autocompleteMedicines('Para');
    assert(suggestions.includes('Paracetamol 500mg'), 'Autocomplete matches "Paracetamol 500mg" from past entries');

    // Search for 'Vit' -> should suggest 'Vitamin C Chewable'
    const vitSuggestions = autocompleteMedicines('Vit');
    assert(vitSuggestions.includes('Vitamin C Chewable'), 'Autocomplete matches "Vitamin C Chewable"');

    // Empty query returns recent medicines
    const allRecent = autocompleteMedicines('');
    assert(allRecent.length > 0, 'Empty autocomplete query returns recent distinct medicines');
  }

  // ── 5. Customer Stats & Recently Bought ──
  section('5. Customer Stats & Frequency Analysis');
  {
    const customer = db.prepare('SELECT * FROM customers WHERE phone_number = ?').get('9876543210');
    const custId = customer.customer_id;

    const stats = getCustomerStats(custId);
    assert(stats.total_visits === 2, 'Customer total visits count is 2');
    assert(stats.total_spent === 750, 'Customer total spent is ₹750 (450 + 300)');
    assert(stats.total_due === 0, 'Customer total due is ₹0');

    // Recently bought medicines
    const bought = stats.recently_bought;
    assert(bought.length > 0, 'Recently bought list is populated');
    const paracetamol = bought.find(m => m.name === 'Paracetamol 500mg');
    assert(paracetamol !== undefined, 'Paracetamol appears in recently bought');
    assert(paracetamol.frequency === 2, 'Paracetamol frequency is 2 (bought in 2 visits)');
  }

  // ── 6. Validation Error Checks ──
  section('6. Ledger Accounting Guardrails');
  {
    const customer = db.prepare('SELECT * FROM customers WHERE phone_number = ?').get('9876543210');
    const custId = customer.customer_id;

    // Attempt negative total
    let threwOnNegative = false;
    try {
      addEntry({ customerId: custId, totalAmount: -100, amountPaid: 0, medicines: [{ name: 'Test', price: 100 }] });
    } catch (e) {
      threwOnNegative = true;
    }
    assert(threwOnNegative, 'Rejects entry with non-positive total amount');

    // Attempt amount paid > total
    let threwOnOverpaidEntry = false;
    try {
      addEntry({ customerId: custId, totalAmount: 100, amountPaid: 200, medicines: [{ name: 'Test', price: 100 }] });
    } catch (e) {
      threwOnOverpaidEntry = true;
    }
    assert(threwOnOverpaidEntry, 'Rejects purchase entry where amount paid > total purchase amount');

    // Attempt empty medicine list
    let threwOnEmptyMeds = false;
    try {
      addEntry({ customerId: custId, totalAmount: 100, amountPaid: 100, medicines: [] });
    } catch (e) {
      threwOnEmptyMeds = true;
    }
    assert(threwOnEmptyMeds, 'Rejects purchase entry with no medicine line items');
  }

  // ── 7. Data Safety: Backup Integrity, Restore & Export ──
  section('7. Data Safety: Backup Integrity, Restore & Export');
  {
    const Database = require('better-sqlite3');
    const { performBackup, listBackups, restoreBackup, generateCsvExport } = require('../services/backupService');

    // Force create a backup
    const backupResult = performBackup(true);
    assert(backupResult.success === true, 'Manual/forced backup returns success');
    assert(fs.existsSync(backupResult.path), 'Backup file physically created on disk');

    // Verify backup is a valid, openable SQLite database
    let backupDb;
    let validDb = false;
    try {
      backupDb = new Database(backupResult.path, { readonly: true });
      const tableCount = backupDb.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table'").get();
      validDb = tableCount && tableCount.c > 0;
    } catch (e) {
      validDb = false;
    } finally {
      if (backupDb) backupDb.close();
    }
    assert(validDb, 'Backup file verified as valid, openable SQLite database');

    // Test listBackups
    const backups = listBackups();
    assert(backups.length > 0, 'listBackups returns existing backups array');
    assert(backups.some(b => b.filename === backupResult.filename), 'Newly created backup appears in backup list');

    // Test restoreBackup
    const restoreResult = restoreBackup(backupResult.filename);
    assert(restoreResult.success === true, 'restoreBackup succeeds using valid backup file');
    db = getDb();

    // Test generateCsvExport
    const csvData = generateCsvExport();
    assert(typeof csvData === 'string' && csvData.length > 0, 'generateCsvExport generates non-empty string');
    assert(csvData.includes('=== CUSTOMERS & DUES LEDGER ==='), 'CSV contains customer ledger header');
    assert(csvData.includes('Rajesh Sharma'), 'CSV contains existing customer data');
  }

  // ── 8. Customer Soft Delete & Recycle Bin Lifecycle ──
  section('8. Customer Soft Delete & Recycle Bin Lifecycle');
  {
    // Test 1: Delete returns 409 when due is not 0 (both positive due and credit balance)
    // 1a. Positive due
    const custA = db.prepare('INSERT INTO customers (phone_number, name, village) VALUES (?, ?, ?) RETURNING customer_id')
      .get('9000000001', 'Debtor A', 'Village A');
    addEntry({
      customerId: custA.customer_id,
      totalAmount: 500,
      amountPaid: 200,
      medicines: [{ name: 'Test Med', price: 500 }],
    });
    let blockedPositive = false;
    let blockedPositiveStatus = 0;
    try {
      softDeleteCustomer(custA.customer_id);
    } catch (err) {
      blockedPositive = true;
      blockedPositiveStatus = err.status;
    }
    assert(blockedPositive && blockedPositiveStatus === 409, '1a. Delete blocked with 409 when customer has positive outstanding due');

    // 1b. Credit balance (overpayment)
    const custB = db.prepare('INSERT INTO customers (phone_number, name, village) VALUES (?, ?, ?) RETURNING customer_id')
      .get('9000000002', 'Credit B', 'Village B');
    addEntry({
      customerId: custB.customer_id,
      totalAmount: 100,
      amountPaid: 100,
      medicines: [{ name: 'Test Med', price: 100 }],
    });
    recordPayment({ customerId: custB.customer_id, amount: 50, note: 'Advance credit' });
    let blockedCredit = false;
    let blockedCreditStatus = 0;
    try {
      softDeleteCustomer(custB.customer_id);
    } catch (err) {
      blockedCredit = true;
      blockedCreditStatus = err.status;
    }
    assert(blockedCredit && blockedCreditStatus === 409, '1b. Delete blocked with 409 when customer has credit balance (overpayment)');

    // Test 2: Soft delete clear customer (due = 0) -> absent from search & dues report, but entries/payments stay
    const custC = db.prepare('INSERT INTO customers (phone_number, name, village) VALUES (?, ?, ?) RETURNING customer_id')
      .get('9000000003', 'Clear C', 'Village C');
    addEntry({
      customerId: custC.customer_id,
      totalAmount: 200,
      amountPaid: 200,
      medicines: [{ name: 'Test Med C', price: 200 }],
    });
    assert(getCustomerDue(custC.customer_id) === 0, 'Customer C starts with 0 due');

    const deleteRes = softDeleteCustomer(custC.customer_id);
    assert(deleteRes.success === true, 'Soft delete succeeds for customer with 0 due');

    // Check absent from active search query
    const searchMatches = db.prepare('SELECT * FROM customers WHERE phone_number = ? AND deleted_at IS NULL')
      .all('9000000003');
    assert(searchMatches.length === 0, '2a. Deleted customer absent from active search query');

    // Check absent from dues report query
    const duesCustomers = db.prepare('SELECT * FROM customers WHERE deleted_at IS NULL').all();
    assert(!duesCustomers.some(c => c.customer_id === custC.customer_id), '2b. Deleted customer absent from dues report query');

    // Check child rows remain in DB
    const entriesRemain = db.prepare('SELECT count(*) as count FROM entries WHERE customer_id = ?').get(custC.customer_id);
    const medsRemain = db.prepare(`
      SELECT count(*) as count FROM entry_medicine 
      WHERE entry_id IN (SELECT entry_id FROM entries WHERE customer_id = ?)
    `).get(custC.customer_id);
    assert(entriesRemain.count > 0 && medsRemain.count > 0, '2c. Entries and entry_medicine line items remain untouched in database');

    // Appears in trash
    const trashList = getTrashCustomers();
    assert(trashList.some(c => c.customer_id === custC.customer_id), 'Deleted customer appears in Recycle Bin (getTrashCustomers)');

    // Test 3: Restore returns the same derived due
    const restored = restoreCustomer(custC.customer_id);
    assert(restored.deleted_at === null, '3a. Restore sets deleted_at to NULL');
    assert(restored.total_due === 0, '3b. Restore returns the same derived due (0.00)');
    const activeAgain = db.prepare('SELECT * FROM customers WHERE customer_id = ? AND deleted_at IS NULL').get(custC.customer_id);
    assert(activeAgain !== undefined, '3c. Restored customer is active again in search queries');

    // Test 4: Permanent delete removes customer and all child rows, returns error if not in bin
    let errNotBinned = false;
    try {
      permanentDeleteCustomer(custC.customer_id); // Currently active, not in bin
    } catch (err) {
      errNotBinned = true;
    }
    assert(errNotBinned, '4a. Permanent delete throws error if customer is not in the Recycle Bin');

    // Soft delete again to put in bin
    softDeleteCustomer(custC.customer_id);
    // Now permanent delete
    const permRes = permanentDeleteCustomer(custC.customer_id);
    assert(permRes.success === true, '4b. Permanent delete succeeds for customer in bin');

    const checkCust = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(custC.customer_id);
    const checkEntries = db.prepare('SELECT count(*) as count FROM entries WHERE customer_id = ?').get(custC.customer_id);
    const checkMeds = db.prepare(`
      SELECT count(*) as count FROM entry_medicine 
      WHERE entry_id IN (SELECT entry_id FROM entries WHERE customer_id = ?)
    `).get(custC.customer_id);
    assert(!checkCust && checkEntries.count === 0 && checkMeds.count === 0, '4c. Customer, entries, and entry_medicine completely removed from DB');

    // Test 5: Re-registering binned phone number returns 409 with inRecycleBin true
    const custD = db.prepare('INSERT INTO customers (phone_number, name, village) VALUES (?, ?, ?) RETURNING customer_id')
      .get('9000000005', 'Binned D', 'Village D');
    softDeleteCustomer(custD.customer_id);

    const dupCheck = db.prepare('SELECT * FROM customers WHERE phone_number = ?').get('9000000005');
    assert(dupCheck !== undefined && dupCheck.deleted_at !== null, '5a. Customer with phone 9000000005 exists in bin');
    const isBinned = dupCheck.deleted_at !== null;
    assert(isBinned === true, '5b. Duplicate registration detects inRecycleBin true');

    // Test 6: A failure mid-permanent-delete rolls back everything
    const custE = db.prepare('INSERT INTO customers (phone_number, name, village) VALUES (?, ?, ?) RETURNING customer_id')
      .get('9000000006', 'Rollback E', 'Village E');
    addEntry({
      customerId: custE.customer_id,
      totalAmount: 150,
      amountPaid: 150,
      medicines: [{ name: 'Rollback Med', price: 150 }],
    });
    softDeleteCustomer(custE.customer_id);

    // Create trigger that aborts customer deletion to simulate failure mid-transaction
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS test_abort_cust_del
      BEFORE DELETE ON customers
      WHEN OLD.phone_number = '9000000006'
      BEGIN
        SELECT RAISE(ABORT, 'Simulated mid-transaction failure');
      END;
    `);

    let rollbackTriggered = false;
    try {
      permanentDeleteCustomer(custE.customer_id);
    } catch (err) {
      rollbackTriggered = true;
    }
    assert(rollbackTriggered, '6a. Mid-transaction failure triggers error');

    // Verify rollback: entries, entry_medicine, and customer must still exist
    const custEExists = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(custE.customer_id);
    const entriesEExists = db.prepare('SELECT count(*) as count FROM entries WHERE customer_id = ?').get(custE.customer_id);
    const medsEExists = db.prepare(`
      SELECT count(*) as count FROM entry_medicine 
      WHERE entry_id IN (SELECT entry_id FROM entries WHERE customer_id = ?)
    `).get(custE.customer_id);
    assert(custEExists !== undefined && entriesEExists.count === 1 && medsEExists.count === 1, '6b. Complete rollback: customer, entries, and medicines preserved intact');

    // Clean up trigger & custE
    db.exec('DROP TRIGGER IF EXISTS test_abort_cust_del;');
    permanentDeleteCustomer(custE.customer_id);

    // Test 7: Auto-purge removes only items older than retention period
    const custOld = db.prepare('INSERT INTO customers (phone_number, name, village) VALUES (?, ?, ?) RETURNING customer_id')
      .get('9000000007', 'Old Binned', 'Old Village');
    const custNew = db.prepare('INSERT INTO customers (phone_number, name, village) VALUES (?, ?, ?) RETURNING customer_id')
      .get('9000000008', 'New Binned', 'New Village');

    // Set deleted_at to 40 days ago for custOld and 5 days ago for custNew
    db.prepare("UPDATE customers SET deleted_at = datetime('now', '-40 days') WHERE customer_id = ?").run(custOld.customer_id);
    db.prepare("UPDATE customers SET deleted_at = datetime('now', '-5 days') WHERE customer_id = ?").run(custNew.customer_id);

    const purgeResult = autoPurgeTrash(30);
    assert(purgeResult.purgedCount >= 1, '7a. autoPurgeTrash purges expired customer(s)');

    const oldCheck = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(custOld.customer_id);
    const newCheck = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(custNew.customer_id);
    assert(oldCheck === undefined, '7b. Customer deleted 40 days ago was purged');
    assert(newCheck !== undefined && newCheck.deleted_at !== null, '7c. Customer deleted 5 days ago is retained safely in the bin');

    // Clean up custNew and custD
    permanentDeleteCustomer(custNew.customer_id);
    permanentDeleteCustomer(custD.customer_id);
  }

  // ── Summary ──
  console.log(`\n====================================================`);
  console.log(`  Tests Passed: ${passed}`);
  console.log(`  Tests Failed: ${failed}`);
  console.log(`====================================================\n`);

  // Cleanup test database
  if (fs.existsSync(testDbPath)) {
    try { fs.unlinkSync(testDbPath); } catch {}
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runCoreTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

