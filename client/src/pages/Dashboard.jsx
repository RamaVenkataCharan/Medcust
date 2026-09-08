import React, { useState, useEffect } from 'react';
import {
  IndianRupee,
  ShoppingCart,
  AlertTriangle,
  Users,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Plus,
  CreditCard,
  Package,
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';

export default function Dashboard({ setActiveTab, onSelectCustomer, onQuickPayment, onRestockMedicine }) {
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboard();
      setData(res);
    } catch (err) {
      addToast('Failed to load dashboard: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">Loading counter statistics...</span>
        </div>
      </div>
    );
  }

  const {
    today = {},
    total_market_due = 0,
    low_stock_count = 0,
    critical_stock = [],
    top_selling = [],
    recent_transactions = [],
  } = data || {};

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Banner & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Counter Overview</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time medical shop metrics, sales totals, and outstanding balances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setActiveTab('billing')}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>New Sale (F2)</span>
          </button>

          <button
            onClick={() => setActiveTab('customers')}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-medium transition-all"
          >
            <Users className="w-4 h-4 text-slate-600" />
            <span>Lookup Customer (F3)</span>
          </button>

          <button
            onClick={onQuickPayment}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl text-xs font-medium transition-all"
          >
            <CreditCard className="w-4 h-4 text-amber-700" />
            <span>Collect Due</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-teal-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Sales</span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold font-mono text-slate-900">
              ₹{today.sales?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
              <span className="font-semibold text-emerald-700">₹{today.collected?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <span>cash/paid collected</span>
            </div>
          </div>
        </div>

        {/* Today's Transactions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-teal-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Bills</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {today.transactions}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Customer counter checkouts</p>
          </div>
        </div>

        {/* Total Outstanding Dues */}
        <div
          onClick={() => setActiveTab('reports')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-amber-300 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Market Due</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold font-mono text-amber-700">
              ₹{total_market_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-amber-800 font-medium mt-1">
              <span>View ledger list</span>
              <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div
          onClick={() => setActiveTab('inventory')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-rose-300 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Low Stock Items</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${low_stock_count > 0 ? 'bg-rose-50 text-rose-700 animate-pulse' : 'bg-slate-50 text-slate-600'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className={`text-2xl font-bold font-mono ${low_stock_count > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
              {low_stock_count}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {low_stock_count > 0 ? 'Medicines require restocking' : 'All stocks above threshold'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Low-Stock & Top-Selling / Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Transactions & Urgent Stock */}
        <div className="lg:col-span-2 space-y-6">
          {/* Urgent Low Stock Notification Bar */}
          {critical_stock.length > 0 && (
            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4.5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-rose-900 font-semibold text-sm">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Urgent Replenishment Needed ({critical_stock.length})</span>
                </div>
                <button
                  onClick={() => setActiveTab('inventory')}
                  className="text-xs font-semibold text-rose-700 hover:text-rose-900"
                >
                  Manage All Inventory →
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {critical_stock.map((med) => (
                  <div
                    key={med.medicine_id}
                    className="bg-white p-3 rounded-xl border border-rose-200/80 shadow-2xs flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900 truncate max-w-[170px]">{med.name}</p>
                      <p className="text-[11px] text-rose-700 font-medium">
                        Only <span className="font-bold">{med.stock_qty}</span> left (threshold {med.low_stock_threshold})
                      </p>
                    </div>
                    <button
                      onClick={() => onRestockMedicine && onRestockMedicine(med)}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg transition-colors"
                    >
                      + Restock
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Counter Transactions */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-bold text-slate-900">Recent Counter Visits</h2>
              </div>
              <button
                onClick={() => setActiveTab('customers')}
                className="text-xs text-teal-700 hover:text-teal-800 font-medium"
              >
                Find by Phone →
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {recent_transactions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No sales recorded yet.</div>
              ) : (
                recent_transactions.map((t) => (
                  <div
                    key={t.transaction_id}
                    className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                        #{t.transaction_id}
                      </div>
                      <div>
                        <button
                          onClick={() => onSelectCustomer && onSelectCustomer(t.customer_id)}
                          className="text-xs font-bold text-slate-900 hover:text-teal-700 text-left"
                        >
                          {t.customer_name}
                        </button>
                        <p className="text-[11px] text-slate-500">
                          {t.phone_number} {t.village ? `• ${t.village}` : ''} • {new Date(t.txn_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-bold font-mono text-slate-900">₹{t.bill_total.toFixed(2)}</p>
                      {t.due_amount > 0 ? (
                        <span className="inline-block text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/60">
                          Due: ₹{t.due_amount.toFixed(2)}
                        </span>
                      ) : (
                        <span className="inline-block text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                          Fully Paid
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Top Selling Medicines & Quick Help */}
        <div className="space-y-6">
          {/* Top Selling Medicines */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-teal-700" />
              <h2 className="text-sm font-bold text-slate-900">Fast-Moving Medicines</h2>
            </div>

            <div className="space-y-3">
              {top_selling.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs pb-2.5 border-b border-slate-100 last:border-0 last:pb-0">
                  <div className="truncate max-w-[160px]">
                    <p className="font-semibold text-slate-900 truncate">{item.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono">Revenue ₹{item.total_revenue}</p>
                  </div>
                  <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded text-[11px]">
                    {item.total_units_sold} sold
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Counter Tips Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400">Keyboard Shortcuts</h3>
            <ul className="mt-3 space-y-2 text-xs text-slate-300">
              <li className="flex justify-between">
                <span>New Sale Counter:</span>
                <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px] font-mono">F2</kbd>
              </li>
              <li className="flex justify-between">
                <span>Search Customer:</span>
                <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px] font-mono">F3</kbd>
              </li>
              <li className="flex justify-between">
                <span>Dues Ledger / Report:</span>
                <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px] font-mono">F4</kbd>
              </li>
              <li className="flex justify-between">
                <span>Stock & Inventory:</span>
                <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px] font-mono">F5</kbd>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
