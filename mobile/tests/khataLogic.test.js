const { 
  canDeleteCustomer, 
  calculateCustomerTotalDue, 
  cleanPhoneNumber, 
  calculateEntryDue, 
  calculatePaymentDue, 
  isPaymentEntry,
  filterCustomersForSearch
} = require('../src/utils/khataLogic');

describe('canDeleteCustomer', () => {
  it('returns false for due != 0', () => {
    const entries = [{ due_amount: 50 }, { due_amount: -25 }];
    expect(calculateCustomerTotalDue(entries)).toBe(25);
    expect(canDeleteCustomer(entries)).toBe(false);
  });

  it('returns true for due == 0', () => {
    const entries = [{ due_amount: 50 }, { due_amount: -50 }];
    expect(calculateCustomerTotalDue(entries)).toBe(0);
    expect(canDeleteCustomer(entries)).toBe(true);
  });

  it('returns false for credit balance', () => {
    const entries = [{ due_amount: 50 }, { due_amount: -60 }];
    expect(calculateCustomerTotalDue(entries)).toBe(-10);
    expect(canDeleteCustomer(entries)).toBe(false);
  });

  it('returns false for a customer with only payment rows (credit)', () => {
    const entries = [{ due_amount: -20 }, { due_amount: -30 }];
    expect(calculateCustomerTotalDue(entries)).toBe(-50);
    expect(canDeleteCustomer(entries)).toBe(false);
  });
  
  it('returns true for a customer with only zero-due payment rows', () => {
    const entries = [{ due_amount: 0 }, { due_amount: 0 }];
    expect(calculateCustomerTotalDue(entries)).toBe(0);
    expect(canDeleteCustomer(entries)).toBe(true);
  });
});

describe('cleanPhoneNumber', () => {
  it('cleans non-numeric characters and keeps last 10 digits', () => {
    expect(cleanPhoneNumber('+91 98765-43210')).toBe('9876543210');
    expect(cleanPhoneNumber('09876543210')).toBe('9876543210');
    expect(cleanPhoneNumber(null)).toBe('');
  });
});

describe('calculateEntryDue', () => {
  it('calculates due correctly', () => {
    expect(calculateEntryDue(100, 40)).toBe(60);
    expect(calculateEntryDue('100.50', '40.25')).toBe(60.25);
  });
});

describe('calculatePaymentDue', () => {
  it('calculates negative due for payments', () => {
    expect(calculatePaymentDue(50)).toBe(-50);
  });
});

describe('isPaymentEntry', () => {
  it('identifies payment correctly', () => {
    expect(isPaymentEntry({ total_amount: 0, amount_paid: 50, medicines: [] })).toBe(true);
    expect(isPaymentEntry({ total_amount: 100, amount_paid: 50, medicines: [{}] })).toBe(false);
    expect(isPaymentEntry(null)).toBe(false);
  });
});

describe('filterCustomersForSearch', () => {
  const customers = [
    { customer_id: 1, name: 'Alice', phone_number: '9876543210' },
    { customer_id: 2, name: 'Bob', phone_number: '1234567890', deleted_at: '2026-10-06' },
    { customer_id: 3, name: 'Charlie', phone_number: '9999999999' }
  ];

  it('returns all non-deleted if query is empty', () => {
    const result = filterCustomersForSearch(customers, '');
    expect(result.length).toBe(2);
    expect(result.find(c => c.name === 'Bob')).toBeUndefined();
  });

  it('filters by name case-insensitive and ignores deleted', () => {
    const result = filterCustomersForSearch(customers, 'ali');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Alice');
    
    const resultBob = filterCustomersForSearch(customers, 'bob');
    expect(resultBob.length).toBe(0); // Bob is deleted
  });

  it('filters by phone number', () => {
    const result = filterCustomersForSearch(customers, '9999');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Charlie');
  });
});
