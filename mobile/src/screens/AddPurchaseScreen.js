import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { addPurchaseEntry, getPastMedicineNames, getCustomerById } from '../db/database';
import { calculateEntryDue } from '../utils/khataLogic';
import {
  formatINR,
  formatPhone,
  isJunkMedicineName,
  discountToRupees,
  paise,
  fromPaise,
} from '../utils/formatUtils';
import { useResponsive, TEXT_PROPS } from '../utils/responsive';
import { computeBill, computeLine } from '../utils/discountEngine';
import ScreenContainer from '../components/ScreenContainer';
import StickyFooter from '../components/StickyFooter';

let rowCounter = 100;
function newRowId() {
  rowCounter += 1;
  return String(rowCounter);
}

function makeMedicineRow() {
  return { id: newRowId(), name: '', price: '', discount: '', discountMode: '₹' };
}

const MedicineTableRow = memo(function MedicineTableRow({
  item,
  index,
  isFirst,
  nameRef,
  priceRef,
  discountRef,
  nextNameRef,
  onChangeName,
  onChangePrice,
  onChangeDiscount,
  onToggleMode,
  onRemove,
  onFocus,
  netTotal,
  styles,
  r
}) {
  return (
    <View>
      {index > 0 && <View style={styles.rowDivider} />}
      <View style={styles.tableRow}>
        <View style={styles.colName}>
          <TextInput
            ref={nameRef}
            style={styles.cellInput}
            value={item.name}
            onChangeText={onChangeName}
            placeholder={`Medicine ${index + 1}`}
            placeholderTextColor={COLORS.textTertiary}
            autoCapitalize="words"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => priceRef && priceRef.current && priceRef.current.focus()}
            onFocus={() => onFocus(item.id)}
            accessibilityLabel={`Medicine name ${index + 1}`}
            {...TEXT_PROPS}
          />
        </View>

        <View style={styles.colPrice}>
          <TextInput
            ref={priceRef}
            style={[styles.cellInput, styles.cellRight]}
            value={item.price}
            onChangeText={onChangePrice}
            placeholder="₹0"
            placeholderTextColor={COLORS.textTertiary}
            keyboardType="decimal-pad"
            returnKeyType="next"
            blurOnSubmit={false}
            selectTextOnFocus
            onSubmitEditing={() => discountRef && discountRef.current && discountRef.current.focus()}
            onFocus={() => onFocus(item.id)}
            accessibilityLabel={`Actual price for medicine ${index + 1}`}
            {...TEXT_PROPS}
          />
        </View>

        <View style={styles.colDiscount}>
          <View style={styles.discountCell}>
            <TextInput
              ref={discountRef}
              style={[styles.cellInput, styles.cellCenter, styles.discountInput]}
              value={item.discount}
              onChangeText={onChangeDiscount}
              placeholder="0"
              placeholderTextColor={COLORS.textTertiary}
              keyboardType="decimal-pad"
              returnKeyType="next"
              blurOnSubmit={false}
              selectTextOnFocus
              onSubmitEditing={() => nextNameRef && nextNameRef.current && nextNameRef.current.focus()}
              onFocus={() => onFocus(item.id)}
              accessibilityLabel={`Discount for medicine ${index + 1}`}
              {...TEXT_PROPS}
            />
            <TouchableOpacity
              style={styles.modeChip}
              onPress={onToggleMode}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text {...TEXT_PROPS} style={styles.modeChipText}>{item.discountMode}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.colNetTotal}>
          <Text {...TEXT_PROPS} style={styles.cellNetTotal} numberOfLines={1}>
            {netTotal >= 0 ? formatINR(netTotal) : '—'}
          </Text>
          {!isFirst && (
            <TouchableOpacity
              onPress={onRemove}
              style={styles.removeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={r.scale(16)} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
});

export default function AddPurchaseScreen({ route, navigation }) {
  const { customerId, customerName } = route.params;

  const [customer, setCustomer] = useState(null);
  const [medicines, setMedicines] = useState([makeMedicineRow()]);
  const [pastSuggestions, setPastSuggestions] = useState([]);
  const [focusedRowId, setFocusedRowId] = useState(null);
  const [amountPaid, setAmountPaid] = useState('');
  const [paidError, setPaidError] = useState('');
  const [saving, setSaving] = useState(false);
  const [footerH, setFooterH] = useState(0);

  const nameRefs = useRef({});
  const priceRefs = useRef({});
  const discountRefs = useRef({});

  const r = useResponsive();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(r, footerH, insets), [r, footerH, insets]);

  useEffect(() => {
    try {
      const cust = getCustomerById(customerId);
      if (!cust) {
        Alert.alert('Not Found', 'Customer not found. Going back.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }
      setCustomer(cust);
    } catch (e) {
      console.error('Error loading customer:', e);
    }
    try {
      const names = getPastMedicineNames();
      setPastSuggestions(names);
    } catch (e) {
      console.warn('Could not load past medicine names:', e);
    }
  }, [customerId]);

  const addMedicineRow = useCallback(() => {
    const newRow = makeMedicineRow();
    setMedicines((prev) => [...prev, newRow]);
    setTimeout(() => {
      if (nameRefs.current[newRow.id] && nameRefs.current[newRow.id].current) {
        nameRefs.current[newRow.id].current.focus();
      }
    }, 80);
  }, []);

  const removeMedicineRow = useCallback((id) => {
    setMedicines((prev) => {
      if (prev.length === 1) return [makeMedicineRow()];
      return prev.filter((m) => m.id !== id);
    });
  }, []);

  const updateMedicine = useCallback((id, field, value) => {
    setMedicines((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  }, []);

  const toggleDiscountMode = useCallback((id) => {
    setMedicines((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, discountMode: m.discountMode === '₹' ? '%' : '₹', discount: '' }
          : m
      )
    );
  }, []);

  const handleSelectSuggestion = useCallback((name) => {
    setMedicines((prev) => {
      if (!focusedRowId) {
        const lastIdx = prev.length - 1;
        if (!prev[lastIdx].name) {
          const updated = [...prev];
          updated[lastIdx] = { ...updated[lastIdx], name };
          return updated;
        }
        return [...prev, { ...makeMedicineRow(), name }];
      }
      return prev.map((m) => (m.id === focusedRowId ? { ...m, name } : m));
    });
  }, [focusedRowId]);

  function sanitiseNumeric(val) {
    const clean = val.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    const sanitized = parts.length > 2
      ? parts[0] + '.' + parts.slice(1).join('')
      : clean;
    return sanitized.includes('.')
      ? sanitized.split('.')[0] + '.' + sanitized.split('.')[1].slice(0, 2)
      : sanitized;
  }

  const validRows = medicines.filter((m) => {
    const p = parseFloat(m.price);
    return m.name.trim().length > 0 && !isNaN(p) && p > 0;
  });

  const currentDue = parseFloat(customer?.total_due || 0);

  const bill = computeBill({
    lines: validRows.map(m => ({
      name: m.name,
      price: m.price,
      discount: m.discount,
      mode: m.discountMode === '%' ? 'percent' : 'amount'
    })),
    paidNow: parseFloat(amountPaid) || 0,
    currentDue
  });

  const subtotalPaise = bill.paise.subtotal;
  const totalDiscountPaise = bill.paise.discountTotal;
  const grandTotalPaise = bill.paise.grandTotal;
  const parsedPaidPaise = bill.paise.paid;
  const dueCreatedPaise = bill.paise.dueCreated;
  const updatedBalancePaise = bill.paise.updatedBalance;

  const subtotal = bill.rupees.subtotal;
  const totalDiscount = bill.rupees.discountTotal;
  const grandTotal = bill.rupees.grandTotal;
  const dueCreated = bill.rupees.dueCreated;
  const updatedBalance = bill.rupees.updatedBalance;
  const paidDisplay = bill.rupees.paid;

  const isFullyPaid = dueCreatedPaise === 0 && grandTotalPaise > 0;
  const isFormValid = bill.ok && validRows.length > 0;

  const focusedRow = medicines.find((m) => m.id === focusedRowId);
  const focusedName = focusedRow?.name?.trim() || '';
  const filteredSuggestions =
    focusedName.length >= 2
      ? pastSuggestions
          .filter(
            (s) =>
              !isJunkMedicineName(s) &&
              s.toLowerCase().includes(focusedName.toLowerCase())
          )
          .slice(0, 10)
      : [];

  const handleSave = useCallback(() => {
    setPaidError('');

    if (parsedPaidPaise > grandTotalPaise) {
      setPaidError('Paid amount cannot exceed the total');
      return;
    }
    if (validRows.length === 0) {
      Alert.alert('Empty Entry', 'Please enter at least one medicine with a price > 0.');
      return;
    }
    if (grandTotalPaise <= 0) {
      Alert.alert('Zero Total', 'Grand Total must be greater than ₹0.');
      return;
    }
    for (const row of validRows) {
      if (isJunkMedicineName(row.name)) {
        Alert.alert('Invalid Name', `"${row.name}" does not look like a medicine name.`);
        return;
      }
    }

    setSaving(true);
    try {
      const medsForDb = validRows.map((m) => {
        const actual = parseFloat(m.price) || 0;
        const discR = discountToRupees(m.discount, m.discountMode, actual);
        const netPrice = fromPaise(Math.max(0, paise(actual) - paise(discR)));
        return {
          name: m.name.trim(),
          price: parseFloat(netPrice.toFixed(2)),
        };
      });

      addPurchaseEntry({
        customerId,
        medicines: medsForDb,
        totalAmount: parseFloat(grandTotal.toFixed(2)),
        amountPaid: parseFloat(paidDisplay.toFixed(2)),
      });

      navigation.goBack();
    } catch (err) {
      console.error('Error saving purchase:', err);
      Alert.alert('Save Failed', err.message || 'Could not save purchase entry.');
    } finally {
      setSaving(false);
    }
  }, [validRows, grandTotalPaise, parsedPaidPaise, grandTotal, paidDisplay, customerId, navigation]);

  const renderCurrentDue = () => {
    if (!customer) return null;
    const due = parseFloat(customer.total_due || 0);
    if (due > 0) {
      return (
        <View style={styles.dueRightCol}>
          <Text {...TEXT_PROPS} style={styles.currentDueLabel}>Current Due</Text>
          <Text {...TEXT_PROPS} style={styles.currentDueAmber}>{formatINR(due)}</Text>
        </View>
      );
    }
    if (due < 0) {
      return (
        <View style={styles.dueRightCol}>
          <Text {...TEXT_PROPS} style={styles.currentDueLabel}>Credit</Text>
          <Text {...TEXT_PROPS} style={styles.currentDueCredit}>{formatINR(Math.abs(due))}</Text>
        </View>
      );
    }
    return (
      <View style={styles.dueRightCol}>
        <Text {...TEXT_PROPS} style={styles.currentDueLabel}>Current Due</Text>
        <Text {...TEXT_PROPS} style={styles.currentDueClear}>{formatINR(0)}</Text>
      </View>
    );
  };

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
          <Text {...TEXT_PROPS} style={styles.headerTitle}>Add Purchase</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {customer && (
            <View style={styles.customerCard}>
              <View style={styles.customerLeft}>
                <View style={styles.avatarCircle}>
                  <Ionicons name="person" size={r.scale(22)} color={COLORS.primary} />
                </View>
                <View style={styles.customerTextBlock}>
                  <Text {...TEXT_PROPS} style={styles.customerName} numberOfLines={1}>
                    {customer.name}{customer.phone_number ? ' · ' + formatPhone(customer.phone_number) : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.verticalDivider} />
              {renderCurrentDue()}
            </View>
          )}

          <View style={styles.card}>
            <View style={styles.tableHeader}>
              <Text {...TEXT_PROPS} style={[styles.tableHeaderCell, styles.colName]}>Medicine</Text>
              <Text {...TEXT_PROPS} style={[styles.tableHeaderCell, styles.colPrice, { textAlign: 'right' }]}>Actual Price</Text>
              <Text {...TEXT_PROPS} style={[styles.tableHeaderCell, styles.colDiscount, { textAlign: 'center' }]}>Discount</Text>
              <Text {...TEXT_PROPS} style={[styles.tableHeaderCell, styles.colNetTotal, { textAlign: 'right' }]}>Net Total</Text>
            </View>
            <View style={styles.tableHeaderDivider} />

            {medicines.map((item, index) => {
              const line = computeLine({ price: item.price, discount: item.discount, mode: item.discountMode === '%' ? 'percent' : 'amount' });
              const net = fromPaise(line.netPaise);
              const actualPrice = parseFloat(item.price);
              const netDisplay = (item.name.trim().length > 0 || !isNaN(actualPrice)) && actualPrice > 0 ? net : -1;

              if (!nameRefs.current[item.id]) nameRefs.current[item.id] = React.createRef();
              if (!priceRefs.current[item.id]) priceRefs.current[item.id] = React.createRef();
              if (!discountRefs.current[item.id]) discountRefs.current[item.id] = React.createRef();

              const nextRow = medicines[index + 1];
              const nextNameRef = nextRow ? nameRefs.current[nextRow.id] : null;

              return (
                <MedicineTableRow
                  key={item.id}
                  item={item}
                  index={index}
                  isFirst={index === 0}
                  nameRef={nameRefs.current[item.id]}
                  priceRef={priceRefs.current[item.id]}
                  discountRef={discountRefs.current[item.id]}
                  nextNameRef={nextNameRef}
                  onChangeName={(val) => updateMedicine(item.id, 'name', val)}
                  onChangePrice={(val) => updateMedicine(item.id, 'price', sanitiseNumeric(val))}
                  onChangeDiscount={(val) => updateMedicine(item.id, 'discount', sanitiseNumeric(val))}
                  onToggleMode={() => toggleDiscountMode(item.id)}
                  onRemove={() => removeMedicineRow(item.id)}
                  onFocus={setFocusedRowId}
                  netTotal={netDisplay}
                  styles={styles}
                  r={r}
                />
              );
            })}

            {filteredSuggestions.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScroll}
                keyboardShouldPersistTaps="handled"
                style={styles.suggestionsRow}
              >
                {filteredSuggestions.map((name) => (
                  <TouchableOpacity
                    key={name}
                    style={styles.suggestionChip}
                    onPress={() => handleSelectSuggestion(name)}
                  >
                    <Text {...TEXT_PROPS} style={styles.suggestionChipText}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.addMedicineBtn}
              onPress={addMedicineRow}
            >
              <View style={styles.addMedicineCircle}>
                <Ionicons name="add" size={r.scale(18)} color={COLORS.primary} />
              </View>
              <Text {...TEXT_PROPS} style={styles.addMedicineBtnText}>Add Medicine</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <View style={styles.totalRow}>
              <Text {...TEXT_PROPS} style={styles.totalLabel}>Subtotal</Text>
              <Text {...TEXT_PROPS} style={styles.totalValue}>{formatINR(subtotal)}</Text>
            </View>

            {totalDiscountPaise > 0 && (
              <View style={styles.totalRow}>
                <Text {...TEXT_PROPS} style={styles.totalLabel}>Discount</Text>
                <Text {...TEXT_PROPS} style={styles.discountValue}>−{formatINR(totalDiscount)}</Text>
              </View>
            )}

            <View style={styles.grandTotalBand}>
              <Text {...TEXT_PROPS} style={styles.grandTotalLabel}>Grand Total</Text>
              <Text {...TEXT_PROPS} style={styles.grandTotalAmount}>{formatINR(grandTotal)}</Text>
            </View>

            <View style={styles.sectionDivider} />

            <View style={styles.totalRow}>
              <Text {...TEXT_PROPS} style={styles.totalLabel}>Paid Now</Text>
              <TextInput
                style={styles.paidNowInput}
                value={amountPaid}
                onChangeText={(val) => {
                  setAmountPaid(sanitiseNumeric(val));
                  setPaidError('');
                }}
                placeholder="₹0.00"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="decimal-pad"
                selectTextOnFocus
                {...TEXT_PROPS}
              />
            </View>
            {paidError ? <Text {...TEXT_PROPS} style={styles.inlineError}>{paidError}</Text> : null}

            <View style={[styles.dueCreatedBand, isFullyPaid && styles.dueCreatedBandGreen]}>
              <Text {...TEXT_PROPS} style={[styles.dueCreatedLabel, isFullyPaid && styles.dueCreatedLabelGreen]}>
                {isFullyPaid ? 'Fully paid ✓' : 'Due Created'}
              </Text>
              {!isFullyPaid && (
                <Text {...TEXT_PROPS} style={styles.dueCreatedAmount}>{formatINR(dueCreated)}</Text>
              )}
            </View>

            <View style={styles.sectionDivider} />

            <View style={styles.totalRow}>
              <View style={styles.updatedBalanceLeft}>
                <Text {...TEXT_PROPS} style={styles.totalLabel}>Updated Balance</Text>
                <TouchableOpacity
                  onPress={() => Alert.alert('Updated Balance', 'Previous due + due created from this bill.')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="information-circle-outline" size={r.scale(16)} color={COLORS.textTertiary} style={styles.infoIcon} />
                </TouchableOpacity>
              </View>
              <Text {...TEXT_PROPS} style={styles.totalValue}>{formatINR(updatedBalance)}</Text>
            </View>
          </View>
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
              <Text {...TEXT_PROPS} style={styles.saveBtnText}>Save Purchase</Text>
            )}
          </TouchableOpacity>
        </StickyFooter>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const COL_NAME_FLEX = 2.2;
const COL_PRICE_FLEX = 1.3;
const COL_DISCOUNT_FLEX = 1.5;
const COL_NET_FLEX = 1.3;

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
    fontSize: r.font(26),
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingHorizontal: r.moderate(16),
    paddingTop: r.moderate(4),
    paddingBottom: footerH + 16,
  },
  customerCard: {
    backgroundColor: COLORS.avatarBg,
    borderRadius: r.moderate(14),
    paddingHorizontal: r.moderate(16),
    paddingVertical: r.moderate(12),
    marginBottom: r.moderate(20),
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  customerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: r.scale(48),
    height: r.scale(48),
    borderRadius: r.scale(24),
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: r.moderate(12),
  },
  customerTextBlock: {
    flex: 1,
  },
  customerName: {
    fontSize: r.font(15),
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  verticalDivider: {
    width: 1,
    height: r.scale(40),
    backgroundColor: COLORS.primaryBorder,
    marginHorizontal: r.moderate(12),
  },
  dueRightCol: {
    alignItems: 'flex-end',
    minWidth: r.scale(72),
  },
  currentDueLabel: {
    fontSize: r.font(11),
    color: COLORS.textSecondary,
    marginBottom: r.scale(2),
  },
  currentDueAmber: {
    fontSize: r.font(18),
    fontWeight: '700',
    color: COLORS.amberBannerText,
    letterSpacing: -0.3,
  },
  currentDueClear: {
    fontSize: r.font(16),
    fontWeight: '700',
    color: COLORS.greenText,
  },
  currentDueCredit: {
    fontSize: r.font(15),
    fontWeight: '600',
    color: COLORS.creditBannerText,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: r.moderate(14),
    padding: r.moderate(16),
    marginBottom: r.moderate(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: r.moderate(4),
  },
  tableHeaderCell: {
    fontSize: r.font(12),
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tableHeaderDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: r.moderate(4),
  },
  colName: { flex: COL_NAME_FLEX },
  colPrice: { flex: COL_PRICE_FLEX },
  colDiscount: { flex: COL_DISCOUNT_FLEX },
  colNetTotal: {
    flex: COL_NET_FLEX,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  cellRight: { textAlign: 'right' },
  cellCenter: { textAlign: 'center' },
  rowDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: r.scale(2),
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: r.touch,
    paddingVertical: r.scale(2),
  },
  cellInput: {
    fontSize: r.font(14),
    color: COLORS.textPrimary,
    paddingVertical: r.scale(8),
    paddingHorizontal: r.scale(2),
  },
  discountInput: {
    flex: 1,
  },
  cellNetTotal: {
    fontSize: r.font(14),
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'right',
    flex: 1,
  },
  removeBtn: {
    marginLeft: r.moderate(2),
    width: r.scale(22),
    height: r.scale(22),
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountCell: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modeChip: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: r.moderate(6),
    paddingHorizontal: r.moderate(5),
    paddingVertical: r.moderate(3),
    marginLeft: r.moderate(3),
    minWidth: r.scale(24),
    alignItems: 'center',
  },
  modeChipText: {
    fontSize: r.font(11),
    fontWeight: '700',
    color: COLORS.primary,
  },
  suggestionsRow: {
    marginTop: r.moderate(8),
  },
  chipsScroll: {
    gap: r.scale(8),
    paddingVertical: r.moderate(4),
    paddingHorizontal: r.scale(2),
  },
  suggestionChip: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: r.moderate(12),
    paddingVertical: r.moderate(6),
    borderRadius: r.moderate(999),
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  suggestionChipText: {
    fontSize: r.font(12),
    fontWeight: '500',
    color: COLORS.primary,
  },
  addMedicineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: r.moderate(12),
    paddingVertical: r.moderate(4),
    gap: r.scale(8),
  },
  addMedicineCircle: {
    width: r.scale(32),
    height: r.scale(32),
    borderRadius: r.scale(16),
    backgroundColor: COLORS.avatarBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMedicineBtnText: {
    fontSize: r.font(14),
    fontWeight: '700',
    color: COLORS.primary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: r.moderate(8),
  },
  totalLabel: {
    fontSize: r.font(15),
    color: COLORS.textSecondary,
  },
  totalValue: {
    fontSize: r.font(15),
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  discountValue: {
    fontSize: r.font(15),
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  grandTotalBand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.grandTotalBg,
    borderRadius: r.moderate(10),
    paddingHorizontal: r.moderate(12),
    paddingVertical: r.moderate(12),
    marginVertical: r.moderate(4),
  },
  grandTotalLabel: {
    fontSize: r.font(16),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  grandTotalAmount: {
    fontSize: r.font(28),
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: r.moderate(4),
  },
  paidNowInput: {
    fontSize: r.font(15),
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'right',
    minWidth: r.scale(80),
    paddingVertical: r.scale(4),
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
  },
  inlineError: {
    fontSize: r.font(12),
    color: COLORS.danger,
    textAlign: 'right',
    marginTop: r.scale(-2),
    marginBottom: r.moderate(4),
  },
  dueCreatedBand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.amberBannerBg,
    borderRadius: r.moderate(10),
    paddingHorizontal: r.moderate(12),
    paddingVertical: r.moderate(12),
    marginVertical: r.moderate(4),
  },
  dueCreatedBandGreen: {
    backgroundColor: COLORS.greenCircleBg,
  },
  dueCreatedLabel: {
    fontSize: r.font(15),
    fontWeight: '600',
    color: COLORS.amberBannerText,
  },
  dueCreatedLabelGreen: {
    color: COLORS.greenText,
  },
  dueCreatedAmount: {
    fontSize: r.font(15),
    fontWeight: '700',
    color: COLORS.amberBannerText,
  },
  updatedBalanceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    marginLeft: r.moderate(4),
  },
  saveBarContainer: {
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
    minHeight: r.touch,
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
});
