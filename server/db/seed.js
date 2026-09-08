const { getDb } = require('./database');
const fs = require('fs');
const path = require('path');

function seedKhataDatabase() {
  const db = getDb();
  console.log('Seeding MedTrack Khata Ledger database...');

  // Reset tables
  db.pragma('foreign_keys = OFF');
  db.exec(`
    DROP TABLE IF EXISTS entry_medicine;
    DROP TABLE IF EXISTS entries;
    DROP TABLE IF EXISTS payments;
    DROP TABLE IF EXISTS customers;
    DROP TABLE IF EXISTS transaction_items;
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS stock_logs;
    DROP TABLE IF EXISTS medicines;
  `);
  db.pragma('foreign_keys = ON');

  // Run schema
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schemaSql);

  const tx = db.transaction(() => {
    // 1. Insert Customers
    const insertCustomer = db.prepare(`
      INSERT INTO customers (phone_number, name, village, address, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now', ?), datetime('now', ?))
    `);

    const customers = [
      ['9848012345', 'Ramesh Kumar', 'Rampur', 'H.No 3-45, Near Temple', '-30 days', '-2 days'],
      ['9848023456', 'Lakshmi Narayana', 'Shampur', 'Plot 12, Main Bazaar', '-45 days', '-5 days'],
      ['9848034567', 'Suresh Babu', 'Kothapally', 'Opp. Gram Panchayat', '-60 days', '-10 days'],
      ['9848045678', 'Anitha Reddy', 'Rampur', 'H.No 1-102, School Road', '-20 days', '-3 days'],
      ['9848056789', 'Venkatesh Goud', 'Nizampet', 'MIG-245, Phase 2', '-50 days', '-7 days'],
      ['9848067890', 'Mohammed Ali', 'Bolarum', 'Shop #4, Station Road', '-15 days', '0 days'],
      ['9848078901', 'Padma Shri', 'Kothapally', 'Near Water Tank', '-35 days', '-1 day'],
      ['9848089012', 'Govind Raju', 'Rampur', 'Old Village Well', '-70 days', '-15 days'],
    ];

    const customerIds = [];
    for (const c of customers) {
      const res = insertCustomer.run(c[0], c[1], c[2], c[3], c[4], c[5]);
      customerIds.push(res.lastInsertRowid);
    }

    // 2. Insert Entries & Medicines
    const insertEntry = db.prepare(`
      INSERT INTO entries (customer_id, entry_date, total_amount, amount_paid, due_amount)
      VALUES (?, datetime('now', ?), ?, ?, ?)
    `);

    const insertMed = db.prepare(`
      INSERT INTO entry_medicine (entry_id, medicine_name, price)
      VALUES (?, ?, ?)
    `);

    // Ramesh Kumar: Due 350
    // Entry 1: 15 days ago, Total 450, Paid 450, Due 0
    let e1 = insertEntry.run(customerIds[0], '-15 days', 450.00, 450.00, 0.00);
    insertMed.run(e1.lastInsertRowid, 'Dolo 650mg Tablet', 32.50);
    insertMed.run(e1.lastInsertRowid, 'Amoxicillin 500mg (Novamox)', 120.00);
    insertMed.run(e1.lastInsertRowid, 'Pantoprazole 40mg (Pan-40)', 95.00);
    insertMed.run(e1.lastInsertRowid, 'Ascoril D+ Cough Syrup', 110.00);
    insertMed.run(e1.lastInsertRowid, 'Limcee Vitamin C Chewable', 92.50);

    // Entry 2: 2 days ago, Total 650, Paid 300, Due 350
    let e2 = insertEntry.run(customerIds[0], '-2 days', 650.00, 300.00, 350.00);
    insertMed.run(e2.lastInsertRowid, 'Dolo 650mg Tablet', 65.00);
    insertMed.run(e2.lastInsertRowid, 'Clavam 625mg Tablet', 410.00);
    insertMed.run(e2.lastInsertRowid, 'Montair LC 10mg', 175.00);

    // Lakshmi Narayana: Due 1,200
    // Entry: 5 days ago, Total 1700, Paid 500, Due 1200
    let e3 = insertEntry.run(customerIds[1], '-5 days', 1700.00, 500.00, 1200.00);
    insertMed.run(e3.lastInsertRowid, 'Telmisartan 40mg (Telma 40)', 345.00);
    insertMed.run(e3.lastInsertRowid, 'Atorvastatin 10mg (Atorva)', 560.00);
    insertMed.run(e3.lastInsertRowid, 'Metformin 500mg (Glycomet)', 420.00);
    insertMed.run(e3.lastInsertRowid, 'Thyronorm 50mcg', 320.00);
    insertMed.run(e3.lastInsertRowid, 'Dolo 650mg Tablet', 55.00);

    // Suresh Babu: Due 450
    let e4 = insertEntry.run(customerIds[2], '-10 days', 950.00, 500.00, 450.00);
    insertMed.run(e4.lastInsertRowid, 'Volini Pain Relief Gel', 196.00);
    insertMed.run(e4.lastInsertRowid, 'Combiflam Tablet', 180.00);
    insertMed.run(e4.lastInsertRowid, 'Azithromycin 500mg (Azee)', 375.00);
    insertMed.run(e4.lastInsertRowid, 'Pan-40 Tablet', 199.00);

    // Anitha Reddy: Due 0 (Fully paid)
    let e5 = insertEntry.run(customerIds[3], '-3 days', 280.00, 280.00, 0.00);
    insertMed.run(e5.lastInsertRowid, 'Cetirizine 10mg', 48.00);
    insertMed.run(e5.lastInsertRowid, 'Ascoril D+ Cough Syrup', 110.00);
    insertMed.run(e5.lastInsertRowid, 'Electral ORS Sachet', 88.00);
    insertMed.run(e5.lastInsertRowid, 'Limcee 500mg', 34.00);

    // Venkatesh Goud: Due 420 (Created 820, Paid 400 later)
    let e6 = insertEntry.run(customerIds[4], '-18 days', 820.00, 0.00, 820.00);
    insertMed.run(e6.lastInsertRowid, 'Metformin 500mg', 420.00);
    insertMed.run(e6.lastInsertRowid, 'Telma 40mg', 230.00);
    insertMed.run(e6.lastInsertRowid, 'Atorva 10mg', 170.00);

    // Mohammed Ali: Today's visit, fully paid
    let e7 = insertEntry.run(customerIds[5], '0 hours', 340.00, 340.00, 0.00);
    insertMed.run(e7.lastInsertRowid, 'Dolo 650mg Tablet', 130.00);
    insertMed.run(e7.lastInsertRowid, 'Ascoril D+ Cough Syrup', 110.00);
    insertMed.run(e7.lastInsertRowid, 'ORS Sachet', 44.00);
    insertMed.run(e7.lastInsertRowid, 'Becosules Capsules', 56.00);

    // Padma Shri: Due 380
    let e8 = insertEntry.run(customerIds[6], '-1 day', 580.00, 200.00, 380.00);
    insertMed.run(e8.lastInsertRowid, 'Clavam 625mg Tablet', 410.00);
    insertMed.run(e8.lastInsertRowid, 'Omeprazole 20mg (Omez)', 128.00);
    insertMed.run(e8.lastInsertRowid, 'Cetirizine 10mg', 42.00);

    // 3. Insert Payments
    const insertPayment = db.prepare(`
      INSERT INTO payments (customer_id, pay_date, amount, note)
      VALUES (?, datetime('now', ?), ?, ?)
    `);

    // Venkatesh Goud paid 400 towards his 820 due
    insertPayment.run(customerIds[4], '-7 days', 400.00, 'Cash paid at counter towards due');

    // Govind Raju had a past clearance
    insertPayment.run(customerIds[7], '-15 days', 650.00, 'UPI / GPay payment');

    console.log('Khata Ledger seed completed successfully!');
  });

  tx();
}

seedKhataDatabase();
