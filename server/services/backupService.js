const fs = require('fs');
const path = require('path');
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
    const backupFileName = `medtrack_backup_${today}.sqlite`;
    const backupFilePath = path.join(config.BACKUP_DIR, backupFileName);

    if (fs.existsSync(backupFilePath) && !force) {
      return {
        success: true,
        skipped: true,
        message: `Today's backup already exists: ${backupFileName}`,
        filename: backupFileName,
      };
    }

    // Copy SQLite database to backup folder
    fs.copyFileSync(config.DB_PATH, backupFilePath);

    // Also keep max 30 recent backups
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
      .sort((a, b) => b.createdAt - a.createdAt);
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

module.exports = {
  performBackup,
  listBackups,
};
