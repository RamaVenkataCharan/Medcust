import React, { useState, useEffect } from 'react';
import { AlertTriangle, Eye, ChevronDown, ChevronUp } from 'lucide-react';

const API_BASE = 'http://localhost:4000';

export default function SentimentMonitor() {
  const [escalations, setEscalations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadEscalations();
    const interval = setInterval(loadEscalations, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadEscalations = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/recovery/escalations?limit=20`);
      const data = await res.json();
      setEscalations(data);
    } catch (err) {
      console.error('Failed to load escalations:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalCount = escalations?.total_count || 0;
  const items = escalations?.escalations || [];

  const getSentimentColor = (score) => {
    if (score === null || score === undefined) return 'text-slate-400';
    if (score <= -0.6) return 'text-red-600';
    if (score <= -0.3) return 'text-amber-600';
    if (score <= 0.3) return 'text-slate-500';
    return 'text-emerald-600';
  };

  const getSentimentLabel = (score) => {
    if (score === null || score === undefined) return 'N/A';
    if (score <= -0.6) return 'Distressed';
    if (score <= -0.3) return 'Negative';
    if (score <= 0.3) return 'Neutral';
    return 'Positive';
  };

  const formatDateTime = (dt) => {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <h3 className="text-xs font-bold text-slate-800">Sentiment & Escalation Monitor</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold font-mono px-2.5 py-1 rounded-lg ${
            totalCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
          }`}>
            {totalCount} escalated
          </span>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center">
          <p className="text-xs text-slate-400">Loading escalation data...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center">
          <AlertTriangle className="w-6 h-6 text-slate-200 mx-auto mb-2" />
          <p className="text-xs text-slate-400">No escalated calls — all calls within sentiment thresholds</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((esc) => {
            const isExpanded = expandedId === esc.call_id;
            const flags = esc.compliance_flags || [];

            return (
              <div key={esc.call_id}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : esc.call_id)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-900">{esc.name || 'Unknown'}</p>
                      <span className="text-[10px] text-slate-400 font-mono">{esc.phone_number}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {formatDateTime(esc.started_at)}
                      {esc.sentiment_score != null && (
                        <span className={`ml-2 font-bold ${getSentimentColor(esc.sentiment_score)}`}>
                          {getSentimentLabel(esc.sentiment_score)} ({esc.sentiment_score.toFixed(2)})
                        </span>
                      )}
                    </p>
                  </div>

                  {flags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {flags.slice(0, 2).map((flag, i) => (
                        <span key={i} className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium border border-red-100">
                          {flag}
                        </span>
                      ))}
                    </div>
                  )}

                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  }
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pl-15">
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/50">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Call Details
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                        <div><span className="text-slate-400">Call ID:</span> <span className="font-mono text-slate-600">{esc.call_id}</span></div>
                        <div><span className="text-slate-400">Case ID:</span> <span className="font-mono text-slate-600">{esc.case_id}</span></div>
                        <div><span className="text-slate-400">Started:</span> <span className="text-slate-600">{formatDateTime(esc.started_at)}</span></div>
                        <div><span className="text-slate-400">Ended:</span> <span className="text-slate-600">{formatDateTime(esc.ended_at)}</span></div>
                        <div><span className="text-slate-400">AI Disclosed:</span> <span className={esc.ai_disclosed_at_start ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>{esc.ai_disclosed_at_start ? 'Yes' : 'No'}</span></div>
                        <div><span className="text-slate-400">Outcome:</span> <span className="font-bold text-amber-700">{esc.outcome}</span></div>
                      </div>
                      {esc.transcript_ref && (
                        <p className="mt-2 text-[10px] text-slate-400">
                          <Eye className="w-3 h-3 inline mr-1" />
                          Transcript: <span className="font-mono">{esc.transcript_ref}</span>
                        </p>
                      )}
                      {flags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {flags.map((flag, i) => (
                            <span key={i} className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium border border-red-100">
                              {flag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
