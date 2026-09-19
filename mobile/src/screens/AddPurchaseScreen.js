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
import { calculateEntryDue } from '../utils/khataLogic';

export default function AddPurchaseScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 24);

  const { customerId, customerName } = route.params;

  // Medicine list: array of { id, name, price }
  const [medicines, setMedicines] = useState([
    { id: '1', name: '', price: '' },
  ]);
  const [pastSuggestions, setPastSuggestions] = useState([]);
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
      { id: String(Date.now() + Math.random()), name: '', price: '' },
    ]);
  };

  const removeMedicineRow = (id) => {
    if (medicines.length === 1) {
      // Clear instead of removing last row
      setMedicines([{ id: '1', name: '', price: '' }]);
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
  const calculatedTotal = medicines.reduce((sum, item) => {
    const val = parseFloat(item.price);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const parsedPaid = parseFloat(amountPaid) || 0;
  const calculatedDue = calculateEntryDue(calculatedTotal, parsedPaid);

  const handleSave = () => {
    // Check if at least one medicine has a name or at least total > 0
    const validMeds = medicines.filter((m) => m.name.trim().length > 0);

    if (validMeds.length === 0 && calculatedTotal === 0) {
      Alert.alert('Empty Entry', 'Please enter at least one medicine name or amount.');
      return;
    }

    setSaving(true);
    try {
      addPurchaseEntry({
        customerId,
        medicines: validMeds,
        totalAmount: calculatedTotal,
        amountPaid: parsedPaid,
      });

      navigation.goBack();
    } catch (err) {
      console.error('Error saving purchase:', err);
      Alert.alert('Save Failed', err.message || 'Could not save purchase entry');
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
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>New Purchase</Text>
            <Text style={styles.subtitle}>For {customerName}</Text>
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
              <Text style={styles.suggestionsTitle}>Quick pick recent medicine:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                {pastSuggestions.slice(0, 10).map((name, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.suggestionChip}
                    onPress={() => {
                      // fill the last row or add row
                      const lastIdx = medicines.length - 1;
                      if (!medicines[lastIdx].name) {
                        selectSuggestion(lastIdx, name);
                      } else {
                        setMedicines([...medicines, { id: String(Date.now()), name, price: '' }]);
                      }
                    }}
                  >
                    <Text style={styles.suggestionChipText}>+ {name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Medicines Entry Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>Medicines & Items</Text>

            {medicines.map((item, index) => (
              <View key={item.id} style={styles.medicineRow}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.medicineInput}
                    placeholder={`Medicine #${index + 1}`}
                    placeholderTextColor={COLORS.textTertiary}
                    value={item.name}
                    onChangeText={(val) => updateMedicine(item.id, 'name', val)}
                    autoCapitalize="words"
                  />
                </View>

                <View style={{ width: 100 }}>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="Price (₹)"
                    placeholderTextColor={COLORS.textTertiary}
                    value={item.price}
                    onChangeText={(val) => updateMedicine(item.id, 'price', val)}
                    keyboardType="numeric"
                  />
                </View>

                <TouchableOpacity
                  onPress={() => removeMedicineRow(item.id)}
                  style={styles.deleteRowBtn}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            ))}

            {/* Add Another Medicine Row */}
            <TouchableOpacity style={styles.addRowBtn} onPress={addMedicineRow}>
              <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
              <Text style={styles.addRowBtnText}>Add Another Medicine</Text>
            </TouchableOpacity>
          </View>

          {/* Payment & Due Calculation Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>Payment Details</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Purchase:</Text>
              <Text style={styles.summaryValue}>₹{calculatedTotal.toFixed(2)}</Text>
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
  medicineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.md,
  },
  medicineInput: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    ...FONTS.body,
  },
  priceInput: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    ...FONTS.body,
    textAlign: 'right',
  },
  deleteRowBtn: {
    padding: SPACING.xs,
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
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceSubtle,
  },
  summaryLabel: {
    ...FONTS.body,
    fontWeight: '600',
  },
  summaryValue: {
    ...FONTS.title,
    fontSize: 18,
  },
  paymentInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
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
