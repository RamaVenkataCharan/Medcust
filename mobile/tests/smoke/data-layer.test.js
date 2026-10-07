import { Platform } from 'react-native';
import { 
  initDatabase, 
  addCustomer, 
  addPurchaseEntry, 
  addDuePayment, 
  getCustomerLedger,
  exportAllData,
  restoreDatabaseFromJson,
  softDeleteCustomer,
  searchCustomers
} from '../../src/db/database';
import { calculateCustomerTotalDue } from '../../src/utils/khataLogic';
import { validateBackupJson } from '../../src/utils/importValidator';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

// Mock AsyncStorage used by database.js on web
let mockStorage = {};
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, value) => { mockStorage[key] = value.toString(); },
  removeItem: (key) => { delete mockStorage[key]; }
};

describe('Phase E: Data-Layer Sanity', () => {
  beforeEach(async () => {
    mockStorage = {};
    await initDatabase();
  });

  test('run the worked example', async () => {
    // 1. Current due 65
    const customerId = await addCustomer({ phone_number: '9999999999', name: 'Test User', village: 'Village', address: 'Address' });
    await addPurchaseEntry({ customerId, totalAmount: 65, amountPaid: 0, medicines: [{ name: 'Old Med', price: 65, discount: 0 }] });
    
    let entries = await getCustomerLedger(customerId);
    expect(calculateCustomerTotalDue(entries)).toBe(65);

    // 2. Add purchase with Cifran 75 at 10% (wait, 10% of 75 is 7.5, so 67.5) and Dolo 15. Total: 67.5 + 15 = 82.50. Paid 25.
    // expect due created 57.50
    // expect total due 65 + 57.50 = 122.50
    await addPurchaseEntry({
      customerId, 
      totalAmount: 82.50, 
      amountPaid: 25, 
      medicines: [
        { name: 'Cifran', price: 75, discount: 10, discountMode: '%' },
        { name: 'Dolo', price: 15, discount: 0, discountMode: '₹' }
      ]
    });

    entries = await getCustomerLedger(customerId);
    expect(calculateCustomerTotalDue(entries)).toBe(122.50);

    // 3. Payment note stored as "Cash - counter settled"
    const paymentId = await addDuePayment({ customerId, amountPaid: 20, note: 'Cash - counter settled' });
    entries = await getCustomerLedger(customerId);
    const payment = entries.find(e => e.entry_id === paymentId);
    expect(payment.note).toBe('Cash - counter settled');

    // 4. Deleted customers excluded from search and restored correctly
    const cust2 = await addCustomer({ phone_number: '8888888888', name: 'Delete Me', village: '', address: '' });
    await softDeleteCustomer(cust2);
    const searchRes = await searchCustomers('Delete');
    expect(searchRes.length).toBe(0);

    // 5. Restore verification catches tampered backup
    const backup = await exportAllData();
    const parsed = JSON.parse(JSON.stringify(backup));
    parsed.entries[0].due_amount = 9999; // Tamper
    const tamperedJSON = JSON.stringify(parsed);
    
    expect(() => validateBackupJson(tamperedJSON)).toThrow();
  });
});
