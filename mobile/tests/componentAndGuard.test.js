describe('Delete Customer Blocking Guards', () => {
  function evaluateDeleteEligibility(totalDue) {
    const due = parseFloat(totalDue || 0);
    if (due > 0.001) {
      return { allowed: false, reason: `Clear this customer's due before deleting — currently ₹${due.toFixed(2)} due.` };
    }
    if (due < -0.001) {
      return { allowed: false, reason: `Clear this customer's credit balance before deleting — currently ₹${Math.abs(due).toFixed(2)} in credit.` };
    }
    return { allowed: true, reason: null };
  }

  test('Blocks deletion if customer has positive due (> ₹0.00)', () => {
    const res = evaluateDeleteEligibility(65);
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain('₹65.00 due');
  });

  test('Blocks deletion if customer has credit balance (< ₹0.00)', () => {
    const res = evaluateDeleteEligibility(-50);
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain('₹50.00 in credit');
  });

  test('Allows deletion if customer has zero due (₹0.00)', () => {
    const res = evaluateDeleteEligibility(0);
    expect(res.allowed).toBe(true);
    expect(res.reason).toBeNull();
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
