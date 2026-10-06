import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  StyleSheet
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { searchCustomers, getActiveDriverName } from '../db/database';
import { exportKhataBackup } from '../services/exportService';
import { useResponsive, TEXT_PROPS } from '../utils/responsive';
import ScreenContainer from '../components/ScreenContainer';

export default function HomeScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const r = useResponsive();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(r, insets), [r, insets]);

  const reqCounter = useRef(0);
  const timerRef = useRef(null);

  const loadData = useCallback(() => {
    const currentReq = ++reqCounter.current;
    
    // Fire immediately if query is cleared
    if (query === '') {
      try {
        const results = searchCustomers(query);
        if (reqCounter.current === currentReq) {
          setCustomers(results);
          setLoading(false);
        }
      } catch (e) {
        console.error('Error loading customers:', e);
        if (reqCounter.current === currentReq) setLoading(false);
      }
      return;
    }

    setLoading(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    
    timerRef.current = setTimeout(() => {
      try {
        const results = searchCustomers(query);
        if (reqCounter.current === currentReq) {
          setCustomers(results);
          setLoading(false);
        }
      } catch (e) {
        console.error('Error loading customers:', e);
        if (reqCounter.current === currentReq) setLoading(false);
      }
    }, 250);
  }, [query]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }, [loadData])
  );

  useEffect(() => {
    loadData();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, loadData]);

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
          <Text {...TEXT_PROPS} style={styles.customerName} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.dueBadge, hasDue ? styles.dueBadgeAlert : styles.dueBadgeClear]}>
            <Text {...TEXT_PROPS} style={[styles.dueBadgeText, hasDue ? styles.dueBadgeTextAlert : styles.dueBadgeTextClear]}>
              {hasDue ? `₹${totalDue.toFixed(0)} due` : 'All clear'}
            </Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <Text {...TEXT_PROPS} style={styles.detailText} numberOfLines={1}>
            <Ionicons name="call-outline" size={r.scale(13)} color={COLORS.textSecondary} /> {item.phone_number}
          </Text>
          {item.village ? (
            <Text {...TEXT_PROPS} style={styles.detailText} numberOfLines={1}>
              <Ionicons name="location-outline" size={r.scale(13)} color={COLORS.textSecondary} /> {item.village}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Notebook Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: r.moderate(8) }}>
          <Text {...TEXT_PROPS} style={styles.appTitle}>MedTrack</Text>
          <Text {...TEXT_PROPS} style={styles.appSubtitle} numberOfLines={1}>
            Medical Khata Book • {getActiveDriverName().includes('SQLITE') ? 'Native SQLite' : 'Web Fallback'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.exportButton}
          onPress={() => navigation.navigate('Settings')}
          accessibilityLabel="Settings"
        >
          <Ionicons name="settings-outline" size={r.scale(20)} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Auto-focused Large Search Box */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={r.scale(20)} color={COLORS.textTertiary} style={styles.searchIcon} />
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
          maxFontSizeMultiplier={1.3}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} style={styles.clearSearchBtn}>
            <Ionicons name="close-circle" size={r.scale(18)} color={COLORS.textTertiary} />
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
          <Ionicons name="book-outline" size={r.scale(48)} color={COLORS.borderStrong} />
          <Text {...TEXT_PROPS} style={styles.emptyTitle}>
            {query.trim() ? `No customer matching "${query}"` : 'No customers yet'}
          </Text>
          <Text {...TEXT_PROPS} style={styles.emptySubtitle}>
            Add this customer to start tracking medicines and purchases.
          </Text>
          <TouchableOpacity
            style={styles.addCustomerEmptyBtn}
            onPress={() => navigation.navigate('AddCustomer', { initialPhoneOrName: query.trim() })}
          >
            <Ionicons name="person-add-outline" size={r.scale(20)} color={COLORS.textInverted} />
            <Text {...TEXT_PROPS} style={styles.addCustomerEmptyBtnText}>+ Add Customer</Text>
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
          <Ionicons name="person-add" size={r.scale(20)} color={COLORS.textInverted} />
          <Text {...TEXT_PROPS} style={styles.fabText}>+ Add Customer</Text>
        </TouchableOpacity>
      )}
    </ScreenContainer>
  );
}

const makeStyles = (r, insets) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: r.moderate(20),
    paddingTop: r.moderate(12),
    paddingBottom: r.moderate(8),
  },
  appTitle: {
    fontSize: r.font(22),
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: -0.3,
  },
  appSubtitle: {
    fontSize: r.font(12),
    color: COLORS.textSecondary,
    marginTop: r.scale(2),
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: r.moderate(12),
    paddingVertical: r.moderate(7),
    borderRadius: r.moderate(999),
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    gap: r.scale(4),
    minHeight: r.touch,
  },
  exportButtonText: {
    fontSize: r.font(12),
    fontWeight: '600',
    color: COLORS.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: r.moderate(20),
    marginVertical: r.moderate(12),
    paddingHorizontal: r.moderate(12),
    height: r.scale(52),
    borderRadius: r.moderate(14),
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  searchIcon: {
    marginRight: r.moderate(8),
  },
  searchInput: {
    flex: 1,
    fontSize: r.font(15),
    color: COLORS.textPrimary,
    height: '100%',
  },
  clearSearchBtn: {
    padding: r.moderate(4),
    minHeight: Math.max(r.touch, r.scale(44)),
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: r.moderate(20),
    paddingBottom: insets.bottom + r.moderate(85), // fab padding
    paddingTop: r.moderate(4),
  },
  customerCard: {
    backgroundColor: COLORS.surface,
    padding: r.moderate(16),
    borderRadius: r.moderate(10),
    marginBottom: r.moderate(12),
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
    marginBottom: r.moderate(8),
  },
  customerName: {
    fontSize: r.font(18),
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: r.moderate(8),
  },
  dueBadge: {
    paddingHorizontal: r.moderate(12),
    paddingVertical: r.scale(3),
    borderRadius: r.moderate(999),
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
    fontSize: r.font(12),
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
    gap: r.moderate(16),
  },
  detailText: {
    fontSize: r.font(13),
    color: COLORS.textSecondary,
    lineHeight: r.font(20),
    flex: 1,
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
    paddingHorizontal: r.moderate(32),
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
    lineHeight: r.font(20),
    textAlign: 'center',
    marginTop: r.scale(4),
    marginBottom: r.moderate(20),
  },
  addCustomerEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: r.moderate(12),
    paddingHorizontal: r.moderate(20),
    borderRadius: r.moderate(999),
    gap: r.scale(8),
    minHeight: r.touch,
  },
  addCustomerEmptyBtnText: {
    fontSize: r.font(15),
    fontWeight: '600',
    color: COLORS.textInverted,
  },
  fab: {
    position: 'absolute',
    bottom: insets.bottom + 16,
    right: insets.right + 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: r.moderate(12),
    paddingHorizontal: r.moderate(20),
    borderRadius: r.moderate(999),
    gap: r.scale(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
    minHeight: r.touch,
  },
  fabText: {
    fontSize: r.font(15),
    fontWeight: '600',
    color: COLORS.textInverted,
  },
});
