'use strict';

/**
 * Validates a 10-digit Indian mobile number.
 * Empty or undefined is treated as valid (optional field).
 */
function isValidOptionalPhone(phone) {
  if (!phone) return true;
  const raw = String(phone).replace(/\D/g, '');
  if (raw.length === 10) return true;
  if (raw.length === 11 && raw.startsWith('0')) return true;
  if (raw.length === 12 && raw.startsWith('91')) return true;
  return false;
}

/**
 * Validates an optional date string (e.g. YYYY-MM-DD).
 * Empty or undefined is treated as valid (optional field).
 */
function isValidOptionalDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return true;
  const trimmed = dateStr.trim();
  if (!trimmed) return true;
  const parsed = new Date(trimmed);
  return !isNaN(parsed.getTime());
}

/**
 * Checks if a given date string is in the past compared to reference date (defaults to now).
 * Returns false if date string is empty or unparseable.
 */
function isDateInPast(dateStr, referenceDate = new Date()) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  if (!trimmed) return false;
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return false;

  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  const target = new Date(parsed);
  target.setHours(0, 0, 0, 0);

  return target < today;
}

/**
 * Checks if a license is expired.
 */
function isLicenseExpired(dateStr, referenceDate = new Date()) {
  return isDateInPast(dateStr, referenceDate);
}

/**
 * Sanitizes shop profile fields to clean strings.
 */
function sanitizeShopProfile(profile = {}) {
  return {
    shop_name: String(profile.shop_name || '').trim(),
    shop_license_no: String(profile.shop_license_no || '').trim(),
    shop_license_validity: String(profile.shop_license_validity || '').trim(),
    shop_phone: String(profile.shop_phone || '').trim(),
    pharmacist_name: String(profile.pharmacist_name || '').trim(),
    pharmacist_phone: String(profile.pharmacist_phone || '').trim(),
    pharmacist_license_validity: String(profile.pharmacist_license_validity || '').trim(),
  };
}

/**
 * Validates shop profile data.
 * Returns { isValid: boolean, errors: Record<string, string> }
 */
function validateShopProfile(profile = {}) {
  const errors = {};

  if (profile.shop_phone && !isValidOptionalPhone(profile.shop_phone)) {
    errors.shop_phone = 'Shop phone number must be a valid 10-digit number';
  }

  if (profile.pharmacist_phone && !isValidOptionalPhone(profile.pharmacist_phone)) {
    errors.pharmacist_phone = 'Pharmacist phone number must be a valid 10-digit number';
  }

  if (profile.shop_license_validity && !isValidOptionalDate(profile.shop_license_validity)) {
    errors.shop_license_validity = 'Invalid date format (e.g. YYYY-MM-DD)';
  }

  if (profile.pharmacist_license_validity && !isValidOptionalDate(profile.pharmacist_license_validity)) {
    errors.pharmacist_license_validity = 'Invalid date format (e.g. YYYY-MM-DD)';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

module.exports = {
  isValidOptionalPhone,
  isValidOptionalDate,
  isDateInPast,
  isLicenseExpired,
  sanitizeShopProfile,
  validateShopProfile,
};
