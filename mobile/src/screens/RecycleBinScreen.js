import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { getDeletedCustomers, restoreDeletedCustomer, permanentlyDeleteCustomer } from '../db/database';
import { useResponsive, TEXT_PROPS } from '../utils/responsive';
import ScreenContainer from '../components/ScreenContainer';

export default function RecycleBinScreen({ navigation }) {
  const [customers, setCustomers] = useState([]);
  
  const r = useResponsive();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(r, insets), [r, insets]);

  const loadData = useCallback(() => {
    const data = getDeletedCustomers();
    setCustomers(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRestore = (customer) => {
    if (restoreDeletedCustomer(customer.customer_id)) {
      loadData();
      Alert.alert('Restored', `${customer.name} has been restored.`);
    }
  };

  const handleDeleteForever = (customer) => {
    Alert.prompt(
      'Permanent Delete',
      `Type DELETE to permanently remove ${customer.name} and their ${customer.total_entries || 0} records. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async (text) => {
            if (text === 'DELETE') {
              try {
                await permanentlyDeleteCustomer(customer.customer_id);
                loadData();
              } catch (e) {
                Alert.alert('Error', 'Failed to delete customer permanently.');
              }
            } else {
              Alert.alert('Error', 'You must type DELETE exactly.');
            }
          }
        }
      ],
      'plain-text'
    );
  };

  const renderItem = ({ item }) => {
    const deletedDate = new Date(item.deleted_at);
    const now = new Date();
    const diffTime = Math.abs(now - deletedDate);
    const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    
    return (
      <View style={styles.card}>
        <View style={styles.cardInfo}>
          <Text {...TEXT_PROPS} style={styles.name}>{item.name}</Text>
          <Text {...TEXT_PROPS} style={styles.details}>{item.phone_number}</Text>
          {item.village ? <Text {...TEXT_PROPS} style={styles.details}>{item.village}</Text> : null}
          <Text {...TEXT_PROPS} style={styles.deletedDays}>Deleted {diffDays} {diffDays === 1 ? 'day' : 'days'} ago</Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleRestore(item)}>
            <Ionicons name="refresh-outline" size={24} color={COLORS.primary} />
            <Text {...TEXT_PROPS} style={[styles.actionText, { color: COLORS.primary }]}>Restore</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteForever(item)}>
            <Ionicons name="trash-outline" size={24} color={COLORS.danger} />
            <Text {...TEXT_PROPS} style={[styles.actionText, { color: COLORS.danger }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={r.scale(28)} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text {...TEXT_PROPS} style={styles.headerTitle}>Recycle Bin</Text>
        <View style={{ width: r.scale(28) }} />
      </View>

      <FlatList
        data={customers}
        keyExtractor={(item) => item.customer_id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="trash-outline" size={r.scale(64)} color={COLORS.borderStrong} />
            <Text {...TEXT_PROPS} style={styles.emptyText}>Recycle bin is empty</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const makeStyles = (r, insets) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: r.moderate(16),
    paddingVertical: r.moderate(16),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: r.moderate(4),
  },
  headerTitle: {
    fontSize: r.font(20),
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  listContent: {
    padding: r.moderate(16),
    paddingBottom: r.moderate(24) + insets.bottom,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: r.moderate(12),
    padding: r.moderate(16),
    marginBottom: r.moderate(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: r.scale(1) },
    shadowOpacity: 0.1,
    shadowRadius: r.scale(2),
  },
  cardInfo: {
    flex: 1,
    marginRight: r.moderate(12),
  },
  name: {
    fontSize: r.font(16),
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: r.scale(4),
  },
  details: {
    fontSize: r.font(14),
    color: COLORS.textSecondary,
    marginBottom: r.scale(2),
  },
  deletedDays: {
    fontSize: r.font(13),
    color: COLORS.danger,
    marginTop: r.scale(4),
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.scale(12),
  },
  actionBtn: {
    alignItems: 'center',
    padding: r.moderate(8),
  },
  actionText: {
    fontSize: r.font(12),
    marginTop: r.scale(4),
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: r.moderate(64),
  },
  emptyText: {
    fontSize: r.font(16),
    color: COLORS.textSecondary,
    marginTop: r.scale(16),
  },
});
