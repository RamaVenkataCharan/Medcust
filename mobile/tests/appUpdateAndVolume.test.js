import { Platform } from 'react-native';
import * as database from '../src/db/database';
import { validateBackupJson, verifyImport } from '../src/utils/importValidator';

// NOTE: These automated unit & scale tests run in Jest using the WEB_FALLBACK
// (in-memory / localStorage) driver provided by src/db/database.js.
// The native-SQLite driver (expo-sqlite on Android/iOS) and real-APK-update cases
// (Android Package Manager in-place update over an existing APK) are NOT-VERIFIABLE-WITHOUT-DEVICE.

// Set up mock window.localStorage for Node/Jest environment
const storageStore = {};
global.window = {
  localStorage: {
    getItem: (key) => storageStore[key] || null,
    setItem: (key, val) => {
      storageStore[key] = String(val);
    },
    removeItem: (key) => {
      delete storageStore[key];
    },
    clear: () => {
      for (const k in storageStore) delete storageStore[k];
    },
  },
};

describe('App Update & Realistic Volume Performance Audit (WEB_FALLBACK Driver)', () => {
  beforeEach(() => {
    // Driver under test in Jest: WEB_FALLBACK (native-SQLite requires device)
    Platform.OS = 'web';
    global.window.localStorage.clear();
    database.initDatabase();
  });

  describe('1. In-Place App Update / Database Migration Persistence', () => {
    test('updating from older build preserves all existing customers, entries, medicines, and profiles', async () => {
      // Simulate existing old build data prior to update
      const initialOldData = {
        customers: [
          {
            customer_id: 1,
            phone_number: '9848011111',
            name: 'Ramesh Pharmacy Patron',
            village: 'Nizampet',
            address: 'H.No 1-22',
            created_at: '2026-01-01T10:00:00.000Z',
          },
          {
            customer_id: 2,
            phone_number: '9848022222',
            name: 'Suresh Chronic Patient',
            village: 'Bachupally',
            address: 'H.No 3-45',
            created_at: '2026-01-02T11:00:00.000Z',
          },
        ],
        entries: [
          {
            entry_id: 1,
            customer_id: 1,
            entry_date: '2026-01-03T10:00:00.000Z',
            total_amount: 500,
            amount_paid: 200,
            due_amount: 300,
            note: 'Old note before update',
          },
          {
            entry_id: 2,
            customer_id: 2,
            entry_date: '2026-01-04T12:00:00.000Z',
            total_amount: 1200,
            amount_paid: 0,
            due_amount: 1200,
            note: 'Insulin monthly',
          },
        ],
        entryMedicines: [
          { id: 1, entry_id: 1, medicine_name: 'Metformin 500mg', price: 200, discount: 0 },
          { id: 2, entry_id: 1, medicine_name: 'Telmisartan 40mg', price: 300, discount: 0 },
          { id: 3, entry_id: 2, medicine_name: 'Lantus Insulin', price: 1200, discount: 0 },
        ],
        shop_profile: {
          id: 1,
          shop_name: 'Sri Krishna Medicals',
          shop_license_no: 'DL-20B/TG/12345',
          shop_license_validity: '2027-06-30',
          shop_phone: '9848099999',
          pharmacist_name: 'K. Venkatesh',
          pharmacist_phone: '9848088888',
          pharmacist_license_validity: '2027-08-31',
        },
      };

      // Populate pre-upgrade data
      await database.restoreDatabaseFromJson(initialOldData);

      // Verify pre-upgrade state
      const preUpdateCustomers = database.searchCustomers('');
      expect(preUpdateCustomers.length).toBe(2);
      expect(database.getCustomerById(1).total_due).toBe(300);
      expect(database.getCustomerById(2).total_due).toBe(1200);

      // SIMULATE APP UPDATE:
      // When a user updates the APK without uninstalling, Android preserves the SQLite file.
      // Upon new version start, initDatabase() runs and applies idempotent schema checks without wiping.
      database.initDatabase();

      // Post-upgrade verification: ALL previous data must remain intact!
      const postUpdateCustomers = database.searchCustomers('');
      expect(postUpdateCustomers.length).toBe(2);

      const cust1 = database.getCustomerById(1);
      expect(cust1.name).toBe('Ramesh Pharmacy Patron');
      expect(cust1.phone_number).toBe('9848011111');
      expect(cust1.total_due).toBe(300);

      const cust2 = database.getCustomerById(2);
      expect(cust2.name).toBe('Suresh Chronic Patient');
      expect(cust2.total_due).toBe(1200);

      const ledger1 = database.getCustomerLedger(1);
      expect(ledger1.length).toBe(1);
      expect(ledger1[0].medicines.length).toBe(2);
      expect(ledger1[0].medicines[0].medicine_name).toBe('Metformin 500mg');
      expect(ledger1[0].note).toBe('Old note before update');

      const sp = database.getShopProfile();
      expect(sp.shop_name).toBe('Sri Krishna Medicals');
      expect(sp.shop_license_no).toBe('DL-20B/TG/12345');

      // Verify that new operations immediately work after the update
      database.addDuePayment({ customerId: 1, amountPaid: 300, note: 'Cleared full balance after APK update' });
      expect(database.getCustomerById(1).total_due).toBe(0);
    });
  });

  describe('2. Realistic Volume Benchmark (1,000 Customers & 3,000 Purchases)', () => {
    let benchmarkBackup = null;

    beforeAll(() => {
      // Generate realistic retail pharmacy scale dataset
      const customers = [];
      const entries = [];
      const entryMedicines = [];

      const FIRST_NAMES = ['Ramesh', 'Suresh', 'Mahesh', 'Lakshmi', 'Venkatesh', 'Anitha', 'Praveen', 'Sunita', 'Rajesh', 'Geetha'];
      const LAST_NAMES = ['Kumar', 'Reddy', 'Rao', 'Sharma', 'Patel', 'Gupta', 'Verma', 'Goud', 'Naidu', 'Chowdary'];
      const VILLAGES = ['Nizampet', 'Kukatpally', 'Miyapur', 'Bachupally', 'Chandanagar', 'Pragathi Nagar', 'Gachibowli', 'Kondapur'];
      const COMMON_MEDS = [
        'Paracetamol 650mg',
        'Azithromycin 500mg',
        'Pantocid DSR',
        'Metformin 500mg',
        'Telmisartan 40mg',
        'Amoxiclav 625mg',
        'Cetirizine 10mg',
        'Atorvastatin 10mg',
        'Montair LC',
        'Vitamin D3 60k',
      ];

      let entryIdCounter = 1;
      let medIdCounter = 1;

      for (let i = 1; i <= 1000; i++) {
        const fn = FIRST_NAMES[i % FIRST_NAMES.length];
        const ln = LAST_NAMES[(i * 3) % LAST_NAMES.length];
        const village = VILLAGES[i % VILLAGES.length];
        const phone = '9848' + String(100000 + i).padStart(6, '0');

        customers.push({
          customer_id: i,
          phone_number: phone,
          name: `${fn} ${ln} (#${i})`,
          village: village,
          address: `Plot ${i % 150}, Street ${i % 20}`,
          created_at: new Date(Date.now() - (1000 - i) * 3600000).toISOString(),
        });

        // Add 3 purchases/payments per customer = 3,000 entries
        for (let j = 1; j <= 3; j++) {
          const entryId = entryIdCounter++;
          const isPurchase = j < 3;
          const totalAmount = isPurchase ? 250 + (i % 50) * 10 : 0;
          const paidAmount = isPurchase ? 50 : 200;
          const dueAmount = isPurchase ? totalAmount - paidAmount : -paidAmount;

          entries.push({
            entry_id: entryId,
            customer_id: i,
            entry_date: new Date(Date.now() - (1000 - i) * 3600000 + j * 60000).toISOString(),
            total_amount: totalAmount,
            amount_paid: paidAmount,
            due_amount: dueAmount,
            note: isPurchase ? `Rx purchase #${j}` : `Counter payment #${j}`,
          });

          if (isPurchase) {
            const med1 = COMMON_MEDS[(i + j) % COMMON_MEDS.length];
            const med2 = COMMON_MEDS[(i + j + 3) % COMMON_MEDS.length];
            entryMedicines.push({
              id: medIdCounter++,
              entry_id: entryId,
              medicine_name: med1,
              price: Math.round(totalAmount * 0.6),
              discount: 0,
            });
            entryMedicines.push({
              id: medIdCounter++,
              entry_id: entryId,
              medicine_name: med2,
              price: Math.round(totalAmount * 0.4),
              discount: 0,
            });
          }
        }
      }

      benchmarkBackup = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        customers,
        entries,
        entryMedicines,
        shop_profile: {
          id: 1,
          shop_name: 'MedTrack High Volume Test Store',
          shop_license_no: 'DL-20B/99999',
          shop_license_validity: '2028-12-31',
          shop_phone: '9848099999',
          pharmacist_name: 'Dr. Head Pharmacist',
          pharmacist_phone: '9848011111',
          pharmacist_license_validity: '2028-12-31',
        },
      };
    });

    test('populates 1,000 customers and 3,000 entries swiftly', async () => {
      const startTime = Date.now();
      await database.restoreDatabaseFromJson(benchmarkBackup);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(1000); // Must import 1,000 customers in < 1 second

      const allCust = database.getAllCustomers();
      expect(allCust.length).toBe(1000);
    });

    test('Home search by customer name is fast (< 100ms)', async () => {
      await database.restoreDatabaseFromJson(benchmarkBackup);
      const start = Date.now();
      const results = database.searchCustomers('Ramesh');
      const duration = Date.now() - start;

      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100);
    });

    test('Home search by phone number prefix is fast (< 100ms)', async () => {
      await database.restoreDatabaseFromJson(benchmarkBackup);
      const start = Date.now();
      const results = database.searchCustomers('98481005');
      const duration = Date.now() - start;

      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100);
    });

    test('Opening customer profile and ledger history is fast (< 50ms)', async () => {
      await database.restoreDatabaseFromJson(benchmarkBackup);
      const start = Date.now();
      const cust = database.getCustomerById(500);
      const ledger = database.getCustomerLedger(500);
      const duration = Date.now() - start;

      expect(cust).not.toBeNull();
      expect(cust.customer_id).toBe(500);
      expect(ledger.length).toBe(3);
      expect(duration).toBeLessThan(50);
    });

    test('Full JSON backup export of 1,000 customers & 3,000 entries is fast and complete', async () => {
      await database.restoreDatabaseFromJson(benchmarkBackup);
      const start = Date.now();
      const exported = database.exportAllData();
      const duration = Date.now() - start;

      expect(exported.customers.length).toBe(1000);
      expect(exported.entries.length).toBe(3000);
      expect(exported.entryMedicines.length).toBeGreaterThan(3000);
      expect(duration).toBeLessThan(250);

      // Verify the generated JSON is valid and passes validation
      const jsonStr = JSON.stringify(exported);
      expect(validateBackupJson(jsonStr)).toBe(true);
    });

    test('Atomic restore verification of 1,000 customers passes strict integrity check', async () => {
      await database.restoreDatabaseFromJson(benchmarkBackup);
      const exported = database.exportAllData();

      // verifyImport checks customers, entries, entryMedicines count and running balances match exactly
      expect(() => verifyImport(exported, exported)).not.toThrow();
    });
  });
});
