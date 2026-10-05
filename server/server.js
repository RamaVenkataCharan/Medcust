const http = require('http');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const { getDb } = require('./db/database');
const { performBackup } = require('./services/backupService');

// Initialize database schema on startup
const db = getDb();

function runMigrations(db) {
  const hasOldDates = db.prepare(`SELECT 1 FROM entries WHERE entry_date NOT LIKE '%T%' LIMIT 1`).get();
  const hasNoDiscountCol = db.prepare(`SELECT 1 FROM pragma_table_info('entry_medicine') WHERE name = 'discount'`).get() === undefined;

  if (hasOldDates || hasNoDiscountCol) {
    console.log('[Migration] Taking pre-migration safety backup...');
    performBackup(true); // force backup

    if (hasOldDates) {
      console.log('[Migration] Converting timestamps to ISO 8601 UTC...');
      db.transaction(() => {
        db.prepare(`UPDATE entries SET entry_date = REPLACE(entry_date, ' ', 'T') || 'Z' WHERE entry_date NOT LIKE '%T%' AND entry_date LIKE '% %'`).run();
        db.prepare(`UPDATE payments SET pay_date = REPLACE(pay_date, ' ', 'T') || 'Z' WHERE pay_date NOT LIKE '%T%' AND pay_date LIKE '% %'`).run();
        db.prepare(`UPDATE customers SET created_at = REPLACE(created_at, ' ', 'T') || 'Z' WHERE created_at NOT LIKE '%T%' AND created_at LIKE '% %'`).run();
        db.prepare(`UPDATE customers SET updated_at = REPLACE(updated_at, ' ', 'T') || 'Z' WHERE updated_at NOT LIKE '%T%' AND updated_at LIKE '% %'`).run();
      })();
    }

    if (hasNoDiscountCol) {
      console.log('[Migration] Adding discount column to entry_medicine...');
      db.exec(`ALTER TABLE entry_medicine ADD COLUMN discount REAL NOT NULL DEFAULT 0`);
    }
  }
}

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
