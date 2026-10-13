import { Platform } from 'react-native';
import {
  initDatabase,
  getShopProfile,
  saveShopProfile,
  restoreDatabaseFromJson,
  getCustomerLedger,
  searchCustomers
} from '../../src/db/database';
import { calculateCustomerTotalDue } from '../../src/utils/khataLogic';
import { validateBackupJson } from '../../src/utils/importValidator';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

let mockStorage = {};
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, value) => { mockStorage[key] = value.toString(); },
  removeItem: (key) => { delete mockStorage[key]; }
};

describe('Shop profile & Legacy backup restore', () => {
  beforeEach(async () => {
    mockStorage = {};
    await initDatabase();
  });

  test('restoring a backup without shop_profile preserves existing shop profile', async () => {
    // 1. Save an existing shop profile
    saveShopProfile({
      shop_name: 'Existing Pharmacare',
      shop_license_no: 'DL-EXISTING-123',
      shop_phone: '9988776655',
    });

    const currentProfile = getShopProfile();
    expect(currentProfile.shop_name).toBe('Existing Pharmacare');

    // 2. Prepare backup without shop_profile
    const backupWithoutProfile = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      customers: [
        { customer_id: 1, phone_number: '9876543210', name: 'John Doe', village: 'South Village', address: 'Main Rd' }
      ],
      entries: [
        { entry_id: 1, customer_id: 1, total_amount: 100, amount_paid: 50, due_amount: 50, entry_date: new Date().toISOString() }
      ],
      entryMedicines: [
        { id: 1, entry_id: 1, medicine_name: 'Paracetamol', price: 100, discount: 0 }
      ]
    };

    // 3. Validate & Restore
    expect(validateBackupJson(JSON.stringify(backupWithoutProfile))).toBe(true);
    await restoreDatabaseFromJson(backupWithoutProfile);

    // 4. Assert shop profile is unchanged
    const afterRestoreProfile = getShopProfile();
    expect(afterRestoreProfile.shop_name).toBe('Existing Pharmacare');
    expect(afterRestoreProfile.shop_license_no).toBe('DL-EXISTING-123');
    expect(afterRestoreProfile.shop_phone).toBe('9988776655');

    // 5. Assert customer restored
    const custs = await searchCustomers('John');
    expect(custs.length).toBe(1);
    expect(custs[0].name).toBe('John Doe');
  });

  test('restoring legacy fix/phase-b-2 backup with bill-level discount fields succeeds and displays correct dues', async () => {
    // Legacy backup from fix/phase-b-2 containing subtotal, discount_percent, discount_amount
    const legacyPhaseBBackup = {
      version: '1.0',
      exportedAt: '2026-10-11T12:00:00.000Z',
      customers: [
        {
          customer_id: 10,
          phone_number: '9123456780',
          name: 'Legacy Phase-B Patient',
          village: 'Anakapalli',
          address: 'Door 4-12',
          created_at: '2026-10-11T12:00:00.000Z',
          deleted_at: null
        }
      ],
      entries: [
        {
          entry_id: 101,
          customer_id: 10,
          entry_date: '2026-10-11T12:00:00.000Z',
          // 500 bill with 15% discount (75) -> 425 total, 100 paid -> 325 due
          total_amount: 425.0,
          amount_paid: 100.0,
          due_amount: 325.0,
          subtotal: 500.0,
          discount_percent: 15.0,
          discount_amount: 75.0,
          note: 'Counter settled with bill discount'
        }
      ],
      entryMedicines: [
        {
          id: 501,
          entry_id: 101,
          medicine_name: 'Amoxicillin 500mg',
          price: 500.0,
          discount: 0
        }
      ]
    };

    // 1. Validator accepts the legacy backup
    const jsonString = JSON.stringify(legacyPhaseBBackup);
    expect(validateBackupJson(jsonString)).toBe(true);

    // 2. Database restore succeeds
    await restoreDatabaseFromJson(legacyPhaseBBackup);

    // 3. Customer ledger reflects sensible values
    const ledger = await getCustomerLedger(10);
    expect(ledger.length).toBe(1);
    expect(ledger[0].total_amount).toBe(425);
    expect(ledger[0].amount_paid).toBe(100);
    expect(ledger[0].due_amount).toBe(325);
    expect(ledger[0].note).toBe('Counter settled with bill discount');

    // 4. Total customer due calculation matches 325.00
    expect(calculateCustomerTotalDue(ledger)).toBe(325.0);

    // 5. Customer is searchable
    const searchRes = await searchCustomers('Legacy');
    expect(searchRes.length).toBe(1);
    expect(searchRes[0].phone_number).toBe('9123456780');
    expect(searchRes[0].village).toBe('Anakapalli');
  });
});
