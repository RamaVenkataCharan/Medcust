/**
 * Pure Khata Business Logic & Calculations.
 * Shared between Native (expo-sqlite) and Web drivers to prevent logic drift.
 */

/**
 * Sanitizes phone numbers into standard 10-digit mobile format.
 */
export function cleanPhoneNumber(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '').slice(-10);
}

/**
 * Calculates due added for a purchase entry.
 * due_amount = total_amount - amount_paid
 */
export function calculateEntryDue(totalAmount, amountPaid) {
  const total = parseFloat(totalAmount) || 0;
  const paid = parseFloat(amountPaid) || 0;
  return parseFloat((total - paid).toFixed(2));
}

/**
 * Calculates negative due for a due-clearing payment.
 * (total_amount = 0, amount_paid = X, due_amount = -X)
 */
export function calculatePaymentDue(amountPaid) {
  const paid = parseFloat(amountPaid) || 0;
  return parseFloat((-paid).toFixed(2));
}

/**
 * Calculates customer running balance across all ledger entries.
 */
export function calculateCustomerTotalDue(entries = []) {
  const sum = entries.reduce((acc, entry) => {
    return acc + (parseFloat(entry.due_amount) || 0);
  }, 0);
  return parseFloat(sum.toFixed(2));
}

/**
 * Determines whether an entry represents a payment received vs a medicine purchase.
 */
export function isPaymentEntry(entry) {
  if (!entry) return false;
  const total = parseFloat(entry.total_amount || 0);
  const paid = parseFloat(entry.amount_paid || 0);
  const hasNoMeds = !entry.medicines || entry.medicines.length === 0;

  return (total === 0 && paid > 0) || (hasNoMeds && paid > 0);
}

/**
 * Validates whether a typed string is a legitimate medicine/product name.
 * Filters out short junk, keyboard smash, and test filler (e.g. "It Is", "Yu", "test").
 */
export function isValidMedicineName(rawName) {
  if (!rawName || typeof rawName !== 'string') return false;
  const trimmed = rawName.trim();
  // Medicine names must be at least 3 characters and not excessively long
  if (trimmed.length < 3 || trimmed.length > 80) return false;
  // Must contain letters (not pure numbers or symbols)
  if (!/[a-zA-Z]/.test(trimmed)) return false;
  // Reject common garbage words/filler typed during quick testing
  const lower = trimmed.toLowerCase();
  const junkList = [
    'it is', 'yu', 'test', 'testing', 'asdf', 'qwerty', 'temp', 'junk',
    'sample', 'na', 'n/a', 'none', 'null', 'undefined', 'foo', 'bar', 'xx'
  ];
  if (junkList.includes(lower)) return false;
  return true;
}

/**
 * Sanitizes medicine name by trimming and collapsing multiple spaces.
 */
export function cleanMedicineName(rawName) {
  if (!rawName) return '';
  return String(rawName).trim().replace(/\s+/g, ' ');
}

