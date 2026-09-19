import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS } from '../constants/theme';
import { getCustomerById, getCustomerLedger, addDuePayment } from '../db/database';
import { formatLocalDateTime } from '../utils/dateUtils';
import { isPaymentEntry } from '../utils/khataLogic';

export default function CustomerProfileScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 24);

  const { customerId } = route.params;

  const [customer, setCustomer] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  // Payment modal state
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

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
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }

    setSavingPayment(true);
    try {
      addDuePayment({
        customerId,
        amountPaid: amount,
      });
      setPaymentAmount('');
      setPayModalVisible(false);
      loadProfile();
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
  const hasDue = totalDue > 0;

  const renderLedgerItem = ({ item }) => {
    const isPaymentOnly = isPaymentEntry(item);

    // ── DISTINCT VISUAL TREATMENT FOR PAYMENTS (User Feedback #1) ──
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

    return (
      <View style={styles.purchaseCard}>
        {/* Entry Date & Total */}
        <View style={styles.entryHeaderRow}>
          <Text style={styles.entryDateText}>{formatLocalDateTime(item.entry_date)}</Text>
          <Text style={styles.purchaseTotalText}>
            ₹{parseFloat(item.total_amount).toFixed(2)}
          </Text>
        </View>

        {/* Medicine Tags */}
        <View style={styles.medicineList}>
          {medicines.map((med, idx) => (
            <View key={idx} style={styles.medicineChip}>
              <Text style={styles.medicineName}>{med.medicine_name}</Text>
              {med.price > 0 ? (
                <Text style={styles.medicinePrice}>₹{parseFloat(med.price).toFixed(0)}</Text>
              ) : null}
            </View>
          ))}
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
      </View>

      {/* Customer Header Index-Card */}
      <View style={styles.customerHeaderCard}>
        <View style={styles.profileTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerCustomerName}>{customer.name}</Text>
            <Text style={styles.headerPhone}>
              <Ionicons name="call-outline" size={13} color={COLORS.textSecondary} /> {customer.phone_number}
            </Text>
            {customer.village ? (
              <Text style={styles.headerVillage}>
                <Ionicons name="location-outline" size={13} color={COLORS.textSecondary} /> {customer.village}
                {customer.address ? ` • ${customer.address}` : ''}
              </Text>
            ) : null}
          </View>

          {/* Quiet Due Badge */}
          <View style={[styles.quietDueBadge, hasDue ? styles.quietDueAlert : styles.quietDueClear]}>
            <Text style={[styles.quietDueText, hasDue ? styles.quietDueTextAlert : styles.quietDueTextClear]}>
              {hasDue ? `₹${totalDue.toFixed(0)} due` : 'All clear'}
            </Text>
          </View>
        </View>

        {/* Quick Payment Action (if due exists) */}
        {hasDue && (
          <TouchableOpacity
            style={styles.recordPaymentRow}
            onPress={() => {
              setPaymentAmount(String(totalDue));
              setPayModalVisible(true);
            }}
          >
            <Ionicons name="card-outline" size={16} color={COLORS.paymentGreen} />
            <Text style={styles.recordPaymentText}>Record Due Payment</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Ledger Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Purchase & Payment History</Text>
        <Text style={styles.sectionSubtitle}>{ledger.length} record{ledger.length === 1 ? '' : 's'}</Text>
      </View>

      {/* Ledger Entries List */}
      {ledger.length === 0 ? (
        <View style={styles.emptyLedgerContainer}>
          <Ionicons name="reader-outline" size={44} color={COLORS.borderStrong} />
          <Text style={styles.emptyLedgerTitle}>No purchases recorded yet</Text>
          <Text style={styles.emptyLedgerSubtitle}>
            Tap "+ Add Purchase" below to record medicines bought by this customer.
          </Text>
        </View>
      ) : (
        <FlatList
          data={ledger}
          keyExtractor={(item) => String(item.entry_id)}
          renderItem={renderLedgerItem}
          contentContainerStyle={[
            styles.ledgerListContent,
            { paddingBottom: Math.max(insets.bottom, SPACING.md) + 80 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Bottom Floating Add Purchase Action */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, SPACING.md) }]}>
        <TouchableOpacity
          style={styles.addPurchaseBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('AddPurchase', { customerId, customerName: customer.name })}
        >
          <Ionicons name="cart-outline" size={22} color={COLORS.textInverted} />
          <Text style={styles.addPurchaseBtnText}>+ Add Purchase</Text>
        </TouchableOpacity>
      </View>

      {/* Record Payment Modal */}
      <Modal visible={payModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Record Payment</Text>
            <Text style={styles.modalSubtitle}>
              Clearing due for {customer.name} (Current due: ₹{totalDue.toFixed(2)})
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Amount received (₹)"
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
                style={styles.modalConfirmBtn}
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
    marginBottom: SPACING.sm,
  },
  entryDateText: {
    ...FONTS.subtext,
    color: COLORS.textTertiary,
  },
  purchaseTotalText: {
    ...FONTS.header,
    fontSize: 16,
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
    marginBottom: SPACING.lg,
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
});
