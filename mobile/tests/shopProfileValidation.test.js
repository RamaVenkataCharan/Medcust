const {
  isValidOptionalPhone,
  isValidOptionalDate,
  isDateInPast,
  isLicenseExpired,
  sanitizeShopProfile,
  validateShopProfile,
} = require('../src/utils/shopProfileValidation');

describe('shopProfileValidation', () => {
  describe('isValidOptionalPhone', () => {
    test('returns true for empty or undefined', () => {
      expect(isValidOptionalPhone('')).toBe(true);
      expect(isValidOptionalPhone(null)).toBe(true);
      expect(isValidOptionalPhone(undefined)).toBe(true);
    });

    test('returns true for valid 10-digit number and formatted numbers', () => {
      expect(isValidOptionalPhone('9876543210')).toBe(true);
      expect(isValidOptionalPhone('98765 43210')).toBe(true);
      expect(isValidOptionalPhone('+91 9876543210')).toBe(true);
    });

    test('returns false for invalid phone numbers', () => {
      expect(isValidOptionalPhone('123')).toBe(false);
      expect(isValidOptionalPhone('abcdefghij')).toBe(false);
      expect(isValidOptionalPhone('123456789012')).toBe(false);
    });
  });

  describe('isValidOptionalDate', () => {
    test('returns true for empty or undefined', () => {
      expect(isValidOptionalDate('')).toBe(true);
      expect(isValidOptionalDate(null)).toBe(true);
      expect(isValidOptionalDate(undefined)).toBe(true);
    });

    test('returns true for valid ISO date strings', () => {
      expect(isValidOptionalDate('2026-12-31')).toBe(true);
      expect(isValidOptionalDate('2025-01-01')).toBe(true);
    });

    test('returns false for non-date strings', () => {
      expect(isValidOptionalDate('not-a-date')).toBe(false);
      expect(isValidOptionalDate('32-13-2026')).toBe(false);
    });
  });

  describe('isDateInPast & isLicenseExpired', () => {
    const fixedToday = new Date('2026-10-13T12:00:00Z');

    test('returns false for empty date', () => {
      expect(isLicenseExpired('', fixedToday)).toBe(false);
      expect(isDateInPast(null, fixedToday)).toBe(false);
    });

    test('returns true for dates strictly before today', () => {
      expect(isLicenseExpired('2026-10-12', fixedToday)).toBe(true);
      expect(isLicenseExpired('2025-01-01', fixedToday)).toBe(true);
    });

    test('returns false for today or future dates', () => {
      expect(isLicenseExpired('2026-10-13', fixedToday)).toBe(false);
      expect(isLicenseExpired('2026-10-14', fixedToday)).toBe(false);
      expect(isLicenseExpired('2027-01-01', fixedToday)).toBe(false);
    });
  });

  describe('sanitizeShopProfile', () => {
    test('trims whitespace and provides string defaults', () => {
      const input = {
        shop_name: '  MedTrack Pharmacy  ',
        shop_license_no: ' DL-12345 ',
        shop_phone: ' 9876543210 ',
      };
      const result = sanitizeShopProfile(input);
      expect(result.shop_name).toBe('MedTrack Pharmacy');
      expect(result.shop_license_no).toBe('DL-12345');
      expect(result.shop_phone).toBe('9876543210');
      expect(result.pharmacist_name).toBe('');
      expect(result.pharmacist_phone).toBe('');
      expect(result.shop_license_validity).toBe('');
      expect(result.pharmacist_license_validity).toBe('');
    });
  });

  describe('validateShopProfile', () => {
    test('valid profile passes without errors', () => {
      const valid = {
        shop_name: 'Apollo Medicals',
        shop_phone: '9876543210',
        shop_license_no: 'DL-98765',
        shop_license_validity: '2028-12-31',
        pharmacist_name: 'Dr. Rao',
        pharmacist_phone: '9123456780',
        pharmacist_license_validity: '2027-06-30',
      };
      const res = validateShopProfile(valid);
      expect(res.isValid).toBe(true);
      expect(Object.keys(res.errors)).toHaveLength(0);
    });

    test('empty optional fields pass without errors', () => {
      const empty = {};
      const res = validateShopProfile(empty);
      expect(res.isValid).toBe(true);
      expect(Object.keys(res.errors)).toHaveLength(0);
    });

    test('reports invalid phone numbers and invalid date formats', () => {
      const invalid = {
        shop_phone: '12345',
        pharmacist_phone: 'bad-phone',
        shop_license_validity: 'not-a-date',
      };
      const res = validateShopProfile(invalid);
      expect(res.isValid).toBe(false);
      expect(res.errors.shop_phone).toBeDefined();
      expect(res.errors.pharmacist_phone).toBeDefined();
      expect(res.errors.shop_license_validity).toBeDefined();
    });
  });
});
