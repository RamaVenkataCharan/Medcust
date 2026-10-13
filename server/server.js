const http = require('http');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const { getDb } = require('./db/database');
const { performBackup } = require('./services/backupService');

// Initialize database schema on startup
const db = getDb();

const { runMigrations } = require('./db/migrations');
runMigrations(db);

// Daily startup backup check
const backupStatus = performBackup(false);
if (backupStatus.skipped) {
  console.log(`[Backup] ${backupStatus.message}`);
} else if (backupStatus.success) {
  console.log(`[Backup] Automated daily backup created: ${backupStatus.filename}`);
}

const app = express();

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (config.CORS_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json());

// Routes — Core Khata Ledger
app.use('/api/customers', require('./routes/customers'));
app.use('/api/entries', require('./routes/entries'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/medicines', require('./routes/medicines'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/bills', require('./routes/bills'));

// Shop configuration & status
app.get('/api/config', (req, res) => {
  res.json({
    shop: config.SHOP,
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

// Create HTTP server
const server = http.createServer(app);

// Start Server
server.listen(config.PORT, () => {
  console.log(`====================================================`);
  console.log(`  MedTrack — Medical Shop Customer Khata Ledger`);
  console.log(`  API running on http://localhost:${config.PORT}`);
  console.log(`  Database: ${config.DB_PATH}`);
  console.log(`====================================================`);
});
