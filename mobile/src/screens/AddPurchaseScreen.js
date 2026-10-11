import React, { useState, useEffect } from 'react';
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
import { addPurchaseEntry, getPastMedicineNames } from '../db/database';
import { calculateBillDiscount, calculateEntryDue, calculateLineTotal, calculatePurchaseTotal } from '../utils/khataLogic';

export default function AddPurchaseScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 24);

  const { customerId, customerName } = route.params;

  // Medicine list: array of { id, name, price, discount }
  const [medicines, setMedicines] = useState([
    { id: '1', name: '', price: '', discount: '' },
  ]);
  const [pastSuggestions, setPastSuggestions] = useState([]);
  const [discountPercent, setDiscountPercent] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const names = getPastMedicineNames();
      setPastSuggestions(names);
    } catch (e) {
      console.warn('Could not load past medicine names:', e);
    }
  }, []);

  const addMedicineRow = () => {
    setMedicines((prev) => [
      ...prev,
      { id: String(Date.now() + Math.random()), name: '', price: '', discount: '' },
    ]);
  };

  const removeMedicineRow = (id) => {
    if (medicines.length === 1) {
      // Clear instead of removing last row
      setMedicines([{ id: '1', name: '', price: '', discount: '' }]);
      return;
    }
    setMedicines((prev) => prev.filter((m) => m.id !== id));
  };

  const updateMedicine = (id, field, value) => {
    setMedicines((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  // Autocomplete tap
  const selectSuggestion = (activeRowIndex, name) => {
    setMedicines((prev) => {
      const updated = [...prev];
      if (updated[activeRowIndex]) {
        updated[activeRowIndex].name = name;
      }
      return updated;
    });
  };

  // Calculations
  const subtotal = calculatePurchaseTotal(medicines);
  const { discountAmount, netTotal } = calculateBillDiscount(subtotal, discountPercent);
  const parsedPaid = parseFloat(amountPaid) || 0;
  const calculatedDue = calculateEntryDue(netTotal, parsedPaid);

  const handleSave = () => {
    if (saving) return;
    const validMeds = medicines.filter((m) => m.name.trim().length > 0);

    if (validMeds.length === 0 && subtotal === 0) {
      Alert.alert('Empty Entry', 'Please enter at least one medicine name or amount.');
      return;
    }

    setSaving(true);
    try {
      addPurchaseEntry({
        customerId,
        medicines: validMeds,
        subtotal,
        discountPercent: parseFloat(discountPercent) || 0,
        discountAmount,
        totalAmount: netTotal,
        amountPaid: parsedPaid,
      });

      navigation.goBack();
    } catch (err) {
      console.error('Error saving purchase:', err);
      Alert.alert('Save Failed', err.message || 'Could not save purchase entry');
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Nav Bar */}
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
          <View>
            <Text style={styles.title}>New Purchase</Text>
            <Text style={styles.subtitle}>for {customerName}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, SPACING.xxxl) + 20 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Quick Suggestions Chips */}
          {pastSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Frequently Purchased:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                {pastSuggestions.slice(0, 8).map((name, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.suggestionChip}
                    onPress={() => selectSuggestion(medicines.length - 1, name)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.suggestionChipText}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Medicines Entry Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>Prescribed / Purchased Items</Text>

            {medicines.map((item, index) => {
              const lineTotal = calculateLineTotal(item.price, item.discount);
              const hasDiscount = parseFloat(item.discount || 0) > 0;

              return (
                <View key={item.id} style={styles.medicineItemCard}>
                  {/* Top Row: Name & Remove */}
                  <View style={styles.nameRow}>
                    <TextInput
                      style={styles.medicineInput}
                      placeholder={`Medicine #${index + 1} name`}
                      placeholderTextColor={COLORS.textTertiary}
                      value={item.name}
                      onChangeText={(val) => updateMedicine(item.id, 'name', val)}
                      autoFocus={index === 0}
                    />
                    {medicines.length > 1 && (
                      <TouchableOpacity
                        style={styles.deleteRowBtn}
                        onPress={() => removeMedicineRow(item.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Bottom Row: Price, Rupee Discount, Line Total */}
                  <View style={styles.pricingRow}>
                    <View style={styles.priceInputWrap}>
                      <TextInput
                        style={styles.priceInput}
                        placeholder="Price ₹"
                        placeholderTextColor={COLORS.textTertiary}
                        value={item.price}
                        onChangeText={(val) => updateMedicine(item.id, 'price', val)}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.discountInputWrap}>
                      <TextInput
                        style={styles.discountInput}
                        placeholder="Item Disc ₹"
                        placeholderTextColor={COLORS.textTertiary}
                        value={item.discount}
                        onChangeText={(val) => updateMedicine(item.id, 'discount', val)}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={[styles.lineTotalBadge, hasDiscount && styles.lineTotalBadgeDiscounted]}>
                      <Text style={styles.lineTotalLabel}>Net</Text>
                      <Text style={[styles.lineTotalText, hasDiscount && styles.lineTotalTextDiscounted]}>
                        ₹{lineTotal.toFixed(0)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Add Another Medicine Row */}
            <TouchableOpacity style={styles.addRowBtn} onPress={addMedicineRow}>
              <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
              <Text style={styles.addRowBtnText}>Add Another Medicine</Text>
            </TouchableOpacity>
          </View>

          {/* Payment & Due Calculation Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>Payment & Bill Calculation</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Items Subtotal:</Text>
              <Text style={styles.summaryValue}>₹{subtotal.toFixed(2)}</Text>
            </View>

            {/* Bill-Level Percentage Discount Section */}
            <View style={styles.discountSection}>
              <View style={styles.discountHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="pricetag-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.discountSectionLabel}>Bill Discount (%):</Text>
                </View>
                <TextInput
                  style={styles.discountPercentInput}
                  placeholder="0"
                  placeholderTextColor={COLORS.textTertiary}
                  value={discountPercent}
                  onChangeText={(val) => {
                    const clean = val.replace(/[^0-9.]/g, '');
                    const num = parseFloat(clean);
                    if (clean === '' || (!isNaN(num) && num >= 0 && num <= 100)) {
                      setDiscountPercent(clean);
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>

              {/* Quick Percentage Chips */}
              <View style={styles.discountChipsRow}>
                {['5', '10', '15', '20'].map((pct) => (
                  <TouchableOpacity
                    key={pct}
                    style={[
                      styles.quickDiscountChip,
                      discountPercent === pct && styles.quickDiscountChipActive,
                    ]}
                    onPress={() => setDiscountPercent(discountPercent === pct ? '' : pct)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.quickDiscountChipText,
                        discountPercent === pct && styles.quickDiscountChipTextActive,
                      ]}
                    >
                      {pct}%
                    </Text>
                  </TouchableOpacity>
                ))}
                {discountPercent ? (
                  <TouchableOpacity
                    style={styles.clearDiscountBtn}
                    onPress={() => setDiscountPercent('')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle-outline" size={16} color={COLORS.danger} />
                    <Text style={styles.clearDiscountText}>Clear</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {discountAmount > 0 && (
                <View style={styles.discountCalculatedRow}>
                  <Text style={styles.discountCalculatedLabel}>Discount Deducted:</Text>
                  <Text style={styles.discountCalculatedValue}>-₹{discountAmount.toFixed(2)}</Text>
                </View>
              )}
            </View>

            {/* Net Payable */}
            <View style={[styles.summaryRow, styles.netPayableRow]}>
              <Text style={styles.netPayableLabel}>Net Payable:</Text>
              <Text style={styles.netPayableValue}>₹{netTotal.toFixed(2)}</Text>
            </View>

            <View style={styles.paymentInputRow}>
              <Text style={styles.paymentInputLabel}>Amount Paid Now (₹):</Text>
              <TextInput
                style={styles.paidNowInput}
                placeholder="0"
                placeholderTextColor={COLORS.textTertiary}
                value={amountPaid}
                onChangeText={setAmountPaid}
                keyboardType="numeric"
              />
            </View>

            {/* Live Due Summary */}
            <View style={styles.duePreviewBox}>
              <Text style={styles.duePreviewLabel}>Due Added to Khata:</Text>
              <Text
                style={[
                  styles.duePreviewAmount,
                  calculatedDue > 0 ? styles.dueTextAlert : styles.dueTextClear,
                ]}
              >
                ₹{calculatedDue.toFixed(2)}
              </Text>
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
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Purchase Entry'}</Text>
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
  title: {
    ...FONTS.title,
  },
  subtitle: {
    ...FONTS.subtext,
    color: COLORS.textSecondary,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  suggestionsContainer: {
    marginBottom: SPACING.md,
  },
  suggestionsTitle: {
    ...FONTS.subtext,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  chipsScroll: {
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  suggestionChipText: {
    ...FONTS.subtext,
    color: COLORS.primary,
    fontWeight: '500',
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
  cardHeaderTitle: {
    ...FONTS.header,
    fontSize: 16,
    marginBottom: SPACING.md,
  },
  medicineItemCard: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.md,
    padding: SPACING.sm + 2,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  medicineInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    height: 42,
    ...FONTS.body,
    fontSize: 14,
  },
  deleteRowBtn: {
    padding: SPACING.xs,
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceInputWrap: {
    flex: 1,
  },
  priceInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm + 2,
    height: 40,
    ...FONTS.body,
    fontSize: 14,
    textAlign: 'right',
  },
  discountInputWrap: {
    flex: 1,
  },
  discountInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm + 2,
    height: 40,
    ...FONTS.body,
    fontSize: 14,
    textAlign: 'right',
  },
  lineTotalBadge: {
    minWidth: 70,
    height: 40,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lineTotalBadgeDiscounted: {
    borderColor: COLORS.primaryBorder,
    backgroundColor: COLORS.primaryLight,
  },
  lineTotalLabel: {
    fontSize: 10,
    color: COLORS.textTertiary,
    lineHeight: 12,
  },
  lineTotalText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 16,
  },
  lineTotalTextDiscounted: {
    color: COLORS.primary,
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.primaryBorder,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    gap: 6,
    marginTop: SPACING.xs,
  },
  addRowBtnText: {
    ...FONTS.bodySecondary,
    fontWeight: '600',
    color: COLORS.primary,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  summaryLabel: {
    ...FONTS.body,
    fontWeight: '600',
  },
  summaryValue: {
    ...FONTS.title,
    fontSize: 17,
  },
  discountSection: {
    backgroundColor: COLORS.surfaceSubtle,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  discountHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  discountSectionLabel: {
    ...FONTS.bodySecondary,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  discountPercentInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder || '#C7D2FE',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    height: 38,
    width: 80,
    textAlign: 'right',
    ...FONTS.header,
    fontSize: 15,
  },
  discountChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  quickDiscountChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickDiscountChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  quickDiscountChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  quickDiscountChipTextActive: {
    color: COLORS.textInverted,
  },
  clearDiscountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
  },
  clearDiscountText: {
    fontSize: 11,
    color: COLORS.danger,
    fontWeight: '500',
  },
  discountCalculatedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  discountCalculatedLabel: {
    ...FONTS.subtext,
    fontWeight: '600',
    color: COLORS.primary,
  },
  discountCalculatedValue: {
    ...FONTS.header,
    fontSize: 14,
    color: COLORS.primary,
  },
  netPayableRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceSubtle,
    paddingTop: SPACING.sm,
    marginTop: SPACING.xs,
  },
  netPayableLabel: {
    ...FONTS.header,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  netPayableValue: {
    ...FONTS.title,
    fontSize: 20,
    color: COLORS.primary,
  },
  paymentInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    marginTop: SPACING.xs,
  },
  paymentInputLabel: {
    ...FONTS.body,
  },
  paidNowInput: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 46,
    width: 120,
    textAlign: 'right',
    ...FONTS.header,
    fontSize: 16,
  },
  duePreviewBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  duePreviewLabel: {
    ...FONTS.bodySecondary,
    fontWeight: '600',
  },
  duePreviewAmount: {
    ...FONTS.header,
    fontSize: 16,
  },
  dueTextAlert: {
    color: COLORS.dueBadgeText,
  },
  dueTextClear: {
    color: COLORS.paymentGreen,
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
