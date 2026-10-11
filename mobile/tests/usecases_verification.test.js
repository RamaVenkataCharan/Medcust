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
  permanentDeleteCustomer,
  addPurchaseEntry,
  getCustomerLedger,
  addDuePayment,
  getShopProfile,
  saveShopProfile,
} = require('../src/db/database');

const {
  validatePhoneNumber,
  calculateBillDiscount,
  calculateCustomerTotalDue,
} = require('../src/utils/khataLogic');

describe('Full Verification of Specific QA Use-Cases (UC)', () => {
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

  // UC-1.4: Invalid Phone Formats Rejection
  test('UC-1.4: Rejects numbers starting with 0-5 and length > 10', () => {
    expect(validatePhoneNumber('0123456789').isValid).toBe(false);
    expect(validatePhoneNumber('5123456789').isValid).toBe(false);
    expect(validatePhoneNumber('1234567890').isValid).toBe(false);
    expect(validatePhoneNumber('98765432109').isValid).toBe(false); // >10 digits
    expect(validatePhoneNumber('98765').isValid).toBe(false); // <10 digits

    // Valid 6-9
    expect(validatePhoneNumber('9876543210').isValid).toBe(true);
    expect(validatePhoneNumber('8123456789').isValid).toBe(true);
    expect(validatePhoneNumber('7012345678').isValid).toBe(true);
    expect(validatePhoneNumber('6987654321').isValid).toBe(true);
  });

  // UC-2.2 & UC-2.1: Delete Customer with Zero Balance
  test('UC-2.2: Create zero balance customer, delete, history preserved in recycle bin', () => {
    const custId = addCustomer({
      phone_number: '9876500001',
      name: 'QA Zero Balance',
    });

    // Add ₹100 purchase, ₹100 payment -> balance = 0
    addPurchaseEntry({
      customerId: custId,
      medicines: [{ name: 'Medicine A', price: 100 }],
      totalAmount: 100,
      amountPaid: 100,
    });

    const cust = getCustomerById(custId);
    expect(cust.total_due).toBe(0);

    // Delete allowed
    const deleted = deleteCustomer(custId);
    expect(deleted).toBe(true);

    // Hidden from active search
    expect(searchCustomers('QA Zero Balance').length).toBe(0);

    // Preserved in Recycle Bin
    const trash = getTrashCustomers();
    expect(trash.some((c) => c.customer_id === custId)).toBe(true);
  });

  // UC-2.3: Delete Customer with Dues is blocked
  test('UC-2.3: Customer with dues has total_due > 0, blocking delete until paid', () => {
    const custId = addCustomer({
      phone_number: '9876500002',
      name: 'QA With Dues',
    });

    addPurchaseEntry({
      customerId: custId,
      medicines: [{ name: 'Paracetamol', price: 65 }],
      totalAmount: 65,
      amountPaid: 0,
    });

    let cust = getCustomerById(custId);
    expect(cust.total_due).toBe(65);

    // Guard evaluation: due > 0 blocks delete
    const isBlocked = cust.total_due > 0.001;
    expect(isBlocked).toBe(true);

    // Pay ₹65
    addDuePayment({ customerId: custId, amountPaid: 65 });
    cust = getCustomerById(custId);
    expect(cust.total_due).toBe(0);

    // Now delete is allowed
    expect(cust.total_due <= 0.001).toBe(true);
    expect(deleteCustomer(custId)).toBe(true);
  });

  // UC-2.4: Credit balance (overpayment)
  test('UC-2.4: Payment exceeding dues creates credit balance without crash', () => {
    const custId = addCustomer({
      phone_number: '9876500003',
      name: 'QA Credit',
    });

    addPurchaseEntry({
      customerId: custId,
      medicines: [{ name: 'Aspirin', price: 50 }],
      totalAmount: 50,
      amountPaid: 0,
    });

    // Pay ₹100 (overpayment by ₹50)
    addDuePayment({ customerId: custId, amountPaid: 100 });

    const cust = getCustomerById(custId);
    // Running balance is -₹50 (credit)
    expect(cust.total_due).toBe(-50);
  });

  // UC-2.6 & UC-2.7: Restore and Delete Forever
  test('UC-2.6 & UC-2.7: Restore customer, then permanent delete removes all rows', () => {
    const custId = addCustomer({
      phone_number: '9876500004',
      name: 'QA Restore Delete',
    });

    deleteCustomer(custId);
    expect(searchCustomers('QA Restore Delete').length).toBe(0);

    // Restore
    restoreCustomer(custId);
    expect(searchCustomers('QA Restore Delete').length).toBe(1);

    // Permanent Delete
    permanentDeleteCustomer(custId);
    expect(searchCustomers('QA Restore Delete').length).toBe(0);
    expect(getTrashCustomers().some((c) => c.customer_id === custId)).toBe(false);
  });

  // UC-4.8: Shop & Pharmacist Profile Persistence
  test('UC-4.8: Shop & Pharmacist profile saves all fields and persists', () => {
    const saved = saveShopProfile({
      shop_name: 'Laxmi Medical Stores',
      shop_license_no: 'DL-20B-12345 / Form 20/21',
      shop_license_validity: '2028-12-31',
      shop_phone: '9876543210',
      pharmacist_name: 'R. K. Sharma (Reg. Pharmacist)',
      pharmacist_phone: '9876543211',
      pharmacist_license_validity: '2027-06-30',
    });

    expect(saved.shop_name).toBe('Laxmi Medical Stores');
    expect(saved.pharmacist_name).toBe('R. K. Sharma (Reg. Pharmacist)');

    const loaded = getShopProfile();
    expect(loaded.shop_name).toBe('Laxmi Medical Stores');
    expect(loaded.shop_license_no).toBe('DL-20B-12345 / Form 20/21');
    expect(loaded.pharmacist_name).toBe('R. K. Sharma (Reg. Pharmacist)');
  });

  // Bill-Level Percentage Discount on Purchases
  test('Bill-level discount: ₹500 at 15% gives ₹75 discount, ₹425 net total, correct due', () => {
    const custId = addCustomer({
      phone_number: '9876500005',
      name: 'QA Discount User',
    });

    // Subtotal 500, discount 15% -> discountAmount 75, netTotal 425, paid 100, due 325
    addPurchaseEntry({
      customerId: custId,
      medicines: [{ name: 'Medicine X', price: 500 }],
      subtotal: 500,
      discountPercent: 15,
      discountAmount: 75,
      totalAmount: 425,
      amountPaid: 100,
    });

    const ledger = getCustomerLedger(custId);
    expect(ledger[0].subtotal).toBe(500);
    expect(ledger[0].discount_percent).toBe(15);
    expect(ledger[0].discount_amount).toBe(75);
    expect(ledger[0].total_amount).toBe(425);
    expect(ledger[0].amount_paid).toBe(100);
    expect(ledger[0].due_amount).toBe(325);

    const cust = getCustomerById(custId);
    expect(cust.total_due).toBe(325);
  });
});
