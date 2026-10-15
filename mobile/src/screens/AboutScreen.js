import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../constants/theme';
import ScreenContainer from '../components/ScreenContainer';
import { useResponsive, TEXT_PROPS } from '../utils/responsive';
import {
  APP_NAME,
  APP_TAGLINE,
  TERMS_OF_USE_TEXT,
  PRIVACY_POLICY_TEXT,
} from '../constants/legalText';

function getAppVersion() {
  try {
    const Constants = require('expo-constants');
    const version =
      Constants.default?.expoConfig?.version ||
      Constants.default?.manifest?.version;
    if (version) return version;
  } catch (e) {
    // expo-constants not installed or unavailable
  }

  try {
    const pkg = require('../../package.json');
    if (pkg && pkg.version) return pkg.version;
  } catch (e) {
    // fallback
  }

  return '1.0.0';
}

export default function AboutScreen({ navigation }) {
  const r = useResponsive();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(r, insets), [r, insets]);
  const appVersion = useMemo(() => getAppVersion(), []);

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          testID="about-back-btn"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={r.scale(24)} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text {...TEXT_PROPS} style={styles.headerTitle}>About MedTrack</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* App Info Card */}
        <View style={styles.appInfoCard}>
          <View style={styles.appIconCircle}>
            <Ionicons name="medical" size={r.scale(32)} color={COLORS.primary} />
          </View>
          <Text {...TEXT_PROPS} style={styles.appName}>{APP_NAME}</Text>
          <Text {...TEXT_PROPS} style={styles.appTagline}>{APP_TAGLINE}</Text>
          <View style={styles.versionBadge}>
            <Text {...TEXT_PROPS} style={styles.versionText} testID="about-app-version">
              Version {appVersion}
            </Text>
          </View>
          <Text {...TEXT_PROPS} style={styles.offlineNote}>
            100% Offline • Private • On-Device Storage Only
          </Text>
        </View>

        {/* Safety & Responsibilities Summary */}
        <View style={styles.noticeCard}>
          <View style={styles.noticeHeader}>
            <Ionicons name="shield-checkmark-outline" size={r.scale(20)} color={COLORS.primary} />
            <Text {...TEXT_PROPS} style={styles.noticeTitle}>Key Operational Principles</Text>
          </View>
          <View style={styles.bulletList}>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark-circle" size={r.scale(16)} color={COLORS.primary} style={styles.bulletIcon} />
              <Text {...TEXT_PROPS} style={styles.bulletText}>
                <Text style={styles.boldText}>Credit Ledger Provided "As Is": </Text>
                You must independently verify all bills, customer balances, and discounts.
              </Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark-circle" size={r.scale(16)} color={COLORS.primary} style={styles.bulletIcon} />
              <Text {...TEXT_PROPS} style={styles.bulletText}>
                <Text style={styles.boldText}>Device-Only Storage: </Text>
                All data is stored exclusively on this phone and is never sent to the developer.
              </Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark-circle" size={r.scale(16)} color={COLORS.primary} style={styles.bulletIcon} />
              <Text {...TEXT_PROPS} style={styles.bulletText}>
                <Text style={styles.boldText}>Backup Responsibility: </Text>
                You are solely responsible for exporting and preserving off-device backups.
              </Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark-circle" size={r.scale(16)} color={COLORS.primary} style={styles.bulletIcon} />
              <Text {...TEXT_PROPS} style={styles.bulletText}>
                <Text style={styles.boldText}>Reminder Convenience: </Text>
                Expiry alerts are an offline convenience, not a regulatory compliance guarantee.
              </Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark-circle" size={r.scale(16)} color={COLORS.primary} style={styles.bulletIcon} />
              <Text {...TEXT_PROPS} style={styles.bulletText}>
                <Text style={styles.boldText}>Customer Data: </Text>
                The shop owner is responsible for all customer data entered into the app.
              </Text>
            </View>
          </View>
        </View>

        {/* Terms of Use Section */}
        <View style={styles.sectionCard} testID="section-terms-of-use">
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={r.scale(22)} color={COLORS.primary} />
            <Text {...TEXT_PROPS} style={styles.sectionTitle}>Terms of Use</Text>
          </View>
          <ScrollView
            style={styles.legalTextBlock}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
            testID="text-terms-of-use"
          >
            <Text {...TEXT_PROPS} style={styles.legalBodyText}>
              {TERMS_OF_USE_TEXT}
            </Text>
          </ScrollView>
        </View>

        {/* Privacy Policy Section */}
        <View style={styles.sectionCard} testID="section-privacy-policy">
          <View style={styles.sectionHeader}>
            <Ionicons name="lock-closed-outline" size={r.scale(22)} color={COLORS.primary} />
            <Text {...TEXT_PROPS} style={styles.sectionTitle}>Privacy</Text>
          </View>
          <ScrollView
            style={styles.legalTextBlock}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
            testID="text-privacy-policy"
          >
            <Text {...TEXT_PROPS} style={styles.legalBodyText}>
              {PRIVACY_POLICY_TEXT}
            </Text>
          </ScrollView>
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
    paddingBottom: insets.bottom + r.moderate(32),
    gap: r.scale(16),
  },
  appInfoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: r.moderate(14),
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: r.moderate(20),
    alignItems: 'center',
  },
  appIconCircle: {
    width: r.scale(64),
    height: r.scale(64),
    borderRadius: r.scale(32),
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: r.scale(12),
  },
  appName: {
    fontSize: r.font(22),
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.3,
  },
  appTagline: {
    fontSize: r.font(14),
    color: COLORS.textSecondary,
    marginTop: r.scale(2),
  },
  versionBadge: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: r.moderate(999),
    paddingHorizontal: r.moderate(12),
    paddingVertical: r.moderate(4),
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: r.scale(8),
    marginBottom: r.scale(8),
  },
  versionText: {
    fontSize: r.font(12),
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  offlineNote: {
    fontSize: r.font(12),
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
  noticeCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: r.moderate(12),
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: r.moderate(16),
    gap: r.scale(12),
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.scale(8),
  },
  noticeTitle: {
    fontSize: r.font(15),
    fontWeight: '700',
    color: '#92400E',
  },
  bulletList: {
    gap: r.scale(8),
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: r.scale(8),
  },
  bulletIcon: {
    marginTop: r.scale(2),
  },
  bulletText: {
    flex: 1,
    fontSize: r.font(13),
    color: '#78350F',
    lineHeight: r.font(18),
  },
  boldText: {
    fontWeight: '700',
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
  },
  sectionTitle: {
    fontSize: r.font(16),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  legalTextBlock: {
    maxHeight: r.scale(200),
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: r.moderate(8),
    padding: r.moderate(12),
  },
  legalBodyText: {
    fontSize: r.font(12.5),
    color: COLORS.textPrimary,
    lineHeight: r.font(19),
    fontFamily: undefined,
  },
});
