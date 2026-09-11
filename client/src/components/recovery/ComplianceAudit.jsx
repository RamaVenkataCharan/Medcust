import React, { useState, useEffect } from 'react';
import { Shield, Download, Filter, Calendar, Search, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

const API_BASE = 'http://localhost:4000';

const OUTCOME_OPTIONS = [
  { value: '', label: 'All Outcomes' },
  { value: 'NO_ANSWER', label: 'No Answer' },
  { value: 'REFUSED', label: 'Refused' },
  { value: 'PROMISED', label: 'Promised' },
  { value: 'ESCALATED_TO_HUMAN', label: 'Escalated' },
  { value: 'DISCONNECTED', label: 'Disconnected' },
  { value: 'COMPLETED', label: 'Completed' },
];

export default function ComplianceAudit() {
  const [auditData, setAuditData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    outcome: '',
  });
  const [page, setPage] = useState(0);
  const pageSize = 25;

  useEffect(() => {
    loadAudit();
  }, [filters]);

  const loadAudit = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.outcome) params.set('outcome', filters.outcome);
      params.set('limit', '500');

      const res = await fetch(`${API_BASE}/api/recovery/audit?${params}`);
      const data = await res.json();
      setAuditData(data);
      setPage(0);
    } catch (err) {
      console.error('Failed to load audit:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const params = new URLSearchParams();
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.outcome) params.set('outcome', filters.outcome);

    window.open(`${API_BASE}/api/recovery/audit/export?${params}`, '_blank');
  };

  const exportJSON = () => {
    const params = new URLSearchParams();
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.outcome) params.set('outcome', filters.outcome);
    params.set('format', 'json');

    window.open(`${API_BASE}/api/recovery/audit/export?${params}`, '_blank');
  };

  const items = auditData?.audit_log || [];
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const pagedItems = items.slice(page * pageSize, (page + 1) * pageSize);

  const formatDateTime = (dt) => {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getOutcomeBadgeClass = (outcome) => {
    switch (outcome) {
      case 'PROMISED': return 'bg-emerald-100 text-emerald-700';
      case 'COMPLETED': return 'bg-blue-100 text-blue-700';
      case 'REFUSED': return 'bg-red-100 text-red-700';
      case 'ESCALATED_TO_HUMAN': return 'bg-amber-100 text-amber-700';
      case 'NO_ANSWER': return 'bg-slate-100 text-slate-600';
      case 'DISCONNECTED': return 'bg-gray-100 text-gray-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-800">Compliance Audit Trail</h3>
          <span className="text-[10px] text-slate-400 font-mono">({totalItems} records)</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-semibold transition-colors"
          >
            <Download className="w-3 h-3" />
            Export CSV
          </button>
          <button
            onClick={exportJSON}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-semibold transition-colors"
          >
            <FileText className="w-3 h-3" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-2.5 bg-slate-50/30 border-b border-slate-100 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))}
            className="text-[11px] border border-slate-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
            placeholder="From"
          />
          <span className="text-[10px] text-slate-400">to</span>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))}
            className="text-[11px] border border-slate-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
          />
        </div>

        <select
          value={filters.outcome}
          onChange={(e) => setFilters(f => ({ ...f, outcome: e.target.value }))}
          className="text-[11px] border border-slate-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
        >
          {OUTCOME_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {(filters.from || filters.to || filters.outcome) && (
          <button
            onClick={() => setFilters({ from: '', to: '', outcome: '' })}
            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-2.5 px-4">Date/Time</th>
              <th className="py-2.5 px-3">Customer</th>
              <th className="py-2.5 px-3">Phone</th>
              <th className="py-2.5 px-3">Outcome</th>
              <th className="py-2.5 px-3 text-center">AI Disc.</th>
              <th className="py-2.5 px-3 text-center">Sentiment</th>
              <th className="py-2.5 px-3">Compliance Flags</th>
              <th className="py-2.5 px-3">Case State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-[11px]">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                  Loading audit data...
                </td>
              </tr>
            ) : pagedItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                  No audit records found for the selected filters
                </td>
              </tr>
            ) : (
              pagedItems.map((entry) => {
                const flags = entry.compliance_flags || [];
                return (
                  <tr key={entry.call_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4 text-slate-500 font-mono whitespace-nowrap">
                      {formatDateTime(entry.started_at)}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{entry.name || '—'}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono">{entry.phone_number || '—'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${getOutcomeBadgeClass(entry.outcome)}`}>
                        {entry.outcome || '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {entry.ai_disclosed_at_start ? (
                        <span className="text-emerald-600 font-bold">✓</span>
                      ) : (
                        <span className="text-red-500 font-bold">✗</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      {entry.sentiment_score != null ? (
                        <span className={entry.sentiment_score < -0.3 ? 'text-red-600 font-bold' : 'text-slate-500'}>
                          {entry.sentiment_score.toFixed(2)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {flags.length === 0 ? (
                          <span className="text-[9px] text-emerald-500 font-medium">Clean</span>
                        ) : (
                          flags.map((flag, i) => (
                            <span key={i} className="text-[8px] bg-red-50 text-red-600 px-1 py-0.5 rounded font-medium border border-red-100">
                              {flag}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {entry.case_state || '—'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
          <p className="text-[10px] text-slate-400">
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalItems)} of {totalItems}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-[10px] text-slate-500 font-mono px-2">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      )}

      {/* Tamper-evident notice */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
        <p className="text-[9px] text-slate-400 text-center">
          🔒 Audit trail is append-only and tamper-evident. Historical compliance flags and call logs cannot be edited from this interface.
        </p>
      </div>
    </div>
  );
}
