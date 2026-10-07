import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet
} from 'react-native';
import CustomTextInput from '../components/CustomTextInput';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { addCustomer, getCustomerByPhone } from '../db/database';
import { cleanPhoneNumber } from '../utils/khataLogic';
import { useResponsive, TEXT_PROPS } from '../utils/responsive';
import ScreenContainer from '../components/ScreenContainer';
import StickyFooter from '../components/StickyFooter';

export default function AddCustomerScreen({ navigation, route }) {
  const initialValue = route.params?.initialPhoneOrName || '';
  const isNumericInitial = /^\d+$/.test(initialValue);

  const [name, setName] = useState(!isNumericInitial ? initialValue : '');
  const [phone, setPhone] = useState(isNumericInitial ? initialValue : '');
  const [village, setVillage] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [footerH, setFooterH] = useState(0);

  const r = useResponsive();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(r, footerH), [r, footerH]);

  const handleSave = () => {
    const trimmedName = name.trim();
    const cleanPhone = cleanPhoneNumber(phone);

    if (!trimmedName) {
      Alert.alert('Name Required', 'Please enter customer name.');
      return;
    }

    if (cleanPhone.length < 10) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setSaving(true);
    try {
      const existing = getCustomerByPhone(cleanPhone);
      if (existing) {
        if (existing.deleted_at) {
          Alert.alert(
            'Number in Recycle Bin',
            `This number is in the Recycle Bin. Restore it instead?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Restore',
                onPress: () => {
                  import('../db/database').then(({ restoreDeletedCustomer }) => {
                    restoreDeletedCustomer(existing.customer_id);
                    navigation.replace('CustomerProfile', { customerId: existing.customer_id });
                  });
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Customer Already Exists',
            `"${existing.name}" is already registered with this phone number. Opening profile...`,
            [
              {
                text: 'Open Profile',
                onPress: () => {
                  navigation.replace('CustomerProfile', { customerId: existing.customer_id });
                },
              },
            ]
          );
        }
        return;
      }

      const newId = addCustomer({
        name: trimmedName,
        phone_number: cleanPhone,
        village: village.trim(),
        address: address.trim(),
      });

      navigation.replace('CustomerProfile', { customerId: newId });
    } catch (err) {
      console.error('Error adding customer:', err);
      Alert.alert('Error', 'Failed to save customer: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={r.scale(24)} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text {...TEXT_PROPS} style={styles.title}>New Customer</Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text {...TEXT_PROPS} style={styles.label}>Customer Name *</Text>
              <CustomTextInput
                style={styles.input}
                placeholder="e.g. Ramesh Kumar"
                placeholderTextColor={COLORS.textTertiary}
                value={name}
                onChangeText={setName}
                autoFocus={!isNumericInitial}
                autoCapitalize="words"
                maxFontSizeMultiplier={1.3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text {...TEXT_PROPS} style={styles.label}>Phone Number (10 digits) *</Text>
              <CustomTextInput
                style={styles.input}
                placeholder="e.g. 9876543210"
                placeholderTextColor={COLORS.textTertiary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
                autoFocus={isNumericInitial}
                maxFontSizeMultiplier={1.3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text {...TEXT_PROPS} style={styles.label}>Village / Locality (Optional)</Text>
              <CustomTextInput
                style={styles.input}
                placeholder="e.g. Nizampet"
                placeholderTextColor={COLORS.textTertiary}
                value={village}
                onChangeText={setVillage}
                autoCapitalize="words"
                maxFontSizeMultiplier={1.3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text {...TEXT_PROPS} style={styles.label}>Address / Landmark (Optional)</Text>
              <CustomTextInput
                style={[styles.input, styles.textArea]}
                placeholder="e.g. Near Ramalayam Temple"
                placeholderTextColor={COLORS.textTertiary}
                value={address}
                onChangeText={setAddress}
                multiline={true}
                numberOfLines={2}
                maxFontSizeMultiplier={1.3}
              />
            </View>
          </View>
        </ScrollView>
        <StickyFooter onHeight={setFooterH}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            activeOpacity={0.85}
            onPress={handleSave}
            disabled={saving}
          >
            <Ionicons name="checkmark-circle-outline" size={r.scale(22)} color={COLORS.textInverted} />
            <Text {...TEXT_PROPS} style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save & Open Profile'}</Text>
          </TouchableOpacity>
        </StickyFooter>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const makeStyles = (r, footerH) => StyleSheet.create({
  scrollContent: {
    padding: r.moderate(20),
    paddingBottom: footerH + 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: r.moderate(20),
  },
  backBtn: {
    marginRight: r.moderate(12),
    padding: r.moderate(4),
    minHeight: r.touch,
    justifyContent: 'center',
  },
  title: {
    fontSize: r.font(22),
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  formCard: {
    backgroundColor: COLORS.surface,
    padding: r.moderate(20),
    borderRadius: r.moderate(14),
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
    marginBottom: r.moderate(20),
  },
  inputGroup: {
    marginBottom: r.moderate(16),
  },
  label: {
    fontSize: r.font(14),
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: r.scale(6),
  },
  input: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: r.moderate(10),
    paddingHorizontal: r.moderate(12),
    height: r.scale(52),
    fontSize: r.font(15),
    color: COLORS.textPrimary,
  },
  textArea: {
    height: r.scale(70),
    paddingTop: r.moderate(12),
    textAlignVertical: 'top',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    height: r.scale(54),
    borderRadius: r.moderate(999),
    gap: r.scale(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
    minHeight: r.touch,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: r.font(16),
    fontWeight: '700',
    color: COLORS.textInverted,
  },
});
