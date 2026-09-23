import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS } from '../constants/theme';
import { getShopProfile, saveShopProfile } from '../db/database';

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 24);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [profile, setProfile] = useState({
    shop_name: '',
    shop_license_no: '',
    shop_license_validity: '',
    shop_phone: '',
    pharmacist_name: '',
    pharmacist_phone: '',
    pharmacist_license_validity: '',
  });

  useEffect(() => {
    try {
      const data = getShopProfile();
      if (data) {
        setProfile({
          shop_name: data.shop_name || '',
          shop_license_no: data.shop_license_no || '',
          shop_license_validity: data.shop_license_validity || '',
          shop_phone: data.shop_phone || '',
          pharmacist_name: data.pharmacist_name || '',
          pharmacist_phone: data.pharmacist_phone || '',
          pharmacist_license_validity: data.pharmacist_license_validity || '',
        });
      }
    } catch (e) {
      console.warn('Could not load shop profile:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    if (savedSuccess) setSavedSuccess(false);
  };

  const handleSave = () => {
    setSaving(true);
    try {
      saveShopProfile(profile);
      setSavedSuccess(true);
      Alert.alert('Settings Saved', 'Shop and Pharmacist profile updated successfully.');
    } catch (err) {
      console.error('Failed to save shop profile:', err);
      Alert.alert('Save Failed', err.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Helper to check if a date string is in the past.
   * Returns true only if it is a parseable date strictly before today.
   */
  const isDateInPast = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return false;
    const trimmed = dateStr.trim();
    if (!trimmed) return false;
    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) return false;

    // Compare date portions at local midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    parsed.setHours(0, 0, 0, 0);
    return parsed < today;
  };

  const shopExpired = isDateInPast(profile.shop_license_validity);
  const pharmacistExpired = isDateInPast(profile.pharmacist_license_validity);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: topInset + SPACING.sm }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={26} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Shop & Pharmacist Profile</Text>
            <Text style={styles.subtitle}>Display & business license details</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, SPACING.xxxl) + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Shop Information Section */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="business-outline" size={20} color={COLORS.primary} />
              <Text style={styles.cardHeaderTitle}>Shop Information</Text>
            </View>

            {/* Shop Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Shop Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Laxmi Medical Stores"
                placeholderTextColor={COLORS.textTertiary}
                value={profile.shop_name}
                onChangeText={(val) => handleChange('shop_name', val)}
                autoCapitalize="words"
              />
            </View>

            {/* Shop Phone */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Shop Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="10-digit mobile or landline"
                placeholderTextColor={COLORS.textTertiary}
                value={profile.shop_phone}
                onChangeText={(val) => handleChange('shop_phone', val)}
                keyboardType="phone-pad"
              />
            </View>

            {/* Shop License Number */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Shop License Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. DL-20B-12345 / Form 20/21"
                placeholderTextColor={COLORS.textTertiary}
                value={profile.shop_license_no}
                onChangeText={(val) => handleChange('shop_license_no', val)}
                autoCapitalize="characters"
              />
            </View>

            {/* Shop License Validity */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelWithTagRow}>
                <Text style={styles.fieldLabel}>Shop License Validity</Text>
                {shopExpired && (
                  <View style={styles.neutralTag}>
                    <Text style={styles.neutralTagText}>Expired</Text>
                  </View>
                )}
              </View>
              <TextInput
                style={[styles.input, shopExpired && styles.inputMuted]}
                placeholder="YYYY-MM-DD (e.g. 2027-12-31)"
                placeholderTextColor={COLORS.textTertiary}
                value={profile.shop_license_validity}
                onChangeText={(val) => handleChange('shop_license_validity', val)}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          {/* Pharmacist Information Section */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="person-outline" size={20} color={COLORS.primary} />
              <Text style={styles.cardHeaderTitle}>Pharmacist Information</Text>
            </View>

            {/* Pharmacist Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Pharmacist Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. R. K. Sharma (Reg. Pharmacist)"
                placeholderTextColor={COLORS.textTertiary}
                value={profile.pharmacist_name}
                onChangeText={(val) => handleChange('pharmacist_name', val)}
                autoCapitalize="words"
              />
            </View>

            {/* Pharmacist Phone */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Pharmacist Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="10-digit mobile number"
                placeholderTextColor={COLORS.textTertiary}
                value={profile.pharmacist_phone}
                onChangeText={(val) => handleChange('pharmacist_phone', val)}
                keyboardType="phone-pad"
              />
            </View>

            {/* Pharmacist License Validity */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelWithTagRow}>
                <Text style={styles.fieldLabel}>Pharmacist License Validity</Text>
                {pharmacistExpired && (
                  <View style={styles.neutralTag}>
                    <Text style={styles.neutralTagText}>Expired</Text>
                  </View>
                )}
              </View>
              <TextInput
                style={[styles.input, pharmacistExpired && styles.inputMuted]}
                placeholder="YYYY-MM-DD (e.g. 2026-06-30)"
                placeholderTextColor={COLORS.textTertiary}
                value={profile.pharmacist_license_validity}
                onChangeText={(val) => handleChange('pharmacist_license_validity', val)}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            activeOpacity={0.85}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.textInverted} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={22} color={COLORS.textInverted} />
                <Text style={styles.saveBtnText}>Save Profile</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  backBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.xs,
  },
  title: {
    ...FONTS.title,
    fontSize: 20,
  },
  subtitle: {
    ...FONTS.subtext,
    color: COLORS.textSecondary,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.surface,
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
    marginBottom: SPACING.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceSubtle,
  },
  cardHeaderTitle: {
    ...FONTS.header,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  fieldGroup: {
    marginBottom: SPACING.md,
  },
  labelWithTagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    ...FONTS.subtext,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 6,
  },
  neutralTag: {
    backgroundColor: COLORS.clearBadgeBg,
    borderColor: COLORS.clearBadgeBorder,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
  },
  neutralTagText: {
    fontSize: 11,
    color: COLORS.clearBadgeText,
    fontWeight: '500',
  },
  input: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    ...FONTS.body,
    fontSize: 14,
  },
  inputMuted: {
    color: COLORS.textSecondary,
    borderColor: COLORS.borderStrong,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: RADIUS.pill,
    gap: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
    marginTop: SPACING.xs,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    ...FONTS.body,
    fontWeight: '700',
    color: COLORS.textInverted,
    fontSize: 16,
  },
});
