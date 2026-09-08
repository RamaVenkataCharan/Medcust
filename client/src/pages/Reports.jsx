import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  IndianRupee,
  Users,
  Search,
  ArrowUpDown,
  MessageCircle,
  Copy,
  CreditCard,
  Download,
  Check,
  Building,
  HardDrive,
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';

export default function Reports({ onCollectPayment }) {
  const { addToast } = useToast();

  const [duesData, setDuesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('amount'); // 'amount' | 'village' | 'name'
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [copiedPhone, setCopiedPhone] = useState(null);

  const loadDuesReport = async () => {
    try {
      setLoading(true);
      const res = await api.getDuesReport({
        sortBy,
        order: sortOrder,
        village: selectedVillage,
      });
      setDuesData(res);
    } catch (err) {
      addToast('Failed to load dues report: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDuesReport();
  }, [sortBy, sortOrder, selectedVillage]);

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getReminderMessage = (customer) => {
    return `Namaste ${customer.name} garu, this is a gentle reminder from MedTrack Medical Store. Your outstanding balance is Rs. ${customer.total_due.toFixed(2)}. Kindly settle it during your next visit. Thank you!`;
  };

  const copyReminderText = (customer) => {
    const text = getReminderMessage(customer);
    navigator.clipboard.writeText(text);
    setCopiedPhone(customer.phone_number);
    addToast(`Reminder message copied for ${customer.name}!`, 'success');
    setTimeout(() => setCopiedPhone(null), 2500);
  };

  const openWhatsApp = (customer) => {
    const text = encodeURIComponent(getReminderMessage(customer));
    const url = `https://wa.me/91${customer.phone_number}?text=${text}`;
    window.open(url, '_blank');
  };

  const { totalOutstanding = 0, customerCount = 0, villageBreakdown = {}, customers = [] } = duesData || {};

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-teal-700" />
            <span>Customer Dues & Credit Ledger</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-derived balances across all debtor accounts with one-click collection and WhatsApp reminders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-amber-50 border border-amber-200/80 rounded-xl px-4 py-2 text-right">
            <span className="text-[10px] uppercase tracking-wider font-bold text-amber-800 block">Total Due in Market</span>
            <span className="text-xl font-bold font-mono text-amber-900 block">
              ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Village Breakdown Strip */}
      {Object.keys(villageBreakdown).length > 0 && (
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              <span>Village-wise Outstanding Credit Distribution</span>
            </span>
            {selectedVillage && (
              <button
                onClick={() => setSelectedVillage('')}
                className="text-xs text-teal-700 hover:text-teal-900 font-semibold"
              >
                Clear Village Filter
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {Object.entries(villageBreakdown).map(([village, due]) => {
              const isSelected = selectedVillage.toLowerCase() === village.toLowerCase();
              return (
                <button
                  key={village}
                  onClick={() => setSelectedVillage(isSelected ? '' : village)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{village}</span>
                  <span className={`font-mono font-bold ${isSelected ? 'text-white' : 'text-amber-800'}`}>
                    ₹{due.toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Dues List Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="text-xs font-bold text-slate-700">
            Debtors List ({customers.length} customer{customers.length !== 1 ? 's' : ''})
          </div>

          {/* Sort options */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Sort by:</span>
            <button
              onClick={() => toggleSort('amount')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                sortBy === 'amount' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              Amount {sortBy === 'amount' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button
              onClick={() => toggleSort('village')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                sortBy === 'village' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              Village {sortBy === 'village' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button
              onClick={() => toggleSort('name')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                sortBy === 'name' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              Name {sortBy === 'name' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-5">Customer / Contact</th>
                <th className="py-3 px-4">Village / Town</th>
                <th className="py-3 px-4 text-right">Outstanding Due</th>
                <th className="py-3 px-4 text-center">Last Activity</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Loading ledger data...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No customers with outstanding dues! All accounts settled.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.customer_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-5">
                      <p className="font-bold text-slate-900">{c.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">Ph: {c.phone_number}</p>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700">
                      {c.village ? (
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px] font-medium">
                          {c.village}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Not set</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-base text-amber-800">
                      ₹{c.total_due.toFixed(2)}
                    </td>

                    <td className="py-3.5 px-4 text-center text-[11px] text-slate-500">
                      {c.last_payment_date ? (
                        <span>Paid: {new Date(c.last_payment_date).toLocaleDateString()}</span>
                      ) : c.last_visit_date ? (
                        <span>Visit: {new Date(c.last_visit_date).toLocaleDateString()}</span>
                      ) : (
                        <span>—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-5 text-right space-x-2">
                      {/* WhatsApp Reminder Button */}
                      <button
                        onClick={() => openWhatsApp(c)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                        title="Send WhatsApp payment reminder"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </button>

                      {/* Copy message button */}
                      <button
                        onClick={() => copyReminderText(c)}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors inline-block"
                        title="Copy reminder text"
                      >
                        {copiedPhone === c.phone_number ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Collect Due Button */}
                      <button
                        onClick={() => onCollectPayment && onCollectPayment(c)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Collect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
