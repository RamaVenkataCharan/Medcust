const { computeBill, MODE } = require('../src/utils/discountEngine');

describe('discountEngine', () => {
  it('computes bill for worked example', () => {
    // worked example: current due 65; Cifran 75 at 10%, Dolo 15, paid 25
    // Net Cifran = 75 - 7.5 = 67.50. Dolo = 15. Subtotal = 90. Discount = 7.50. Grand Total = 82.50.
    // Paid = 25. Due Created = 57.50. Updated balance = 65 + 57.50 = 122.50.
    const bill = computeBill({
      lines: [
        { name: 'Cifran', price: 75, discount: 10, mode: MODE.PERCENT },
        { name: 'Dolo', price: 15, discount: 0, mode: MODE.AMOUNT }
      ],
      paidNow: 25,
      currentDue: 65
    });

    expect(bill.ok).toBe(true);
    expect(bill.rupees.subtotal).toBe(90.00);
    expect(bill.rupees.discountTotal).toBe(7.50);
    expect(bill.rupees.grandTotal).toBe(82.50);
    expect(bill.rupees.dueCreated).toBe(57.50);
    expect(bill.rupees.updatedBalance).toBe(122.50);
  });
});
