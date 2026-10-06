const fs = require('fs');
const path = require('path');
const http = require('http');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.log(`  ❌ ${message}`);
  }
}

async function runTests() {
  console.log(`\n====================================================`);
  console.log(`  Running Extra Phase 1 Tests`);
  console.log(`====================================================`);

  // Setup test DB
  const testDbPath = path.join(__dirname, '..', 'db', 'extra_test.sqlite');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const config = require('../config');
  config.DB_PATH = testDbPath;
  config.PORT = 4001; // use alternative port
  
  // 1. Test precision 0.1 + 0.2
  console.log('\n━━━ 1. Precision 0.1 + 0.2 ━━━');
  const { getDb, getCustomerDue, addEntry, closeDb } = require('../db/database');
  const db = getDb();
  const insertStmt = db.prepare(`INSERT INTO customers (phone_number, name, village, address) VALUES (?, ?, ?, ?)`);
  const custId = insertStmt.run('8888888888', 'Precision Tester', '', '').lastInsertRowid;
  
  addEntry({ customerId: custId, totalAmount: 0.10, amountPaid: 0, medicines: [{ name: 'A', price: 0.10 }] });
  addEntry({ customerId: custId, totalAmount: 0.20, amountPaid: 0, medicines: [{ name: 'B', price: 0.20 }] });
  
  const duePaise = getCustomerDue(custId);
  assert(duePaise === 30, `0.1 + 0.2 due precision is exact in paise: ${duePaise}`);
  assert(duePaise / 100 === 0.30, '0.1 + 0.2 is exactly 0.30 rupees');

  // 2. Test restore rejecting non-SQLite file
  console.log('\n━━━ 2. Restore rejecting a non-SQLite file ━━━');
  const { restoreBackup } = require('../services/backupService');
  const fakeBackupPath = path.join(config.BACKUP_DIR, 'fake.sqlite');
  if (!fs.existsSync(config.BACKUP_DIR)) fs.mkdirSync(config.BACKUP_DIR, { recursive: true });
  fs.writeFileSync(fakeBackupPath, 'Not a database');
  
  const result = restoreBackup('fake.sqlite');
  assert(result.success === false, 'Restore returns success: false for non-SQLite files');
  assert(result.error && (result.error.includes('Backup file contains no valid tables') || result.error.includes('Corrupted backup file') || result.error.includes('file is not a database')), 'Restore safely rejects corrupted or non-SQLite files');

  // 3. Test migration run twice on a temp DB
  console.log('\n━━━ 3. Migration run twice ━━━');
  // insert some old dates
  db.prepare(`UPDATE customers SET created_at = '2025-01-01 10:10:10' WHERE customer_id = ?`).run(custId);
  db.prepare(`UPDATE entries SET entry_date = '2025-01-01 10:10:10' WHERE customer_id = ?`).run(custId);
  
  const { runMigrations } = require('../db/migrations');
  runMigrations(db);
  
  let hasOld = db.prepare(`SELECT 1 FROM customers WHERE created_at LIKE '____-__-__ __:__:__'`).get();
  assert(!hasOld, 'First migration converted old timestamps to ISO');
  
  let threwDouble = false;
  try {
    runMigrations(db);
  } catch(e) { threwDouble = true; }
  assert(!threwDouble, 'Second migration run is safe (idempotent)');

  // 4. Start Server to test API responses
  console.log('\n━━━ 4. API responses still in rupees ━━━');
  const app = require('express')();
  app.use(require('express').json());
  app.use('/api/customers', require('../routes/customers'));
  app.use('/api/entries', require('../routes/entries'));
  
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(config.PORT, resolve));
  
  // fetch customer profile
  const res = await fetch(`http://localhost:${config.PORT}/api/customers/${custId}`);
  const json = await res.json();
  assert(json.total_due === 0.30, `API response total_due is in rupees: ${json.total_due}`);
  
  // fetch search
  const resSearch = await fetch(`http://localhost:${config.PORT}/api/customers/search?q=8888`);
  const jsonSearch = await resSearch.json();
  assert(jsonSearch[0].total_due === 0.30, `API search total_due is in rupees: ${jsonSearch[0].total_due}`);
  
  server.close();
  closeDb();

  console.log(`\n====================================================`);
  console.log(`  Tests Passed: ${passed}`);
  console.log(`  Tests Failed: ${failed}`);
  console.log(`====================================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
