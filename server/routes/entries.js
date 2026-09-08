const express = require('express');
const router = express.Router();
const { getDb, addEntry } = require('../db/database');

/**
 * POST /api/entries
 * Create a new purchase entry with line items atomically
 */
router.post('/', (req, res) => {
  try {
    const { customer_id, customerId, total_amount, totalAmount, amount_paid, amountPaid, medicines, entry_date, entryDate } = req.body;

    const targetCustomerId = parseInt(customer_id || customerId, 10);
    if (!targetCustomerId) {
      return res.status(400).json({ error: 'Valid customer_id is required' });
    }

    if (!medicines || !Array.isArray(medicines) || medicines.length === 0) {
      return res.status(400).json({ error: 'At least one medicine is required' });
    }

    const total = parseFloat(total_amount !== undefined ? total_amount : totalAmount);
    const paid = parseFloat(amount_paid !== undefined ? amount_paid : (amountPaid !== undefined ? amountPaid : 0));

    if (isNaN(total) || total <= 0) {
      return res.status(400).json({ error: 'Total amount must be greater than 0' });
    }

    if (isNaN(paid) || paid < 0) {
      return res.status(400).json({ error: 'Amount paid cannot be negative' });
    }

    if (paid > total) {
      return res.status(400).json({ error: 'Amount paid cannot exceed total purchase amount' });
    }

    const result = addEntry({
      customerId: targetCustomerId,
      totalAmount: total,
      amountPaid: paid,
      medicines,
      entryDate: entry_date || entryDate,
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Create entry error:', err);
    res.status(400).json({ error: err.message || 'Failed to record entry' });
  }
});

/**
 * GET /api/entries?customer_id={id}&page=1&limit=10
 * List entries for a customer with medicines line items
 */
router.get('/', (req, res) => {
  try {
    const customerId = parseInt(req.query.customer_id || req.query.customerId, 10);
    if (!customerId) {
      return res.status(400).json({ error: 'customer_id parameter is required' });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const db = getDb();

    const countRow = db.prepare(`SELECT COUNT(*) as count FROM entries WHERE customer_id = ?`).get(customerId);
    const totalCount = countRow ? countRow.count : 0;

    const entries = db.prepare(`
      SELECT entry_id, customer_id, entry_date, total_amount, amount_paid, due_amount
      FROM entries
      WHERE customer_id = ?
      ORDER BY entry_date DESC, entry_id DESC
      LIMIT ? OFFSET ?
    `).all(customerId, limit, offset);

    // Fetch line items for each entry
    const getMedsStmt = db.prepare(`
      SELECT id, entry_id, medicine_name, price
      FROM entry_medicine
      WHERE entry_id = ?
      ORDER BY id ASC
    `);

    const enrichedEntries = entries.map((e) => {
      const items = getMedsStmt.all(e.entry_id);
      return {
        ...e,
        medicines: items,
        medicines_summary: items.map((i) => i.medicine_name).join(', '),
      };
    });

    res.json({
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      entries: enrichedEntries,
    });
  } catch (err) {
    console.error('List entries error:', err);
    res.status(500).json({ error: 'Failed to retrieve entries' });
  }
});

/**
 * GET /api/entries/:id
 * Retrieve single entry with line items
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
      return res.status(404).json({ error: 'Entry not found' });
    }

    const medicines = db.prepare(`
      SELECT id, medicine_name, price
      FROM entry_medicine
      WHERE entry_id = ?
      ORDER BY id ASC
    `).all(entryId);

    res.json({
      ...entry,
      medicines,
    });
  } catch (err) {
    console.error('Get entry error:', err);
    res.status(500).json({ error: 'Failed to retrieve entry' });
  }
});

module.exports = router;
