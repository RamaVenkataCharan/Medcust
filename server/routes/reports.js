const express = require('express');
const router = express.Router();
const {
  getDb,
  getCustomerDue,
  getReminderSettings,
  getOldestUnpaidEntry,
  getRemindersSentForDueCycle,
} = require('../db/database');
const reminderConfig = require('../services/reminderConfig');
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

    // Compute derived total_due and reminder metadata for each debtor
    let debtors = customers
      .map((c) => {
        const totalDue = getCustomerDue(c.customer_id);
        if (totalDue <= 0) return null;

        const reminderSettings = getReminderSettings(c.customer_id);
        const oldestUnpaid = getOldestUnpaidEntry(c.customer_id);
        const cycleReminders = getRemindersSentForDueCycle(c.customer_id);
        const lastReminder = cycleReminders.length > 0 ? cycleReminders[cycleReminders.length - 1] : null;

        // Next scheduled stage
        let nextStage = null;
        if (reminderSettings.reminders_enabled && cycleReminders.length < reminderConfig.maxRemindersPerDue && oldestUnpaid) {
          const sentStages = cycleReminders.map((r) => r.scheduled_stage);
          for (const s of reminderConfig.scheduleStages) {
            if (oldestUnpaid.daysSinceDue >= s.daysAfterDue && !sentStages.includes(s.stage)) {
              nextStage = s.stage;
              break;
            }
          }
        }

        return {
          ...c,
          total_due: totalDue,
          reminder_settings: reminderSettings,
          oldest_unpaid_date: oldestUnpaid?.entryDate || null,
          days_since_due: oldestUnpaid?.daysSinceDue || 0,
          reminders_sent_count: cycleReminders.length,
          max_reminders: reminderConfig.maxRemindersPerDue,
          last_reminder: lastReminder
            ? {
                channel: lastReminder.channel,
                sent_at: lastReminder.sent_at,
                stage: lastReminder.scheduled_stage,
                delivery_status: lastReminder.delivery_status,
              }
            : null,
          next_stage: nextStage,
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
