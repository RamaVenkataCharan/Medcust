import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS } from '../constants/theme';
import { searchCustomers, getActiveDriverName } from '../db/database';
import { exportKhataBackup } from '../services/exportService';

export default function HomeScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(() => {
    try {
      const results = searchCustomers(query);
      setCustomers(results);
    } catch (e) {
      console.error('Error loading customers:', e);
    } finally {
      setLoading(false);
    }
  }, [query]);

  // Reload when screen regains focus or query changes
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    loadData();
  }, [query, loadData]);

  const handleExport = async () => {
    setExporting(true);
    await exportKhataBackup();
    setExporting(false);
  };

  const renderCustomerItem = ({ item }) => {
    const totalDue = parseFloat(item.total_due || 0);
    const hasDue = totalDue > 0;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.customerCard}
        onPress={() => navigation.navigate('CustomerProfile', { customerId: item.customer_id })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.customerName}>{item.name}</Text>
          <View style={[styles.dueBadge, hasDue ? styles.dueBadgeAlert : styles.dueBadgeClear]}>
            <Text style={[styles.dueBadgeText, hasDue ? styles.dueBadgeTextAlert : styles.dueBadgeTextClear]}>
              {hasDue ? `₹${totalDue.toFixed(0)} due` : 'All clear'}
            </Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <Text style={styles.detailText}>
            <Ionicons name="call-outline" size={13} color={COLORS.textSecondary} /> {item.phone_number}
          </Text>
          {item.village ? (
            <Text style={styles.detailText}>
              <Ionicons name="location-outline" size={13} color={COLORS.textSecondary} /> {item.village}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Notebook Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>MedTrack</Text>
          <Text style={styles.appSubtitle}>
            Medical Khata Book • {getActiveDriverName().includes('SQLITE') ? 'Native SQLite' : 'Web Fallback'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.exportButton}
          onPress={handleExport}
          disabled={exporting}
          accessibilityLabel="Export Backup"
        >
          {exporting ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <>
              <Ionicons name="share-outline" size={18} color={COLORS.primary} />
              <Text style={styles.exportButtonText}>Backup</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Auto-focused Large Search Box */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by phone or name..."
          placeholderTextColor={COLORS.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoFocus={true}
          keyboardType="default"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} style={styles.clearSearchBtn}>
            <Ionicons name="close-circle" size={18} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Customer List or Empty Match */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : customers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="book-outline" size={48} color={COLORS.borderStrong} />
          <Text style={styles.emptyTitle}>
            {query.trim() ? `No customer matching "${query}"` : 'No customers yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            Add this customer to start tracking medicines and purchases.
          </Text>
          <TouchableOpacity
            style={styles.addCustomerEmptyBtn}
            onPress={() => navigation.navigate('AddCustomer', { initialPhoneOrName: query.trim() })}
          >
            <Ionicons name="person-add-outline" size={20} color={COLORS.textInverted} />
            <Text style={styles.addCustomerEmptyBtnText}>+ Add Customer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => String(item.customer_id)}
          renderItem={renderCustomerItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Add Customer Button */}
      {customers.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('AddCustomer', { initialPhoneOrName: query.trim() })}
        >
          <Ionicons name="person-add" size={20} color={COLORS.textInverted} />
          <Text style={styles.fabText}>+ Add Customer</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  appTitle: {
    ...FONTS.title,
    color: COLORS.primary,
  },
  appSubtitle: {
    ...FONTS.subtext,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 3,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    gap: 4,
  },
  exportButtonText: {
    ...FONTS.subtext,
    fontWeight: '600',
    color: COLORS.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.xl,
    marginVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    height: 52,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    ...FONTS.body,
    height: '100%',
  },
  clearSearchBtn: {
    padding: SPACING.xs,
  },
  listContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 85,
    paddingTop: SPACING.xs,
  },
  customerCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  customerName: {
    ...FONTS.header,
    flex: 1,
    marginRight: SPACING.sm,
  },
  dueBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  dueBadgeAlert: {
    backgroundColor: COLORS.dueBadgeBg,
    borderColor: COLORS.dueBadgeBorder,
  },
  dueBadgeClear: {
    backgroundColor: COLORS.clearBadgeBg,
    borderColor: COLORS.clearBadgeBorder,
  },
  dueBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dueBadgeTextAlert: {
    color: COLORS.dueBadgeText,
  },
  dueBadgeTextClear: {
    color: COLORS.clearBadgeText,
  },
  cardDetails: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  detailText: {
    ...FONTS.bodySecondary,
    fontSize: 13,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxxl,
  },
  emptyTitle: {
    ...FONTS.header,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...FONTS.bodySecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.xl,
  },
  addCustomerEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.pill,
    gap: SPACING.sm,
  },
  addCustomerEmptyBtnText: {
    ...FONTS.body,
    fontWeight: '600',
    color: COLORS.textInverted,
  },
  fab: {
    position: 'absolute',
    bottom: SPACING.xxl,
    right: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.pill,
    gap: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  fabText: {
    ...FONTS.body,
    fontWeight: '600',
    color: COLORS.textInverted,
  },
});
