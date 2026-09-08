import React, { useState } from 'react';
import { BookOpen, UserPlus, Phone, ShieldCheck, Zap, Users, ArrowRight } from 'lucide-react';
import SearchBar from '../components/SearchBar';
import Modal from '../components/Modal';
import { api } from '../utils/api';
import { useToast } from '../components/Toast';

export default function Home({ onSelectCustomer, onOpenDuesReport }) {
  const { addToast } = useToast();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone_number: '', village: '', address: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenAddModal = (prefill = {}) => {
    setFormData({
      name: prefill.name || '',
      phone_number: prefill.phone || '',
      village: '',
      address: '',
    });
    setIsAddModalOpen(true);
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();

    const cleanPhone = formData.phone_number.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      addToast('Phone number must be exactly 10 digits', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await api.createCustomer({
        name: formData.name.trim(),
        phone_number: cleanPhone,
        village: formData.village.trim() || null,
        address: formData.address.trim() || null,
      });

      addToast(`Customer "${created.name}" registered successfully!`, 'success');
      setIsAddModalOpen(false);
      onSelectCustomer(created);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 py-6 sm:py-12">
      {/* Hero Header & Search */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-200/60 mb-2">
          <Zap className="w-3.5 h-3.5" />
          <span>Sub-2-Second Khata Ledger Lookup</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Medical Shop Customer Ledger
        </h1>

        <p className="text-sm text-slate-500 max-w-lg mx-auto">
          Look up patient medicine history, track outstanding balances automatically, and log payments in seconds.
        </p>
      </div>

      {/* Primary Search Bar */}
      <div className="space-y-3">
        <SearchBar
          onSelectCustomer={onSelectCustomer}
          onOpenAddCustomer={handleOpenAddModal}
        />

        <div className="flex items-center justify-center gap-4 text-xs text-slate-500 pt-2">
          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add New Customer</span>
          </button>

          <span className="text-slate-300">•</span>

          <button
            type="button"
            onClick={onOpenDuesReport}
            className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <span>View All Outstanding Dues</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Feature Value Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
            <Phone className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-slate-900">Phone-Number-First</h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Search immediately by 10-digit mobile number with instant fallback by customer name or village.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-slate-900">Zero-Error Dues</h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Due balance is strictly derived from transaction entries minus payments. Never manually overwritten.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
            <Zap className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-slate-900">20-Second Purchases</h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Fast repeatable medicine entry with instant autocomplete from past purchases and auto-computed dues.
          </p>
        </div>
      </div>

      {/* Add Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Customer"
        subtitle="Register customer details for khata ledger tracking"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Mobile Number (10 digits) *</label>
            <input
              type="tel"
              required
              maxLength={10}
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value.replace(/\D/g, '') })}
              placeholder="e.g. 9848012345"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Customer / Patient Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Ramesh Kumar"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Village / Town</label>
            <input
              type="text"
              value={formData.village}
              onChange={(e) => setFormData({ ...formData, village: e.target.value })}
              placeholder="e.g. Rampur"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Address / Landmark</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="e.g. Near Hanuman Temple"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save & Open Ledger'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
