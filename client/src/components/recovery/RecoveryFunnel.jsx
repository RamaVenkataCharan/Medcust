import React, { useState, useEffect } from 'react';
import { ArrowRight, TrendingUp } from 'lucide-react';

const API_BASE = 'http://localhost:4000';

const STATE_COLORS = {
  NEW: { bg: 'bg-slate-100', text: 'text-slate-700', bar: 'bg-slate-400' },
  CONTACTED: { bg: 'bg-blue-100', text: 'text-blue-700', bar: 'bg-blue-500' },
  PROMISED: { bg: 'bg-amber-100', text: 'text-amber-700', bar: 'bg-amber-500' },
  PARTIAL: { bg: 'bg-orange-100', text: 'text-orange-700', bar: 'bg-orange-500' },
  RECOVERED: { bg: 'bg-emerald-100', text: 'text-emerald-700', bar: 'bg-emerald-500' },
  PROMISE_BROKEN: { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-400' },
};

const STATE_LABELS = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  PROMISED: 'Promised',
  PARTIAL: 'Partial',
  RECOVERED: 'Recovered',
  PROMISE_BROKEN: 'Promise Broken',
};

export default function RecoveryFunnel() {
  const [funnelData, setFunnelData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFunnel();
    const interval = setInterval(loadFunnel, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadFunnel = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/recovery/funnel`);
      const data = await res.json();
      setFunnelData(data);
    } catch (err) {
      console.error('Failed to load funnel:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !funnelData) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 h-full flex items-center justify-center">
        <p className="text-xs text-slate-400">Loading funnel data...</p>
      </div>
    );
  }

  const { funnel, conversionRates, totalCases } = funnelData;
  const maxCount = Math.max(...funnel.map(s => s.count), 1);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-800">Recovery Funnel</h3>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">{totalCases} total cases</span>
      </div>

      <div className="p-4">
        {/* Funnel Bars */}
        <div className="space-y-2.5">
          {funnel.map((stage, i) => {
            const colors = STATE_COLORS[stage.state] || STATE_COLORS.NEW;
            const widthPct = Math.max(8, (stage.count / maxCount) * 100);

            return (
              <div key={stage.state}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                      {STATE_LABELS[stage.state] || stage.state}
                    </span>
                    {i < funnel.length - 1 && i > 0 && (
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-slate-700">{stage.count}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ₹{stage.total_amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${colors.bar}`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Conversion Rates */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">Conversion Rates</p>
          <div className="grid grid-cols-2 gap-2">
            <ConversionBadge label="Contact Rate" value={conversionRates.contact_rate} />
            <ConversionBadge label="Promise Rate" value={conversionRates.promise_rate} />
            <ConversionBadge label="Recovery Rate" value={conversionRates.recovery_rate} />
            <ConversionBadge label="Overall" value={conversionRates.overall_rate} highlight />
          </div>
        </div>
      </div>
    </div>
  );
}

function ConversionBadge({ label, value, highlight }) {
  const getColor = (v) => {
    if (v >= 70) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (v >= 40) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-slate-600 bg-slate-50 border-slate-200';
  };

  return (
    <div className={`rounded-lg border px-3 py-2 ${highlight ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-slate-50/50'}`}>
      <p className="text-[10px] text-slate-500 font-medium">{label}</p>
      <p className={`text-lg font-bold font-mono ${highlight ? 'text-indigo-700' : getColor(value).split(' ')[0]}`}>
        {value}%
      </p>
    </div>
  );
}
