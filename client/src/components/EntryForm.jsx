import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Printer, CheckCircle2, IndianRupee, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from './Toast';
import { formatCurrency } from '../utils/formatting';
import Modal from './Modal';

export default function EntryForm({ isOpen, onClose, customer, onSuccess }) {
  const { addToast } = useToast();

  const [medicines, setMedicines] = useState([{ name: '', price: '' }]);
  const [totalAmountInput, setTotalAmountInput] = useState('');
  const [isManualTotal, setIsManualTotal] = useState(false);
  const [amountPaid, setAmountPaid] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  // Completed entry state for print prompt
  const [completedEntry, setCompletedEntry] = useState(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setMedicines([{ name: '', price: '' }]);
      setTotalAmountInput('');
      setIsManualTotal(false);
      setAmountPaid('');
      setEntryDate(new Date().toISOString().slice(0, 10));
      setCompletedEntry(null);
    }
  }, [isOpen]);

  // Autocomplete fetch
  const handleMedicineNameChange = async (index, value) => {
    const updated = [...medicines];
    updated[index].name = value;
    setMedicines(updated);

    if (value.trim().length >= 2) {
      try {
        const matches = await api.autocompleteMedicines(value.trim());
        setSuggestions(matches || []);
        setActiveSuggestionIndex(index);
      } catch (err) {
        console.error('Autocomplete error:', err);
      }
    } else {
      setSuggestions([]);
      setActiveSuggestionIndex(-1);
    }
  };

  const selectSuggestion = (index, medName) => {
    const updated = [...medicines];
    updated[index].name = medName;
    setMedicines(updated);
    setSuggestions([]);
    setActiveSuggestionIndex(-1);
  };

  // Medicine row addition/removal
  const addMedicineRow = () => {
    setMedicines([...medicines, { name: '', price: '' }]);
  };

  const removeMedicineRow = (index) => {
    if (medicines.length > 1) {
      setMedicines(medicines.filter((_, i) => i !== index));
    }
  };

  const handlePriceChange = (index, value) => {
    const updated = [...medicines];
    updated[index].price = value;
    setMedicines(updated);
  };

  // Compute sum of medicine prices
  const sumOfPrices = medicines.reduce((sum, item) => {
    const p = parseFloat(item.price);
    return sum + (isNaN(p) ? 0 : p);
  }, 0);

  // Derived or manual total
  const computedTotal = isManualTotal && totalAmountInput !== ''
    ? parseFloat(totalAmountInput) || 0
    : sumOfPrices;

  const parsedPaid = amountPaid === '' ? computedTotal : parseFloat(amountPaid) || 0;
  const liveDue = Math.max(0, Math.round((computedTotal - parsedPaid) * 100) / 100);
  const isOverpaid = parsedPaid > computedTotal;

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validMeds = medicines.filter((m) => m.name.trim() !== '');
    if (validMeds.length === 0) {
      addToast('Please enter at least one medicine name', 'warning');
      return;
    }

    if (computedTotal <= 0) {
      addToast('Total amount must be greater than 0', 'warning');
      return;
    }

    if (isOverpaid) {
      addToast('Amount paid cannot exceed total amount', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payloadPaid = amountPaid === '' ? computedTotal : parseFloat(amountPaid) || 0;
      const res = await api.addEntry({
        customerId: customer.customer_id,
        totalAmount: computedTotal,
        amountPaid: payloadPaid,
        medicines: validMeds,
        entryDate: entryDate ? `${entryDate}T12:00:00` : null,
      });

      addToast('Purchase recorded successfully!', 'success');
      setCompletedEntry(res);
      if (onSuccess) onSuccess(res);
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
      title={completedEntry ? 'Purchase Recorded' : `New Purchase — ${customer?.name}`}
      subtitle={completedEntry ? `Entry #${completedEntry.entryId}` : `Phone: ${customer?.phone_number}`}
      maxWidth="max-w-xl"
    >
      {completedEntry ? (
        /* Post-Entry Success State */
        <div className="text-center py-6 space-y-5 animate-in zoom-in-95 duration-200">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">Purchase Added to Ledger</h3>
            <p className="text-xs text-slate-500 mt-1">
              Customer due balance updated to <strong className="font-mono text-amber-800">{formatCurrency(completedEntry.totalDue)}</strong>
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-left space-y-2">
            <div className="flex justify-between text-slate-600">
              <span>Total Amount:</span>
              <span className="font-mono font-bold text-slate-900">{formatCurrency(completedEntry.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Amount Paid:</span>
              <span className="font-mono font-bold">{formatCurrency(completedEntry.amountPaid)}</span>
            </div>
            {completedEntry.dueAmount > 0 && (
              <div className="flex justify-between text-amber-800 font-bold">
                <span>Due Created:</span>
                <span className="font-mono">{formatCurrency(completedEntry.dueAmount)}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                window.open(`/api/bills/${completedEntry.entryId}`, '_blank');
              }}
              className="flex-1 py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-2xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print Bill</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <span>Done</span>
            </button>
          </div>
        </div>
      ) : (
        /* Purchase Entry Form */
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Medicine Line Items */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <span>Medicine / Prescription Items *</span>
              <span>Price (Optional)</span>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {medicines.map((item, idx) => (
                <div key={idx} className="relative flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      required={idx === 0}
                      value={item.name}
                      onChange={(e) => handleMedicineNameChange(idx, e.target.value)}
                      placeholder={`Medicine name (e.g. Paracetamol 650mg)`}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
                    />

                    {/* Autocomplete popup */}
                    {activeSuggestionIndex === idx && suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 divide-y divide-slate-100 z-50 max-h-36 overflow-y-auto">
                        {suggestions.map((s, sIdx) => (
                          <div
                            key={sIdx}
                            onClick={() => selectSuggestion(idx, s)}
                            className="px-3 py-2 text-xs text-slate-800 hover:bg-indigo-50 cursor-pointer font-medium"
                          >
                            {s}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="w-24 relative">
                    <span className="absolute left-2.5 top-2 text-slate-400">₹</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={item.price}
                      onChange={(e) => handlePriceChange(idx, e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-6 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
                    />
                  </div>

                  {medicines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMedicineRow(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addMedicineRow}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 pt-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add another medicine</span>
            </button>
          </div>

          {/* Total & Paid Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            {/* Total Amount */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-bold text-slate-700">Total Bill Amount (₹) *</label>
                {sumOfPrices > 0 && !isManualTotal && (
                  <span className="text-[10px] text-indigo-600 font-medium">(Auto-calculated)</span>
                )}
              </div>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={isManualTotal ? totalAmountInput : (sumOfPrices > 0 ? String(sumOfPrices) : totalAmountInput)}
                onChange={(e) => {
                  setIsManualTotal(true);
                  setTotalAmountInput(e.target.value);
                }}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
              />
            </div>

            {/* Amount Paid Now */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Amount Paid Now (₹)</label>
              <input
                type="number"
                step="any"
                min="0"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder={computedTotal > 0 ? String(computedTotal) : '0.00'}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
              />
            </div>
          </div>

          {/* Quick Paid Chips */}
          {computedTotal > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => setAmountPaid(String(computedTotal))}
                className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-semibold border border-emerald-200 hover:bg-emerald-100"
              >
                Full Paid ({formatCurrency(computedTotal)})
              </button>
              <button
                type="button"
                onClick={() => setAmountPaid('0')}
                className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-semibold border border-amber-200 hover:bg-amber-100"
              >
                Full Due (₹0 Paid)
              </button>
            </div>
          )}

          {/* Due Display Banner */}
          <div className={`p-3 rounded-xl border flex items-center justify-between font-medium ${
            liveDue > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}>
            <span className="text-xs">Due Created on this Visit:</span>
            <span className="text-sm font-bold font-mono">{formatCurrency(liveDue)}</span>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block font-semibold text-slate-600 mb-1 text-[11px]">Visit Date</label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          {/* Submit Actions */}
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
              disabled={isSubmitting || computedTotal <= 0 || isOverpaid}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <span>Record Purchase</span>
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
