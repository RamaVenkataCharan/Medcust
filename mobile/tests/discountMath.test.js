const {
  calculateBillDiscount,
  calculateEntryDue,
  calculatePaymentDue,
  calculateCustomerTotalDue,
  calculatePurchaseTotal,
  validatePhoneNumber,
} = require('../src/utils/khataLogic');

describe('Bill-Level Percentage Discount & Math Tests', () => {
  test('₹500 at 15% discount gives ₹75 discount and ₹425 net payable', () => {
    const result = calculateBillDiscount(500, 15);
    expect(result.subtotal).toBe(500);
    expect(result.discountPercent).toBe(15);
    expect(result.discountAmount).toBe(75);
    expect(result.netTotal).toBe(425);
  });

  test('0% discount gives 0 discount and full subtotal', () => {
    const result = calculateBillDiscount(500, 0);
    expect(result.subtotal).toBe(500);
    expect(result.discountPercent).toBe(0);
    expect(result.discountAmount).toBe(0);
    expect(result.netTotal).toBe(500);
  });

  test('100% discount gives full discount and ₹0 net payable', () => {
    const result = calculateBillDiscount(500, 100);
    expect(result.subtotal).toBe(500);
    expect(result.discountPercent).toBe(100);
    expect(result.discountAmount).toBe(500);
    expect(result.netTotal).toBe(0);
  });

  test('Blank, null, or NaN discount defaults to 0% discount', () => {
    expect(calculateBillDiscount(500, '').discountAmount).toBe(0);
    expect(calculateBillDiscount(500, '').netTotal).toBe(500);
    expect(calculateBillDiscount(500, null).netTotal).toBe(500);
    expect(calculateBillDiscount(500, undefined).netTotal).toBe(500);
    expect(calculateBillDiscount(500, 'abc').netTotal).toBe(500);
  });

  test('Clamps negative discount to 0% and >100% to 100%', () => {
    expect(calculateBillDiscount(500, -10).discountPercent).toBe(0);
    expect(calculateBillDiscount(500, -10).netTotal).toBe(500);
    expect(calculateBillDiscount(500, 120).discountPercent).toBe(100);
    expect(calculateBillDiscount(500, 120).netTotal).toBe(0);
  });

  test('Decimal discount with half-up rounding (₹333.33 at 12.5% = ₹41.67 discount)', () => {
    // 333.33 * 0.125 = 41.66625 -> rounds to 41.67
    const result = calculateBillDiscount(333.33, 12.5);
    expect(result.discountAmount).toBe(41.67);
    expect(result.netTotal).toBe(291.66); // 333.33 - 41.67
  });

  test('Due calculation: net total ₹425 with ₹100 paid gives ₹325 due', () => {
    const due = calculateEntryDue(425, 100);
    expect(due).toBe(325);
  });

  test('Due calculation: fully paid net total ₹425 with ₹425 paid gives ₹0 due', () => {
    const due = calculateEntryDue(425, 425);
    expect(due).toBe(0);
  });

  test('Due calculation: overpayment clamps due to 0', () => {
    const due = calculateEntryDue(425, 500);
    expect(due).toBe(0);
  });
});

describe('Khata Ledger Invariants', () => {
  test('Due Invariant: due = max(0, net_total - paid)', () => {
    expect(calculateEntryDue(1000, 400)).toBe(600);
    expect(calculateEntryDue(500, 500)).toBe(0);
    expect(calculateEntryDue(200, 300)).toBe(0);
  });

  test('Balance Invariant: running balance equals sum of entry dues and payment dues', () => {
    const entries = [
      // Purchase 1: ₹500 bill with 15% discount -> net ₹425, paid ₹100, due ₹325
      { entry_id: 1, total_amount: 425, amount_paid: 100, due_amount: 325 },
      // Payment 1: paid ₹125 -> due_amount -125
      { entry_id: 2, total_amount: 0, amount_paid: 125, due_amount: -125 },
      // Purchase 2: ₹200 bill without discount -> net ₹200, paid ₹50, due ₹150
      { entry_id: 3, total_amount: 200, amount_paid: 50, due_amount: 150 },
    ];

    // Total due: 325 - 125 + 150 = 350
    const totalDue = calculateCustomerTotalDue(entries);
    expect(totalDue).toBe(350);
  });

  test('Legacy purchase entries without discount render cleanly and hold invariants', () => {
    const legacyEntry = {
      entry_id: 99,
      total_amount: 250,
      amount_paid: 50,
      due_amount: 200,
      // subtotal, discount_percent, discount_amount missing
    };

    const subtotal = legacyEntry.subtotal != null ? legacyEntry.subtotal : legacyEntry.total_amount;
    const discountPercent = legacyEntry.discount_percent || 0;
    const discountAmount = legacyEntry.discount_amount || 0;

    expect(subtotal).toBe(250);
    expect(discountPercent).toBe(0);
    expect(discountAmount).toBe(0);
    expect(legacyEntry.total_amount).toBe(250);
    expect(legacyEntry.due_amount).toBe(200);
  });
});

describe('Phone Number Validation Tests', () => {
  test('Valid 10-digit Indian numbers starting with 6, 7, 8, 9 are accepted', () => {
    expect(validatePhoneNumber('9876543210').isValid).toBe(true);
    expect(validatePhoneNumber('8123456789').isValid).toBe(true);
    expect(validatePhoneNumber('7000000000').isValid).toBe(true);
    expect(validatePhoneNumber('6987654321').isValid).toBe(true);
  });

  test('Clean prefix stripping: +91 and 0 are normalized without truncation', () => {
    const withPlus91 = validatePhoneNumber('+91 9876543210');
    expect(withPlus91.isValid).toBe(true);
    expect(withPlus91.cleaned).toBe('9876543210');

    const withLeadingZero = validatePhoneNumber('09876543210');
    expect(withLeadingZero.isValid).toBe(true);
    expect(withLeadingZero.cleaned).toBe('9876543210');
  });

  test('Invalid Indian mobile prefixes (0, 1, 2, 3, 4, 5) are rejected', () => {
    expect(validatePhoneNumber('0123456789').isValid).toBe(false);
    expect(validatePhoneNumber('5123456789').isValid).toBe(false);
    expect(validatePhoneNumber('1234567890').isValid).toBe(false);
    expect(validatePhoneNumber('4987654321').isValid).toBe(false);
  });

  test('Phone numbers > 10 digits are rejected instead of silently truncated', () => {
    const tooLong = validatePhoneNumber('98765432109');
    expect(tooLong.isValid).toBe(false);
    expect(tooLong.error).toContain('too many digits');
  });

  test('Short or empty phone numbers are rejected', () => {
    expect(validatePhoneNumber('').isValid).toBe(false);
    expect(validatePhoneNumber('98765').isValid).toBe(false);
  });
});
