import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { exportAllData } from '../db/database';
import { validateBackupJson } from '../utils/importValidator';
import { getCurrentLocalIso } from '../utils/dateUtils';

export async function performAtomicRestore(jsonData) {
  // 1. Pre-restore snapshot
  const snapshotData = exportAllData();
  const snapshotStr = JSON.stringify(snapshotData);
  const ts = getCurrentLocalIso().replace(/[:.]/g, '-');
  const snapshotUri = `${FileSystem.documentDirectory}khata_snapshot_${ts}.json`;
  
  try {
    // Write timestamped file
    await FileSystem.writeAsStringAsync(snapshotUri, snapshotStr);
    // Read it back
    const readBack = await FileSystem.readAsStringAsync(snapshotUri);
    // Validate it
    validateBackupJson(readBack);
  } catch (error) {
    throw new Error('Failed to create or validate pre-restore snapshot. Restore aborted for safety. ' + error.message);
  }

  // Keep the last 3 snapshots
  try {
    const dirContent = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
    const snapshots = dirContent
      .filter(f => f.startsWith('khata_snapshot_') && f.endsWith('.json'))
      .sort(); // String sort works due to ISO timestamp naming
    
    if (snapshots.length > 3) {
      const toDelete = snapshots.slice(0, snapshots.length - 3);
      for (const file of toDelete) {
        await FileSystem.deleteAsync(`${FileSystem.documentDirectory}${file}`, { idempotent: true });
      }
    }
  } catch (e) {
    console.warn("Could not clean up old snapshots:", e);
  }

  // 2. Perform restore via database.js
  const { restoreDatabaseFromJson } = require('../db/database');
  await restoreDatabaseFromJson(jsonData);
}
