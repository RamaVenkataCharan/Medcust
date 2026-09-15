import { Platform, Alert } from 'react-native';
import { exportAllData } from '../db/database';

/**
 * Creates a complete JSON backup file and triggers download (Web) or native share sheet (Mobile).
 */
export async function exportKhataBackup() {
  try {
    const data = exportAllData();
    const dateStamp = new Date().toISOString().split('T')[0];
    const fileName = `medtrack_backup_${dateStamp}.json`;
    const jsonString = JSON.stringify(data, null, 2);

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Alert.alert('Backup Exported', `Downloaded ${fileName} (${data.customers?.length || 0} customers)`);
        return { success: true, count: data.customers?.length };
      }
    }

    const FileSystem = require('expo-file-system');
    const Sharing = require('expo-sharing');
    const filePath = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, jsonString, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/json',
        dialogTitle: 'Export MedTrack Khata Backup',
        UTI: 'public.json',
      });
      return { success: true, count: data.customers?.length };
    } else {
      Alert.alert(
        'Backup Created',
        `Backup file written to:\n${filePath}\n(Sharing is not supported on this device).`
      );
      return { success: true, path: filePath };
    }
  } catch (error) {
    console.error('Failed to export khata backup:', error);
    Alert.alert('Export Failed', 'Could not export backup: ' + (error.message || 'Unknown error'));
    return { success: false, error };
  }
}
