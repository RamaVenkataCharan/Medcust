import React, { useState, useCallback, useRef, memo, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  UIManager,
  LayoutAnimation,
  StyleSheet
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { getCustomerById, getCustomerLedger, softDeleteCustomer } from '../db/database';
import { formatLocalDateTime, getDateLabel } from '../utils/dateUtils';
import { isPaymentEntry } from '../utils/khataLogic';
import { formatINR, formatPhone } from '../utils/formatUtils';
import { useResponsive, TEXT_PROPS } from '../utils/responsive';
import ScreenContainer from '../components/ScreenContainer';
import StickyFooter from '../components/StickyFooter';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function extractPaymentMethod(note) {
  if (!note) return null;
  const parts = note.split(' - ');
  const mode = parts[0].trim();
  if (['Cash', 'UPI', 'Bank'].includes(mode)) return mode;
  
  const lower = note.toLowerCase();
  if (lower.includes('upi')) return 'UPI';
  if (lower.includes('cash')) return 'Cash';
  if (lower.includes('card')) return 'Card';
  if (lower.includes('cheque') || lower.includes('check')) return 'Cheque';
  if (lower.includes('neft') || lower.includes('rtgs') || lower.includes('imps') || lower.includes('bank')) return 'Bank';
  return null;
}

const PurchaseRow = memo(function PurchaseRow({ item, isExpanded, onToggle, styles, r }) {
  const medicines = item.medicines || [];
  const total = parseFloat(item.total_amount || 0);
  const paid = parseFloat(item.amount_paid || 0);
  const due = parseFloat(item.due_amount || 0);
  const isFullyPaid = due <= 0;

  const dateLabel = getDateLabel(item.entry_date);
  const dateTimestamp = formatLocalDateTime(item.entry_date);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.rowHeader}
        onPress={onToggle}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={styles.purchaseCircle}>
          <Ionicons name="bag-outline" size={r.scale(20)} color={COLORS.primary} />
        </View>

        <View style={styles.rowMiddle}>
          <Text {...TEXT_PROPS} style={styles.rowDateLabel} numberOfLines={1}>{dateLabel}</Text>
          <Text {...TEXT_PROPS} style={styles.rowTimestamp} numberOfLines={1}>{dateTimestamp}</Text>
        </View>

        <View style={styles.rowRight}>
          <Text {...TEXT_PROPS} style={styles.rowTotalLabel}>Total</Text>
          <Text {...TEXT_PROPS} style={styles.rowTotalAmount}>{formatINR(total)}</Text>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={r.scale(18)}
          color={COLORS.textTertiary}
          style={styles.chevron}
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.expandedBox}>
          {medicines.length > 0
            ? medicines.map((med, idx) => {
                const price = parseFloat(med.price || 0);
                const discount = parseFloat(med.discount || 0);
                const lineTotal = discount > 0 ? price - discount : price;
                return (
                  <View key={med.id || idx}>
                    {idx > 0 && <View style={styles.medDivider} />}
                    <View style={styles.medRow}>
                      <View style={styles.medLeft}>
                        <Text {...TEXT_PROPS} style={styles.medName} numberOfLines={2}>{med.medicine_name}</Text>
                        <Text {...TEXT_PROPS} style={styles.medQty}>1 × {price.toFixed(0)}</Text>
                        {discount > 0 && (
                          <Text {...TEXT_PROPS} style={styles.medDiscount}>Discount −{formatINR(discount)}</Text>
                        )}
                      </View>
                      <Text {...TEXT_PROPS} style={styles.medAmount}>{formatINR(lineTotal)}</Text>
                    </View>
                  </View>
                );
              })
            : (
              <Text {...TEXT_PROPS} style={styles.noMedsText}>General purchase</Text>
            )
          }

          <View style={styles.paidRow}>
            <Ionicons name="card-outline" size={r.scale(16)} color={COLORS.textSecondary} style={{ marginRight: r.scale(6) }} />
            <View>
              <Text {...TEXT_PROPS} style={styles.paidLabel}>Paid</Text>
              <Text {...TEXT_PROPS} style={styles.paidAmount}>{formatINR(paid)}</Text>
            </View>
          </View>

          {isFullyPaid ? (
            <View style={styles.pillGreen}>
              <Ionicons name="checkmark-circle-outline" size={r.scale(14)} color={COLORS.greenText} style={{ marginRight: r.scale(4) }} />
              <Text {...TEXT_PROPS} style={styles.pillGreenText}>Fully paid</Text>
            </View>
          ) : (
            <View style={styles.pillAmber}>
              <Ionicons name="cash-outline" size={r.scale(14)} color={COLORS.amberBannerText} style={{ marginRight: r.scale(4) }} />
              <Text {...TEXT_PROPS} style={styles.pillAmberText}>{formatINR(due)} added to due</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
});

const PaymentRow = memo(function PaymentRow({ item, isExpanded, onToggle, styles, r }) {
  const paid = parseFloat(item.amount_paid || 0);
  const dateLabel = getDateLabel(item.entry_date);
  const dateTimestamp = formatLocalDateTime(item.entry_date);
  const method = extractPaymentMethod(item.note);
  const methodLine = method ? `Payment · ${method}` : 'Payment';

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.rowHeader}
        onPress={onToggle}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={styles.paymentCircle}>
          <Text {...TEXT_PROPS} style={styles.rupeeText}>₹</Text>
        </View>

        <View style={styles.rowMiddle}>
          <Text {...TEXT_PROPS} style={styles.rowDateLabel} numberOfLines={1}>{dateLabel}</Text>
          <Text {...TEXT_PROPS} style={styles.rowTimestamp} numberOfLines={1}>{dateTimestamp}</Text>
          <Text {...TEXT_PROPS} style={styles.rowMethodLine} numberOfLines={1}>{methodLine}</Text>
        </View>

        <Text {...TEXT_PROPS} style={styles.paymentAmount}>{formatINR(paid)}</Text>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={r.scale(18)}
          color={COLORS.textTertiary}
          style={styles.chevron}
        />
      </TouchableOpacity>

      {(() => {
        if (!isExpanded || !item.note) return null;
        let displayNote = item.note;
        if (method) {
          const prefix = method + ' - ';
          if (displayNote.startsWith(prefix)) {
            displayNote = displayNote.substring(prefix.length).trim();
          } else if (displayNote === method) {
            displayNote = null;
          }
        }
        if (!displayNote) return null;
        return (
          <View style={styles.expandedBox}>
            <Text {...TEXT_PROPS} style={styles.noteText}>{displayNote}</Text>
          </View>
        );
      })()}
    </View>
  );
});

