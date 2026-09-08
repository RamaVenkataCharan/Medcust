import React from 'react';
import { Phone, MapPin, Calendar, PlusCircle, CreditCard, ArrowLeft, Clock } from 'lucide-react';
import { formatRelativeTime } from '../utils/formatting';
import DuesBadge from './DuesBadge';

export default function CustomerCard({
  customer,
  onAddPurchase,
  onCollectPayment,
  onBackToSearch,
}) {
  if (!customer) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-6">
      {/* Top action row */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToSearch}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 py-1.5 px-2.5 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Search</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Last Visit: <strong className="text-slate-700">{formatRelativeTime(customer.last_visit)}</strong></span>
        </div>
      </div>

      {/* Main Profile Info & Due Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {customer.name}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1 font-mono font-medium">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              {customer.phone_number}
            </span>

            {customer.village && (
              <span className="flex items-center gap-1 bg-slate-100 px-2.5 py-0.5 rounded-full text-slate-700 font-medium">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {customer.village}
              </span>
            )}

            {customer.address && (
              <span className="text-slate-500">
                {customer.address}
              </span>
            )}
          </div>
        </div>

        {/* Prominent Large Due Badge */}
        <div className="self-start sm:self-center">
          <DuesBadge dueAmount={customer.total_due} size="large" />
        </div>
      </div>

      {/* Action Buttons Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <div>
            Total Visits: <span className="font-bold text-slate-900">{customer.total_visits || 0}</span>
          </div>
          <div>
            Lifetime Purchases: <span className="font-bold font-mono text-slate-900">₹{(customer.total_spent || 0).toFixed(2)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onAddPurchase}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Purchase Entry</span>
          </button>

          <button
            type="button"
            onClick={onCollectPayment}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold shadow-2xs transition-all active:scale-95"
          >
            <CreditCard className="w-4 h-4 text-amber-700" />
            <span>Collect Payment</span>
          </button>
        </div>
      </div>
    </div>
  );
}
