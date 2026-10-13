import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { COLORS } from '../constants/theme';
import ScreenContainer from '../components/ScreenContainer';
import { useResponsive, TEXT_PROPS } from '../utils/responsive';
import { exportKhataBackup } from '../services/exportService';
import { performAtomicRestore } from '../services/importService';
import { validateBackupJson } from '../utils/importValidator';
import { exportAllData } from '../db/database';

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

      if (result.assets[0].size > 20 * 1024 * 1024) {
        throw new Error('File is too large.');
      }

      const fileContent = await FileSystem.readAsStringAsync(fileUri);

      validateBackupJson(fileContent);
      const backupData = JSON.parse(fileContent);

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
                  { text: 'OK', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Home' }] }) },
                ]);
              } catch (restoreErr) {
                if (restoreErr.snapshotUri) {
                  Alert.alert(
                    'Restore Failed',
                    restoreErr.message + '\n\nWould you like to share the safe snapshot?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Share Snapshot', onPress: () => Sharing.shareAsync(restoreErr.snapshotUri) },
                    ]
                  );
                } else {
                  Alert.alert('Restore Failed', restoreErr.message);
                }
                setRestoring(false);
              }
            },
          },
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
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} testID="settings-back-btn">
          <Ionicons name="arrow-back" size={r.scale(24)} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text {...TEXT_PROPS} style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Backup & Data Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="server-outline" size={r.scale(22)} color={COLORS.primary} />
            <Text {...TEXT_PROPS} style={styles.sectionTitle}>Data Management & Backup</Text>
          </View>

          <TouchableOpacity style={styles.actionButton} onPress={handleExport} disabled={exporting || restoring} testID="btn-export-backup">
            {exporting ? <ActivityIndicator color="#fff" /> : <Ionicons name="share-outline" size={r.scale(22)} color="#fff" />}
            <Text {...TEXT_PROPS} style={styles.actionButtonText}>{exporting ? 'Exporting...' : 'Share Backup'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.restoreButton]} onPress={handleRestore} disabled={exporting || restoring} testID="btn-restore-backup">
            {restoring ? <ActivityIndicator color="#fff" /> : <Ionicons name="download-outline" size={r.scale(22)} color="#fff" />}
            <Text {...TEXT_PROPS} style={styles.actionButtonText}>{restoring ? 'Restore from Backup' : 'Restore from Backup'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('RecycleBin')}
            disabled={exporting || restoring}
            testID="btn-recycle-bin"
          >
            <Ionicons name="trash-outline" size={r.scale(22)} color={COLORS.textPrimary} />
            <Text {...TEXT_PROPS} style={[styles.actionButtonText, { color: COLORS.textPrimary }]}>Recycle Bin</Text>
          </TouchableOpacity>
        </View>
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: r.moderate(8),
    marginRight: r.moderate(8),
  },
  headerTitle: {
    fontSize: r.font(20),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  content: {
    padding: r.moderate(16),
    paddingBottom: insets.bottom + r.moderate(24),
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: r.moderate(12),
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: r.moderate(16),
    gap: r.scale(12),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.scale(8),
    marginBottom: r.scale(4),
  },
  sectionTitle: {
    fontSize: r.font(16),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    padding: r.moderate(14),
    borderRadius: r.moderate(10),
    alignItems: 'center',
    justifyContent: 'center',
    gap: r.scale(10),
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
    fontSize: r.font(15),
    fontWeight: '600',
  },
});
