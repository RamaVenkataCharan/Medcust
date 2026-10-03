const express = require('express');
const router = express.Router();
const {
  getDb,
  getCustomerDue,
  getCustomerStats,
  softDeleteCustomer,
  restoreCustomer,
  getTrashCustomers,
  permanentDeleteCustomer,
} = require('../db/database');

/**
 * GET /api/customers/search?q=...
 * Primary search by 10-digit phone number, fallback by name or village (active customers only)
 */
router.get('/search', (req, res) => {
  try {
    const query = (req.query.q || '').trim();
    if (!query) {
      return res.json([]);
    }

    const db = getDb();
    const isNumeric = /^\d+$/.test(query);

    let rows = [];
    if (isNumeric) {
      // Exact match first, then prefix match
      rows = db.prepare(`
        SELECT customer_id, phone_number, name, village, address, created_at, updated_at
        FROM customers
        WHERE phone_number LIKE ? AND deleted_at IS NULL
        ORDER BY
          CASE WHEN phone_number = ? THEN 0 ELSE 1 END,
          phone_number ASC
        LIMIT 15
      `).all(`${query}%`, query);
    } else {
      // Substring match on name or village
      rows = db.prepare(`
        SELECT customer_id, phone_number, name, village, address, created_at, updated_at
        FROM customers
        WHERE (name LIKE ? OR village LIKE ?) AND deleted_at IS NULL
        ORDER BY name ASC
        LIMIT 15
      `).all(`%${query}%`, `%${query}%`);
    }

    const results = rows.map((c) => ({
      ...c,
      total_due: getCustomerDue(c.customer_id),
    }));

    res.json(results);
  } catch (err) {
    console.error('Customer search error:', err);
    res.status(500).json({ error: 'Failed to search customers' });
  }
});

/**
 * GET /api/customers/trash
 * List all soft-deleted customers in the Recycle Bin
 * NOTE: Must be registered BEFORE /:id
 */
router.get('/trash', (req, res) => {
  try {
    const trash = getTrashCustomers();
    res.json(trash);
  } catch (err) {
    console.error('List trash error:', err);
    res.status(500).json({ error: 'Failed to retrieve recycle bin customers' });
  }
});

/**
 * GET /api/customers/:id
 * Full profile with computed due, last visit, and lifetime spend (active customers only)
 */
router.get('/:id', (req, res) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    if (isNaN(customerId)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    const db = getDb();
    const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ? AND deleted_at IS NULL').get(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const totalDue = getCustomerDue(customerId);
    const stats = getCustomerStats(customerId);

    res.json({
      ...customer,
      total_due: totalDue,
      last_visit: stats.last_visit,
      total_visits: stats.total_visits,
      total_spent: stats.total_spent,
      recently_bought: stats.recently_bought,
    });
  } catch (err) {
    console.error('Get customer error:', err);
    res.status(500).json({ error: 'Failed to retrieve customer' });
  }
});

/**
 * GET /api/customers/:id/stats
 * Total due (computed), last visit, recently bought with frequency
 */
router.get('/:id/stats', (req, res) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    if (isNaN(customerId)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    const db = getDb();
    const customer = db.prepare('SELECT customer_id FROM customers WHERE customer_id = ? AND deleted_at IS NULL').get(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const stats = getCustomerStats(customerId);
    res.json(stats);
  } catch (err) {
    console.error('Customer stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve customer statistics' });
  }
});

/**
 * POST /api/customers
 * Create customer (name, phone [10 digits], village, address)
 */
router.post('/', (req, res) => {
  try {
    const { name, phone_number, village, address } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    const cleanPhone = (phone_number || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ error: 'Phone number must be exactly 10 digits' });
    }

    const db = getDb();

    // Check duplicate
    const existing = db.prepare('SELECT * FROM customers WHERE phone_number = ?').get(cleanPhone);
    if (existing) {
      if (existing.deleted_at) {
        return res.status(409).json({
          error: `Customer with phone ${cleanPhone} (${existing.name}) is in the Recycle Bin. You can restore them instead.`,
          inRecycleBin: true,
          customer: {
            ...existing,
            total_due: getCustomerDue(existing.customer_id),
          },
        });
      }
      return res.status(409).json({
        error: `Customer with phone ${cleanPhone} already exists: ${existing.name} (${existing.village || 'No village'})`,
        existingCustomer: {
          ...existing,
          total_due: getCustomerDue(existing.customer_id),
        },
      });
    }

    const insert = db.prepare(`
      INSERT INTO customers (name, phone_number, village, address)
      VALUES (?, ?, ?, ?)
    `);

    const result = insert.run(
      name.trim(),
      cleanPhone,
      village ? village.trim() : null,
      address ? address.trim() : null
    );

    const newCustomer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      ...newCustomer,
      total_due: 0,
      recently_bought: [],
    });
  } catch (err) {
    console.error('Create customer error:', err);
    res.status(500).json({ error: err.message || 'Failed to create customer' });
  }
});

/**
 * DELETE /api/customers/:id
 * Soft delete customer into the Recycle Bin (blocks if due != 0)
 */
router.delete('/:id', (req, res) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    if (isNaN(customerId)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    const result = softDeleteCustomer(customerId);
    res.json(result);
  } catch (err) {
    console.error('Soft delete customer error:', err);
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || 'Failed to delete customer',
      due: err.due,
    });
  }
});

/**
 * POST /api/customers/:id/restore
 * Restore customer from the Recycle Bin
 */
router.post('/:id/restore', (req, res) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    if (isNaN(customerId)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    const restored = restoreCustomer(customerId);
    res.json(restored);
  } catch (err) {
    console.error('Restore customer error:', err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to restore customer' });
  }
});

/**
 * DELETE /api/customers/:id/permanent
 * Permanently delete customer and all child rows (requires { confirm: "DELETE" })
 */
router.delete('/:id/permanent', (req, res) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    if (isNaN(customerId)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    const { confirm } = req.body || {};
    if (confirm !== 'DELETE') {
      return res.status(400).json({
        error: 'Permanent deletion requires confirmation phrase "DELETE"',
      });
    }

    const result = permanentDeleteCustomer(customerId);
    res.json(result);
  } catch (err) {
    console.error('Permanent delete customer error:', err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to permanently delete customer' });
  }
});

module.exports = router;
