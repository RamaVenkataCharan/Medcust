const express = require('express');
const router = express.Router();
const { getDb, getCustomerDue, getCustomerStats } = require('../db/database');

/**
 * GET /api/customers/search?q=...
 * Primary search by 10-digit phone number, fallback by name or village
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
        WHERE phone_number LIKE ?
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
        WHERE name LIKE ? OR village LIKE ?
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
 * GET /api/customers/:id
 * Full profile with computed due, last visit, and lifetime spend
 */
router.get('/:id', (req, res) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    const db = getDb();

    const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customerId);
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

module.exports = router;
