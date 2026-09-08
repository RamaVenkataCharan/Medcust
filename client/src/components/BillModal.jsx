import React, { useEffect } from 'react';
import { CheckCircle2, Printer, Download, ArrowRight, X } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function BillModal({ isOpen, onClose, billData, onNextSale }) {
  useEffect(() => {
    if (isOpen) {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#0f766e', '#14b8a6', '#f59e0b'],
        });
      } catch (e) {
        // ignore if not supported
      }
    }
  }, [isOpen]);

  if (!isOpen || !billData) return null;

  const handlePrint = () => {
    window.open(`/api/transactions/${billData.transactionId}/pdf`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
        {/* Top Success Banner */}
        <div className="bg-gradient-to-br from-teal-800 to-teal-700 text-white p-6 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-teal-200 hover:text-white p-1 rounded-lg hover:bg-teal-600/50"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-14 h-14 bg-white text-teal-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg animate-checkmark">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h2 className="text-xl font-bold">Sale Completed Successfully</h2>
          <p className="text-xs text-teal-100 mt-0.5">Bill #{String(billData.transactionId).padStart(5, '0')}</p>
        </div>

        {/* Printable Receipt Preview Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto bg-slate-50/50">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3 text-xs">
            {/* Customer metadata */}
            <div className="flex justify-between items-start border-b border-dashed border-slate-200 pb-2.5">
              <div>
                <p className="font-semibold text-slate-900 text-sm">{billData.customerName}</p>
                <p className="text-slate-500">{billData.phone} {billData.village ? `• ${billData.village}` : ''}</p>
              </div>
              <div className="text-right text-[11px] text-slate-500">
                <p>{new Date(billData.txnDate || Date.now()).toLocaleDateString()}</p>
                <p>{new Date(billData.txnDate || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>

            {/* Line items list */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider pb-1">
                <span>Medicine</span>
                <span className="text-right">Qty × Price</span>
              </div>
              {billData.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-slate-800">
                  <span className="truncate max-w-[200px]">{item.name}</span>
                  <span className="font-mono text-slate-700 whitespace-nowrap">
                    {item.quantity} × ₹{item.price_each?.toFixed(2)} = ₹{(item.quantity * item.price_each)?.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Financial summary */}
            <div className="border-t border-dashed border-slate-200 pt-3 space-y-1.5 font-medium">
              <div className="flex justify-between text-slate-600">
                <span>Bill Total:</span>
                <span className="font-bold text-slate-900 font-mono">₹{billData.billTotal?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Amount Paid Now:</span>
                <span className="font-bold font-mono">₹{billData.amountPaid?.toFixed(2)}</span>
              </div>
              {billData.dueCreated > 0 && (
                <div className="flex justify-between text-amber-700 font-semibold">
                  <span>Due on this Bill:</span>
                  <span className="font-mono">₹{billData.dueCreated?.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 font-bold text-sm">
                <span className="text-slate-800">Customer Total Due:</span>
                <span className={`font-mono px-2 py-0.5 rounded text-xs ${billData.totalDue > 0 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
                  ₹{billData.totalDue?.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-xs transition-colors shadow-xs"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print PDF Bill</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onNextSale) onNextSale();
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-teal-700 text-white hover:bg-teal-800 font-semibold text-xs transition-colors shadow-sm"
          >
            <span>Next Customer</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
