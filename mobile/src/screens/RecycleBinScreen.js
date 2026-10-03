import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS } from '../constants/theme';
import { getTrashCustomers, restoreCustomer, permanentDeleteCustomer } from '../db/database';
import { formatLocalDateTime } from '../utils/dateUtils';

export default function RecycleBinScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 24);

  const [trashList, setTrashList] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTrash = useCallback(() => {
    try {
      setLoading(true);
      const data = getTrashCustomers();
      setTrashList(data || []);
    } catch (err) {
      console.error('Error loading trash customers:', err);
      Alert.alert('Error', 'Failed to load recycle bin items: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTrash();
    }, [loadTrash])
  );

  const handleRestore = (customer) => {
    Alert.alert(
      'Restore Customer',
      `Restore "${customer.name}" (${customer.phone_number}) back to the active customer ledger?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: () => {
            try {
              restoreCustomer(customer.customer_id);
              Alert.alert('Customer Restored', `"${customer.name}" is now active in search.`);
              loadTrash();
            } catch (err) {
              Alert.alert('Restore Failed', err.message || 'Could not restore customer.');
            }
          },
        },
      ]
    );
  };

  const handlePermanentDelete = (customer) => {
    Alert.alert(
      'Delete Forever?',
      `Are you sure you want to permanently delete "${customer.name}" (${customer.phone_number})?\n\nThis will permanently remove all historical purchase entries, medicine line items, and payment receipts from this device. This CANNOT be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: () => {
            try {
              permanentDeleteCustomer(customer.customer_id);
              Alert.alert('Customer Eradicated', `"${customer.name}" and all historical data were permanently removed.`);
              loadTrash();
            } catch (err) {
              Alert.alert('Delete Failed', err.message || 'Could not permanently delete customer.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const deletedTimeStr = item.deleted_at ? formatLocalDateTime(item.deleted_at) : 'Recently deleted';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.customerName}>{item.name}</Text>
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={13} color={COLORS.textSecondary} />
              <Text style={styles.phoneText}>{item.phone_number}</Text>
              {item.village ? (
                <>
                  <Text style={styles.bullet}>•</Text>
                  <Ionicons name="location-outline" size={13} color={COLORS.textSecondary} />
                  <Text style={styles.villageText}>{item.village}</Text>
                </>
              ) : null}
            </View>
          </View>
          <View style={styles.binBadge}>
            <Text style={styles.binBadgeText}>In Bin</Text>
          </View>
        </View>

        <View style={styles.dateRow}>
          <Ionicons name="time-outline" size={13} color={COLORS.textTertiary} />
          <Text style={styles.dateText}>Deleted: {deletedTimeStr}</Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={() => handleRestore(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-undo-outline" size={16} color={COLORS.primary} />
            <Text style={styles.restoreBtnText}>Restore</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteForeverBtn}
            onPress={() => handlePermanentDelete(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-bin-outline" size={16} color={COLORS.dueBadgeBg} />
            <Text style={styles.deleteForeverBtnText}>Delete Forever</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
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
          <Text style={styles.title}>Recycle Bin</Text>
          <Text style={styles.subtitle}>Soft-deleted customers ({trashList.length})</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : trashList.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="trash-outline" size={36} color={COLORS.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>Recycle Bin is Empty</Text>
          <Text style={styles.emptySubtitle}>
            Customers deleted with zero balance are safely kept here before permanent removal.
          </Text>
        </View>
      ) : (
        <FlatList
          data={trashList}
          keyExtractor={(item) => String(item.customer_id)}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, SPACING.xxxl) + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
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
    fontSize: 20,
  },
  subtitle: {
    ...FONTS.subtext,
    color: COLORS.textSecondary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    ...FONTS.header,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    ...FONTS.subtext,
    textAlign: 'center',
    color: COLORS.textSecondary,
    maxWidth: 260,
    lineHeight: 18,
  },
  listContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.surface,
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  customerName: {
    ...FONTS.header,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  phoneText: {
    ...FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  bullet: {
    color: COLORS.textTertiary,
    fontSize: 10,
    marginHorizontal: 2,
  },
  villageText: {
    ...FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  binBadge: {
    backgroundColor: COLORS.dueBadgeBorder,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
  },
  binBadgeText: {
    fontSize: 11,
    color: COLORS.dueBadgeBg,
    fontWeight: '700',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.xs,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceSubtle,
  },
  dateText: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  restoreBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  deleteForeverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.dueBadgeBorder,
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  deleteForeverBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.dueBadgeBg,
  },
});
