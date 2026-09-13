import React, { useState, useEffect } from 'react';
import {
  FileText,
  Building,
  ArrowUpDown,
  ArrowRight,
  Phone,
  Filter,
  Users,
  AlertCircle,
  Download,
  TrendingUp,
  CreditCard,
  Pill,
  Sparkles,
} from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../components/Toast';
import { formatCurrency, formatRelativeTime } from '../utils/formatting';
import DuesBadge from '../components/DuesBadge';

export default function DuesReport({ onSelectCustomer }) {
  const { addToast } = useToast();

  const [duesData, setDuesData] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('amount'); // 'amount' | 'village' | 'name'
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedVillage, setSelectedVillage] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [reportRes, statsRes] = await Promise.all([
        api.getDuesReport({
          sortBy,
          order: sortOrder,
          village: selectedVillage,
        }),
        api.getStats().catch((e) => {
          console.warn('Stats load note:', e.message);
          return null;
        }),
      ]);

      setDuesData(reportRes);
      if (statsRes) setStatsData(statsRes);
    } catch (err) {
      addToast('Failed to load dues report: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sortBy, sortOrder, selectedVillage]);

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const villages = duesData?.villageBreakdown ? Object.keys(duesData.villageBreakdown) : [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header Title & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-indigo-600" />
            <span>Outstanding Dues Report</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time accounts receivable ledger across all medical shop customers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href={api.getExportCsvUrl()}
            download
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-2xs transition-colors"
            title="Download full dues ledger as CSV spreadsheet"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Dues CSV</span>
          </a>
        </div>
      </div>

      {/* Monthly Store Performance & Overview Bar */}
      {statsData && (
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                This Month's Counter Summary
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Auto-aggregated from ledger
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
            <div>
              <span className="text-[11px] text-slate-400 block">Total Sales</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-white mt-0.5 block">
                {formatCurrency(statsData.salesThisMonth)}
              </span>
              <span className="text-[10px] text-slate-400">{statsData.entriesThisMonth} purchase visits</span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block">Total Collected</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-emerald-400 mt-0.5 block">
                {formatCurrency(statsData.collectedThisMonth)}
              </span>
              <span className="text-[10px] text-slate-400">{statsData.paymentsThisMonth} settlements</span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block">Outstanding Dues</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-amber-300 mt-0.5 block">
                {formatCurrency(statsData.totalOutstanding)}
              </span>
              <span className="text-[10px] text-slate-400">{statsData.debtorCount} pending accounts</span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block">Top Prescribed</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {statsData.topMedicines && statsData.topMedicines.length > 0 ? (
                  statsData.topMedicines.slice(0, 2).map((m, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-white/10 rounded-md text-[10px] font-medium text-slate-200 truncate max-w-[120px]"
                      title={`${m.medicine_name} (${m.frequency}x)`}
                    >
                      {m.medicine_name.split(' ')[0]} ({m.frequency}x)
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-slate-400">—</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Outstanding</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
              ₹
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
            {formatCurrency(duesData?.totalOutstanding || 0)}
          </div>
          <p className="text-[11px] text-slate-500">
            Across all pending customer khata balances
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Debtor Customers</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
            {duesData?.customerCount || 0}
          </div>
          <p className="text-[11px] text-slate-500">
            Customers with balance &gt; ₹0
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Villages Represented</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
            {villages.length}
          </div>
          <p className="text-[11px] text-slate-500">
            Localities with active customer dues
          </p>
        </div>
      </div>

      {/* Filter & Sort Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filter by Village:</span>
          </div>

          <select
            value={selectedVillage}
            onChange={(e) => setSelectedVillage(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            <option value="">All Villages ({duesData?.customerCount || 0})</option>
            {villages.map((v) => (
              <option key={v} value={v}>
                {v} ({formatCurrency(duesData.villageBreakdown[v])})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Sort by:</span>

          <button
            type="button"
            onClick={() => toggleSort('amount')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-all ${
              sortBy === 'amount'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Due Amount</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={() => toggleSort('name')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-all ${
              sortBy === 'name'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Name</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={() => toggleSort('village')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-all ${
              sortBy === 'village'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Village</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Dues List Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {loading && !duesData ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="flex justify-between items-center py-2 border-b border-slate-100">
                <div className="space-y-1.5">
                  <div className="h-4 w-36 bg-slate-200 rounded"></div>
                  <div className="h-3 w-24 bg-slate-100 rounded"></div>
                </div>
                <div className="h-4 w-20 bg-slate-200 rounded"></div>
                <div className="h-4 w-24 bg-slate-200 rounded"></div>
                <div className="h-6 w-20 bg-slate-200 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : !duesData?.customers || duesData.customers.length === 0 ? (
          <div className="p-12 text-center space-y-3 text-slate-400 text-xs">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="font-bold text-sm text-slate-800">All Clear — No Outstanding Dues!</p>
            <p className="text-slate-500 max-w-sm mx-auto">
              Every customer on record has settled their khata balance in full.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Customer Details</th>
                  <th className="py-3 px-4">Village / Town</th>
                  <th className="py-3 px-4">Last Visit</th>
                  <th className="py-3 px-4 text-right">Outstanding Due</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {duesData.customers.map((c) => (
                  <tr
                    key={c.customer_id}
                    onClick={() => onSelectCustomer(c)}
                    className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {c.name}
                      </div>
                      <div className="flex items-center gap-1 font-mono text-slate-500 text-[11px] mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{c.phone_number}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {c.village || <span className="text-slate-300">—</span>}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500">
                      {c.last_visit ? formatRelativeTime(c.last_visit) : <span className="text-slate-300">—</span>}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="font-extrabold font-mono text-sm text-amber-700">
                        {formatCurrency(c.total_due)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCustomer(c);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition-colors"
                      >
                        <span>Open Khata</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
