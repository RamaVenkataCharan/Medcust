const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Creates a timestamped backup of the SQLite database
 */
function performBackup(force = false) {
  try {
    ensureDir(config.BACKUP_DIR);

    if (!fs.existsSync(config.DB_PATH)) {
      return { success: false, reason: 'Database file does not exist yet' };
    }

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const timestamp = Date.now();
    const backupFileName = force
      ? `medtrack_backup_${today}_${timestamp}.sqlite`
      : `medtrack_backup_${today}.sqlite`;
    const backupFilePath = path.join(config.BACKUP_DIR, backupFileName);

    if (fs.existsSync(backupFilePath) && !force) {
      return {
        success: true,
        skipped: true,
        message: `Today's backup already exists: ${backupFileName}`,
        filename: backupFileName,
      };
    }

    // Checkpoint SQLite WAL mode before copying to ensure all transactions are flushed
    try {
      const db = new Database(config.DB_PATH);
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
    } catch (checkpointErr) {
      console.warn('WAL checkpoint notice:', checkpointErr.message);
    }

    // Copy SQLite database to backup folder
    fs.copyFileSync(config.DB_PATH, backupFilePath);

    // Keep max 30 recent backups
    cleanupOldBackups(30);

    return {
      success: true,
      skipped: false,
      message: `Database successfully backed up to ${backupFileName}`,
      filename: backupFileName,
      path: backupFilePath,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error('Automated backup failed:', err);
    return { success: false, error: err.message };
  }
}

function listBackups() {
  try {
    ensureDir(config.BACKUP_DIR);
    const files = fs.readdirSync(config.BACKUP_DIR);
    return files
      .filter(f => f.endsWith('.sqlite'))
      .map(f => {
        const stats = fs.statSync(path.join(config.BACKUP_DIR, f));
        return {
          filename: f,
          sizeBytes: stats.size,
          sizeKb: (stats.size / 1024).toFixed(1),
          createdAt: stats.mtime,
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (err) {
    console.error('Error listing backups:', err);
    return [];
  }
}

function cleanupOldBackups(keepCount = 30) {
  try {
    const backups = listBackups();
    if (backups.length > keepCount) {
      const toDelete = backups.slice(keepCount);
      for (const b of toDelete) {
        fs.unlinkSync(path.join(config.BACKUP_DIR, b.filename));
      }
    }
  } catch (err) {
    console.error('Error cleaning old backups:', err);
  }
}

/**
 * Restores database from a selected backup file.
 * Creates an automatic safety snapshot before overwriting.
 */
function restoreBackup(filename) {
  try {
    if (!filename || typeof filename !== 'string') {
      throw new Error('Valid backup filename is required');
    }

    // Security: sanitize filename to prevent directory traversal
    const safeFilename = path.basename(filename);
    const backupFilePath = path.join(config.BACKUP_DIR, safeFilename);

    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`Backup file "${safeFilename}" does not exist`);
    }

    // Verify file integrity: try opening with SQLite and query master
    let testDb;
    try {
      testDb = new Database(backupFilePath, { readonly: true });
      const tableCheck = testDb.prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table'").get();
      if (!tableCheck || tableCheck.cnt === 0) {
        throw new Error('Backup file contains no valid tables');
      }
    } catch (testErr) {
      throw new Error(`Corrupted backup file: ${testErr.message}`);
    } finally {
      if (testDb) testDb.close();
    }

    // 1. Safely close active database connection before replacing files
    try {
      const { closeDb } = require('../db/database');
      if (closeDb) closeDb();
    } catch (closeErr) {
      console.warn('Notice while closing DB before restore:', closeErr.message);
    }

    // 2. Create a safety snapshot of the active db before overwriting
    if (fs.existsSync(config.DB_PATH)) {
      const preRestoreSafetyPath = path.join(
        config.BACKUP_DIR,
        `pre_restore_safety_${Date.now()}.sqlite`
      );
      fs.copyFileSync(config.DB_PATH, preRestoreSafetyPath);
    }

    // 3. Overwrite active database file
    fs.copyFileSync(backupFilePath, config.DB_PATH);

    // Remove old WAL and SHM files to avoid state conflict
    const walPath = `${config.DB_PATH}-wal`;
    const shmPath = `${config.DB_PATH}-shm`;
    try {
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
    } catch (unlinkErr) {
      console.warn('Notice removing WAL/SHM on restore:', unlinkErr.message);
    }

    return {
      success: true,
      message: `Database successfully restored from ${safeFilename}`,
      restoredFrom: safeFilename,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error('Database restore error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Exports core ledger data (Customers, Entries, Payments) as CSV formatted text
 */
function generateCsvExport() {
  const db = new Database(config.DB_PATH, { readonly: true });
  try {
    // 1. Customers with computed dues
    const customers = db.prepare(`
      SELECT
        c.customer_id,
        c.phone_number,
        c.name,
        c.village,
        c.address,
        c.created_at,
        ROUND(COALESCE((SELECT SUM(due_amount) FROM entries WHERE customer_id = c.customer_id), 0) -
              COALESCE((SELECT SUM(amount) FROM payments WHERE customer_id = c.customer_id), 0), 2) AS current_due
      FROM customers c
      ORDER BY c.customer_id ASC
    `).all();

    let csv = '=== CUSTOMERS & DUES LEDGER ===\r\n';
    csv += 'Customer ID,Phone Number,Name,Village,Address,Created Date,Current Due (INR)\r\n';
    for (const c of customers) {
      csv += `${c.customer_id},"${c.phone_number}","${(c.name || '').replace(/"/g, '""')}","${(c.village || '').replace(/"/g, '""')}","${(c.address || '').replace(/"/g, '""')}",${c.created_at},${c.current_due}\r\n`;
    }

    // 2. Entries with Medicines
    const entries = db.prepare(`
      SELECT
        e.entry_id,
        e.customer_id,
        c.name AS customer_name,
        c.phone_number,
        e.entry_date,
        e.total_amount,
        e.amount_paid,
        e.due_amount
      FROM entries e
      JOIN customers c ON e.customer_id = c.customer_id
      ORDER BY e.entry_id ASC
    `).all();

    csv += '\r\n=== VISIT ENTRIES ===\r\n';
    csv += 'Entry ID,Customer ID,Customer Name,Phone Number,Entry Date,Total Amount,Amount Paid,Due Created\r\n';
    for (const e of entries) {
      csv += `${e.entry_id},${e.customer_id},"${(e.customer_name || '').replace(/"/g, '""')}","${e.phone_number}",${e.entry_date},${e.total_amount},${e.amount_paid},${e.due_amount}\r\n`;
    }

    // 3. Payments
    const payments = db.prepare(`
      SELECT
        p.payment_id,
        p.customer_id,
        c.name AS customer_name,
        p.pay_date,
        p.amount,
        p.note
      FROM payments p
      JOIN customers c ON p.customer_id = c.customer_id
      ORDER BY p.payment_id ASC
    `).all();

    csv += '\r\n=== PAYMENTS / DUE CLEARANCE ===\r\n';
    csv += 'Payment ID,Customer ID,Customer Name,Payment Date,Amount Paid,Note\r\n';
    for (const p of payments) {
      csv += `${p.payment_id},${p.customer_id},"${(p.customer_name || '').replace(/"/g, '""')}",${p.pay_date},${p.amount},"${(p.note || '').replace(/"/g, '""')}"\r\n`;
    }

    return csv;
  } finally {
    db.close();
  }
}

module.exports = {
  performBackup,
  listBackups,
  restoreBackup,
  generateCsvExport,
};
