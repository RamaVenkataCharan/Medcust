jest.mock('react-native', () => ({
  Platform: { OS: 'web' }
}));

// Provide mock localStorage for web driver testing
global.window = {
  localStorage: {
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, val) { this.store[key] = val; }
  }
};

const database = require('../../src/db/database');
const { validateCustomerInput } = require('../../src/utils/customerValidation');
const { cleanPhoneNumber, canDeleteCustomer } = require('../../src/utils/khataLogic');
const { validateShopProfile, isLicenseExpired, sanitizeShopProfile } = require('../../src/utils/shopProfileValidation');

describe('E2E Audit: Add Customer, Delete Customer & Shop Profile', () => {
  beforeEach(() => {
    // Reset web store
    global.window.localStorage.store = {};
  });

  describe('1. Add Customer Flow', () => {
    it('should validate and sanitize phone numbers correctly', () => {
      expect(cleanPhoneNumber('+91 98480 12345')).toBe('9848012345');
      expect(cleanPhoneNumber('9848012345')).toBe('9848012345');
      expect(cleanPhoneNumber('')).toBe('');
      expect(cleanPhoneNumber('12345')).toBe('12345');
    });

    it('should successfully add a customer and retrieve by phone and id', () => {
      const custId = database.addCustomer({
        name: 'Sita Devi',
        phone_number: '9848099999',
        village: 'Kothapally',
        address: 'H.No 4-22'
      });

      expect(custId).toBeDefined();
      const byId = database.getCustomerById(custId);
      expect(byId).toBeDefined();
      expect(byId.name).toBe('Sita Devi');
      expect(byId.phone_number).toBe('9848099999');
      expect(byId.village).toBe('Kothapally');

      const byPhone = database.getCustomerByPhone('9848099999');
      expect(byPhone).toBeDefined();
      expect(byPhone.customer_id).toBe(custId);
    });

    it('should identify duplicate active customer phone in validation', () => {
      const allCust = [
        { customer_id: 1, phone_number: '9848099999', name: 'Sita Devi', deleted_at: null }
      ];

      const validation = validateCustomerInput({ name: 'Duplicate Sita', phone_number: '9848099999' }, allCust, 999);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('This number belongs to Sita Devi.');
      expect(validation.duplicateId).toBe(1);
    });

    it('should identify duplicate soft-deleted customer in Recycle Bin', () => {
      const allCust = [
        { customer_id: 2, phone_number: '9848088888', name: 'Deleted Sita', deleted_at: '2026-10-10T10:00:00Z' }
      ];

      const validation = validateCustomerInput({ name: 'Restore Sita', phone_number: '9848088888' }, allCust, 999);
      expect(validation.isValid).toBe(false);
      expect(validation.isDeleted).toBe(true);
      expect(validation.error).toBe('This number is in the Recycle Bin.');
    });
  });

  describe('2. Delete Customer & Recycle Bin Flow', () => {
    it('canDeleteCustomer logic restricts deletion when due > 0 and allows for 0 or credit', () => {
      // Due > 0
      expect(canDeleteCustomer([{ due_amount: 150 }])).toBe(false);
      // Credit (Due < 0)
      expect(canDeleteCustomer([{ due_amount: -50 }])).toBe(true);
      // Zero due
      expect(canDeleteCustomer([{ due_amount: 0 }])).toBe(true);
      expect(canDeleteCustomer([])).toBe(true);
    });

    it('should soft delete, appear in recycle bin, restore, and permanently delete', async () => {
      const custId = database.addCustomer({
        name: 'Gopal Varma',
        phone_number: '9848077777',
        village: 'Miyapur'
      });

      // 1. Soft delete
      const deleted = database.softDeleteCustomer(custId);
      expect(deleted).toBe(true);

      // Check not in regular search
      const activeSearch = database.searchCustomers('Gopal');
      expect(activeSearch.find(c => c.customer_id === custId)).toBeUndefined();

      // Check present in recycle bin
      const bin = database.getDeletedCustomers();
      const inBin = bin.find(c => c.customer_id === custId);
      expect(inBin).toBeDefined();
      expect(inBin.name).toBe('Gopal Varma');

      // 2. Restore
      const restored = database.restoreDeletedCustomer(custId);
      expect(restored).toBe(true);
      const afterRestore = database.searchCustomers('Gopal');
      expect(afterRestore.find(c => c.customer_id === custId)).toBeDefined();

      // 3. Re-delete and Permanently delete
      database.softDeleteCustomer(custId);
      await database.permanentlyDeleteCustomer(custId);
      const afterPermanent = database.getCustomerById(custId);
      expect(afterPermanent).toBeNull();
      const binAfter = database.getDeletedCustomers();
      expect(binAfter.find(c => c.customer_id === custId)).toBeUndefined();
    });
  });

  describe('3. Shop & Pharmacist Profile Flow', () => {
    it('should save and retrieve full shop & pharmacist profile', () => {
      const sampleProfile = {
        shop_name: 'MedTrack Pharmacy',
        shop_license_no: 'DL-20B/21B-98765',
        shop_license_validity: '2028-12-31',
        shop_phone: '9848011111',
        pharmacist_name: 'Dr. V. Prasad (B.Pharm)',
        pharmacist_phone: '9848022222',
        pharmacist_license_validity: '2027-06-30'
      };

      const val = validateShopProfile(sampleProfile);
      expect(val.isValid).toBe(true);

      database.saveShopProfile(sampleProfile);
      const saved = database.getShopProfile();

      expect(saved.shop_name).toBe('MedTrack Pharmacy');
      expect(saved.shop_license_no).toBe('DL-20B/21B-98765');
      expect(saved.shop_license_validity).toBe('2028-12-31');
      expect(saved.shop_phone).toBe('9848011111');
      expect(saved.pharmacist_name).toBe('Dr. V. Prasad (B.Pharm)');
      expect(saved.pharmacist_phone).toBe('9848022222');
      expect(saved.pharmacist_license_validity).toBe('2027-06-30');
    });

    it('should detect expired license validity dates', () => {
      expect(isLicenseExpired('2020-01-01')).toBe(true);
      expect(isLicenseExpired('2035-12-31')).toBe(false);
      expect(isLicenseExpired('')).toBe(false);
      expect(isLicenseExpired(null)).toBe(false);
    });

    it('should validate invalid phone formats in shop profile', () => {
      const invalidPhone = {
        shop_phone: '12345',
        pharmacist_phone: 'not-a-number'
      };
      const val = validateShopProfile(invalidPhone);
      expect(val.isValid).toBe(false);
      expect(val.errors.shop_phone).toBeDefined();
      expect(val.errors.pharmacist_phone).toBeDefined();
    });
  });
});
