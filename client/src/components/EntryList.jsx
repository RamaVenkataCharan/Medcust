import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Printer, Receipt, Calendar, ArrowRight } from 'lucide-react';
import { formatDate, formatCurrency } from '../utils/formatting';

export default function EntryList({ entries, totalCount, page, totalPages, onPageChange, onAddPurchase }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!entries || entries.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center space-y-3">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
          <Receipt className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">No purchases yet</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Record this customer's first medicine purchase to start tracking their khata ledger.
        </p>
        <button
          type="button"
          onClick={onAddPurchase}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
        >
          <span>Add Purchase</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handlePrint = (e, entryId) => {
    e.stopPropagation();
    window.open(`/api/bills/${entryId}`, '_blank');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
      <div className="divide-y divide-slate-100">
        {entries.map((entry) => {
          const isExpanded = expandedId === entry.entry_id;
          const dueCreated = parseFloat(entry.due_amount) || 0;

          return (
            <div
              key={entry.entry_id}
              className="p-4 hover:bg-slate-50/70 transition-colors"
            >
              {/* Main Summary Row */}
              <div
                onClick={() => toggleExpand(entry.entry_id)}
                className="flex items-start justify-between gap-4 cursor-pointer"
              >
                {/* Left side: Date & Medicines */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-900 font-mono">
                      Entry #{String(entry.entry_id).padStart(4, '0')}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-500 font-medium">
                      {formatDate(entry.entry_date)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 font-medium truncate max-w-lg">
                    {entry.medicines_summary || 'Medicines'}
                  </p>
                </div>

                {/* Right side: Amounts and Actions */}
                <div className="flex items-center gap-4 text-right flex-shrink-0">
                  <div>
                    <div className="text-sm font-bold font-mono text-slate-900">
                      {formatCurrency(entry.total_amount)}
                    </div>
                    <div className="flex items-center justify-end gap-2 text-[11px]">
                      <span className="text-emerald-700 font-mono">Paid: {formatCurrency(entry.amount_paid)}</span>
                      {dueCreated > 0 && (
                        <span className="text-amber-800 font-bold font-mono bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                          Due: {formatCurrency(dueCreated)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Print bill button */}
                  <button
                    type="button"
                    onClick={(e) => handlePrint(e, entry.entry_id)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Print PDF Bill"
                  >
                    <Printer className="w-4 h-4" />
                  </button>

                  <div className="text-slate-400 pl-1">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* Expandable Line Items */}
              {isExpanded && (
                <div className="mt-3.5 pt-3 border-t border-slate-100 pl-4 pr-2 bg-slate-50/60 rounded-xl p-3 space-y-1.5 animate-in fade-in duration-150">
                  <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider pb-1">
                    <span>Medicine / Line Item</span>
                    <span>Price</span>
                  </div>

                  {entry.medicines?.map((med, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-slate-700 font-medium">
                      <span>{med.medicine_name}</span>
                      <span className="font-mono">
                        {parseFloat(med.price) > 0 ? formatCurrency(med.price) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <span>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} entries)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
