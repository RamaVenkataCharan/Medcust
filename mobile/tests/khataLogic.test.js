const { 
  canDeleteCustomer, 
  calculateCustomerTotalDue, 
  cleanPhoneNumber, 
  calculateEntryDue, 
  calculatePaymentDue, 
  isPaymentEntry 
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
