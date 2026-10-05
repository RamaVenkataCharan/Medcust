/**
 * Shared formatting utilities for MedTrack.
 * Imported by both CustomerProfileScreen and AddPurchaseScreen.
 */

/**
 * Formats a number as Indian Rupee string with 2 decimal places.
 * e.g. 125000 → "₹1,25,000.00"
 */
export function formatINR(amount) {
  const num = parseFloat(amount) || 0;
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formats a phone number as "98765 43210" (5+5 split, last 10 digits).
 */
export function formatPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  if (digits.length === 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  return phone || '';
}

/**
 * Returns true if a medicine name looks like junk/test data.
 * Rejects strings that are empty, too short, or contain only digits/symbols.
 */
export function isJunkMedicineName(name) {
  if (!name || typeof name !== 'string') return true;
  const trimmed = name.trim();
  if (trimmed.length < 2) return true;
  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(trimmed)) return true;
  return false;
}

/**
 * Converts a discount value to rupees given a mode and actual price.
 * @param {number} value     - Discount value (rupees or percent)
 * @param {'₹'|'%'} mode    - Discount mode
 * @param {number} actualPrice - Actual price for clamping
 * @returns {number}         - Discount in rupees, clamped [0, actualPrice]
 */
export function discountToRupees(value, mode, actualPrice) {
  const actual = parseFloat(actualPrice) || 0;
  const val = parseFloat(value) || 0;
  let rupees = mode === '%' ? Math.round((val / 100) * actual * 100) / 100 : val;
  rupees = Math.max(0, Math.min(rupees, actual));
  return Math.round(rupees * 100) / 100;
}

/**
 * Computes integer paise-safe arithmetic for totals.
 * All input values in rupees → result in rupees.
 */
export function paise(rupees) {
  return Math.round((parseFloat(rupees) || 0) * 100);
}
export function fromPaise(p) {
  return p / 100;
}
