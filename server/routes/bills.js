const express = require('express');
const router = express.Router();
const { getDb, getCustomerDue } = require('../db/database');
const { generateBillPdf } = require('../services/pdfService');

/**
 * GET /api/bills/:entry_id
 * Stream generated PDF bill for an entry
 */
router.get('/:id', (req, res) => {
  try {
    const entryId = parseInt(req.params.id, 10);
    const db = getDb();

    const entry = db.prepare(`
      SELECT
        e.entry_id,
        e.customer_id,
        e.entry_date,
        e.total_amount,
        e.amount_paid,
        e.due_amount,
        c.name AS customer_name,
        c.phone_number,
        c.village,
        c.address
      FROM entries e
      JOIN customers c ON e.customer_id = c.customer_id
      WHERE e.entry_id = ?
    `).get(entryId);

    if (!entry) {
      return res.status(404).send('Entry not found');
    }

    const medicines = db.prepare(`
      SELECT id, medicine_name, price
      FROM entry_medicine
      WHERE entry_id = ?
      ORDER BY id ASC
    `).all(entryId);

    const totalDue = getCustomerDue(entry.customer_id);

    const billData = {
      ...entry,
      medicines,
      totalDue,
    };

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=bill_${entryId}.pdf`);

    generateBillPdf(billData, res);
  } catch (err) {
    console.error('PDF bill error:', err);
    res.status(500).send('Error generating PDF bill');
  }
});

module.exports = router;
