import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet
} from 'react-native';
import CustomTextInput from '../components/CustomTextInput';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { getCustomerById, addDuePayment, getCustomerLedger } from '../db/database';
import { calculateCustomerTotalDue } from '../utils/khataLogic';
import { formatINR, formatPhone, paise, fromPaise } from '../utils/formatUtils';
import { useResponsive, TEXT_PROPS } from '../utils/responsive';
import ScreenContainer from '../components/ScreenContainer';
import StickyFooter from '../components/StickyFooter';

const PRESET_AMOUNTS = [100, 200, 500];

const PAYMENT_MODES = [
  { id: 'Cash', label: 'Cash', icon: 'cash-outline' },
  { id: 'UPI', label: 'UPI', icon: 'navigate-outline' },
  { id: 'Bank', label: 'Bank', icon: 'business-outline' },
];

const AmountChip = memo(({ label, value, currentAmount, onPress, disabled, styles }) => {
  const isSelected = paise(currentAmount) === paise(value);
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        isSelected && styles.chipSelected,
        disabled && styles.chipDisabled,
      ]}
      onPress={() => onPress(value)}
      disabled={disabled}
      accessibilityLabel={`Set amount to ${label}`}
    >
      <Text {...TEXT_PROPS} style={[styles.chipText, isSelected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

const PaymentModeTile = memo(({ mode, isSelected, onSelect, styles }) => {
  return (
    <TouchableOpacity
      style={[styles.modeTile, isSelected && styles.modeTileSelected]}
      onPress={() => onSelect(mode.id)}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`Select ${mode.label}`}
    >
      <View style={styles.modeTileRadioContainer}>
        <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
          {isSelected && <View style={styles.radioDot} />}
        </View>
      </View>
      <Ionicons
        name={mode.icon}
        size={24}
        color={isSelected ? COLORS.primary : COLORS.textSecondary}
        style={styles.modeTileIcon}
      />
      <Text {...TEXT_PROPS} style={[styles.modeTileText, isSelected && styles.modeTileTextSelected]}>
        {mode.label}
      </Text>
    </TouchableOpacity>
  );
});

export default function RecordPaymentScreen({ route, navigation }) {
  const { customerId } = route.params;

  const [customer, setCustomer] = useState(null);
  const [currentDue, setCurrentDue] = useState(0);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [footerH, setFooterH] = useState(0);

  const r = useResponsive();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(r, footerH, insets), [r, footerH, insets]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      try {
        const cust = getCustomerById(customerId);
        if (!cust) {
          if (isActive) {
            Alert.alert('Error', 'Customer not found.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          }
          return;
        }

        const entries = getCustomerLedger(customerId);
        const due = calculateCustomerTotalDue(entries);

        if (isActive) {
          setCustomer(cust);
          setCurrentDue(due);
          if (amount === '' && due > 0) {
            setAmount(due.toString());
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading customer for payment:', err);
        if (isActive) {
          Alert.alert('Error', 'Could not load customer data.');
          navigation.goBack();
        }
      }

      return () => {
        isActive = false;
      };
    }, [customerId, navigation])
  );

  if (!loading && currentDue <= 0) {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={r.scale(24)} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text {...TEXT_PROPS} style={styles.headerTitle}>Record Due Payment</Text>
        </View>
        <View style={styles.centeredMessage}>
          <Ionicons name="checkmark-circle-outline" size={r.scale(64)} color={COLORS.paymentGreen} />
          <Text {...TEXT_PROPS} style={styles.messageText}>No dues to collect</Text>
        </View>
      </ScreenContainer>
    );
  }

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  };

  function sanitiseNumeric(val) {
    const clean = val.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : clean;
    return sanitized.includes('.')
      ? sanitized.split('.')[0] + '.' + sanitized.split('.')[1].slice(0, 2)
      : sanitized;
  }

  const parsedAmountPaise = paise(amount);
  const currentDuePaise = paise(currentDue);
  
  let inlineError = '';
  if (parsedAmountPaise > currentDuePaise) {
    inlineError = `Amount cannot exceed the current due (${formatINR(currentDue)})`;
  } else if (amountError) {
    inlineError = amountError;
  }

  const isFormValid = parsedAmountPaise > 0 && parsedAmountPaise <= currentDuePaise;

  const handleSave = async () => {
    if (!isFormValid) return;
    setSaving(true);
    setAmountError('');

    try {
      const entries = getCustomerLedger(customerId);
      const latestDue = calculateCustomerTotalDue(entries);
      const latestDuePaise = paise(latestDue);

      if (parsedAmountPaise > latestDuePaise) {
        setSaving(false);
        setAmountError(`Amount cannot exceed the current due (${formatINR(latestDue)})`);
        return;
      }

      const formattedNote = note.trim() ? `${paymentMode} - ${note.trim()}` : paymentMode;

      addDuePayment({
        customerId,
        amountPaid: fromPaise(parsedAmountPaise),
        note: formattedNote,
      });

      const remainingDuePaise = latestDuePaise - parsedAmountPaise;

      if (remainingDuePaise <= 0) {
        Alert.alert('Success', 'Dues cleared!', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        navigation.goBack();
      }
    } catch (err) {
      console.error('Error saving payment:', err);
      Alert.alert('Save Failed', 'Could not record the payment.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: r.scale(50) }} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={r.scale(24)} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text {...TEXT_PROPS} style={styles.headerTitle}>Record Due Payment</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {customer && (
            <View style={styles.customerCard}>
              <View style={styles.avatarCircle}>
                <Text {...TEXT_PROPS} style={styles.avatarText}>{getInitials(customer.name)}</Text>
              </View>
              <View style={styles.customerTextBlock}>
                <Text {...TEXT_PROPS} style={styles.customerName} numberOfLines={1}>{customer.name}</Text>
                {customer.phone_number ? (
                  <Text {...TEXT_PROPS} style={styles.customerPhone} numberOfLines={1}>{formatPhone(customer.phone_number)}</Text>
                ) : null}
                {customer.village ? (
                  <View style={styles.villageRow}>
                    <Ionicons name="location-sharp" size={r.scale(12)} color={COLORS.textSecondary} />
                    <Text {...TEXT_PROPS} style={styles.villageText} numberOfLines={1}>{customer.village}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          )}

          <View style={styles.currentDueCard}>
            <View style={styles.documentCircle}>
              <Ionicons name="document-text-outline" size={r.scale(28)} color={COLORS.greenText} />
            </View>
            <View style={styles.currentDueTextBlock}>
              <Text {...TEXT_PROPS} style={styles.currentDueLabel}>Current Due</Text>
              <Text {...TEXT_PROPS} style={styles.currentDueAmount}>{formatINR(currentDue)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text {...TEXT_PROPS} style={styles.cardTitle}>Amount Received</Text>
            <View style={styles.amountInputContainer}>
              <Text {...TEXT_PROPS} style={styles.currencySymbol}>₹</Text>
              <CustomTextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={(val) => {
                  setAmount(sanitiseNumeric(val));
                  setAmountError('');
                }}
                keyboardType="decimal-pad"
                selectTextOnFocus
                placeholder="0.00"
                placeholderTextColor={COLORS.textTertiary}
                {...TEXT_PROPS}
              />
            </View>
            {inlineError ? <Text {...TEXT_PROPS} style={styles.inlineError}>{inlineError}</Text> : null}

            <View style={styles.chipsRow}>
              {PRESET_AMOUNTS.map((val) => {
                if (paise(val) > currentDuePaise) return null;
                return (
                  <AmountChip
                    key={val}
                    label={`₹${val}`}
                    value={val}
                    currentAmount={amount}
                    onPress={(v) => setAmount(v.toString())}
                    styles={styles}
                  />
                );
              })}
              <AmountChip
                label="Pay Remaining"
                value={currentDue}
                currentAmount={amount}
                onPress={(v) => setAmount(v.toString())}
                styles={styles}
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text {...TEXT_PROPS} style={styles.cardTitle}>Payment Mode</Text>
            <View style={styles.modeTilesRow}>
              {PAYMENT_MODES.map((mode) => (
                <PaymentModeTile
                  key={mode.id}
                  mode={mode}
                  isSelected={paymentMode === mode.id}
                  onSelect={setPaymentMode}
                  styles={styles}
                />
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text {...TEXT_PROPS} style={styles.cardTitle}>Note (Optional)</Text>
            <CustomTextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="e.g. paid at counter"
              placeholderTextColor={COLORS.textTertiary}
              maxLength={120}
              returnKeyType="done"
              {...TEXT_PROPS}
            />
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        <StickyFooter onHeight={setFooterH}>
          <TouchableOpacity
            style={[styles.saveBtn, (!isFormValid || saving) && styles.saveBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleSave}
            disabled={!isFormValid || saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.textInverted} size="small" />
            ) : (
              <Text {...TEXT_PROPS} style={styles.saveBtnText}>Save Payment</Text>
            )}
          </TouchableOpacity>
          <View style={styles.saveCaptionRow}>
            <Ionicons name="shield-checkmark" size={r.scale(14)} color={COLORS.paymentGreen} />
            <Text {...TEXT_PROPS} style={styles.saveCaption}>Balance updates from recorded payments</Text>
          </View>
        </StickyFooter>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const makeStyles = (r, footerH, insets) => StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: r.moderate(16),
    paddingVertical: r.moderate(12),
  },
  backBtn: {
    minHeight: r.touch,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: r.moderate(8),
  },
  headerTitle: {
    fontSize: r.font(24),
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  centeredMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageText: {
    marginTop: r.moderate(12),
    fontSize: r.font(18),
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  scrollContent: {
    paddingHorizontal: r.moderate(16),
    paddingTop: r.moderate(4),
    paddingBottom: footerH + 16,
  },
  bottomSpacer: {
    height: r.moderate(32),
  },
  customerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: r.moderate(14),
    paddingHorizontal: r.moderate(16),
    paddingVertical: r.moderate(12),
    marginBottom: r.moderate(16),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  avatarCircle: {
    width: r.scale(64),
    height: r.scale(64),
    borderRadius: r.scale(32),
    backgroundColor: COLORS.avatarBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: r.moderate(12),
  },
  avatarText: {
    fontSize: r.font(24),
    fontWeight: '700',
    color: COLORS.primary,
  },
  customerTextBlock: {
    flex: 1,
  },
  customerName: {
    fontSize: r.font(22),
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: r.scale(4),
  },
  customerPhone: {
    fontSize: r.font(14),
    color: COLORS.textSecondary,
    marginBottom: r.scale(4),
  },
  villageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  villageText: {
    fontSize: r.font(13),
    color: COLORS.textSecondary,
    marginLeft: r.scale(4),
  },
  currentDueCard: {
    backgroundColor: COLORS.greenCircleBg,
    borderRadius: r.moderate(14),
    paddingHorizontal: r.moderate(16),
    paddingVertical: r.moderate(12),
    marginBottom: r.moderate(20),
    flexDirection: 'row',
    alignItems: 'center',
  },
  documentCircle: {
    width: r.scale(56),
    height: r.scale(56),
    borderRadius: r.scale(28),
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: r.moderate(12),
  },
  currentDueTextBlock: {
    flex: 1,
  },
  currentDueLabel: {
    fontSize: r.font(14),
    fontWeight: '600',
    color: COLORS.greenText,
    marginBottom: r.scale(4),
  },
  currentDueAmount: {
    fontSize: r.font(32),
    fontWeight: '700',
    color: COLORS.greenText,
    letterSpacing: -0.5,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: r.moderate(14),
    padding: r.moderate(16),
    marginBottom: r.moderate(16),
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTitle: {
    fontSize: r.font(16),
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: r.moderate(12),
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.borderStrong,
    paddingBottom: r.scale(4),
    marginBottom: r.moderate(12),
  },
  currencySymbol: {
    fontSize: r.font(24),
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginRight: r.scale(4),
  },
  amountInput: {
    flex: 1,
    fontSize: r.font(28),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  inlineError: {
    color: COLORS.danger,
    fontSize: r.font(13),
    marginTop: r.scale(-8),
    marginBottom: r.moderate(12),
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: r.scale(8),
  },
  chip: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: r.moderate(12),
    paddingVertical: r.moderate(8),
    borderRadius: r.moderate(999),
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    fontSize: r.font(14),
    fontWeight: '600',
    color: COLORS.primary,
  },
  chipTextSelected: {
    color: COLORS.textInverted,
  },
  modeTilesRow: {
    flexDirection: 'row',
    gap: r.scale(12),
  },
  modeTile: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: r.moderate(10),
    padding: r.moderate(12),
    minHeight: r.scale(96),
    justifyContent: 'space-between',
  },
  modeTileSelected: {
    backgroundColor: COLORS.avatarBg,
    borderColor: COLORS.primary,
  },
  modeTileRadioContainer: {
    alignItems: 'flex-end',
  },
  radioCircle: {
    width: r.scale(20),
    height: r.scale(20),
    borderRadius: r.scale(10),
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: COLORS.primary,
  },
  radioDot: {
    width: r.scale(10),
    height: r.scale(10),
    borderRadius: r.scale(5),
    backgroundColor: COLORS.primary,
  },
  modeTileIcon: {
    marginTop: r.scale(4),
  },
  modeTileText: {
    fontSize: r.font(14),
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: r.scale(4),
  },
  modeTileTextSelected: {
    color: COLORS.primary,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: r.moderate(10),
    paddingHorizontal: r.moderate(12),
    paddingVertical: r.moderate(12),
    fontSize: r.font(15),
    color: COLORS.textPrimary,
  },
  saveContainer: {
    paddingHorizontal: r.moderate(16),
    paddingTop: r.moderate(8),
    paddingBottom: insets.bottom + r.moderate(16),
    backgroundColor: COLORS.background,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    height: r.scale(56),
    borderRadius: r.moderate(14),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  saveBtnDisabled: {
    opacity: 0.45,
  },
  saveBtnText: {
    fontSize: r.font(17),
    fontWeight: '700',
    color: COLORS.textInverted,
    letterSpacing: 0.2,
  },
  saveCaptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: r.moderate(8),
  },
  saveCaption: {
    fontSize: r.font(12),
    color: COLORS.textSecondary,
    marginLeft: r.scale(6),
  },
});
