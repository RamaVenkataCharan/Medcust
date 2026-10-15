import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../constants/theme';
import { useResponsive, TEXT_PROPS } from '../utils/responsive';
import { FIRST_LAUNCH_NOTICE } from '../constants/legalText';

export default function FirstLaunchNoticeModal({ visible, onAccept }) {
  const r = useResponsive();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(r, insets), [r, insets]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {}} // Mandatory non-dismissable until accepted
    >
      <View style={styles.container} testID="first-launch-notice">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={r.scale(28)} color={COLORS.primary} />
          </View>
          <Text {...TEXT_PROPS} style={styles.appTitle}>MedTrack</Text>
          <Text {...TEXT_PROPS} style={styles.title}>{FIRST_LAUNCH_NOTICE.title}</Text>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary Box */}
          <View style={styles.summaryCard}>
            <Text {...TEXT_PROPS} style={styles.summaryTitle}>Please review before continuing:</Text>
            <Text {...TEXT_PROPS} style={styles.summaryText}>
              {FIRST_LAUNCH_NOTICE.summaryText}
            </Text>
          </View>

          {/* Prominent Backup Warning Callout */}
          <View style={styles.warningCard} testID="callout-backup-warning">
            <View style={styles.warningHeader}>
              <Ionicons name="warning" size={r.scale(22)} color="#DC2626" />
              <Text {...TEXT_PROPS} style={styles.warningTitle}>
                {FIRST_LAUNCH_NOTICE.backupWarningTitle}
              </Text>
            </View>
            <Text {...TEXT_PROPS} style={styles.warningText}>
              {FIRST_LAUNCH_NOTICE.backupWarningText}
            </Text>
          </View>
        </ScrollView>

        {/* Bottom Accept Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={onAccept}
            testID="btn-accept-first-launch-notice"
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle-outline" size={r.scale(20)} color="#fff" />
            <Text {...TEXT_PROPS} style={styles.acceptButtonText}>
              {FIRST_LAUNCH_NOTICE.buttonText}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (r, insets) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: insets.top + r.moderate(16),
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: r.moderate(20),
    paddingBottom: r.moderate(16),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  iconCircle: {
    width: r.scale(56),
    height: r.scale(56),
    borderRadius: r.scale(28),
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: r.scale(8),
  },
  appTitle: {
    fontSize: r.font(20),
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.3,
  },
  title: {
    fontSize: r.font(15),
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: r.scale(4),
  },
  scrollArea: {
    flex: 1,
  },
  contentContainer: {
    padding: r.moderate(20),
    gap: r.scale(16),
    paddingBottom: r.moderate(24),
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: r.moderate(12),
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: r.moderate(16),
  },
  summaryTitle: {
    fontSize: r.font(14),
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: r.scale(10),
  },
  summaryText: {
    fontSize: r.font(13),
    color: COLORS.textSecondary,
    lineHeight: r.font(20),
  },
  warningCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#F87171',
    borderRadius: r.moderate(12),
    padding: r.moderate(16),
    gap: r.scale(8),
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.scale(8),
  },
  warningTitle: {
    fontSize: r.font(15),
    fontWeight: '800',
    color: '#991B1B',
  },
  warningText: {
    fontSize: r.font(13),
    color: '#991B1B',
    lineHeight: r.font(19),
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: r.moderate(20),
    paddingTop: r.moderate(12),
    paddingBottom: insets.bottom + r.moderate(16),
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  acceptButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: r.moderate(14),
    borderRadius: r.moderate(10),
    gap: r.scale(8),
    minHeight: r.touch,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: r.font(16),
    fontWeight: '700',
  },
});
