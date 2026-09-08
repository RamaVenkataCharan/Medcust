import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../utils/formatting';

export default function DuesBadge({ dueAmount, size = 'default' }) {
  const due = parseFloat(dueAmount) || 0;
  const isZero = due <= 0;

  if (size === 'large') {
    return (
      <div
        className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl font-bold border transition-colors ${
          isZero
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}
      >
        {isZero ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        ) : (
          <AlertCircle className="w-5 h-5 text-amber-600" />
        )}
        <div className="text-left">
          <span className="text-[10px] uppercase tracking-wider font-semibold opacity-75 block">
            {isZero ? 'Status' : 'Current Due'}
          </span>
          <span className="text-xl font-mono block leading-none mt-0.5">
            {isZero ? 'All Clear' : formatCurrency(due)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold font-mono border ${
        isZero
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-amber-50 border-amber-200 text-amber-800'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isZero ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      <span>{isZero ? 'All clear' : `${formatCurrency(due)} due`}</span>
    </span>
  );
}
