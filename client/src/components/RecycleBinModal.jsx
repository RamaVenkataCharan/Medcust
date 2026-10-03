import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, AlertTriangle, ShieldAlert, Lock, Info, Check } from 'lucide-react';
import Modal from './Modal';
import { api } from '../utils/api';
import { useToast } from './Toast';
import { formatDate, formatRelativeTime } from '../utils/formatting';

export default function RecycleBinModal({
  isOpen,
  onClose,
  onCustomerRestored,
  onCustomerPermanentlyDeleted,
}) {
  const { addToast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState(null);

  // Permanent Delete confirmation dialog state
  const [permanentTarget, setPermanentTarget] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTrash = async () => {
    try {
      setLoading(true);
      const data = await api.getTrash();
      setCustomers(data || []);
    } catch (err) {
      addToast('Failed to load recycle bin: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTrash();
      setPermanentTarget(null);
      setConfirmText('');
      setPinInput('');
      setPinError('');
    }
  }, [isOpen]);

  const handleRestore = async (customer) => {
    setRestoringId(customer.customer_id);
    try {
      const restored = await api.restoreCustomer(customer.customer_id);
      addToast(`Customer "${restored.name}" restored successfully!`, 'success');
      setCustomers((prev) => prev.filter((c) => c.customer_id !== customer.customer_id));
      if (onCustomerRestored) onCustomerRestored(restored);
    } catch (err) {
      addToast('Failed to restore customer: ' + err.message, 'error');
    } finally {
      setRestoringId(null);
    }
  };

  const openPermanentModal = (customer) => {
    setPermanentTarget(customer);
    setConfirmText('');
    setPinInput('');
    setPinError('');
  };

  const handleExecutePermanentDelete = async (e) => {
    e.preventDefault();
    if (!permanentTarget) return;

    if (confirmText.trim() !== 'DELETE') {
      return;
    }

    const storedPin = localStorage.getItem('medtrack_shop_pin') || '1234';
    if (pinInput !== storedPin) {
      setPinError('Incorrect 4-digit shop PIN');
      return;
    }

    setIsDeleting(true);
    setPinError('');
    try {
      const res = await api.permanentDeleteCustomer(permanentTarget.customer_id, 'DELETE');
      addToast(res.message || `Customer "${permanentTarget.name}" permanently deleted.`, 'info');
      const deletedId = permanentTarget.customer_id;
      setCustomers((prev) => prev.filter((c) => c.customer_id !== deletedId));
      setPermanentTarget(null);
      if (onCustomerPermanentlyDeleted) onCustomerPermanentlyDeleted(deletedId);
    } catch (err) {
      addToast('Permanent deletion failed: ' + err.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !permanentTarget}
        onClose={onClose}
        title="Recycle Bin"
        subtitle="Deleted customers are safely preserved here and hidden from search and dues reports"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4 text-xs">
          {/* Info Banner */}
          <div className="flex items-start gap-2.5 p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-amber-900 leading-relaxed">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p>
              Customers with zero dues can be soft-deleted. Their past entries and payments remain intact in the database.
              Items older than 30 days are automatically purged on server startup.
            </p>
          </div>

          {/* Content */}
          {loading ? (
            <div className="space-y-2 py-6 animate-pulse">
              <div className="h-10 bg-slate-100 rounded-xl"></div>
              <div className="h-10 bg-slate-100 rounded-xl"></div>
              <div className="h-10 bg-slate-100 rounded-xl"></div>
            </div>
          ) : customers.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">Recycle Bin is Empty</h4>
              <p className="text-slate-400 max-w-sm mx-auto">
                No soft-deleted customers. Deleted customers will appear here for 30 days before automatic purge.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Village</th>
                    <th className="py-2.5 px-3">Deleted</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {customers.map((c) => (
                    <tr key={c.customer_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{c.name}</div>
                        {c.address && <div className="text-[11px] text-slate-400 truncate max-w-[160px]">{c.address}</div>}
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-slate-800">
                        {c.phone_number}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {c.village || '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                        <span title={formatDate(c.deleted_at)}>
                          {formatRelativeTime(c.deleted_at)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => handleRestore(c)}
                            disabled={restoringId === c.customer_id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg border border-indigo-200 transition-colors active:scale-95 disabled:opacity-50"
                            title="Restore customer to active ledger"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{restoringId === c.customer_id ? 'Restoring...' : 'Restore'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openPermanentModal(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg border border-rose-200 transition-colors active:scale-95"
                            title="Permanently remove customer and all past history"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Forever</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-between items-center pt-3 border-t border-slate-100">
            <span className="text-[11px] text-slate-400">
              Total items in bin: <strong>{customers.length}</strong>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Nested Permanent Deletion Confirmation Modal */}
      {permanentTarget && (
        <Modal
          isOpen={true}
          onClose={() => setPermanentTarget(null)}
          title="Permanently Delete Customer?"
          subtitle="This action cannot be undone. All historical data will be erased."
          maxWidth="max-w-md"
        >
          <form onSubmit={handleExecutePermanentDelete} className="space-y-4 text-xs">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>Permanent Data Eradication</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Permanently deleting <strong>{permanentTarget.name}</strong> ({permanentTarget.phone_number}) will
                cascade delete all associated purchase entries, medicine line items, and payment receipts from the database.
              </p>
              <p className="text-[11px] font-semibold text-rose-700">
                • A pre-deletion backup snapshot will be automatically generated before deletion.
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Type <span className="font-mono text-rose-600">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                required
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-center text-sm font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Shop PIN (4 digits):
              </label>
              <input
                type="password"
                maxLength={4}
                required
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value.replace(/\D/g, ''));
                  setPinError('');
                }}
                placeholder="Shop PIN (default 1234)"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-center text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
              {pinError && <p className="text-[11px] text-rose-600 font-bold mt-1 text-center">{pinError}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPermanentTarget(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={confirmText.trim() !== 'DELETE' || pinInput.length !== 4 || isDeleting}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                {isDeleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
