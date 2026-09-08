const express = require('express');
const router = express.Router();
const { getDb, getCustomerDue } = require('../db/database');
const { performBackup, listBackups } = require('../services/backupService');

/**
 * GET /api/reports/dues
 * All customers with total_due > 0, sorted by amount, name, or village
 */
router.get('/dues', (req, res) => {
  try {
    const { sortBy = 'amount', order = 'desc', village } = req.query;
    const db = getDb();

    // Fetch all customers with their last visit date
    const customers = db.prepare(`
      SELECT
        c.customer_id,
        c.phone_number,
        c.name,
        c.village,
        c.address,
        (
          SELECT MAX(entry_date)
          FROM entries e
          WHERE e.customer_id = c.customer_id
        ) AS last_visit,
        (
          SELECT MAX(pay_date)
          FROM payments p
          WHERE p.customer_id = c.customer_id
        ) AS last_payment
      FROM customers c
    `).all();

    // Compute derived total_due for each customer
    let debtors = customers
      .map((c) => {
        const totalDue = getCustomerDue(c.customer_id);
        return {
          ...c,
          total_due: totalDue,
        };
      })
      .filter((c) => c.total_due > 0);

    // Filter by village if provided
    if (village && village.trim()) {
      debtors = debtors.filter((c) =>
        (c.village || '').toLowerCase().includes(village.trim().toLowerCase())
      );
    }

    // Sort
    debtors.sort((a, b) => {
      if (sortBy === 'name') {
        return order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      } else if (sortBy === 'village') {
        const vA = a.village || '';
        const vB = b.village || '';
        return order === 'asc' ? vA.localeCompare(vB) : vB.localeCompare(vA);
      } else {
        // Default: amount
        return order === 'asc' ? a.total_due - b.total_due : b.total_due - a.total_due;
      }
    });

    const totalOutstanding = Math.round(debtors.reduce((sum, c) => sum + c.total_due, 0) * 100) / 100;

    // Village breakdown
    const villageBreakdown = {};
    for (const c of debtors) {
      const v = c.village || 'Other';
      villageBreakdown[v] = Math.round(((villageBreakdown[v] || 0) + c.total_due) * 100) / 100;
    }

    res.json({
      totalOutstanding,
      customerCount: debtors.length,
      villageBreakdown,
      customers: debtors,
    });
  } catch (err) {
    console.error('Dues report error:', err);
    res.status(500).json({ error: 'Failed to generate dues report' });
  }
});

/**
 * POST /api/reports/backup
 * Trigger manual database backup
 */
router.post('/backup', (req, res) => {
  try {
    const result = performBackup(true);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Backup failed', details: err.message });
  }
});

/**
 * GET /api/reports/backups
 * List all existing backups
 */
router.get('/backups', (req, res) => {
  try {
    const backups = listBackups();
    res.json(backups);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

module.exports = router;
