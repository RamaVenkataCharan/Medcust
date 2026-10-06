const { canDeleteCustomer, calculateCustomerTotalDue } = require('../src/utils/khataLogic');

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
