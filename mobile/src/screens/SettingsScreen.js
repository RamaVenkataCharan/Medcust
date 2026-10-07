import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { COLORS, TEXT_PROPS } from '../constants/theme';
import ScreenContainer from '../components/ScreenContainer';
import { useResponsive } from '../utils/responsive';
import { exportKhataBackup } from '../services/exportService';
import { performAtomicRestore } from '../services/importService';
import { validateBackupJson } from '../utils/importValidator';
import { exportAllData } from '../db/database'; // simpler to get counts

export default function SettingsScreen({ navigation }) {
  const [restoring, setRestoring] = useState(false);
  const [exporting, setExporting] = useState(false);

  const r = useResponsive();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(r, insets), [r, insets]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportKhataBackup();
    } catch (err) {
      Alert.alert('Export Failed', err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleRestore = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Restore is only available natively for files. Web fallback can only swap state directly.');
      // Actually expo-document-picker works on web too, but FileSystem does not fully.
      // The prompt says "Restore from Backup: DocumentPicker...".
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setRestoring(true);
      const fileUri = result.assets[0].uri;
      
      // Check file size (rough check for safety, e.g., > 20MB reject)
      if (result.assets[0].size > 20 * 1024 * 1024) {
        throw new Error("File is too large.");
      }

      const fileContent = await FileSystem.readAsStringAsync(fileUri);
      
      // Validate
      validateBackupJson(fileContent);
      const backupData = JSON.parse(fileContent);

      // Get current counts for confirmation
      const currentData = exportAllData();
      const currentCustCount = currentData.customers.length;
      const currentEntryCount = currentData.entries.length;

      const newCustCount = backupData.customers.length;
      const newEntryCount = backupData.entries.length;

      Alert.alert(
        'Warning: Destructive Restore',
        `Current: ${currentCustCount} customers, ${currentEntryCount} records.\nBackup: ${newCustCount} customers, ${newEntryCount} records.\n\nAll current local data will be replaced. Proceed?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setRestoring(false) },
          {
            text: 'Restore Data',
            style: 'destructive',
            onPress: async () => {
              try {
                await performAtomicRestore(backupData);
                Alert.alert('Success', 'Data restored successfully!', [
                  { text: 'OK', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Home' }] }) }
                ]);
              } catch (restoreErr) {
                if (restoreErr.snapshotUri) {
                  Alert.alert(
                    'Restore Failed',
                    restoreErr.message + '\n\nWould you like to share the safe snapshot?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Share Snapshot', onPress: () => Sharing.shareAsync(restoreErr.snapshotUri) }
                    ]
                  );
                } else {
                  Alert.alert('Restore Failed', restoreErr.message);
                }
                setRestoring(false);
              }
            }
          }
        ],
        { cancelable: false }
      );

    } catch (err) {
      setRestoring(false);
      Alert.alert('Import Failed', err.message);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={r.scale(24)} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text {...TEXT_PROPS} style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.actionButton} onPress={handleExport} disabled={exporting || restoring}>
          {exporting ? <ActivityIndicator color="#fff" /> : <Ionicons name="share-outline" size={r.scale(24)} color="#fff" />}
          <Text {...TEXT_PROPS} style={styles.actionButtonText}>{exporting ? 'Exporting...' : 'Share Backup'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.restoreButton]} onPress={handleRestore} disabled={exporting || restoring}>
          {restoring ? <ActivityIndicator color="#fff" /> : <Ionicons name="download-outline" size={r.scale(24)} color="#fff" />}
          <Text {...TEXT_PROPS} style={styles.actionButtonText}>{restoring ? 'Restoring...' : 'Restore from Backup'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('RecycleBin')}
          disabled={exporting || restoring}
        >
          <Ionicons name="trash" size={r.scale(24)} color={COLORS.textPrimary} />
          <Text {...TEXT_PROPS} style={[styles.actionButtonText, { color: COLORS.textPrimary }]}>Recycle Bin</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const makeStyles = (r, insets) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: r.moderate(16),
    paddingTop: r.moderate(16),
    paddingBottom: r.moderate(16),
    backgroundColor: COLORS.surface,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: r.moderate(8),
    marginRight: r.moderate(8),
  },
  headerTitle: {
    fontSize: r.font(20),
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  content: {
    padding: r.moderate(16),
    paddingBottom: insets.bottom + r.moderate(16),
    gap: r.scale(16),
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    padding: r.moderate(16),
    borderRadius: r.moderate(12),
    alignItems: 'center',
    justifyContent: 'center',
    gap: r.scale(12),
  },
  restoreButton: {
    backgroundColor: COLORS.danger,
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: r.font(16),
    fontWeight: '600',
  },
});
