// Mock Platform to 'web' for headless testing
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

const {
  initDatabase,
  addCustomer,
  deleteCustomer,
  getTrashCustomers,
  addPurchaseEntry,
  addDuePayment,
  getCustomerLedger,
  purgeExpiredTrash,
} = require('../src/db/database');

const { calculateDaysLeftInBin } = require('../src/utils/khataLogic');

describe('Recycle Bin 30-Day Retention Window & Atomic Auto-Purge', () => {
  beforeEach(() => {
    global.window = {
      localStorage: {
        store: {},
        getItem(k) { return this.store[k] || null; },
        setItem(k, v) { this.store[k] = String(v); },
        clear() { this.store = {}; },
      },
    };
    initDatabase();
  });

  describe('calculateDaysLeftInBin (Countdown Formula)', () => {
    test('Calculates accurate countdown within 30-day retention window', () => {
      const now = new Date('2026-10-15T12:00:00Z');

      // Deleted today: 30 days remaining
      const deleted0 = '2026-10-15T12:00:00Z';
      expect(calculateDaysLeftInBin(deleted0, now)).toBe(30);

      // Deleted 10 days ago: 20 days remaining
      const deleted10 = '2026-10-05T12:00:00Z';
      expect(calculateDaysLeftInBin(deleted10, now)).toBe(20);

      // Deleted 29 days ago: 1 day remaining
      const deleted29 = '2026-09-16T12:00:00Z';
      expect(calculateDaysLeftInBin(deleted29, now)).toBe(1);

      // Deleted 30 days ago: 0 days remaining
      const deleted30 = '2026-09-15T12:00:00Z';
      expect(calculateDaysLeftInBin(deleted30, now)).toBe(0);

      // Deleted 35 days ago: clamped to 0 days remaining
      const deleted35 = '2026-09-10T12:00:00Z';
      expect(calculateDaysLeftInBin(deleted35, now)).toBe(0);
    });
  });

  describe('purgeExpiredTrash: 29-day keep and 31-day purge with simulated date', () => {
    test('Retains 29-day-old customer intact while auto-purging 31-day-old customer in one atomic cascade', () => {
      const simulatedNow = new Date('2026-10-15T10:00:00Z');

      // 1. Create Customer 1 (will be 29 days deleted)
      const cust29Id = addCustomer({
        phone_number: '9876529001',
        name: 'Keep Customer (29 Days)',
        village: 'Rampur',
      });

      // Add purchase with medicine lines
      addPurchaseEntry({
        customerId: cust29Id,
        medicines: [
          { name: 'Amoxicillin 500mg', price: 120, discount: 20 },
          { name: 'Cetirizine 10mg', price: 40, discount: 0 },
        ],
        subtotal: 160,
        discountPercent: 0,
        discountAmount: 0,
        totalAmount: 140,
        amountPaid: 40,
      });

      // Add a due-clearing payment
      addDuePayment({
        customerId: cust29Id,
        amountPaid: 100,
      });

      // Move to recycle bin
      deleteCustomer(cust29Id);

      // 2. Create Customer 2 (will be 31 days deleted)
      const cust31Id = addCustomer({
        phone_number: '9876531002',
        name: 'Purge Customer (31 Days)',
        village: 'Shyampur',
      });

      // Add purchase with medicine lines
      addPurchaseEntry({
        customerId: cust31Id,
        medicines: [
          { name: 'Cifran 500mg', price: 100, discount: 25 },
        ],
        subtotal: 100,
        discountPercent: 0,
        discountAmount: 0,
        totalAmount: 75,
        amountPaid: 75,
      });

      // Move to recycle bin
      deleteCustomer(cust31Id);

      // Simulate back-dating deleted_at timestamps in the storage state
      const state = JSON.parse(global.window.localStorage.getItem('medtrack_khata_web_state_v1'));

      // 29 days before simulatedNow
      const date29DaysAgo = new Date(simulatedNow.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString();
      // 31 days before simulatedNow
      const date31DaysAgo = new Date(simulatedNow.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString();

      const c29 = state.customers.find((c) => c.customer_id === cust29Id);
      const c31 = state.customers.find((c) => c.customer_id === cust31Id);
      c29.deleted_at = date29DaysAgo;
      c31.deleted_at = date31DaysAgo;

      global.window.localStorage.setItem('medtrack_khata_web_state_v1', JSON.stringify(state));

      // Verify both are initially in Recycle Bin before purge
      const initialTrash = getTrashCustomers();
      expect(initialTrash.some((c) => c.customer_id === cust29Id)).toBe(true);
      expect(initialTrash.some((c) => c.customer_id === cust31Id)).toBe(true);

      // Execute auto-purge with simulated date
      const purgeResult = purgeExpiredTrash(simulatedNow);

      expect(purgeResult.purgedCount).toBe(1);
      expect(purgeResult.customerIds).toContain(cust31Id);
      expect(purgeResult.customerIds).not.toContain(cust29Id);

      // Verify Customer 31 is completely eradicated
      const postTrash = getTrashCustomers();
      expect(postTrash.some((c) => c.customer_id === cust31Id)).toBe(false);

      // Verify Customer 31's ledger entries and medicine lines are eradicated
      const ledger31 = getCustomerLedger(cust31Id);
      expect(ledger31.length).toBe(0);

      const stateAfter = JSON.parse(global.window.localStorage.getItem('medtrack_khata_web_state_v1'));
      expect(stateAfter.customers.some((c) => c.customer_id === cust31Id)).toBe(false);
      expect(stateAfter.entries.some((e) => e.customer_id === cust31Id)).toBe(false);
      expect(stateAfter.entry_medicines.some((m) => m.entry_id === 2)).toBe(false);

      // Verify Customer 29 is KEPT intact with all purchase entries, medicines, and payments
      expect(postTrash.some((c) => c.customer_id === cust29Id)).toBe(true);
      const ledger29 = getCustomerLedger(cust29Id);
      expect(ledger29.length).toBe(2); // 1 purchase + 1 payment
      const purchaseEntry = ledger29.find((e) => e.medicines && e.medicines.length > 0);
      expect(purchaseEntry).toBeDefined();
      expect(purchaseEntry.medicines.length).toBe(2); // Amoxicillin & Cetirizine
    });
  });
});
