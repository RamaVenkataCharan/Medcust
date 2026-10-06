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
  console.log(`  Running Phase 2 Discount & Engine Tests`);
  console.log(`====================================================`);

  // 1. Verify all 3 engine copies are byte-for-byte identical
  console.log('\n━━━ 1. Engine Copies ━━━');
  const serverEngine = fs.readFileSync(path.join(__dirname, '..', 'services', 'discountEngine.js'), 'utf8');
  const clientEngine = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'src', 'utils', 'discountEngine.js'), 'utf8');
  const mobileEngine = fs.readFileSync(path.join(__dirname, '..', '..', 'mobile', 'src', 'utils', 'discountEngine.js'), 'utf8');
  
  assert(serverEngine === clientEngine, 'Server and Client discountEngine copies are identical');
  assert(serverEngine === mobileEngine, 'Server and Mobile discountEngine copies are identical');

  // Setup test DB
  const testDbPath = path.join(__dirname, '..', 'db', 'phase2_test_2.sqlite');
  try { if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath); } catch (e) {}
  
  const config = require('../config');
  config.DB_PATH = testDbPath;
  config.PORT = 4003;
  
  const { getDb, closeDb } = require('../db/database');
  const db = getDb();
  const custId = db.prepare(`INSERT INTO customers (phone_number, name, village, address) VALUES (?, ?, ?, ?)`).run('7777777777', 'Discount Test Cust', '', '').lastInsertRowid;
  
  // Set initial due to 100 via an old entry
  db.prepare(`INSERT INTO entries (customer_id, entry_date, total_amount, amount_paid, due_amount) VALUES (?, datetime('now'), 100, 0, 100)`).run(custId);
  
  console.log('\n━━━ 2. Worked Example through POST /api/entries ━━━');
  const app = require('express')();
  app.use(require('express').json());
  app.use('/api/entries', require('../routes/entries'));
  
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(config.PORT, resolve));
  
  const payload = {
    customer_id: custId,
    medicines: [
      { name: 'Med1', price: 100, discount: 10, discount_mode: 'amount' },
      { name: 'Med2', price: 200, discount: 5, discount_mode: 'percent' } // 200 * 5% = 10
    ],
    amount_paid: 50,
    total_amount: 280 // (100-10) + (200-10) = 280
  };
  
  const res = await fetch(`http://localhost:${config.PORT}/api/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const json = await res.json();
  assert(res.status === 201, `POST /api/entries returned 201 Created (got ${res.status})`);
  assert(json.entryId > 0, 'Entry created successfully');
  
  const savedEntry = db.prepare('SELECT total_amount, amount_paid, due_amount FROM entries WHERE entry_id = ?').get(json.entryId);
  assert(savedEntry.total_amount === 280, 'Total amount saved as 280');
  assert(savedEntry.amount_paid === 50, 'Amount paid saved as 50');
  assert(savedEntry.due_amount === 230, 'Due amount for this bill is 230'); // 280 - 50 = 230
  
  // Total due should now be 100 (old) + 230 (new) = 330
  const totalDueRes = require('../db/database').getCustomerDue(custId) / 100;
  assert(totalDueRes === 330, `Total combined customer due is exactly 330 (got ${totalDueRes})`);
  
  // Fetch via GET /api/entries/:id to ensure discount is populated
  const getRes = await fetch(`http://localhost:${config.PORT}/api/entries/${json.entryId}`);
  const getJson = await getRes.json();
  
  assert(getJson.medicines.length === 2, 'Fetched 2 medicines');
  assert(getJson.medicines[0].discount === 10, 'Medicine 1 has 10 discount saved');
  assert(getJson.medicines[1].discount === 10, 'Medicine 2 has 10 (5% of 200) discount saved');

  server.close();
  closeDb();

  console.log(`\n====================================================`);
  console.log(`  Tests Passed: ${passed}`);
  console.log(`  Tests Failed: ${failed}`);
  console.log(`====================================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
