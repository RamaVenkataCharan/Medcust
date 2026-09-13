const express = require('express');
const router = express.Router();
const fs = require('fs');
const config = require('../config');
const { getDb, getCustomerDue } = require('../db/database');
const { performBackup, listBackups, restoreBackup, generateCsvExport } = require('../services/backupService');

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

    // Compute derived total_due for each debtor
    let debtors = customers
      .map((c) => {
        const totalDue = getCustomerDue(c.customer_id);
        if (totalDue <= 0) return null;

        return {
          ...c,
          total_due: totalDue,
        };
      })
      .filter(Boolean);

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
 * GET /api/reports/stats
 * Weekly & monthly store khata analytics
 */
router.get('/stats', (req, res) => {
  try {
    const db = getDb();

    // Monthly sales & collections
    const salesRow = db.prepare(`
      SELECT
        COALESCE(SUM(total_amount), 0) AS sales_month,
        COUNT(*) AS entries_month
      FROM entries
      WHERE entry_date >= datetime('now', 'start of month')
    `).get();

    const collectionRow = db.prepare(`
      SELECT
        COALESCE(SUM(amount), 0) AS collected_month,
        COUNT(*) AS payments_month
      FROM payments
      WHERE pay_date >= datetime('now', 'start of month')
    `).get();

    // All-time active outstanding dues
    const customers = db.prepare('SELECT customer_id FROM customers').all();
    let totalOutstanding = 0;
    let debtorCount = 0;
    for (const c of customers) {
      const due = getCustomerDue(c.customer_id);
      if (due > 0) {
        totalOutstanding += due;
        debtorCount++;
      }
    }

    // Top 5 medicines by purchase frequency in the last 30 days
    const topMedicines = db.prepare(`
      SELECT
        em.medicine_name,
        COUNT(*) AS frequency,
        ROUND(AVG(em.price), 2) AS avg_price
      FROM entry_medicine em
      JOIN entries e ON em.entry_id = e.entry_id
      WHERE e.entry_date >= datetime('now', '-30 days')
      GROUP BY LOWER(em.medicine_name)
      ORDER BY frequency DESC
      LIMIT 5
    `).all();

    res.json({
      salesThisMonth: Math.round((salesRow?.sales_month || 0) * 100) / 100,
      entriesThisMonth: salesRow?.entries_month || 0,
      collectedThisMonth: Math.round((collectionRow?.collected_month || 0) * 100) / 100,
      paymentsThisMonth: collectionRow?.payments_month || 0,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      debtorCount,
      topMedicines,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to generate stats' });
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

/**
 * POST /api/reports/restore
 * Restore database from a backup file with overwrite confirmation
 */
router.post('/restore', (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const result = restoreBackup(filename);
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Restore failed: ' + err.message });
  }
});

/**
 * GET /api/reports/export/sqlite
 * Download current SQLite database file
 */
router.get('/export/sqlite', (req, res) => {
  try {
    if (!fs.existsSync(config.DB_PATH)) {
      return res.status(404).json({ error: 'Database file not found' });
    }

    const filename = `medtrack_export_${new Date().toISOString().slice(0, 10)}.sqlite`;
    res.download(config.DB_PATH, filename);
  } catch (err) {
    res.status(500).json({ error: 'SQLite export failed: ' + err.message });
  }
});

/**
 * GET /api/reports/export/csv
 * Download full ledger CSV export
 */
router.get('/export/csv', (req, res) => {
  try {
    const csvData = generateCsvExport();
    const filename = `medtrack_ledger_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvData);
  } catch (err) {
    res.status(500).json({ error: 'CSV export failed: ' + err.message });
  }
});

module.exports = router;
