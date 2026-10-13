import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../constants/theme';
import ScreenContainer from '../components/ScreenContainer';
import CustomTextInput from '../components/CustomTextInput';
import { useResponsive, TEXT_PROPS } from '../utils/responsive';
import { getShopProfile, saveShopProfile } from '../db/database';
import {
  validateShopProfile,
  isLicenseExpired,
} from '../utils/shopProfileValidation';

export default function ProfileScreen({ navigation }) {
  const [profile, setProfile] = useState({
    shop_name: '',
    shop_license_no: '',
    shop_license_validity: '',
    shop_phone: '',
    pharmacist_name: '',
    pharmacist_phone: '',
    pharmacist_license_validity: '',
  });
  const [errors, setErrors] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);

  const r = useResponsive();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(r, insets), [r, insets]);

  useEffect(() => {
    try {
      const sp = getShopProfile();
      if (sp) {
        setProfile({
          shop_name: sp.shop_name || '',
          shop_license_no: sp.shop_license_no || '',
          shop_license_validity: sp.shop_license_validity || '',
          shop_phone: sp.shop_phone || '',
          pharmacist_name: sp.pharmacist_name || '',
          pharmacist_phone: sp.pharmacist_phone || '',
          pharmacist_license_validity: sp.pharmacist_license_validity || '',
        });
      }
    } catch (e) {
      console.warn('Failed to load shop profile:', e);
    }
  }, []);

  const handleProfileChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  const handleSaveProfile = () => {
    const val = validateShopProfile(profile);
    if (!val.isValid) {
      setErrors(val.errors);
      Alert.alert('Validation Error', 'Please correct the highlighted fields before saving.');
      return;
    }

    setErrors({});
    setSavingProfile(true);
    try {
      saveShopProfile(profile);
      Alert.alert('Saved', 'Shop and Pharmacist profile updated successfully.');
    } catch (err) {
      Alert.alert('Save Failed', err.message || 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const isShopExpired = useMemo(
    () => isLicenseExpired(profile.shop_license_validity),
    [profile.shop_license_validity]
  );
  const isPharmacistExpired = useMemo(
    () => isLicenseExpired(profile.pharmacist_license_validity),
    [profile.pharmacist_license_validity]
  );

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          testID="profile-back-btn"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={r.scale(24)} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text {...TEXT_PROPS} style={styles.headerTitle}>Shop & Pharmacist Profile</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* Shop Details Card */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="business-outline" size={r.scale(22)} color={COLORS.primary} />
              <Text {...TEXT_PROPS} style={styles.sectionTitle}>Shop Details</Text>
            </View>

            {/* Shop Name */}
            <View style={styles.inputGroup}>
              <Text {...TEXT_PROPS} style={styles.inputLabel}>Shop / Medical Store Name</Text>
              <CustomTextInput
                style={styles.textInput}
                placeholder="e.g. Sri Krishna Medicos"
                placeholderTextColor={COLORS.textTertiary}
                value={profile.shop_name}
                onChangeText={(val) => handleProfileChange('shop_name', val)}
                testID="input-shop-name"
              />
            </View>

            {/* Shop Phone */}
            <View style={styles.inputGroup}>
              <Text {...TEXT_PROPS} style={styles.inputLabel}>Shop Contact Phone</Text>
              <CustomTextInput
                style={[styles.textInput, errors.shop_phone && styles.inputError]}
                placeholder="10-digit mobile number"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="phone-pad"
                value={profile.shop_phone}
                onChangeText={(val) => handleProfileChange('shop_phone', val)}
                testID="input-shop-phone"
              />
              {errors.shop_phone && (
                <Text {...TEXT_PROPS} style={styles.errorText}>{errors.shop_phone}</Text>
              )}
            </View>

            {/* Shop License Number */}
            <View style={styles.inputGroup}>
              <Text {...TEXT_PROPS} style={styles.inputLabel}>Drug License (DL) Number</Text>
              <CustomTextInput
                style={styles.textInput}
                placeholder="e.g. DL-20B-12345"
                placeholderTextColor={COLORS.textTertiary}
                value={profile.shop_license_no}
                onChangeText={(val) => handleProfileChange('shop_license_no', val)}
                testID="input-shop-license"
              />
            </View>

            {/* Shop License Validity */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text {...TEXT_PROPS} style={styles.inputLabel}>DL Validity Date</Text>
                {isShopExpired && (
                  <View style={styles.expiredBadge}>
                    <Text {...TEXT_PROPS} style={styles.expiredBadgeText}>EXPIRED</Text>
                  </View>
                )}
              </View>
              <CustomTextInput
                style={[styles.textInput, isShopExpired && styles.inputWarning, errors.shop_license_validity && styles.inputError]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textTertiary}
                value={profile.shop_license_validity}
                onChangeText={(val) => handleProfileChange('shop_license_validity', val)}
                testID="input-shop-validity"
              />
              {errors.shop_license_validity && (
                <Text {...TEXT_PROPS} style={styles.errorText}>{errors.shop_license_validity}</Text>
              )}
            </View>
          </View>

          {/* Pharmacist Details Card */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="medical-outline" size={r.scale(22)} color={COLORS.primary} />
              <Text {...TEXT_PROPS} style={styles.sectionTitle}>Pharmacist Details</Text>
            </View>

            {/* Pharmacist Name */}
            <View style={styles.inputGroup}>
              <Text {...TEXT_PROPS} style={styles.inputLabel}>Registered Pharmacist Name</Text>
              <CustomTextInput
                style={styles.textInput}
                placeholder="e.g. Dr. / Mr. Registered Pharmacist"
                placeholderTextColor={COLORS.textTertiary}
                value={profile.pharmacist_name}
                onChangeText={(val) => handleProfileChange('pharmacist_name', val)}
                testID="input-pharmacist-name"
              />
            </View>

            {/* Pharmacist Phone */}
            <View style={styles.inputGroup}>
              <Text {...TEXT_PROPS} style={styles.inputLabel}>Pharmacist Mobile Phone</Text>
              <CustomTextInput
                style={[styles.textInput, errors.pharmacist_phone && styles.inputError]}
                placeholder="10-digit mobile number"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="phone-pad"
                value={profile.pharmacist_phone}
                onChangeText={(val) => handleProfileChange('pharmacist_phone', val)}
                testID="input-pharmacist-phone"
              />
              {errors.pharmacist_phone && (
                <Text {...TEXT_PROPS} style={styles.errorText}>{errors.pharmacist_phone}</Text>
              )}
            </View>

            {/* Pharmacist License Validity */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text {...TEXT_PROPS} style={styles.inputLabel}>Pharmacist Reg. Validity Date</Text>
                {isPharmacistExpired && (
                  <View style={styles.expiredBadge}>
                    <Text {...TEXT_PROPS} style={styles.expiredBadgeText}>EXPIRED</Text>
                  </View>
                )}
              </View>
              <CustomTextInput
                style={[styles.textInput, isPharmacistExpired && styles.inputWarning, errors.pharmacist_license_validity && styles.inputError]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textTertiary}
                value={profile.pharmacist_license_validity}
                onChangeText={(val) => handleProfileChange('pharmacist_license_validity', val)}
                testID="input-pharmacist-validity"
              />
              {errors.pharmacist_license_validity && (
                <Text {...TEXT_PROPS} style={styles.errorText}>{errors.pharmacist_license_validity}</Text>
              )}
            </View>
          </View>

          {/* Save Profile Button */}
          <TouchableOpacity
            style={styles.saveProfileBtn}
            onPress={handleSaveProfile}
            disabled={savingProfile}
            testID="btn-save-profile"
            activeOpacity={0.8}
          >
            {savingProfile ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={r.scale(20)} color="#fff" />
                <Text {...TEXT_PROPS} style={styles.saveProfileBtnText}>Save Profile</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
    gap: r.scale(16),
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
  inputGroup: {
    gap: r.scale(4),
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: r.font(13),
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  textInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: r.moderate(8),
    paddingHorizontal: r.moderate(12),
    paddingVertical: r.moderate(10),
    fontSize: r.font(14),
    color: COLORS.textPrimary,
  },
  inputWarning: {
    borderColor: '#E65100',
    backgroundColor: '#FFF8E1',
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  expiredBadge: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: r.moderate(6),
    paddingVertical: r.moderate(2),
    borderRadius: r.moderate(4),
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  expiredBadgeText: {
    fontSize: r.font(10),
    fontWeight: '700',
    color: '#C62828',
  },
  errorText: {
    fontSize: r.font(11),
    color: COLORS.danger,
    marginTop: r.scale(2),
  },
  saveProfileBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    padding: r.moderate(14),
    borderRadius: r.moderate(10),
    alignItems: 'center',
    justifyContent: 'center',
    gap: r.scale(8),
    marginTop: r.scale(4),
  },
  saveProfileBtnText: {
    color: '#fff',
    fontSize: r.font(15),
    fontWeight: '600',
  },
});
