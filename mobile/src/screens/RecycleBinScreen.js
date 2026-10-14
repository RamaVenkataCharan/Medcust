import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, Modal, StyleSheet } from 'react-native';
import CustomTextInput from '../components/CustomTextInput';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { getDeletedCustomers, restoreDeletedCustomer, permanentlyDeleteCustomer } from '../db/database';
import { useResponsive, TEXT_PROPS } from '../utils/responsive';
import ScreenContainer from '../components/ScreenContainer';

export default function RecycleBinScreen({ navigation }) {
  const [customers, setCustomers] = useState([]);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingForever, setDeletingForever] = useState(false);
  
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
    setCustomerToDelete(customer);
    setDeleteConfirmText('');
  };

  const handleConfirmPermanentDelete = async () => {
    if (!customerToDelete) return;
    if (deleteConfirmText.trim() !== 'DELETE') {
      Alert.alert('Error', 'You must type DELETE exactly.');
      return;
    }
    setDeletingForever(true);
    try {
      await permanentlyDeleteCustomer(customerToDelete.customer_id);
      const name = customerToDelete.name;
      setCustomerToDelete(null);
      loadData();
      Alert.alert('Permanently Deleted', `${name} has been removed.`);
    } catch (e) {
      Alert.alert('Error', 'Failed to delete customer permanently.');
    } finally {
      setDeletingForever(false);
    }
  };

  const renderItem = ({ item }) => {
    const deletedDate = new Date(item.deleted_at);
    const now = new Date();
    const diffTime = Math.abs(now - deletedDate);
    const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    
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

      {/* Cross-platform Permanent Delete Modal */}
      {customerToDelete && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setCustomerToDelete(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Ionicons name="warning" size={r.scale(28)} color={COLORS.danger} />
                <Text {...TEXT_PROPS} style={styles.modalTitle}>Permanent Delete</Text>
              </View>
              <Text {...TEXT_PROPS} style={styles.modalMessage}>
                Permanently delete <Text style={{ fontWeight: 'bold' }}>{customerToDelete.name}</Text> and their {customerToDelete.total_entries || 0} records? This cannot be undone.
              </Text>
              <Text {...TEXT_PROPS} style={styles.modalPrompt}>
                Type <Text style={{ fontWeight: 'bold', color: COLORS.danger }}>DELETE</Text> to confirm:
              </Text>
              <CustomTextInput
                style={styles.modalInput}
                placeholder="DELETE"
                placeholderTextColor={COLORS.textTertiary}
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                autoCapitalize="characters"
                autoFocus={true}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setCustomerToDelete(null)}
                >
                  <Text {...TEXT_PROPS} style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalDeleteBtn,
                    deleteConfirmText.trim() !== 'DELETE' && styles.modalDeleteBtnDisabled
                  ]}
                  disabled={deleteConfirmText.trim() !== 'DELETE' || deletingForever}
                  onPress={handleConfirmPermanentDelete}
                >
                  <Text {...TEXT_PROPS} style={styles.modalDeleteText}>
                    {deletingForever ? 'Deleting...' : 'Delete Forever'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: r.moderate(20),
  },
  modalCard: {
    width: '100%',
    maxWidth: r.scale(400),
    backgroundColor: COLORS.surface,
    borderRadius: r.scale(12),
    padding: r.moderate(20),
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.scale(8),
    marginBottom: r.scale(12),
  },
  modalTitle: {
    fontSize: r.font(18),
    fontWeight: '700',
    color: COLORS.danger,
  },
  modalMessage: {
    fontSize: r.font(14),
    color: COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: r.scale(12),
  },
  modalPrompt: {
    fontSize: r.font(13),
    color: COLORS.textSecondary,
    marginBottom: r.scale(8),
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: r.scale(6),
    paddingHorizontal: r.moderate(12),
    paddingVertical: r.moderate(10),
    fontSize: r.font(15),
    color: COLORS.textPrimary,
    marginBottom: r.scale(16),
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: r.scale(12),
  },
  modalCancelBtn: {
    paddingVertical: r.moderate(8),
    paddingHorizontal: r.moderate(16),
    borderRadius: r.scale(6),
  },
  modalCancelText: {
    fontSize: r.font(14),
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modalDeleteBtn: {
    backgroundColor: COLORS.danger,
    paddingVertical: r.moderate(8),
    paddingHorizontal: r.moderate(16),
    borderRadius: r.scale(6),
  },
  modalDeleteBtnDisabled: {
    opacity: 0.5,
  },
  modalDeleteText: {
    fontSize: r.font(14),
    fontWeight: '600',
    color: '#FFF',
  },
});
