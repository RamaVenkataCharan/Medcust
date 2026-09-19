import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS } from '../constants/theme';
import { addCustomer, getCustomerByPhone } from '../db/database';
import { cleanPhoneNumber } from '../utils/khataLogic';

export default function AddCustomerScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 24);

  const initialValue = route.params?.initialPhoneOrName || '';
  const isNumericInitial = /^\d+$/.test(initialValue);

  const [name, setName] = useState(!isNumericInitial ? initialValue : '');
  const [phone, setPhone] = useState(isNumericInitial ? initialValue : '');
  const [village, setVillage] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

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
      // 1. Check for existing customer by phone number
      const existing = getCustomerByPhone(cleanPhone);
      if (existing) {
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
        return;
      }

      // 2. Add new customer
      const newId = addCustomer({
        name: trimmedName,
        phone_number: cleanPhone,
        village: village.trim(),
        address: address.trim(),
      });

      // 3. Immediately open newly created profile
      navigation.replace('CustomerProfile', { customerId: newId });
    } catch (err) {
      console.error('Error adding customer:', err);
      Alert.alert('Error', 'Failed to save customer: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
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
          <Text style={styles.title}>New Customer</Text>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, SPACING.xxxl) + 20 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Form Card */}
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Customer Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Ramesh Kumar"
                placeholderTextColor={COLORS.textTertiary}
                value={name}
                onChangeText={setName}
                autoFocus={!isNumericInitial}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number (10 digits) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 9876543210"
                placeholderTextColor={COLORS.textTertiary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
                autoFocus={isNumericInitial}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Village / Locality (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Nizampet"
                placeholderTextColor={COLORS.textTertiary}
                value={village}
                onChangeText={setVillage}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address / Landmark (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="e.g. Near Ramalayam Temple"
                placeholderTextColor={COLORS.textTertiary}
                value={address}
                onChangeText={setAddress}
                multiline={true}
                numberOfLines={2}
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
            <Ionicons name="checkmark-circle-outline" size={22} color={COLORS.textInverted} />
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save & Open Profile'}</Text>
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
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
  },
  title: {
    ...FONTS.title,
  },
  formCard: {
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
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  label: {
    ...FONTS.bodySecondary,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs + 2,
  },
  input: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 52,
    ...FONTS.body,
  },
  textArea: {
    height: 70,
    paddingTop: SPACING.md,
    textAlignVertical: 'top',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    height: 54,
    borderRadius: RADIUS.pill,
    gap: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
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
