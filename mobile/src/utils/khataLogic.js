/**
 * Pure Khata Business Logic & Calculations.
 * Shared between Native (expo-sqlite) and Web drivers to prevent logic drift.
 */

/**
 * Validates and normalizes Indian mobile phone numbers.
 * Enforces strict TRAI 10-digit mobile standards (starting with 6, 7, 8, 9).
 * Prevents silent truncation of >10 digits.
 */
export function validatePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string' && typeof phone !== 'number') {
    return { isValid: false, error: 'Phone number is required.', cleaned: '' };
  }

  let raw = String(phone).trim();
  // Strip country code if present (+91 or 91 with 12 digits)
  if (raw.startsWith('+91')) {
    raw = raw.slice(3).trim();
  } else if (raw.startsWith('91') && raw.replace(/\D/g, '').length === 12) {
    raw = raw.replace(/\D/g, '').slice(2);
  } else if (raw.startsWith('0') && raw.replace(/\D/g, '').length === 11) {
    raw = raw.replace(/\D/g, '').slice(1);
  }

  const cleaned = raw.replace(/\D/g, '');

  if (cleaned.length === 0) {
    return { isValid: false, error: 'Please enter a mobile phone number.', cleaned: '' };
  }

  if (cleaned.length < 10) {
    return {
      isValid: false,
      error: `Phone number is too short (${cleaned.length}/10 digits).`,
      cleaned,
    };
  }

  if (cleaned.length > 10) {
    return {
      isValid: false,
      error: `Phone number has too many digits (${cleaned.length} digits). Please enter exactly 10 digits.`,
      cleaned,
    };
  }

  if (!/^[6-9]/.test(cleaned)) {
    return {
      isValid: false,
      error: `Invalid starting digit "${cleaned[0]}". Indian mobile numbers must begin with 6, 7, 8, or 9.`,
      cleaned,
    };
  }

  return { isValid: true, error: null, cleaned };
}

/**
 * Sanitizes phone numbers into standard 10-digit mobile format.
 */
export function cleanPhoneNumber(phone) {
  const result = validatePhoneNumber(phone);
  if (result.isValid) return result.cleaned;
  if (!phone) return '';
  return String(phone).replace(/\D/g, '').slice(-10);
}

/**
 * Calculates bill-level discount.
 * Form: subtotal - (subtotal * percent / 100).
 * Rounds discountAmount to 2 decimal places using half-up rounding.
 * Clamps discount percent to [0, 100].
 */
export function calculateBillDiscount(subtotal, discountPercent) {
  const s = Math.max(0, parseFloat(subtotal) || 0);
  const rawP = parseFloat(discountPercent);
  const p = isNaN(rawP) ? 0 : Math.min(100, Math.max(0, rawP));

  const rawDiscount = s * (p / 100);
  // Half-up 2 decimal places
  const discountAmount = Math.round(rawDiscount * 100) / 100;
  const netTotal = parseFloat(Math.max(0, s - discountAmount).toFixed(2));

  return {
    subtotal: parseFloat(s.toFixed(2)),
    discountPercent: p,
    discountAmount: parseFloat(discountAmount.toFixed(2)),
    netTotal,
  };
}

/**
 * Calculates due added for a purchase entry.
 * due_amount = max(0, total_amount - amount_paid)
 */
export function calculateEntryDue(totalAmount, amountPaid) {
  const total = parseFloat(totalAmount) || 0;
  const paid = parseFloat(amountPaid) || 0;
  return parseFloat(Math.max(0, total - paid).toFixed(2));
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
 * Invariant: total_due = SUM(due_amount) across all entries.
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
  if (trimmed.length < 3 || trimmed.length > 80) return false;
  if (!/[a-zA-Z]/.test(trimmed)) return false;
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

/**
 * Calculates net line total for a medicine row.
 * Clamps discount to >= 0, and line total to >= 0 (never negative).
 * line_total = max(0, price - max(0, discount))
 */
export function calculateLineTotal(price, discount) {
  const p = parseFloat(price);
  const d = parseFloat(discount);
  const validPrice = isNaN(p) ? 0 : p;
  const validDiscount = isNaN(d) ? 0 : Math.max(0, d);
  return parseFloat(Math.max(0, validPrice - validDiscount).toFixed(2));
}

/**
 * Calculates total purchase amount across all medicine rows, summing post-discount line totals.
 */
export function calculatePurchaseTotal(medicines = []) {
  const sum = medicines.reduce((acc, med) => {
    return acc + calculateLineTotal(med.price, med.discount);
  }, 0);
  return parseFloat(sum.toFixed(2));
}

/**
 * Calculates remaining days in the 30-day Recycle Bin retention window before permanent auto-purge.
 */
export function calculateDaysLeftInBin(deletedAt, currentDate = new Date()) {
  if (!deletedAt) return 30;
  const deletedTime = new Date(deletedAt).getTime();
  const currentTime = new Date(currentDate).getTime();
  const diffDays = Math.floor((currentTime - deletedTime) / (1000 * 60 * 60 * 24));
  return Math.max(0, 30 - diffDays);
}

/**
 * Formats medicine chip label with discount relabeled to " · ₹X off" (e.g. "Cifran ₹75 · ₹25 off")
 * to prevent confusion with customer payments.
 */
export function formatMedicineDiscountChip(name, netPrice, discount) {
  const p = parseFloat(netPrice || 0);
  const d = parseFloat(discount || 0);
  let pricePart = p > 0 ? `₹${p.toFixed(0)}` : '';
  if (d > 0) {
    pricePart = pricePart ? `${pricePart} · ₹${d.toFixed(0)} off` : `₹${d.toFixed(0)} off`;
  }
  return {
    name: name || '',
    priceText: pricePart,
  };
}