export default function CustomerProfileScreen({ route, navigation }) {
  const { customerId } = route.params;

  const [customer, setCustomer] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [footerH, setFooterH] = useState(0);
  const firstPurchaseIdRef = useRef(null);

  const r = useResponsive();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(r, footerH, insets), [r, footerH, insets]);

  const loadProfile = useCallback(() => {
    try {
      const cust = getCustomerById(customerId);
      if (!cust) {
        navigation.goBack();
        return;
      }
      const entries = getCustomerLedger(customerId);
      setCustomer(cust);
      setLedger(entries);

      const firstPurchase = entries.find((e) => !isPaymentEntry(e));
      if (firstPurchase) {
        const id = String(firstPurchase.entry_id);
        firstPurchaseIdRef.current = id;
        setExpandedIds(new Set([id]));
      }
    } catch (err) {
      console.error('Error loading customer profile:', err);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadProfile();
    }, [loadProfile])
  );

  const toggleExpand = useCallback((entryId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }, []);

  const handleDelete = useCallback(() => {
    if (!customer) return;
    const due = parseFloat(customer.total_due || 0);

    if (due !== 0) {
      const dueLine = due > 0
          ? `This customer has ₹${due.toFixed(2)} in outstanding dues.`
          : `This customer has a credit balance of ₹${Math.abs(due).toFixed(2)}.`;
      Alert.alert('Cannot Delete', `${dueLine}\n\nSettle all dues/credit before deleting this customer.`, [{ text: 'OK' }]);
      return;
    }

    Alert.alert(
      'Move to Recycle Bin?',
      `Move ${customer.name} to the Recycle Bin? You can restore them later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (softDeleteCustomer(customer.customer_id)) {
              navigation.goBack();
            } else {
              Alert.alert('Error', 'Failed to delete customer.');
            }
          },
        },
      ]
    );
  }, [customer]);

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: r.scale(40) }} />
      </ScreenContainer>
    );
  }

  if (!customer) {
    return (
      <ScreenContainer>
        <Text style={styles.notFoundText}>Customer not found.</Text>
      </ScreenContainer>
    );
  }

  const totalDue = parseFloat(customer.total_due || 0);
  const hasDue = totalDue > 0;
  const hasCredit = totalDue < 0;

  const renderLedgerItem = ({ item }) => {
    const id = String(item.entry_id);
    const expanded = expandedIds.has(id);
    const toggle = () => toggleExpand(id);

    if (isPaymentEntry(item)) {
      return <PaymentRow item={item} isExpanded={expanded} onToggle={toggle} styles={styles} r={r} />;
    }
    return <PurchaseRow item={item} isExpanded={expanded} onToggle={toggle} styles={styles} r={r} />;
  };

  const renderCustomerCard = () => (
    <View style={styles.customerCard}>
      <View style={styles.customerTopRow}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={r.scale(36)} color={COLORS.primary} />
        </View>

        <View style={styles.customerInfo}>
          <Text {...TEXT_PROPS} style={styles.customerName} numberOfLines={2}>{customer.name}</Text>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={r.scale(13)} color={COLORS.textSecondary} />
            <Text {...TEXT_PROPS} style={styles.infoText} numberOfLines={1}> {formatPhone(customer.phone_number)}</Text>
          </View>
          {customer.village ? (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={r.scale(13)} color={COLORS.textSecondary} />
              <Text {...TEXT_PROPS} style={styles.infoText} numberOfLines={1}> {customer.village}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {hasDue ? (
        <View style={styles.amberBanner}>
          <Ionicons name="wallet-outline" size={r.scale(20)} color={COLORS.amberBannerText} style={{ marginRight: r.scale(8) }} />
          <Text {...TEXT_PROPS} style={styles.amberBannerText}>{formatINR(totalDue)} due</Text>
        </View>
      ) : hasCredit ? (
        <View style={styles.creditBanner}>
          <Ionicons name="wallet-outline" size={r.scale(20)} color={COLORS.creditBannerText} style={{ marginRight: r.scale(8) }} />
          <Text {...TEXT_PROPS} style={styles.creditBannerText}>{formatINR(Math.abs(totalDue))} credit</Text>
        </View>
      ) : (
        <View style={styles.clearBanner}>
          <Ionicons name="checkmark-circle-outline" size={r.scale(20)} color={COLORS.greenText} style={{ marginRight: r.scale(8) }} />
          <Text {...TEXT_PROPS} style={styles.clearBannerText}>All clear, no dues</Text>
        </View>
      )}

      {hasDue && (
        <TouchableOpacity
          style={styles.recordPaymentBtn}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('RecordPayment', { customerId: customer.customer_id })}
        >
          <Ionicons name="card-outline" size={r.scale(18)} color={COLORS.primary} />
          <Text {...TEXT_PROPS} style={styles.recordPaymentBtnText}>Record Due Payment</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const ListEmptyComponent = (
    <View style={styles.emptyContainer}>
      <Ionicons name="receipt-outline" size={r.scale(48)} color={COLORS.borderStrong} />
      <Text {...TEXT_PROPS} style={styles.emptyTitle}>No purchases or payments yet</Text>
      <Text {...TEXT_PROPS} style={styles.emptySubtitle}>Tap "+ Add Purchase" below to record the first transaction.</Text>
    </View>
  );

  return (
    <ScreenContainer>
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={r.scale(24)} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <Text {...TEXT_PROPS} style={styles.navTitle} numberOfLines={1}>{customer.name}</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            style={[styles.trashBtn, { marginRight: 16 }]}
            onPress={() => navigation.navigate('EditCustomer', { customerId: customer.customer_id })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="pencil" size={r.scale(22)} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.trashBtn}
            onPress={handleDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={r.scale(22)} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {r.columns === 2 ? (
        <View style={styles.twoPaneContainer}>
          <View style={styles.leftPane}>
            {renderCustomerCard()}
          </View>
          <View style={styles.rightPane}>
            <View style={styles.sectionHeader}>
              <Text {...TEXT_PROPS} style={styles.sectionTitle}>Purchase & Payment History</Text>
              <Text {...TEXT_PROPS} style={styles.sectionCount}>{ledger.length} record{ledger.length === 1 ? '' : 's'}</Text>
            </View>
            <FlatList
              data={ledger}
              keyExtractor={(item) => String(item.entry_id)}
              renderItem={renderLedgerItem}
              ListEmptyComponent={ListEmptyComponent}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      ) : (
        <FlatList
          data={ledger}
          keyExtractor={(item) => String(item.entry_id)}
          renderItem={renderLedgerItem}
          ListHeaderComponent={() => (
            <View>
              {renderCustomerCard()}
              <View style={styles.sectionHeader}>
                <Text {...TEXT_PROPS} style={styles.sectionTitle}>Purchase & Payment History</Text>
                <Text {...TEXT_PROPS} style={styles.sectionCount}>{ledger.length} record{ledger.length === 1 ? '' : 's'}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={ListEmptyComponent}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <StickyFooter onHeight={setFooterH}>
        <TouchableOpacity
          style={styles.addPurchaseBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('AddPurchase', { customerId, customerName: customer.name })}
        >
          <Ionicons name="add" size={r.scale(22)} color={COLORS.textInverted} />
          <Text {...TEXT_PROPS} style={styles.addPurchaseBtnText}>Add Purchase</Text>
        </TouchableOpacity>
      </StickyFooter>
    </ScreenContainer>
  );
}

const makeStyles = (r, footerH, insets) => StyleSheet.create({
  notFoundText: {
    fontSize: r.font(15),
    color: COLORS.textSecondary,
    alignSelf: 'center',
    marginTop: r.scale(40),
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: r.moderate(16),
    paddingVertical: r.moderate(12),
    backgroundColor: COLORS.background,
  },
  backBtn: {
    minHeight: r.touch,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: r.moderate(4),
  },
  navTitle: {
    fontSize: r.font(20),
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
    letterSpacing: -0.3,
  },
  trashBtn: {
    minHeight: r.touch,
    justifyContent: 'center',
    alignItems: 'center',
  },
  twoPaneContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPane: {
    flex: 1,
    borderRightWidth: 1,
    borderColor: COLORS.border,
    paddingRight: r.moderate(16),
  },
  rightPane: {
    flex: 1.5,
  },
  customerCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: r.columns === 2 ? 0 : r.moderate(16),
    marginLeft: r.moderate(16),
    marginBottom: r.moderate(12),
    padding: r.moderate(16),
    borderRadius: r.moderate(18),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  customerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: r.moderate(12),
  },
  avatarCircle: {
    width: r.scale(72),
    height: r.scale(72),
    borderRadius: r.scale(36),
    backgroundColor: COLORS.avatarBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: r.moderate(12),
  },
  customerInfo: {
    flex: 1,
    paddingTop: r.scale(4),
  },
  customerName: {
    fontSize: r.font(22),
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
    marginBottom: r.scale(4),
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: r.scale(3),
  },
  infoText: {
    fontSize: r.font(14),
    color: COLORS.textSecondary,
    flex: 1,
  },
  amberBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.amberBannerBg,
    borderRadius: r.moderate(10),
    paddingHorizontal: r.moderate(16),
    paddingVertical: r.moderate(12),
    marginBottom: r.moderate(12),
  },
  amberBannerText: {
    fontSize: r.font(18),
    fontWeight: '700',
    color: COLORS.amberBannerText,
    letterSpacing: -0.2,
  },
  clearBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.greenCircleBg,
    borderRadius: r.moderate(10),
    paddingHorizontal: r.moderate(16),
    paddingVertical: r.moderate(12),
    marginBottom: r.moderate(12),
  },
  clearBannerText: {
    fontSize: r.font(15),
    fontWeight: '600',
    color: COLORS.greenText,
  },
  creditBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.creditBannerBg,
    borderRadius: r.moderate(10),
    paddingHorizontal: r.moderate(16),
    paddingVertical: r.moderate(12),
    marginBottom: r.moderate(12),
  },
  creditBannerText: {
    fontSize: r.font(15),
    fontWeight: '600',
    color: COLORS.creditBannerText,
  },
  recordPaymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: r.moderate(10),
    paddingVertical: r.moderate(12),
    gap: r.scale(8),
    minHeight: r.touch,
  },
  recordPaymentBtnText: {
    fontSize: r.font(15),
    fontWeight: '600',
    color: COLORS.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: r.moderate(16),
    marginTop: r.moderate(8),
    marginBottom: r.moderate(8),
  },
  sectionTitle: {
    fontSize: r.font(18),
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  sectionCount: {
    fontSize: r.font(12),
    color: COLORS.textSecondary,
  },
  listContent: {
    paddingTop: r.moderate(12),
    paddingBottom: footerH + 16,
  },
  card: {
    backgroundColor: COLORS.surface,
    marginHorizontal: r.moderate(16),
    marginBottom: r.moderate(8),
    borderRadius: r.moderate(14),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    overflow: 'hidden',
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: r.moderate(16),
    paddingVertical: r.moderate(12),
    minHeight: r.touch,
  },
  rowMiddle: {
    flex: 1,
    marginLeft: r.moderate(12),
  },
  rowDateLabel: {
    fontSize: r.font(15),
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: r.scale(1),
  },
  rowTimestamp: {
    fontSize: r.font(12),
    color: COLORS.textSecondary,
  },
  rowMethodLine: {
    fontSize: r.font(12),
    color: COLORS.textSecondary,
    marginTop: r.scale(1),
  },
  rowRight: {
    alignItems: 'flex-end',
    marginRight: r.moderate(4),
  },
  rowTotalLabel: {
    fontSize: r.font(11),
    color: COLORS.textTertiary,
    marginBottom: r.scale(1),
  },
  rowTotalAmount: {
    fontSize: r.font(16),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  paymentAmount: {
    fontSize: r.font(16),
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginRight: r.moderate(4),
  },
  chevron: {
    marginLeft: r.moderate(4),
  },
  purchaseCircle: {
    width: r.scale(44),
    height: r.scale(44),
    borderRadius: r.scale(22),
    backgroundColor: COLORS.avatarBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentCircle: {
    width: r.scale(44),
    height: r.scale(44),
    borderRadius: r.scale(22),
    backgroundColor: COLORS.greenCircleBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rupeeText: {
    fontSize: r.font(18),
    fontWeight: '700',
    color: COLORS.greenText,
  },
  expandedBox: {
    marginHorizontal: r.moderate(16),
    marginBottom: r.moderate(12),
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: r.moderate(10),
    overflow: 'hidden',
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: r.moderate(12),
    paddingVertical: r.moderate(10),
  },
  medLeft: {
    flex: 1,
    marginRight: r.moderate(12),
  },
  medName: {
    fontSize: r.font(14),
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: r.scale(2),
  },
  medQty: {
    fontSize: r.font(12),
    color: COLORS.textSecondary,
  },
  medDiscount: {
    fontSize: r.font(12),
    color: COLORS.amberBannerText,
    marginTop: r.scale(1),
  },
  medAmount: {
    fontSize: r.font(14),
    fontWeight: '600',
    color: COLORS.textPrimary,
    alignSelf: 'center',
  },
  medDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: r.moderate(12),
  },
  paidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: r.moderate(12),
    paddingVertical: r.moderate(10),
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  paidLabel: {
    fontSize: r.font(12),
    color: COLORS.textSecondary,
    marginBottom: r.scale(1),
  },
  paidAmount: {
    fontSize: r.font(15),
    fontWeight: '700',
    color: COLORS.greenText,
  },
  pillAmber: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.amberBannerBg,
    borderRadius: r.moderate(999),
    paddingHorizontal: r.moderate(12),
    paddingVertical: r.moderate(6),
    margin: r.moderate(12),
    alignSelf: 'flex-start',
  },
  pillAmberText: {
    fontSize: r.font(13),
    fontWeight: '600',
    color: COLORS.amberBannerText,
  },
  pillGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.greenCircleBg,
    borderRadius: r.moderate(999),
    paddingHorizontal: r.moderate(12),
    paddingVertical: r.moderate(6),
    margin: r.moderate(12),
    alignSelf: 'flex-start',
  },
  pillGreenText: {
    fontSize: r.font(13),
    fontWeight: '600',
    color: COLORS.greenText,
  },
  noteText: {
    fontSize: r.font(15),
    color: COLORS.textSecondary,
    padding: r.moderate(12),
  },
  noMedsText: {
    fontSize: r.font(14),
    fontStyle: 'italic',
    padding: r.moderate(12),
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: r.moderate(32),
    paddingTop: r.moderate(32),
  },
  emptyTitle: {
    fontSize: r.font(18),
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: r.moderate(12),
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: r.font(14),
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: r.scale(4),
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    paddingHorizontal: r.moderate(16),
    paddingTop: r.moderate(8),
    paddingBottom: insets.bottom + r.moderate(16),
  },
  addPurchaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    height: r.scale(56),
    borderRadius: r.moderate(14),
    gap: r.scale(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  addPurchaseBtnText: {
    fontSize: r.font(16),
    fontWeight: '700',
    color: COLORS.textInverted,
  },
});
