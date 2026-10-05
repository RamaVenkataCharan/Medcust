'use strict';

const MODE = Object.freeze({ AMOUNT: 'amount', PERCENT: 'percent' });

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// Rupees (number or "75.50") -> integer paise
const toPaise = (rupees) => {
  const n = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) : 0;
};

// Integer paise -> rupees with exactly 2dp precision (safe to store in a REAL column)
const fromPaise = (p) => Math.round(p) / 100;

/**
 * One medicine row.
 * price    : actual price in rupees
 * discount : number typed by the user
 * mode     : 'amount' (rupees) or 'percent' (0-100, up to 2 decimals)
 */
function computeLine({ price = 0, discount = 0, mode = MODE.AMOUNT } = {}) {
  const pricePaise = Math.max(0, toPaise(price));
  const d = Number(discount) || 0;
  let discountPaise;
  let exceeded;

  if (mode === MODE.PERCENT) {
    exceeded = d > 100 || d < 0;
    const basisPoints = Math.round(clamp(d, 0, 100) * 100); // 12.5% -> 1250
    discountPaise = Math.round((pricePaise * basisPoints) / 10000);
  } else {
    const raw = toPaise(d);
    exceeded = raw > pricePaise || raw < 0;
    discountPaise = clamp(raw, 0, pricePaise);
  }

  return {
    pricePaise,
    discountPaise,
    netPaise: pricePaise - discountPaise,
    exceeded, // true when the input had to be clamped
  };
}

/**
 * Whole bill.
 * lines      : [{ name, price, discount, mode }]
 * paidNow    : rupees paid at the counter
 * currentDue : customer's derived due BEFORE this bill (rupees, may be negative for credit)
 */
function computeBill({ lines = [], paidNow = 0, currentDue = 0 } = {}) {
  const rows = lines.map((l) => ({ ...l, ...computeLine(l) }));

  const subtotal = rows.reduce((s, r) => s + r.pricePaise, 0);
  const discountTotal = rows.reduce((s, r) => s + r.discountPaise, 0);
  const grandTotal = subtotal - discountTotal; // equals sum of net totals by construction
  const paid = Math.max(0, toPaise(paidNow));
  const dueCreated = Math.max(0, grandTotal - paid);
  const updatedBalance = toPaise(currentDue) + dueCreated;

  const errors = [];
  if (!rows.length || grandTotal <= 0) errors.push('TOTAL_NOT_POSITIVE');
  if (rows.some((r) => r.exceeded)) errors.push('DISCOUNT_EXCEEDS_PRICE');
  if (paid > grandTotal) errors.push('PAID_EXCEEDS_TOTAL');

  return {
    rows,
    paise: { subtotal, discountTotal, grandTotal, paid, dueCreated, updatedBalance },
    rupees: {
      subtotal: fromPaise(subtotal),
      discountTotal: fromPaise(discountTotal),
      grandTotal: fromPaise(grandTotal),
      paid: fromPaise(paid),
      dueCreated: fromPaise(dueCreated),
      updatedBalance: fromPaise(updatedBalance),
    },
    errors,
    ok: errors.length === 0,
  };
}

/** Exactly what the database layer should store (percent mode is converted to rupees here). */
function toEntryPayload(bill) {
  return {
    total_amount: bill.rupees.grandTotal,
    amount_paid: bill.rupees.paid,
    due_amount: bill.rupees.dueCreated,
    items: bill.rows.map((r) => ({
      name: String(r.name || '').trim(),
      price: fromPaise(r.pricePaise),
      discount: fromPaise(r.discountPaise),
    })),
  };
}

module.exports = { MODE, toPaise, fromPaise, computeLine, computeBill, toEntryPayload };
