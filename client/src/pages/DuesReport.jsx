import React, { useState, useEffect } from 'react';
import {
  FileText,
  Building,
  ArrowUpDown,
  ArrowRight,
  Phone,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../components/Toast';
import { formatCurrency, formatRelativeTime } from '../utils/formatting';
import DuesBadge from '../components/DuesBadge';

export default function DuesReport({ onSelectCustomer }) {
  const { addToast } = useToast();

  const [duesData, setDuesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('amount'); // 'amount' | 'village' | 'name'
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedVillage, setSelectedVillage] = useState('');

  const loadReport = async () => {
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
    loadReport();
  }, [sortBy, sortOrder, selectedVillage]);

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const { totalOutstanding = 0, customerCount = 0, villageBreakdown = {}, customers = [] } = duesData || {};

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header Metric Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <span>Outstanding Dues Ledger Report</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete list of customers with unsettled khata balances. Tap any customer row to open their profile.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-right">
          <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider block">
            Total Outstanding Dues
          </span>
          <span className="text-2xl font-extrabold font-mono text-amber-900 block mt-0.5">
            {formatCurrency(totalOutstanding)}
          </span>
          <span className="text-[11px] text-amber-700 font-medium">
            Across {customerCount} customer{customerCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Filter & Village Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-bold text-slate-700">Filter Village:</span>
          <select
            value={selectedVillage}
            onChange={(e) => setSelectedVillage(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            <option value="">All Villages ({customerCount})</option>
            {Object.keys(villageBreakdown).map((v) => (
              <option key={v} value={v}>
                {v} ({formatCurrency(villageBreakdown[v])})
              </option>
            ))}
          </select>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 pr-1">Sort:</span>
          <button
            type="button"
            onClick={() => toggleSort('amount')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              sortBy === 'amount'
                ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Due Amount {sortBy === 'amount' && (sortOrder === 'desc' ? '↓' : '↑')}
          </button>
          <button
            type="button"
            onClick={() => toggleSort('name')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              sortBy === 'name'
                ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Name {sortBy === 'name' && (sortOrder === 'desc' ? '↓' : '↑')}
          </button>
          <button
            type="button"
            onClick={() => toggleSort('village')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              sortBy === 'village'
                ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Village {sortBy === 'village' && (sortOrder === 'desc' ? '↓' : '↑')}
          </button>
        </div>
      </div>

      {/* Dues Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-5">Phone Number</th>
                <th className="py-3.5 px-4">Customer Name</th>
                <th className="py-3.5 px-4">Village</th>
                <th className="py-3.5 px-4 text-right">Current Due</th>
                <th className="py-3.5 px-4 text-center">Last Visit</th>
                <th className="py-3.5 px-5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading dues report...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                    <p className="text-sm font-bold text-slate-800">Everyone is up to date!</p>
                    <p className="text-xs text-slate-400">Zero outstanding dues recorded in the khata ledger.</p>
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr
                    key={c.customer_id}
                    onClick={() => onSelectCustomer(c)}
                    className="hover:bg-indigo-50/60 cursor-pointer transition-colors group"
                  >
                    <td className="py-4 px-5 font-mono font-medium text-slate-900 group-hover:text-indigo-600">
                      {c.phone_number}
                    </td>

                    <td className="py-4 px-4 font-bold text-slate-900">
                      {c.name}
                    </td>

                    <td className="py-4 px-4 text-slate-600">
                      {c.village ? (
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                          {c.village}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-4 px-4 text-right font-mono font-bold text-sm text-amber-800">
                      {formatCurrency(c.total_due)}
                    </td>

                    <td className="py-4 px-4 text-center text-slate-500">
                      {formatRelativeTime(c.last_visit)}
                    </td>

                    <td className="py-4 px-5 text-right">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform">
                        <span>Open Ledger</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
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
