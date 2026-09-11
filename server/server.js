const http = require('http');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const { getDb } = require('./db/database');
const { performBackup } = require('./services/backupService');

// Initialize database schema on startup (includes recovery tables)
getDb();

// Daily startup backup check
const backupStatus = performBackup(false);
if (backupStatus.skipped) {
  console.log(`[Backup] ${backupStatus.message}`);
} else if (backupStatus.success) {
  console.log(`[Backup] Automated daily backup created: ${backupStatus.filename}`);
}

const app = express();

// Middleware
app.use(cors());

// Parse JSON for most routes
app.use((req, res, next) => {
  // Skip JSON parsing for webhook routes (they need raw body for signature verification)
  if (req.path.startsWith('/api/webhooks/')) {
    return next();
  }
  express.json()(req, res, next);
});

// Routes — Original Khata Ledger
app.use('/api/customers', require('./routes/customers'));
app.use('/api/entries', require('./routes/entries'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/medicines', require('./routes/medicines'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/bills', require('./routes/bills'));

// Routes — AI Revenue Recovery (Phase 2)
app.use('/api/cases', require('./routes/cases'));
app.use('/api/recovery', require('./routes/recovery'));
app.use('/api/webhooks', require('./routes/webhooks'));

// Routes — Courtesy Due Reminder Engine (WhatsApp / SMS)
app.use('/api/reminders', require('./routes/reminders'));

// Shop configuration & status
app.get('/api/config', (req, res) => {
  res.json({
    shop: {
      name: 'Medical Shop',
      tagline: 'Customer Khata Ledger System',
    },
    systemTime: new Date().toISOString(),
    status: 'online',
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// ── Create HTTP server for WebSocket support ──
const server = http.createServer(app);

// ── WebSocket Server for Telephony Media Streams ──
try {
  const WebSocket = require('ws');
  const recoveryConfig = require('./recovery/recoveryConfig');
  const { setupWebSocketHandler } = require('./recovery/telephonyBridge');

  const wss = new WebSocket.Server({
    server,
    path: recoveryConfig.RECOVERY_WS_PATH,
  });

  setupWebSocketHandler(wss);
  console.log(`[Recovery] WebSocket telephony bridge ready at ${recoveryConfig.RECOVERY_WS_PATH}`);
} catch (err) {
  console.warn(`[Recovery] WebSocket setup skipped (ws package not installed): ${err.message}`);
  console.warn(`[Recovery] Install 'ws' package: npm install ws`);
}

// ── Start Follow-Up Scheduler ──
try {
  const { startScheduler } = require('./recovery/followUpScheduler');
  startScheduler();
} catch (err) {
  console.warn(`[Recovery] Follow-up scheduler failed to start: ${err.message}`);
}

// ── Start Due Reminder Scheduler (WhatsApp / SMS) ──
try {
  const { startReminderScheduler } = require('./services/reminderScheduler');
  startReminderScheduler();
} catch (err) {
  console.warn(`[Reminders] Scheduler failed to start: ${err.message}`);
}

// ── Start Server ──
server.listen(config.PORT, () => {
  console.log(`====================================================`);
  console.log(`  MedTrack Khata Ledger + Due Reminder Engine`);
  console.log(`  API running on http://localhost:${config.PORT}`);
  console.log(`  Database: ${config.DB_PATH}`);
  console.log(`====================================================`);
  console.log(`  Reminder APIs:`);
  console.log(`    Summary:   /api/reminders/summary`);
  console.log(`    Customer:  /api/reminders/customer/:id`);
  console.log(`    Toggle:    /api/reminders/toggle (POST)`);
  console.log(`    Pause:     /api/reminders/pause (POST)`);
  console.log(`    Send Now:  /api/reminders/send-now (POST)`);
  console.log(`====================================================`);
});
