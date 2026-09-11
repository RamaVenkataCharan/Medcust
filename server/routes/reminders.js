/**
 * Courtesy Due Reminder Routes — MedTrack Pharmacy
 * 
 * Endpoints for:
 * - Shop-wide reminder statistics
 * - Customer reminder settings (enable/disable/pause)
 * - Template preview and manual single-click reminder send
 * - Reminder history per customer
 * - Manual scheduler trigger
 */

const express = require('express');
const router = express.Router();
const reminderConfig = require('../services/reminderConfig');
const { renderMessage } = require('../services/reminderTemplates');
const { generatePaymentLink } = require('../services/reminderProvider');
const {
  processCustomerReminder,
  runReminderCycle,
  isQuietHours,
} = require('../services/reminderScheduler');
const {
  getDb,
  getCustomerDue,
  getOldestUnpaidEntry,
  getReminderSettings,
  upsertReminderSettings,
  logReminder,
  getReminderHistory,
  getRemindersSentForDueCycle,
  getShopReminderSummary,
} = require('../db/database');

/**
 * GET /api/reminders/summary
 * Shop-wide reminder metrics (sent this week, delivery rate, 48h response rate)
 */
router.get('/summary', (req, res) => {
  try {
    const summary = getShopReminderSummary();
    res.json({
      success: true,
      summary: {
        ...summary,
        quietHoursActive: isQuietHours(),
        config: {
          stages: reminderConfig.scheduleStages,
          maxReminders: reminderConfig.maxRemindersPerDue,
          quietHours: reminderConfig.quietHours,
          primaryChannel: reminderConfig.channels.primary,
        },
      },
    });
  } catch (err) {
    console.error('Reminder summary error:', err);
    res.status(500).json({ error: 'Failed to fetch reminder summary' });
  }
});

/**
 * GET /api/reminders/customer/:id
 * Reminder status, settings, oldest unpaid entry, and history for a customer
 */
router.get('/customer/:id', (req, res) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    const db = getDb();
    const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const totalDue = getCustomerDue(customerId);
    const settings = getReminderSettings(customerId);
    const oldestUnpaid = getOldestUnpaidEntry(customerId);
    const history = getReminderHistory(customerId, 20);
    const cycleReminders = getRemindersSentForDueCycle(customerId);

    // Compute next scheduled stage
    let nextStage = null;
    if (totalDue > 0 && settings.reminders_enabled) {
      const sentStages = cycleReminders.map((r) => r.scheduled_stage);
      if (cycleReminders.length < reminderConfig.maxRemindersPerDue && oldestUnpaid) {
        for (const s of reminderConfig.scheduleStages) {
          if (oldestUnpaid.daysSinceDue >= s.daysAfterDue && !sentStages.includes(s.stage)) {
            nextStage = s.stage;
            break;
          }
        }
      }
    }

    res.json({
      customerId,
      customerName: customer.name,
      phone: customer.phone_number,
      totalDue,
      settings,
      oldestUnpaid,
      nextStage,
      cycleRemindersCount: cycleReminders.length,
      maxReminders: reminderConfig.maxRemindersPerDue,
      history,
    });
  } catch (err) {
    console.error('Customer reminder status error:', err);
    res.status(500).json({ error: 'Failed to fetch customer reminder status' });
  }
});

/**
 * POST /api/reminders/toggle
 * 1-click enable or disable reminders for a customer
 */
router.post('/toggle', (req, res) => {
  try {
    const { customerId, enabled } = req.body;
    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const updated = upsertReminderSettings({
      customerId: parseInt(customerId, 10),
      remindersEnabled: enabled ? 1 : 0,
    });

    res.json({ success: true, settings: updated });
  } catch (err) {
    console.error('Reminder toggle error:', err);
    res.status(500).json({ error: 'Failed to update reminder settings' });
  }
});

/**
 * POST /api/reminders/pause
 * Pause reminders for a customer for N days (e.g. 7 or 14 days) or until a specific date
 */
router.post('/pause', (req, res) => {
  try {
    const { customerId, days, untilDate } = req.body;
    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    let pausedUntil = null;
    if (days && Number(days) > 0) {
      const pauseDate = new Date();
      pauseDate.setDate(pauseDate.getDate() + parseInt(days, 10));
      pausedUntil = pauseDate.toISOString().split('T')[0]; // YYYY-MM-DD
    } else if (untilDate) {
      pausedUntil = untilDate;
    }

    const updated = upsertReminderSettings({
      customerId: parseInt(customerId, 10),
      pausedUntil,
    });

    res.json({ success: true, settings: updated });
  } catch (err) {
    console.error('Reminder pause error:', err);
    res.status(500).json({ error: 'Failed to pause reminders' });
  }
});

/**
 * GET /api/reminders/preview
 * Preview rendered template before sending
 */
router.get('/preview', (req, res) => {
  try {
    const { customerId, language = 'hinglish' } = req.query;
    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const db = getDb();
    const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(parseInt(customerId, 10));
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const totalDue = getCustomerDue(customer.customer_id);
    const oldestUnpaid = getOldestUnpaidEntry(customer.customer_id);
    const paymentLinkInfo = generatePaymentLink({
      customerId: customer.customer_id,
      amount: totalDue,
      customerName: customer.name,
    });

    const message = renderMessage({
      language,
      customerName: customer.name,
      amount: totalDue,
      date: oldestUnpaid?.entryDate,
      paymentLink: paymentLinkInfo.paymentUrl,
    });

    res.json({
      customerId: customer.customer_id,
      customerName: customer.name,
      phone: customer.phone_number,
      totalDue,
      language,
      paymentLink: paymentLinkInfo.paymentUrl,
      message,
    });
  } catch (err) {
    console.error('Preview error:', err);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

/**
 * POST /api/reminders/send-now
 * Manually trigger a polite courtesy reminder for a customer
 */
router.post('/send-now', async (req, res) => {
  try {
    const { customerId, language = 'hinglish', forceStage = 'MANUAL' } = req.body;
    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const db = getDb();
    const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(parseInt(customerId, 10));
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const result = await processCustomerReminder(customer, {
      language,
      forceStage,
      bypassQuietHours: true, // Explicit manual pharmacist action bypasses quiet hours
    });

    res.json({ success: true, result });
  } catch (err) {
    console.error('Send now error:', err);
    res.status(500).json({ error: 'Failed to send reminder: ' + err.message });
  }
});

/**
 * POST /api/reminders/run-job
 * Trigger scheduler cycle on demand
 */
router.post('/run-job', async (req, res) => {
  try {
    const { bypassQuietHours = false } = req.body;
    const result = await runReminderCycle({ bypassQuietHours });
    res.json({ success: true, result });
  } catch (err) {
    console.error('Scheduler run error:', err);
    res.status(500).json({ error: 'Failed to run scheduler: ' + err.message });
  }
});

module.exports = router;
