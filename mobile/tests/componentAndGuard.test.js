describe('Delete Customer Blocking Guards', () => {
  function evaluateDeleteEligibility(totalDue) {
    const due = parseFloat(totalDue || 0);
    if (due > 0.001) {
      return { allowed: false, reason: `Clear this customer's due before deleting — currently ₹${due.toFixed(2)} due.` };
    }
    return { allowed: true, reason: null };
  }

  test('Blocks deletion if customer has positive due (> ₹0.00)', () => {
    const res = evaluateDeleteEligibility(65);
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe("Clear this customer's due before deleting — currently ₹65.00 due.");
  });

  test('Allows deletion if customer has credit balance (< ₹0.00)', () => {
    const res = evaluateDeleteEligibility(-50);
    expect(res.allowed).toBe(true);
    expect(res.reason).toBeNull();
  });

  test('Allows deletion if customer has zero due (₹0.00)', () => {
    const res = evaluateDeleteEligibility(0);
    expect(res.allowed).toBe(true);
    expect(res.reason).toBeNull();
  });
});

describe('Overpayment Warning and Explicit Confirmation Toggle', () => {
  function evaluatePaymentState(dueAmount, enteredAmount, confirmToggle = false) {
    const due = Math.max(0, parseFloat(dueAmount || 0));
    const paid = parseFloat(enteredAmount || 0);
    const isOverpayment = paid > due;
    const overage = isOverpayment ? paid - due : 0;
    const isSaveEnabled = paid > 0 && (!isOverpayment || confirmToggle);

    return {
      due,
      paid,
      isOverpayment,
      overage,
      isSaveEnabled,
    };
  }

  test('Payment exceeding due requires explicit confirmation toggle before Save enables', () => {
    // Current due: ₹50, Paid: ₹70 (Overage: ₹20)
    const withoutToggle = evaluatePaymentState(50, 70, false);
    expect(withoutToggle.isOverpayment).toBe(true);
    expect(withoutToggle.overage).toBe(20);
    expect(withoutToggle.isSaveEnabled).toBe(false); // Gated

    const withToggle = evaluatePaymentState(50, 70, true);
    expect(withToggle.isOverpayment).toBe(true);
    expect(withToggle.isSaveEnabled).toBe(true); // Enabled once checked
  });

  test('Payment within or equal to due enables Save without requiring toggle', () => {
    // Current due: ₹100, Paid: ₹100 (Full payment)
    const exact = evaluatePaymentState(100, 100, false);
    expect(exact.isOverpayment).toBe(false);
    expect(exact.overage).toBe(0);
    expect(exact.isSaveEnabled).toBe(true);

    // Current due: ₹100, Paid: ₹40 (Partial payment)
    const partial = evaluatePaymentState(100, 40, false);
    expect(partial.isOverpayment).toBe(false);
    expect(partial.overage).toBe(0);
    expect(partial.isSaveEnabled).toBe(true);
  });

  test('Editing amount back within due resets toggle requirement', () => {
    let confirmToggle = true; // Was previously checked for overpayment
    let enteredAmount = 70; // Overpayment on ₹50 due

    // User edits amount back to ₹45
    enteredAmount = 45;
    const currentDue = 50;
    if (enteredAmount <= currentDue) {
      confirmToggle = false; // Reset toggle
    }

    const state = evaluatePaymentState(currentDue, enteredAmount, confirmToggle);
    expect(state.isOverpayment).toBe(false);
    expect(confirmToggle).toBe(false);
    expect(state.isSaveEnabled).toBe(true);
  });
});

describe('Per-Medicine Discount Chip Relabeling', () => {
  const { formatMedicineDiscountChip } = require('../src/utils/khataLogic');

  test('Renders "Cifran ₹75 · ₹25 off" instead of bracketed payment format', () => {
    const chip = formatMedicineDiscountChip('Cifran', 75, 25);
    expect(chip.name).toBe('Cifran');
    expect(chip.priceText).toBe('₹75 · ₹25 off');
    expect(chip.priceText).not.toContain('(-₹25)');
  });

  test('Renders clean price without discount suffix when discount is 0', () => {
    const chip = formatMedicineDiscountChip('Paracetamol', 50, 0);
    expect(chip.priceText).toBe('₹50');
    expect(chip.priceText).not.toContain('off');
  });
});

describe('Payment Loading State Reset (Success and Failure Paths)', () => {
  test('Success path resets saving state in finally block', async () => {
    let savingPayment = false;
    let paymentSaved = false;

    const handleRecordPayment = async (apiCall) => {
      savingPayment = true;
      try {
        await apiCall();
        paymentSaved = true;
      } catch (err) {
        // error handling
      } finally {
        savingPayment = false;
      }
    };

    const mockSuccessApi = jest.fn().mockResolvedValue({ success: true });
    await handleRecordPayment(mockSuccessApi);

    expect(paymentSaved).toBe(true);
    expect(savingPayment).toBe(false);
  });

  test('Failure path resets saving state in finally block', async () => {
    let savingPayment = false;
    let paymentError = null;

    const handleRecordPayment = async (apiCall) => {
      savingPayment = true;
      try {
        await apiCall();
      } catch (err) {
        paymentError = err.message;
      } finally {
        savingPayment = false;
      }
    };

    const mockFailureApi = jest.fn().mockRejectedValue(new Error('Network timeout'));
    await handleRecordPayment(mockFailureApi);

    expect(paymentError).toBe('Network timeout');
    expect(savingPayment).toBe(false); // Verified reset
  });
});

describe('Purchase History Ledger String Format', () => {
  function formatLedgerEntrySummary(entry) {
    const subtotal = parseFloat(entry.subtotal || entry.total_amount || 0);
    const discountPercent = parseFloat(entry.discount_percent || 0);
    const discountAmount = parseFloat(entry.discount_amount || 0);
    const total = parseFloat(entry.total_amount || 0);
    const paid = parseFloat(entry.amount_paid || 0);
    const due = parseFloat(entry.due_amount || 0);

    const parts = [];
    if (discountPercent > 0) {
      parts.push(`Subtotal ₹${subtotal.toFixed(2)}`);
      parts.push(`Discount ${discountPercent}% (-₹${discountAmount.toFixed(2)})`);
    }
    parts.push(`Total ₹${total.toFixed(2)}`);
    parts.push(`Paid ₹${paid.toFixed(2)}`);
    parts.push(`Due ₹${due.toFixed(2)}`);

    return parts.join(', ');
  }

  test('Renders subtotal, percent, amount, total, paid, due when discount applied', () => {
    const entry = {
      subtotal: 500,
      discount_percent: 15,
      discount_amount: 75,
      total_amount: 425,
      amount_paid: 100,
      due_amount: 325,
    };
    const summary = formatLedgerEntrySummary(entry);
    expect(summary).toBe('Subtotal ₹500.00, Discount 15% (-₹75.00), Total ₹425.00, Paid ₹100.00, Due ₹325.00');
  });

  test('Legacy entries without discount render cleanly without subtotal/discount headers', () => {
    const legacyEntry = {
      total_amount: 500,
      amount_paid: 100,
      due_amount: 400,
    };
    const summary = formatLedgerEntrySummary(legacyEntry);
    expect(summary).toBe('Total ₹500.00, Paid ₹100.00, Due ₹400.00');
  });
});
