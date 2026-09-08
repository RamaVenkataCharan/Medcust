const express = require('express');
const router = express.Router();
const { autocompleteMedicines } = require('../db/database');

/**
 * GET /api/medicines/autocomplete?q={name}
 * Suggest previously-entered medicine names from past entries
 */
router.get('/autocomplete', (req, res) => {
  try {
    const q = req.query.q || '';
    const suggestions = autocompleteMedicines(q);
    res.json(suggestions);
  } catch (err) {
    console.error('Medicine autocomplete error:', err);
    res.status(500).json({ error: 'Failed to autocomplete medicines' });
  }
});

module.exports = router;
