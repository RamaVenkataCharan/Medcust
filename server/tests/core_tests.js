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
} = require('../db/database');

const db = getDb();

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

    // Test generateCsvExport
    const csvData = generateCsvExport();
    assert(typeof csvData === 'string' && csvData.length > 0, 'generateCsvExport generates non-empty string');
    assert(csvData.includes('=== CUSTOMERS & DUES LEDGER ==='), 'CSV contains customer ledger header');
    assert(csvData.includes('Rajesh Sharma'), 'CSV contains existing customer data');
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

