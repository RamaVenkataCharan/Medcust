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
  
  // Set initial due to 65 via an old entry
  db.prepare(`INSERT INTO entries (customer_id, entry_date, total_amount, amount_paid, due_amount) VALUES (?, datetime('now'), 65, 0, 65)`).run(custId);
  
  console.log('\n━━━ 2. Worked Example through POST /api/entries ━━━');
  const app = require('express')();
  app.use(require('express').json());
  app.use('/api/entries', require('../routes/entries'));
  
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(config.PORT, resolve));
  
  const payload = {
    customer_id: custId,
    medicines: [
      { name: 'Cifran', price: 75, discount: 10, discount_mode: 'percent' }, // 7.50 discount
      { name: 'Dolo', price: 15, discount: 0, discount_mode: 'amount' } // 0 discount
    ],
    amount_paid: 25,
    total_amount: 82.50 // (75 - 7.50) + 15 = 82.50
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
  assert(savedEntry.total_amount === 82.50, `Total amount saved as 82.50 (got ${savedEntry.total_amount})`);
  assert(savedEntry.amount_paid === 25, `Amount paid saved as 25 (got ${savedEntry.amount_paid})`);
  assert(savedEntry.due_amount === 57.50, `Due amount for this bill is 57.50 (got ${savedEntry.due_amount})`);
  
  // Total due should now be 65 (old) + 57.50 (new) = 122.50 rupees, which is 12250 paise
  const totalDuePaise = require('../db/database').getCustomerDue(custId);
  assert(totalDuePaise === 12250, `Total combined customer due is exactly 12250 paise (got ${totalDuePaise})`);
  
  // Fetch via GET /api/entries/:id to ensure discount is populated
  const getRes = await fetch(`http://localhost:${config.PORT}/api/entries/${json.entryId}`);
  const getJson = await getRes.json();
  
  assert(getJson.medicines.length === 2, 'Fetched 2 medicines');
  assert(getJson.medicines[0].discount === 7.50, `Medicine 1 (Cifran) has 7.50 discount saved (got ${getJson.medicines[0].discount})`);
  assert(getJson.medicines[1].discount === 0, `Medicine 2 (Dolo) has 0 discount saved (got ${getJson.medicines[1].discount})`);

  // Verify subtotal equals total_amount + discounts
  const subtotalPaise = getJson.medicines.reduce((sum, med) => sum + med.price * 100, 0);
  const totalDiscountPaise = getJson.medicines.reduce((sum, med) => sum + med.discount * 100, 0);
  const grandTotalPaise = getJson.total_amount * 100;
  
  assert(subtotalPaise === grandTotalPaise + totalDiscountPaise, `Subtotal (${subtotalPaise/100}) equals total_amount (${grandTotalPaise/100}) + discounts (${totalDiscountPaise/100})`);

  server.close();
  closeDb();

  console.log(`\n====================================================`);
  console.log(`  Tests Passed: ${passed}`);
  console.log(`  Tests Failed: ${failed}`);
  console.log(`====================================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
