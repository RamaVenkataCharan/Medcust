/**
 * Cases Route — Recovery case CRUD + state transitions
 */

const express = require('express');
const router = express.Router();
const {
  getCasesByState,
  getCaseById,
  createCase,
  updateCaseState,
  generateCasesFromDues,
  getCustomerDue,
  getDb,
} = require('../db/database');

/**
 * GET /api/cases
 * List cases with optional state filter and pagination.
 */
router.get('/', (req, res) => {
  try {
    const { state, limit } = req.query;
    const cases = getCasesByState(state || null, parseInt(limit, 10) || 100);
    res.json({ cases, count: cases.length });
  } catch (err) {
    console.error('List cases error:', err);
    res.status(500).json({ error: 'Failed to retrieve cases' });
  }
});

/**
 * GET /api/cases/:id
 * Get single case with call logs, payment events, and audit trail.
 */
router.get('/:id', (req, res) => {
  try {
    const caseData = getCaseById(req.params.id);
    if (!caseData) {
      return res.status(404).json({ error: 'Case not found' });
    }
    res.json(caseData);
  } catch (err) {
    console.error('Get case error:', err);
    res.status(500).json({ error: 'Failed to retrieve case' });
  }
});

/**
 * POST /api/cases
 * Create a case from a specific customer.
 */
router.post('/', (req, res) => {
  try {
    const { customer_id } = req.body;
    if (!customer_id) {
      return res.status(400).json({ error: 'customer_id is required' });
    }

    const totalDue = getCustomerDue(parseInt(customer_id, 10));
    if (totalDue <= 0) {
      return res.status(400).json({ error: 'Customer has no outstanding dues' });
    }

    // Check for existing active case
    const db = getDb();
    const existing = db.prepare(`
      SELECT case_id, state FROM cases
      WHERE customer_id = ? AND state NOT IN ('RECOVERED')
      LIMIT 1
    `).get(parseInt(customer_id, 10));

    if (existing) {
      return res.status(409).json({
        error: 'Customer already has an active recovery case',
        existing_case: existing,
      });
    }

    const newCase = createCase(parseInt(customer_id, 10), totalDue);
    res.status(201).json(newCase);
  } catch (err) {
    console.error('Create case error:', err);
    res.status(400).json({ error: err.message || 'Failed to create case' });
  }
});

/**
 * PATCH /api/cases/:id/state
 * Explicit state transition with validation.
 */
router.patch('/:id/state', (req, res) => {
  try {
    const { state, promise_pay_by, amount_recovered } = req.body;
    if (!state) {
      return res.status(400).json({ error: 'New state is required' });
    }

    const extras = {};
    if (promise_pay_by) extras.promise_pay_by = promise_pay_by;
    if (amount_recovered !== undefined) extras.amount_recovered = amount_recovered;

    const updated = updateCaseState(req.params.id, state, extras);
    res.json(updated);
  } catch (err) {
    console.error('Update case state error:', err);
    const status = err.message.includes('not found') ? 404 :
                   err.message.includes('Invalid state') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

/**
 * POST /api/cases/generate
 * Bulk-generate cases from customers with outstanding dues.
 */
router.post('/generate', (req, res) => {
  try {
    const created = generateCasesFromDues();
    res.status(201).json({
      message: `Generated ${created.length} new recovery cases`,
      cases: created,
    });
  } catch (err) {
    console.error('Generate cases error:', err);
    res.status(500).json({ error: 'Failed to generate cases' });
  }
});

module.exports = router;
