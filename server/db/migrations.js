const { performBackup } = require('../services/backupService');

function runMigrations(db) {
  // Check for any timestamps missing 'T' and 'Z' (ISO format check)
  const tables = ['entries', 'payments', 'customers'];
  let hasOldDates = false;
  
  // A strict check if any 'YYYY-MM-DD HH:MM:SS' format dates exist
  if (db.prepare(`SELECT 1 FROM entries WHERE entry_date LIKE '____-__-__ __:__:__' LIMIT 1`).get() ||
      db.prepare(`SELECT 1 FROM payments WHERE pay_date LIKE '____-__-__ __:__:__' LIMIT 1`).get() ||
      db.prepare(`SELECT 1 FROM customers WHERE created_at LIKE '____-__-__ __:__:__' LIMIT 1`).get() ||
      db.prepare(`SELECT 1 FROM customers WHERE updated_at LIKE '____-__-__ __:__:__' LIMIT 1`).get()) {
    hasOldDates = true;
  }
  
  const hasNoDiscountCol = db.prepare(`SELECT 1 FROM pragma_table_info('entry_medicine') WHERE name = 'discount'`).get() === undefined;

  if (hasOldDates || hasNoDiscountCol) {
    console.log('[Migration] Taking pre-migration safety backup...');
    performBackup(true); // force backup

    if (hasOldDates) {
      console.log('[Migration] Converting timestamps to ISO 8601 UTC...');
      db.transaction(() => {
        db.prepare(`UPDATE entries SET entry_date = REPLACE(entry_date, ' ', 'T') || 'Z' WHERE entry_date LIKE '____-__-__ __:__:__'`).run();
        db.prepare(`UPDATE payments SET pay_date = REPLACE(pay_date, ' ', 'T') || 'Z' WHERE pay_date LIKE '____-__-__ __:__:__'`).run();
        db.prepare(`UPDATE customers SET created_at = REPLACE(created_at, ' ', 'T') || 'Z' WHERE created_at LIKE '____-__-__ __:__:__'`).run();
        db.prepare(`UPDATE customers SET updated_at = REPLACE(updated_at, ' ', 'T') || 'Z' WHERE updated_at LIKE '____-__-__ __:__:__'`).run();
      })();
    }

    if (hasNoDiscountCol) {
      console.log('[Migration] Adding discount column to entry_medicine...');
      db.exec(`ALTER TABLE entry_medicine ADD COLUMN discount REAL NOT NULL DEFAULT 0`);
    }
  }
}

module.exports = { runMigrations };
