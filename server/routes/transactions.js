const express = require('express');
const router = express.Router();
const { getDb, executeSale, getCustomerDue } = require('../db/database');
const { generateBillPdf } = require('../services/pdfService');

/**
 * POST /api/transactions
 * Create a new bill/sale atomically
 * Decrements medicine stock, logs stock changes, computes due
 */
router.post('/', (req, res) => {
  try {
    const { customerId, items, amountPaid } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer is required for the transaction' });
    }

    if (!items || !items.length) {
      return res.status(400).json({ error: 'Cart must contain at least one item' });
    }

    const saleResult = executeSale({
      customerId: parseInt(customerId, 10),
      items,
      amountPaid: amountPaid !== undefined ? parseFloat(amountPaid) : 0,
    });

    res.status(201).json(saleResult);
  } catch (err) {
    console.error('Sale transaction error:', err);
    res.status(400).json({ error: err.message || 'Transaction failed' });
  }
});

/**
 * GET /api/transactions/:id
 * Retrieve single transaction with line items and customer info
 */
router.get('/:id', (req, res) => {
  try {
    const txnId = parseInt(req.params.id, 10);
    const db = getDb();

    const txn = db.prepare(`
      SELECT
        t.transaction_id,
        t.customer_id,
        t.txn_date,
        t.bill_total,
        t.amount_paid,
        t.due_amount,
        c.name AS customer_name,
        c.phone_number,
        c.village,
        c.address
      FROM transactions t
      JOIN customers c ON t.customer_id = c.customer_id
      WHERE t.transaction_id = ?
    `).get(txnId);

    if (!txn) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const items = db.prepare(`
      SELECT
        ti.item_id,
        ti.medicine_id,
        ti.quantity,
        ti.price_each,
        (ti.quantity * ti.price_each) AS line_total,
        m.name AS medicine_name
      FROM transaction_items ti
      JOIN medicines m ON ti.medicine_id = m.medicine_id
      WHERE ti.transaction_id = ?
    `).all(txnId);

    const totalDue = getCustomerDue(txn.customer_id);

    res.json({
      ...txn,
      items,
      totalDue,
    });
  } catch (err) {
    console.error('Get transaction error:', err);
    res.status(500).json({ error: 'Failed to retrieve transaction' });
  }
});

/**
 * GET /api/transactions/:id/pdf
 * Stream generated PDF receipt
 */
router.get('/:id/pdf', (req, res) => {
  try {
    const txnId = parseInt(req.params.id, 10);
    const db = getDb();

    const txn = db.prepare(`
      SELECT
        t.transaction_id,
        t.customer_id,
        t.txn_date,
        t.bill_total,
        t.amount_paid,
        t.due_amount,
        c.name AS customer_name,
        c.phone_number,
        c.village,
        c.address
      FROM transactions t
      JOIN customers c ON t.customer_id = c.customer_id
      WHERE t.transaction_id = ?
    `).get(txnId);

    if (!txn) {
      return res.status(404).send('Transaction not found');
    }

    const items = db.prepare(`
      SELECT
        ti.item_id,
        ti.medicine_id,
        ti.quantity,
        ti.price_each,
        m.name
      FROM transaction_items ti
      JOIN medicines m ON ti.medicine_id = m.medicine_id
      WHERE ti.transaction_id = ?
    `).all(txnId);

    const totalDue = getCustomerDue(txn.customer_id);

    const billData = {
      ...txn,
      items,
      totalDue,
    };

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=bill_${txnId}.pdf`);

    generateBillPdf(billData, res);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).send('Error generating PDF bill');
  }
});

/**
 * GET /api/transactions
 * Recent transactions list with customer name
 */
router.get('/', (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const db = getDb();

    const txns = db.prepare(`
      SELECT
        t.transaction_id,
        t.customer_id,
        t.txn_date,
        t.bill_total,
        t.amount_paid,
        t.due_amount,
        c.name AS customer_name,
        c.phone_number,
        c.village,
        (SELECT COUNT(*) FROM transaction_items ti WHERE ti.transaction_id = t.transaction_id) AS item_count
      FROM transactions t
      JOIN customers c ON t.customer_id = c.customer_id
      ORDER BY t.txn_date DESC, t.transaction_id DESC
      LIMIT ?
    `).all(limit);

    res.json(txns);
  } catch (err) {
    console.error('List transactions error:', err);
    res.status(500).json({ error: 'Failed to list transactions' });
  }
});

module.exports = router;
