import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, AlertTriangle, IndianRupee } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from './Toast';
import { formatCurrency } from '../utils/formatting';
import Modal from './Modal';
import DuesBadge from './DuesBadge';

export default function PaymentForm({ isOpen, onClose, customer, onSuccess }) {
  const { addToast } = useToast();

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('Cash counter settlement');
  const [method, setMethod] = useState('Cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allowOverpayment, setAllowOverpayment] = useState(false);

  useEffect(() => {
    if (isOpen && customer) {
      if (customer.total_due > 0) {
        setAmount(String(customer.total_due));
      } else {
        setAmount('');
      }
      setNote('Cash counter settlement');
      setMethod('Cash');
      setAllowOverpayment(false);
    }
  }, [isOpen, customer]);

  if (!customer) return null;

  const currentDue = parseFloat(customer.total_due) || 0;
  const parsedAmt = parseFloat(amount) || 0;
  const isOverpaying = parsedAmt > currentDue;
  const overage = Math.max(0, Math.round((parsedAmt - currentDue) * 100) / 100);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (parsedAmt <= 0) {
      addToast('Please enter an amount greater than 0', 'warning');
      return;
    }

    if (isOverpaying && !allowOverpayment) {
      addToast(`Amount exceeds current due of ${formatCurrency(currentDue)}. Please check confirmation box to proceed.`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const fullNote = `${method} - ${note.trim()}`;
      const res = await api.recordPayment({
        customerId: customer.customer_id,
        amount: parsedAmt,
        note: fullNote,
        allowOverpayment,
      });

      addToast(`Payment of ${formatCurrency(parsedAmt)} recorded. Due reduced.`, 'success');
      if (onSuccess) onSuccess(res);
      onClose();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Collect Payment / Settle Due"
      subtitle={`Customer: ${customer.name} (Ph: ${customer.phone_number})`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Current Due Overview Card */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Outstanding Due
            </span>
            <span className="text-xl font-bold font-mono text-amber-800 block mt-0.5">
              {formatCurrency(currentDue)}
            </span>
          </div>
          <DuesBadge dueAmount={currentDue} />
        </div>

        {/* Amount Input */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">Payment Amount (₹) *</label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-slate-400 text-sm">₹</span>
            <input
              type="number"
              step="any"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
            />
          </div>

          {/* Quick settlement chips */}
          {currentDue > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              <button
                type="button"
                onClick={() => setAmount(String(currentDue))}
                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-200 transition-colors"
              >
                Clear Full Due ({formatCurrency(currentDue)})
              </button>
              {currentDue > 100 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(Math.round(currentDue / 2)))}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-medium"
                >
                  50% ({formatCurrency(Math.round(currentDue / 2))})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Overpayment Confirmation Warning */}
        {isOverpaying && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Collect {formatCurrency(parsedAmt)}? This is {formatCurrency(overage)} more than due.</span>
            </div>
            <label className="flex items-center gap-2 text-amber-900 font-medium cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={allowOverpayment}
                onChange={(e) => setAllowOverpayment(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>I confirm advance credit overpayment</span>
            </label>
          </div>
        )}

        {/* Payment Method */}
        <div>
          <label className="block font-bold text-slate-700 mb-1.5">Payment Method</label>
          <div className="grid grid-cols-3 gap-2">
            {['Cash', 'UPI / GPay', 'Bank'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMethod(m);
                  if (m === 'Cash') setNote('Cash counter settlement');
                  if (m === 'UPI / GPay') setNote('UPI payment settlement');
                  if (m === 'Bank') setNote('Bank transfer');
                }}
                className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                  method === m
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">Payment Note / Reference</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Cash counter settlement"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || parsedAmt <= 0 || (isOverpaying && !allowOverpayment)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <span>Saving...</span>
            ) : (
              <span>Record Payment</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
