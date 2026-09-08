import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Search,
  CheckCircle2,
  AlertTriangle,
  IndianRupee,
  Receipt,
  UserCheck,
  RotateCcw,
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';

export default function Payments({ initialCustomer, onClearCustomer }) {
  const { addToast } = useToast();

  const [customerQuery, setCustomerQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Form
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('Counter Due Settlement');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allowOverpayment, setAllowOverpayment] = useState(false);

  // Success receipt state
  const [receipt, setReceipt] = useState(null);

  // Handle passed initialCustomer
  useEffect(() => {
    if (initialCustomer) {
      setSelectedCustomer(initialCustomer);
      if (initialCustomer.total_due > 0) {
        setPaymentAmount(String(initialCustomer.total_due));
      }
      if (onClearCustomer) onClearCustomer();
    }
  }, [initialCustomer, onClearCustomer]);

  // Customer search debounce
  useEffect(() => {
    if (!customerQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.searchCustomers(customerQuery);
        setSearchResults(res);
        setIsDropdownOpen(true);
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  const selectCustomer = (c) => {
    setSelectedCustomer(c);
    setIsDropdownOpen(false);
    setCustomerQuery('');
    setReceipt(null);
    if (c.total_due > 0) {
      setPaymentAmount(String(c.total_due));
    } else {
      setPaymentAmount('');
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) {
      addToast('Please select a customer first', 'warning');
      return;
    }

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      addToast('Please enter a valid payment amount greater than 0', 'warning');
      return;
    }

    if (amt > selectedCustomer.total_due && !allowOverpayment) {
      addToast(`Amount ₹${amt} exceeds current due of ₹${selectedCustomer.total_due}. Check the override box to proceed.`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const fullNote = `${paymentMethod} - ${paymentNote.trim()}`;
      const res = await api.recordPayment({
        customerId: selectedCustomer.customer_id,
        amount: amt,
        note: fullNote,
        allowOverpayment,
      });

      setReceipt(res);
      // Update selected customer total due
      setSelectedCustomer((prev) => ({ ...prev, total_due: res.remainingDue }));
      setPaymentAmount('');
      setAllowOverpayment(false);
      addToast(`Payment of ₹${amt.toFixed(2)} recorded successfully!`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedCustomer(null);
    setPaymentAmount('');
    setReceipt(null);
    setCustomerQuery('');
  };

  const currentDue = selectedCustomer?.total_due || 0;
  const parsedAmt = parseFloat(paymentAmount) || 0;
  const isOverpaying = parsedAmt > currentDue;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-700" />
            <span>Collect Due / Customer Payment</span>
          </h1>
          <p className="text-xs text-slate-500">
            Log counter settlements, reduce customer balances, and maintain zero-error audit records.
          </p>
        </div>

        {selectedCustomer && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 py-1.5 px-3 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Change Customer</span>
          </button>
        )}
      </div>

      {/* Main Payment Container */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: Customer Selector & Payment Form */}
        <div className="md:col-span-7 space-y-5">
          {/* 1. Customer Selection */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Step 1: Select Customer
            </span>

            {!selectedCustomer ? (
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder="Search customer by 10-digit mobile number or name..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />

                {isDropdownOpen && customerQuery.trim() && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 divide-y divide-slate-100 z-40 max-h-56 overflow-y-auto">
                    {searchResults.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        No customer found matching "{customerQuery}"
                      </div>
                    ) : (
                      searchResults.map((c) => (
                        <div
                          key={c.customer_id}
                          onClick={() => selectCustomer(c)}
                          className="p-3 hover:bg-amber-50/70 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-900">{c.name}</p>
                            <p className="text-[11px] text-slate-500">
                              Ph: <span className="font-mono">{c.phone_number}</span> {c.village ? `• ${c.village}` : ''}
                            </p>
                          </div>
                          <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${c.total_due > 0 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
                            Due: ₹{c.total_due?.toFixed(2)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between bg-amber-50/60 border border-amber-200/80 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-700 text-white flex items-center justify-center font-bold">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{selectedCustomer.name}</h3>
                    <p className="text-xs text-slate-600 font-mono">
                      {selectedCustomer.phone_number} {selectedCustomer.village ? `• ${selectedCustomer.village}` : ''}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Due</span>
                  <span className={`text-xl font-bold font-mono ${selectedCustomer.total_due > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                    ₹{selectedCustomer.total_due?.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 2. Payment Entry Form */}
          {selectedCustomer && (
            <form onSubmit={handleRecordPayment} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Step 2: Enter Payment Details
              </span>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Payment Amount (₹) *</label>
                <div className="relative">
                  <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="number"
                    step="any"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  />
                </div>

                {/* Quick Chips */}
                {currentDue > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(String(currentDue))}
                      className="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-200"
                    >
                      Clear Full Due (₹{currentDue.toFixed(2)})
                    </button>
                    {currentDue > 100 && (
                      <button
                        type="button"
                        onClick={() => setPaymentAmount(String(Math.round(currentDue / 2)))}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-medium"
                      >
                        50% (₹{Math.round(currentDue / 2)})
                      </button>
                    )}
                    {currentDue >= 100 && (
                      <button
                        type="button"
                        onClick={() => setPaymentAmount('100')}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-medium"
                      >
                        ₹100
                      </button>
                    )}
                    {currentDue >= 500 && (
                      <button
                        type="button"
                        onClick={() => setPaymentAmount('500')}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-medium"
                      >
                        ₹500
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Overpayment Warning Safeguard */}
              {isOverpaying && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Payment amount exceeds outstanding due!</span>
                  </div>
                  <p className="text-rose-700 text-[11px]">
                    Current due is ₹{currentDue.toFixed(2)}. Attempting to collect ₹{parsedAmt.toFixed(2)}.
                  </p>
                  <label className="flex items-center gap-2 text-rose-900 font-medium cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={allowOverpayment}
                      onChange={(e) => setAllowOverpayment(e.target.checked)}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span>Allow overpayment advance credit</span>
                  </label>
                </div>
              )}

              {/* Payment Mode */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Payment Mode</label>
                <div className="grid grid-cols-4 gap-2">
                  {['Cash', 'UPI / GPay', 'PhonePe', 'Bank'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMethod(mode)}
                      className={`py-2 text-xs font-medium rounded-xl border transition-all ${
                        paymentMethod === mode
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note / Remarks */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Payment Note / Reference</label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="e.g. Counter cash settlement / Txn reference ID"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !parsedAmt || (isOverpaying && !allowOverpayment)}
                className="w-full py-3 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Recording Payment...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Record ₹{parsedAmt > 0 ? parsedAmt.toFixed(2) : '0.00'}</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Right 5 cols: Settlement Receipt & Ledger Balance Result */}
        <div className="md:col-span-5 space-y-4">
          {receipt ? (
            <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">Payment Received</h3>
                <p className="text-xs text-slate-500">Receipt #{receipt.paymentId}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2.5 text-xs text-left">
                <div className="flex justify-between text-slate-600">
                  <span>Customer:</span>
                  <span className="font-bold text-slate-900">{receipt.customerName}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Previous Due:</span>
                  <span className="font-mono">₹{receipt.previousDue?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold border-t border-dashed border-slate-200 pt-2">
                  <span>Amount Paid:</span>
                  <span className="font-mono text-sm">₹{receipt.amount?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-900 font-bold border-t border-slate-200 pt-2">
                  <span>Remaining Due:</span>
                  <span className={`font-mono text-sm px-2 py-0.5 rounded ${receipt.remainingDue > 0 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
                    ₹{receipt.remainingDue?.toFixed(2)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 pt-1">
                  Note: {receipt.note}
                </div>
              </div>

              <button
                onClick={handleReset}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                Collect Next Due
              </button>
            </div>
          ) : (
            <div className="bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-3">
              <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-700">Audit-Safe Ledger Settlement</p>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Payments recorded here instantly decrease customer dues and update reports in real time without altering transaction history.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
