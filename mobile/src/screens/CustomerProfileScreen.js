import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
  StatusBar,
  Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS } from '../constants/theme';
import { getCustomerById, getCustomerLedger, addDuePayment, deleteCustomer } from '../db/database';
import { formatLocalDateTime } from '../utils/dateUtils';
import { isPaymentEntry } from '../utils/khataLogic';

export default function CustomerProfileScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 24);

  const { customerId } = route.params;

  const [customer, setCustomer] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  // In-app Toast state
  const [toastMessage, setToastMessage] = useState('');

  // Payment modal state
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // Delete modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage('');
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleDeletePress = () => {
    if (!customer) return;
    const currentDue = parseFloat(customer.total_due || 0);

    if (currentDue > 0.001) {
      Alert.alert(
        'Cannot Delete Customer',
        `Clear this customer's due before deleting — currently ₹${currentDue.toFixed(2)} due.`
      );
      return;
    }

    if (currentDue < -0.001) {
      Alert.alert(
        'Cannot Delete Customer',
        `Clear this customer's credit balance before deleting — currently ₹${Math.abs(currentDue).toFixed(2)} in credit.`
      );
      return;
    }

    setDeleteModalVisible(true);
  };

  const confirmDeleteCustomer = () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const success = deleteCustomer(customerId);
      if (success) {
        setDeleteModalVisible(false);
        navigation.navigate('Home', {
          toastMessage: `"${customer.name}" moved to Recycle Bin.`,
        });
      } else {
        Alert.alert('Delete Failed', 'Customer could not be found or removed.');
      }
    } catch (err) {
      console.error('Error deleting customer:', err);
      Alert.alert('Delete Failed', err.message || 'Could not delete customer.');
    } finally {
      setDeleting(false);
    }
  };

  const loadProfile = useCallback(() => {
    try {
      const cust = getCustomerById(customerId);
      const entries = getCustomerLedger(customerId);
      setCustomer(cust);
      setLedger(entries);
    } catch (err) {
      console.error('Error loading customer profile:', err);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleRecordPayment = () => {
    if (savingPayment) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount greater than ₹0.');
      return;
    }

    setSavingPayment(true);
    try {
      const currentDue = parseFloat(customer.total_due || 0);
      addDuePayment({
        customerId,
        amountPaid: amount,
      });

      setPaymentAmount('');
      setPayModalVisible(false);
      loadProfile();

      const newDue = currentDue - amount;
      let balanceStatus = '';
      if (newDue > 0.001) {
        balanceStatus = `New balance: ₹${newDue.toFixed(2)} due`;
      } else if (newDue < -0.001) {
        balanceStatus = `New balance: Credit ₹${Math.abs(newDue).toFixed(2)}`;
      } else {
        balanceStatus = 'New balance: All clear';
      }

      setToastMessage(`₹${amount.toFixed(2)} payment received (Cash). ${balanceStatus}`);
    } catch (e) {
      Alert.alert('Error', 'Could not record payment: ' + e.message);
    } finally {
      setSavingPayment(false);
    }
  };

  if (loading || !customer) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const totalDue = parseFloat(customer.total_due || 0);
  const hasDue = totalDue > 0.001;
  const isCredit = totalDue < -0.001;

  const renderLedgerItem = ({ item }) => {
    const isPaymentOnly = isPaymentEntry(item);

    // ── DISTINCT VISUAL TREATMENT FOR PAYMENTS ──
    if (isPaymentOnly) {
      return (
        <View style={styles.paymentCard}>
          <View style={styles.entryHeaderRow}>
            <View style={styles.paymentBadge}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.paymentGreen} />
              <Text style={styles.paymentBadgeText}>Payment Received</Text>
            </View>
            <Text style={styles.entryDateText}>{formatLocalDateTime(item.entry_date)}</Text>
          </View>

          <View style={styles.paymentBody}>
            <Text style={styles.paymentAmountText}>
              ₹{parseFloat(item.amount_paid).toFixed(2)}
            </Text>
            <Text style={styles.paymentSubtext}>Due balance reduced</Text>
          </View>
        </View>
      );
    }

    // ── STANDARD PURCHASE ENTRY ──
    const medicines = item.medicines || [];
    const entryDue = parseFloat(item.due_amount || 0);
    const subtotal = parseFloat(item.subtotal || item.total_amount || 0);
    const discountPercent = parseFloat(item.discount_percent || 0);
    const discountAmount = parseFloat(item.discount_amount || 0);

    return (
      <View style={styles.purchaseCard}>
        {/* Entry Date & Total */}
        <View style={styles.entryHeaderRow}>
          <Text style={styles.entryDateText}>{formatLocalDateTime(item.entry_date)}</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.purchaseTotalText}>
              ₹{parseFloat(item.total_amount).toFixed(2)}
            </Text>
            {discountPercent > 0 && (
              <Text style={styles.subtotalHint}>
                Subtotal: ₹{subtotal.toFixed(2)}
              </Text>
            )}
          </View>
        </View>

        {/* Bill-level discount badge if applied */}
        {discountPercent > 0 && (
          <View style={styles.billDiscountBanner}>
            <Ionicons name="pricetag-outline" size={13} color={COLORS.primary} />
            <Text style={styles.billDiscountBannerText}>
              Bill Discount: {discountPercent}% off (-₹{discountAmount.toFixed(2)})
            </Text>
          </View>
        )}

        {/* Medicine Tags */}
        <View style={styles.medicineList}>
          {medicines.map((med, idx) => {
            const price = parseFloat(med.price || 0);
            const discount = parseFloat(med.discount || 0);
            const netPrice = Math.max(0, price - discount);

            return (
              <View key={idx} style={styles.medicineChip}>
                <Text style={styles.medicineName}>{med.medicine_name}</Text>
                {price > 0 ? (
                  <Text style={styles.medicinePrice}>
                    ₹{netPrice.toFixed(0)}
                    {discount > 0 ? ` (-₹${discount.toFixed(0)})` : ''}
                  </Text>
                ) : null}
              </View>
            );
          })}
          {medicines.length === 0 && (
            <Text style={styles.noMedsText}>General purchase</Text>
          )}
        </View>

        {/* Entry Financial Footer */}
        <View style={styles.entryFooterRow}>
          <Text style={styles.paidText}>
            Paid: ₹{parseFloat(item.amount_paid).toFixed(2)}
          </Text>
          {entryDue > 0 ? (
            <Text style={styles.unpaidDueText}>+₹{entryDue.toFixed(2)} added to due</Text>
          ) : (
            <Text style={styles.fullyPaidText}>Fully paid</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.navBar, { paddingTop: topInset + SPACING.sm }]}>
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
        <Text style={styles.navTitle} numberOfLines={1}>
          {customer.name}
        </Text>
        <TouchableOpacity
          onPress={handleDeletePress}
          style={styles.deleteCustomerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Delete Customer"
        >
          <Ionicons name="trash-outline" size={22} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      {/* Customer Header Index-Card */}
      <View style={styles.customerHeaderCard}>
        <View style={styles.profileTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerCustomerName}>{customer.name}</Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(`tel:${customer.phone_number}`)}
              activeOpacity={0.7}
            >
              <Text style={styles.headerPhone}>
                <Ionicons name="call-outline" size={13} color={COLORS.primary} /> {customer.phone_number}
              </Text>
            </TouchableOpacity>
            {customer.village ? (
              <Text style={styles.headerVillage}>
                <Ionicons name="location-outline" size={13} color={COLORS.textSecondary} /> {customer.village}
                {customer.address ? ` • ${customer.address}` : ''}
              </Text>
            ) : null}
          </View>

          {/* Due / Credit Badge */}
          <View
            style={[
              styles.quietDueBadge,
              hasDue
                ? styles.quietDueAlert
                : isCredit
                ? styles.quietDueCredit
                : styles.quietDueClear,
            ]}
          >
            <Text
              style={[
                styles.quietDueText,
                hasDue
                  ? styles.quietDueTextAlert
                  : isCredit
                  ? styles.quietDueTextCredit
                  : styles.quietDueTextClear,
              ]}
            >
              {hasDue
                ? `₹${totalDue.toFixed(0)} due`
                : isCredit
                ? `Credit ₹${Math.abs(totalDue).toFixed(0)}`
                : 'All clear'}
            </Text>
          </View>
        </View>

        {/* Record Due Payment Action Button */}
        <TouchableOpacity
          style={styles.recordPaymentRow}
          onPress={() => setPayModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle" size={18} color={COLORS.paymentGreen} />
          <Text style={styles.recordPaymentText}>Record Due Payment</Text>
        </TouchableOpacity>
      </View>

      {/* Ledger History Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Khata Ledger</Text>
        <Text style={styles.sectionSubtitle}>{ledger.length} entries</Text>
      </View>

      {/* Ledger List */}
      <FlatList
        data={ledger}
        keyExtractor={(item) => String(item.entry_id)}
        renderItem={renderLedgerItem}
        contentContainerStyle={styles.ledgerListContent}
        ListEmptyComponent={
          <View style={styles.emptyLedgerContainer}>
            <Ionicons name="receipt-outline" size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyLedgerTitle}>No ledger entries yet</Text>
            <Text style={styles.emptyLedgerSubtitle}>
              Tap "Add Purchase" below to record medicines or credit balance.
            </Text>
          </View>
        }
      />

      {/* Bottom Floating Action: Add Purchase */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, SPACING.md) }]}>
        <TouchableOpacity
          style={styles.addPurchaseBtn}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate('AddPurchase', {
              customerId: customer.customer_id,
              customerName: customer.name,
            })
          }
        >
          <Ionicons name="cart-outline" size={20} color={COLORS.textInverted} />
          <Text style={styles.addPurchaseBtnText}>Add Purchase</Text>
        </TouchableOpacity>
      </View>

      {/* In-app Toast Notification */}
      {toastMessage ? (
        <View style={styles.toastContainer}>
          <Ionicons name="checkmark-circle" size={18} color={COLORS.textInverted} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}

      {/* Record Payment Modal */}
      <Modal visible={payModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Record Due Payment</Text>
            <Text style={styles.modalSubtitle}>
              Enter payment received from {customer.name}.
            </Text>

            {hasDue && (
              <TouchableOpacity
                style={styles.payFullChip}
                onPress={() => setPaymentAmount(totalDue.toFixed(2))}
                activeOpacity={0.7}
              >
                <Ionicons name="flash-outline" size={14} color={COLORS.primary} />
                <Text style={styles.payFullChipText}>
                  Pay Full Dues: ₹{totalDue.toFixed(2)}
                </Text>
              </TouchableOpacity>
            )}

            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 500"
              placeholderTextColor={COLORS.textTertiary}
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="numeric"
              autoFocus={true}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setPayModalVisible(false)}
                disabled={savingPayment}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmBtn, savingPayment && styles.btnDisabled]}
                onPress={handleRecordPayment}
                disabled={savingPayment}
              >
                <Text style={styles.modalConfirmBtnText}>
                  {savingPayment ? 'Saving...' : 'Confirm Payment'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Customer Confirmation Modal */}
      <Modal visible={deleteModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.deleteModalHeader}>
              <View style={styles.deleteIconWrap}>
                <Ionicons name="trash-outline" size={22} color={COLORS.danger} />
              </View>
              <Text style={styles.deleteModalTitle}>Move to Recycle Bin?</Text>
            </View>

            <Text style={styles.deleteModalMessage}>
              Move "{customer.name}" to the Recycle Bin? The customer will be hidden from active search. All purchase entries and payments will remain preserved and can be restored anytime from Settings.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDeleteModalVisible(false)}
                disabled={deleting}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteConfirmBtn, deleting && styles.btnDisabled]}
                onPress={confirmDeleteCustomer}
                disabled={deleting}
                accessibilityRole="button"
                accessibilityLabel="Move to Recycle Bin"
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={COLORS.textInverted} />
                ) : (
                  <Text style={styles.deleteConfirmBtnText}>Move to Bin</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBar: {
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
  navTitle: {
    ...FONTS.header,
    flex: 1,
  },
  deleteCustomerBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
  },
  customerHeaderCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.xl,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  profileTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerCustomerName: {
    ...FONTS.title,
    fontSize: 20,
    marginBottom: 4,
  },
  headerPhone: {
    ...FONTS.bodySecondary,
    fontSize: 13,
    marginBottom: 2,
    color: COLORS.primary,
  },
  headerVillage: {
    ...FONTS.subtext,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  quietDueBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  quietDueAlert: {
    backgroundColor: COLORS.dueBadgeBg,
    borderColor: COLORS.dueBadgeBorder,
  },
  quietDueClear: {
    backgroundColor: COLORS.clearBadgeBg,
    borderColor: COLORS.clearBadgeBorder,
  },
  quietDueCredit: {
    backgroundColor: COLORS.paymentGreenLight || '#E8F5E9',
    borderColor: COLORS.paymentGreen || '#2E7D32',
  },
  quietDueText: {
    fontSize: 13,
    fontWeight: '600',
  },
  quietDueTextAlert: {
    color: COLORS.dueBadgeText,
  },
  quietDueTextClear: {
    color: COLORS.clearBadgeText,
  },
  quietDueTextCredit: {
    color: COLORS.paymentGreen || '#2E7D32',
  },
  recordPaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 6,
  },
  recordPaymentText: {
    ...FONTS.subtext,
    fontWeight: '600',
    color: COLORS.paymentGreen,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    ...FONTS.bodySecondary,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 12,
  },
  sectionSubtitle: {
    ...FONTS.subtext,
  },
  ledgerListContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 90,
  },
  purchaseCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  entryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  entryDateText: {
    ...FONTS.subtext,
    color: COLORS.textTertiary,
  },
  purchaseTotalText: {
    ...FONTS.header,
    fontSize: 16,
  },
  subtotalHint: {
    ...FONTS.subtext,
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  billDiscountBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryLight || '#EEF2FF',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
    marginBottom: SPACING.xs,
  },
  billDiscountBannerText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  medicineList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: SPACING.xs,
  },
  medicineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  medicineName: {
    ...FONTS.subtext,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  medicinePrice: {
    ...FONTS.subtext,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  noMedsText: {
    ...FONTS.subtext,
    fontStyle: 'italic',
  },
  entryFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceSubtle,
  },
  paidText: {
    ...FONTS.subtext,
    color: COLORS.textSecondary,
  },
  unpaidDueText: {
    ...FONTS.subtext,
    color: COLORS.dueBadgeText,
    fontWeight: '600',
  },
  fullyPaidText: {
    ...FONTS.subtext,
    color: COLORS.paymentGreen,
  },
  paymentCard: {
    backgroundColor: COLORS.paymentCardBg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.paymentCardBorder,
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  paymentBadgeText: {
    ...FONTS.subtext,
    fontWeight: '600',
    color: COLORS.paymentGreen,
  },
  paymentBody: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  paymentAmountText: {
    ...FONTS.header,
    color: COLORS.paymentGreen,
    fontSize: 18,
  },
  paymentSubtext: {
    ...FONTS.subtext,
    color: COLORS.paymentGreen,
  },
  emptyLedgerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxxl,
    paddingTop: SPACING.xxxl,
  },
  emptyLedgerTitle: {
    ...FONTS.header,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  emptyLedgerSubtitle: {
    ...FONTS.bodySecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  addPurchaseBtn: {
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
  },
  addPurchaseBtnText: {
    ...FONTS.body,
    fontWeight: '700',
    color: COLORS.textInverted,
    fontSize: 16,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 76,
    left: SPACING.xl,
    right: SPACING.xl,
    backgroundColor: '#1E293B',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 999,
  },
  toastText: {
    ...FONTS.body,
    color: COLORS.textInverted,
    fontWeight: '600',
    flex: 1,
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    width: '100%',
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    ...FONTS.title,
    fontSize: 18,
  },
  modalSubtitle: {
    ...FONTS.bodySecondary,
    fontSize: 13,
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  payFullChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryLight || '#EEF2FF',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder || '#C7D2FE',
  },
  payFullChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  modalInput: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 52,
    ...FONTS.header,
    marginBottom: SPACING.xl,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.md,
  },
  modalCancelBtn: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  modalCancelBtnText: {
    ...FONTS.body,
    color: COLORS.textSecondary,
  },
  modalConfirmBtn: {
    backgroundColor: COLORS.paymentGreen,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.pill,
  },
  modalConfirmBtnText: {
    ...FONTS.body,
    color: COLORS.textInverted,
    fontWeight: '600',
  },
  deleteModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  deleteIconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModalTitle: {
    ...FONTS.header,
    color: COLORS.danger,
    fontSize: 18,
  },
  deleteModalMessage: {
    ...FONTS.body,
    color: COLORS.textPrimary,
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  deleteConfirmBtn: {
    backgroundColor: COLORS.danger,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteConfirmBtnText: {
    ...FONTS.body,
    color: COLORS.textInverted,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
