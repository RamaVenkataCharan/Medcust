const express = require('express');
const cors = require('cors');
const config = require('./config');
const { getDb } = require('./db/database');
const { performBackup } = require('./services/backupService');

// Initialize database schema on startup
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
app.use(express.json());

// Routes
app.use('/api/customers', require('./routes/customers'));
app.use('/api/entries', require('./routes/entries'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/medicines', require('./routes/medicines'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/bills', require('./routes/bills'));

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

app.listen(config.PORT, () => {
  console.log(`====================================================`);
  console.log(`  MedTrack Khata Ledger API running on http://localhost:${config.PORT}`);
  console.log(`  Database: ${config.DB_PATH}`);
  console.log(`====================================================`);
});
