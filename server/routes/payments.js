const express = require('express');
const router = express.Router();
const { getDb, recordPayment, getCustomerDue } = require('../db/database');

/**
 * POST /api/payments
 * Record payment to reduce customer due
 */
router.post('/', (req, res) => {
  try {
    const { customer_id, customerId, amount, note, allowOverpayment, allow_overpayment } = req.body;

    const targetCustomerId = parseInt(customer_id || customerId, 10);
    if (!targetCustomerId) {
      return res.status(400).json({ error: 'Valid customer_id is required' });
    }

    const cleanAmount = parseFloat(amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0' });
    }

    const currentDue = getCustomerDue(targetCustomerId);
    const allowOverride = allowOverpayment || allow_overpayment;

    if (cleanAmount > currentDue && !allowOverride) {
      return res.status(400).json({
        error: `Payment of ₹${cleanAmount.toFixed(2)} exceeds current due of ₹${currentDue.toFixed(2)}`,
        exceedsDue: true,
        currentDue,
        attemptedAmount: cleanAmount,
        overage: Math.round((cleanAmount - currentDue) * 100) / 100,
      });
    }

    const result = recordPayment({
      customerId: targetCustomerId,
      amount: cleanAmount,
      note: note || 'Cash counter settlement',
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Record payment error:', err);
    res.status(400).json({ error: err.message || 'Failed to record payment' });
  }
});

/**
 * GET /api/payments?customer_id={id}
 * List payments for customer (or all recent payments)
 */
router.get('/', (req, res) => {
  try {
    const customerId = req.query.customer_id || req.query.customerId;
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 30);
    const db = getDb();

    let query = `
      SELECT
        p.payment_id,
        p.customer_id,
        p.pay_date,
        p.amount,
        p.note,
        c.name AS customer_name,
        c.phone_number,
        c.village
      FROM payments p
      JOIN customers c ON p.customer_id = c.customer_id
    `;
    const params = [];

    if (customerId) {
      query += ` WHERE p.customer_id = ?`;
      params.push(parseInt(customerId, 10));
    }

    query += ` ORDER BY p.pay_date DESC, p.payment_id DESC LIMIT ?`;
    params.push(limit);

    const payments = db.prepare(query).all(...params);
    res.json(payments);
  } catch (err) {
    console.error('List payments error:', err);
    res.status(500).json({ error: 'Failed to retrieve payments' });
  }
});

module.exports = router;
