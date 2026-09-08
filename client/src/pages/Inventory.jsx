import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  Plus,
  AlertTriangle,
  ArrowUpDown,
  History,
  Edit2,
  CheckCircle,
  PlusCircle,
  Filter,
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

export default function Inventory({ restockTargetMed, onClearRestockTarget }) {
  const { addToast } = useToast();

  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'low_stock' | 'out_of_stock'

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);

  // Forms
  const [selectedMed, setSelectedMed] = useState(null);
  const [medForm, setMedForm] = useState({ name: '', unit_price: '', stock_qty: '', low_stock_threshold: '5' });
  const [restockForm, setRestockForm] = useState({ change_qty: '', reason: 'Distributor Delivery' });
  const [stockLogs, setStockLogs] = useState([]);

  const loadMedicines = async () => {
    try {
      setLoading(true);
      const data = await api.getMedicines({
        search: searchQuery,
        lowStockOnly: filterType === 'low_stock' ? 'true' : 'false',
      });
      setMedicines(data);
    } catch (err) {
      addToast('Failed to load medicines: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedicines();
  }, [searchQuery, filterType]);

  // Handle restock target prop from dashboard
  useEffect(() => {
    if (restockTargetMed) {
      setSelectedMed(restockTargetMed);
      setRestockForm({ change_qty: '20', reason: 'Distributor Delivery' });
      setIsRestockModalOpen(true);
      if (onClearRestockTarget) onClearRestockTarget();
    }
  }, [restockTargetMed, onClearRestockTarget]);

  const handleAddMedicine = async (e) => {
    e.preventDefault();
    try {
      await api.addMedicine({
        name: medForm.name,
        unit_price: parseFloat(medForm.unit_price),
        stock_qty: parseInt(medForm.stock_qty, 10) || 0,
        low_stock_threshold: parseInt(medForm.low_stock_threshold, 10) || 5,
      });
      addToast(`Medicine "${medForm.name}" added to catalog!`, 'success');
      setIsAddModalOpen(false);
      setMedForm({ name: '', unit_price: '', stock_qty: '', low_stock_threshold: '5' });
      loadMedicines();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleUpdateMedicine = async (e) => {
    e.preventDefault();
    try {
      await api.updateMedicine(selectedMed.medicine_id, {
        name: medForm.name,
        unit_price: parseFloat(medForm.unit_price),
        low_stock_threshold: parseInt(medForm.low_stock_threshold, 10) || 5,
      });
      addToast('Medicine details updated!', 'success');
      setIsEditModalOpen(false);
      loadMedicines();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleRestock = async (e) => {
    e.preventDefault();
    try {
      const added = parseInt(restockForm.change_qty, 10);
      await api.restockMedicine(selectedMed.medicine_id, added, restockForm.reason);
      addToast(`Restocked ${added} units of "${selectedMed.name}"!`, 'success');
      setIsRestockModalOpen(false);
      setRestockForm({ change_qty: '', reason: 'Distributor Delivery' });
      loadMedicines();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const openRestock = (med) => {
    setSelectedMed(med);
    setRestockForm({ change_qty: '10', reason: 'Distributor Delivery' });
    setIsRestockModalOpen(true);
  };

  const openEdit = (med) => {
    setSelectedMed(med);
    setMedForm({
      name: med.name,
      unit_price: String(med.unit_price),
      low_stock_threshold: String(med.low_stock_threshold),
    });
    setIsEditModalOpen(true);
  };

  const openLogs = async () => {
    try {
      const logs = await api.getStockLogs();
      setStockLogs(logs);
      setIsLogsModalOpen(true);
    } catch (err) {
      addToast('Failed to load stock logs: ' + err.message, 'error');
    }
  };

  const filteredMedicines = medicines.filter((m) => {
    if (filterType === 'out_of_stock') return m.stock_qty <= 0;
    if (filterType === 'low_stock') return m.is_low_stock && m.stock_qty > 0;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-teal-700" />
            <span>Medicine Inventory & Stock</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track shelf quantities, set minimum thresholds, and log replenishment receipts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={openLogs}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>Audit Logs</span>
          </button>

          <button
            onClick={() => {
              setMedForm({ name: '', unit_price: '', stock_qty: '', low_stock_threshold: '5' });
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Medicine</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search medicine catalog by name..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 shadow-2xs"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              filterType === 'all' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Catalog ({medicines.length})
          </button>
          <button
            onClick={() => setFilterType('low_stock')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              filterType === 'low_stock' ? 'bg-white text-amber-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Low Stock</span>
          </button>
          <button
            onClick={() => setFilterType('out_of_stock')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              filterType === 'out_of_stock' ? 'bg-white text-rose-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Out of Stock</span>
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-5">Medicine / Item</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-center">Stock Level</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Loading medicine catalog...
                  </td>
                </tr>
              ) : filteredMedicines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No medicines match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredMedicines.map((m) => {
                  const isOutOfStock = m.stock_qty <= 0;
                  const isLow = m.is_low_stock && !isOutOfStock;

                  return (
                    <tr key={m.medicine_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-5">
                        <p className="font-bold text-slate-900">{m.name}</p>
                        <p className="text-[10px] text-slate-400">Min threshold: {m.low_stock_threshold} units</p>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                        ₹{m.unit_price.toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono font-bold text-sm">
                        <span className={isOutOfStock ? 'text-rose-600' : isLow ? 'text-amber-700' : 'text-slate-800'}>
                          {m.stock_qty}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Low Stock ({m.stock_qty})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            In Stock
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-5 text-right space-x-2">
                        <button
                          onClick={() => openRestock(m)}
                          className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg text-xs font-semibold transition-colors"
                        >
                          + Restock
                        </button>
                        <button
                          onClick={() => openEdit(m)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors inline-block"
                          title="Edit details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Medicine Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Medicine to Inventory"
        subtitle="Specify pricing and low-stock alert thresholds"
      >
        <form onSubmit={handleAddMedicine} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Medicine / Item Name *</label>
            <input
              type="text"
              required
              value={medForm.name}
              onChange={(e) => setMedForm({ ...medForm, name: e.target.value })}
              placeholder="e.g. Paracetamol 650mg Tablet"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Unit Selling Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={medForm.unit_price}
                onChange={(e) => setMedForm({ ...medForm, unit_price: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Initial Stock Qty</label>
              <input
                type="number"
                min="0"
                value={medForm.stock_qty}
                onChange={(e) => setMedForm({ ...medForm, stock_qty: e.target.value })}
                placeholder="0"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Low-Stock Alert Threshold</label>
            <input
              type="number"
              min="1"
              value={medForm.low_stock_threshold}
              onChange={(e) => setMedForm({ ...medForm, low_stock_threshold: e.target.value })}
              placeholder="5"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Triggers counter alert whenever stock drops to or below this quantity.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold shadow-xs"
            >
              Add Medicine
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Medicine Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Medicine Details"
        subtitle="Update name, price, or threshold"
      >
        <form onSubmit={handleUpdateMedicine} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Medicine Name *</label>
            <input
              type="text"
              required
              value={medForm.name}
              onChange={(e) => setMedForm({ ...medForm, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Unit Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={medForm.unit_price}
                onChange={(e) => setMedForm({ ...medForm, unit_price: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Low-Stock Threshold</label>
              <input
                type="number"
                min="1"
                value={medForm.low_stock_threshold}
                onChange={(e) => setMedForm({ ...medForm, low_stock_threshold: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold shadow-xs"
            >
              Update Medicine
            </button>
          </div>
        </form>
      </Modal>

      {/* Restock Modal */}
      <Modal
        isOpen={isRestockModalOpen}
        onClose={() => setIsRestockModalOpen(false)}
        title={`Restock: ${selectedMed?.name}`}
        subtitle={`Current available stock: ${selectedMed?.stock_qty} units`}
      >
        <form onSubmit={handleRestock} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Quantity to Add *</label>
            <input
              type="number"
              min="1"
              required
              value={restockForm.change_qty}
              onChange={(e) => setRestockForm({ ...restockForm, change_qty: e.target.value })}
              placeholder="e.g. 50"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason / Note</label>
            <select
              value={restockForm.reason}
              onChange={(e) => setRestockForm({ ...restockForm, reason: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
            >
              <option value="Distributor Delivery">Distributor Delivery / Purchase Order</option>
              <option value="Physical Count Correction">Physical Inventory Recount</option>
              <option value="Customer Return">Customer Return</option>
              <option value="Other Adjustment">Other Adjustment</option>
            </select>
          </div>

          {restockForm.change_qty && parseInt(restockForm.change_qty, 10) > 0 && (
            <div className="bg-teal-50 p-3 rounded-xl text-teal-900 flex justify-between font-medium">
              <span>New Stock Total:</span>
              <span className="font-bold font-mono">
                {selectedMed?.stock_qty + parseInt(restockForm.change_qty, 10)} units
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsRestockModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold shadow-xs"
            >
              Confirm Restock
            </button>
          </div>
        </form>
      </Modal>

      {/* Audit Stock Logs Modal */}
      <Modal
        isOpen={isLogsModalOpen}
        onClose={() => setIsLogsModalOpen(false)}
        title="Inventory Stock Audit Logs"
        subtitle="Audit trail of sales decrements, restocks, and manual corrections"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-3">
          {stockLogs.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No stock movements logged yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
              {stockLogs.map((log) => (
                <div key={log.log_id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{log.medicine_name}</p>
                    <p className="text-[11px] text-slate-500">{log.reason} • {new Date(log.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right font-mono">
                    <span className={`font-bold px-2 py-0.5 rounded text-xs ${
                      log.change_qty > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {log.change_qty > 0 ? `+${log.change_qty}` : log.change_qty}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {log.previous_qty} → {log.new_qty}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
