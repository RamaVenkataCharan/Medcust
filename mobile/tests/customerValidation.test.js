const { validateCustomerInput } = require('../src/utils/customerValidation');

describe('validateCustomerInput', () => {
  const existingCustomers = [
    { customer_id: 1, phone_number: '9876543210', name: 'Ramesh', deleted_at: null },
    { customer_id: 2, phone_number: '8888888888', name: 'Suresh', deleted_at: '2023-10-01T12:00:00Z' },
  ];

  it('accepts valid input', () => {
    const result = validateCustomerInput({ name: 'New Guy', phone_number: '9999999999' }, existingCustomers, 3);
    expect(result.isValid).toBe(true);
    expect(result.cleanPhone).toBe('9999999999');
    expect(result.cleanName).toBe('New Guy');
  });

  it('rejects empty name', () => {
    const result = validateCustomerInput({ name: '   ', phone_number: '9999999999' }, existingCustomers, 3);
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/Name is required/);
  });

  it('rejects short phone number', () => {
    const result = validateCustomerInput({ name: 'Test', phone_number: '12345' }, existingCustomers, 3);
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/exactly 10 digits/);
  });

  it('strips non-digits from phone', () => {
    const result = validateCustomerInput({ name: 'Test', phone_number: '+91-999-999-9999' }, existingCustomers, 3);
    expect(result.isValid).toBe(true);
    expect(result.cleanPhone).toBe('9999999999');
  });

  it('accepts own phone unchanged', () => {
    const result = validateCustomerInput({ name: 'Ramesh Updated', phone_number: '9876543210' }, existingCustomers, 1);
    expect(result.isValid).toBe(true);
    expect(result.cleanName).toBe('Ramesh Updated');
  });

  it('rejects duplicate active phone', () => {
    const result = validateCustomerInput({ name: 'Test', phone_number: '9876543210' }, existingCustomers, 3);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('This number belongs to Ramesh.');
    expect(result.duplicateId).toBe(1);
    expect(result.isDeleted).toBe(false);
  });

  it('rejects duplicate deleted phone', () => {
    const result = validateCustomerInput({ name: 'Test', phone_number: '8888888888' }, existingCustomers, 3);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('This number is in the Recycle Bin.');
    expect(result.duplicateId).toBe(2);
    expect(result.isDeleted).toBe(true);
  });
});
