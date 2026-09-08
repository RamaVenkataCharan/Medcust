import React, { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, Phone, MapPin, UserCheck, ArrowRight } from 'lucide-react';
import { api } from '../utils/api';
import DuesBadge from './DuesBadge';

export default function SearchBar({ onSelectCustomer, onOpenAddCustomer }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Auto-focus on load
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Keyboard shortcut '/' to focus
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        if (inputRef.current) inputRef.current.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live search debounced 200ms
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await api.searchCustomers(trimmed);
        setResults(res || []);
        setIsOpen(true);
      } catch (err) {
        console.error('Customer search error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (customer) => {
    setIsOpen(false);
    setQuery('');
    onSelectCustomer(customer);
  };

  const handleAddNew = () => {
    setIsOpen(false);
    const numericPart = query.replace(/\D/g, '');
    const prefillPhone = numericPart.length <= 10 ? numericPart : '';
    const prefillName = numericPart.length === 0 ? query.trim() : '';
    onOpenAddCustomer({ name: prefillName, phone: prefillPhone });
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      {/* Search Input Box */}
      <div className="relative flex items-center bg-white rounded-2xl shadow-sm border border-slate-200 transition-all focus-within:ring-2 focus-within:ring-indigo-600 focus-within:border-indigo-600">
        <div className="pl-4.5 pr-2 pointer-events-none text-slate-400">
          <Search className="w-5 h-5" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          placeholder="Search by 10-digit mobile number, name, or village..."
          className="w-full py-4 pr-16 bg-transparent text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:outline-none"
        />

        {/* Shortcut badge or spinner */}
        <div className="pr-4 flex items-center gap-2">
          {loading ? (
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <kbd className="hidden sm:inline-block px-2 py-1 text-[11px] font-mono text-slate-400 bg-slate-100 rounded-md border border-slate-200">
              /
            </kbd>
          )}
        </div>
      </div>

      {/* Results Dropdown */}
      {isOpen && query.trim() && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 divide-y divide-slate-100 z-50 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
          {results.length === 0 ? (
            <div className="p-6 text-center space-y-3">
              <p className="text-sm font-medium text-slate-600">
                No customer found matching "{query}"
              </p>
              <button
                type="button"
                onClick={handleAddNew}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add as New Customer</span>
              </button>
            </div>
          ) : (
            <>
              <div className="p-2.5 bg-slate-50/80 px-4 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Matching Customers ({results.length})</span>
                <span className="text-[10px] text-slate-400">Click row to open ledger</span>
              </div>

              {results.map((c) => (
                <div
                  key={c.customer_id}
                  onClick={() => handleSelect(c)}
                  className="p-4 hover:bg-indigo-50/70 cursor-pointer flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-900">
                        {c.name}
                      </h4>
                      <p className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{c.phone_number}</span>
                        {c.village && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-600 font-sans">{c.village}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <DuesBadge dueAmount={c.total_due} />
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
