jest.mock('react-native', () => ({
  Platform: { OS: 'web' }
}));

// Provide a mock localStorage for the web fallback
global.window = {
  localStorage: {
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, val) { this.store[key] = val; }
  }
};

import { addCustomer, softDeleteCustomer, getDeletedCustomers, permanentlyDeleteCustomer, getCustomerById } from '../../src/db/database';

describe('Customer Deletion', () => {
  it('should soft delete and permanently delete a customer', async () => {
    // 1. Add customer
    const id = addCustomer({ name: 'Test QA', phone_number: '9999999999' });
    expect(id).toBeDefined();

    // 2. Soft delete
    const softDeleted = softDeleteCustomer(id);
    expect(softDeleted).toBe(true);

    // 3. Verify in recycle bin
    const deleted = getDeletedCustomers();
    const found = deleted.find(c => c.customer_id === id);
    expect(found).toBeDefined();

    // 4. Permanently delete
    await permanentlyDeleteCustomer(id);

    // 5. Verify gone
    const gone = getCustomerById(id);
    expect(gone).toBeNull(); // or undefined depending on getCustomerById implementation
  });
});
