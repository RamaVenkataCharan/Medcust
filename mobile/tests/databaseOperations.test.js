// Mock Platform to 'web' for headless testing of operations layer
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

const {
  initDatabase,
  addCustomer,
  searchCustomers,
  getCustomerById,
  deleteCustomer,
  restoreCustomer,
  getTrashCustomers,
  addPurchaseEntry,
  getCustomerLedger,
  addDuePayment,
  exportAllData,
  importAllData,
} = require('../src/db/database');

describe('Database Operations & Business Logic Tests (Headless Driver)', () => {
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

  test('Add customer with village and search by village name', () => {
    const custId = addCustomer({
      phone_number: '9876543210',
      name: 'Ramesh Kumar',
      village: 'Nizampet',
      address: 'Main Bazar',
    });

    expect(custId).toBeDefined();

    // Search by village
    const results = searchCustomers('Nizampet');
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Ramesh Kumar');
    expect(results[0].village).toBe('Nizampet');
  });

  test('Add purchase entry with bill-level discount and verify ledger fields', () => {
    const custId = addCustomer({
      phone_number: '9876543211',
      name: 'Suresh Patel',
      village: 'Kompally',
    });

    // Add purchase: Subtotal ₹500, 15% discount -> -₹75, net ₹425, paid ₹100, due ₹325
    const entryId = addPurchaseEntry({
      customerId: custId,
      medicines: [{ name: 'Paracetamol', price: 500, discount: 0 }],
      subtotal: 500,
      discountPercent: 15,
      discountAmount: 75,
      totalAmount: 425,
      amountPaid: 100,
    });

    expect(entryId).toBeDefined();

    const ledger = getCustomerLedger(custId);
    expect(ledger.length).toBe(1);
    expect(ledger[0].subtotal).toBe(500);
    expect(ledger[0].discount_percent).toBe(15);
    expect(ledger[0].discount_amount).toBe(75);
    expect(ledger[0].total_amount).toBe(425);
    expect(ledger[0].amount_paid).toBe(100);
    expect(ledger[0].due_amount).toBe(325);

    const customer = getCustomerById(custId);
    expect(customer.total_due).toBe(325);
  });

  test('Record payment updates running balance correctly', () => {
    const custId = addCustomer({
      phone_number: '9876543212',
      name: 'Anil Reddy',
      village: 'Miyapur',
    });

    addPurchaseEntry({
      customerId: custId,
      medicines: [{ name: 'Amoxicillin', price: 400, discount: 0 }],
      subtotal: 400,
      discountPercent: 0,
      discountAmount: 0,
      totalAmount: 400,
      amountPaid: 0,
    });

    let customer = getCustomerById(custId);
    expect(customer.total_due).toBe(400);

    // Record partial payment of ₹250
    addDuePayment({ customerId: custId, amountPaid: 250 });

    customer = getCustomerById(custId);
    expect(customer.total_due).toBe(150);

    // Record remaining payment of ₹150 -> balance cleared
    addDuePayment({ customerId: custId, amountPaid: 150 });

    customer = getCustomerById(custId);
    expect(customer.total_due).toBe(0);
  });

  test('Soft delete moves customer to Recycle Bin and hides from active search', () => {
    const custId = addCustomer({
      phone_number: '9876543213',
      name: 'Zero Due Customer',
      village: 'Chandanagar',
    });

    expect(searchCustomers('Zero Due').length).toBe(1);

    // Soft delete
    const deleted = deleteCustomer(custId);
    expect(deleted.success).toBe(true);
    expect(deleted.changes).toBe(1);

    // Must be hidden from active search
    expect(searchCustomers('Zero Due').length).toBe(0);

    // Must appear in Recycle Bin
    const trash = getTrashCustomers();
    expect(trash.some((c) => c.customer_id === custId)).toBe(true);

    // Restore customer
    const restored = restoreCustomer(custId);
    expect(restored).toBe(true);
    expect(searchCustomers('Zero Due').length).toBe(1);
  });

  test('Export and import backup round-trip preserves discount metadata', () => {
    const custId = addCustomer({
      phone_number: '9876543214',
      name: 'Backup Test User',
      village: 'Bachupally',
    });

    addPurchaseEntry({
      customerId: custId,
      medicines: [{ name: 'Cetirizine', price: 200, discount: 0 }],
      subtotal: 200,
      discountPercent: 10,
      discountAmount: 20,
      totalAmount: 180,
      amountPaid: 80,
    });

    const exported = exportAllData();
    expect(exported.customers.length).toBe(1);
    expect(exported.entries[0].subtotal).toBe(200);
    expect(exported.entries[0].discount_percent).toBe(10);
    expect(exported.entries[0].discount_amount).toBe(20);

    // Clear state and import
    window.localStorage.clear();
    initDatabase();
    expect(searchCustomers().length).toBe(0);

    importAllData(exported);

    const reloaded = searchCustomers('Backup Test');
    expect(reloaded.length).toBe(1);

    const reloadedLedger = getCustomerLedger(custId);
    expect(reloadedLedger[0].subtotal).toBe(200);
    expect(reloadedLedger[0].discount_percent).toBe(10);
    expect(reloadedLedger[0].discount_amount).toBe(20);
    expect(reloadedLedger[0].total_amount).toBe(180);
    expect(reloadedLedger[0].due_amount).toBe(100);
  });
});
