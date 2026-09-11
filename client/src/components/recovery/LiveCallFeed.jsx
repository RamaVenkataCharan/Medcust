import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Radio, Clock, User, AlertTriangle, Zap, Volume2 } from 'lucide-react';

const API_BASE = 'http://localhost:4000';

export default function LiveCallFeed({ activeCalls = [] }) {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    // Connect to SSE endpoint
    const sse = new EventSource(`${API_BASE}/api/recovery/live`);
    eventSourceRef.current = sse;

    sse.onopen = () => setConnected(true);
    sse.onerror = () => setConnected(false);

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'PING') return;
        if (data.type === 'INIT') return;

        setEvents(prev => [data, ...prev].slice(0, 50)); // Keep last 50 events
      } catch (_) {}
    };

    return () => {
      sse.close();
      setConnected(false);
    };
  }, []);

  const getEventIcon = (type) => {
    switch (type) {
      case 'CALL_STARTED': return <Phone className="w-3.5 h-3.5 text-emerald-500" />;
      case 'CALL_ENDED': return <PhoneOff className="w-3.5 h-3.5 text-slate-400" />;
      case 'CALL_BLOCKED': return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
      case 'CALL_ESCALATED': return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
      case 'AI_DISCLOSED': return <Volume2 className="w-3.5 h-3.5 text-blue-500" />;
      case 'AGENT_SPOKE': return <Zap className="w-3.5 h-3.5 text-indigo-500" />;
      case 'PAYMENT_RECEIVED': return <Zap className="w-3.5 h-3.5 text-emerald-500" />;
      case 'PROMISE_BROKEN': return <Clock className="w-3.5 h-3.5 text-red-400" />;
      default: return <Radio className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getEventColor = (type) => {
    switch (type) {
      case 'CALL_STARTED': return 'border-l-emerald-400 bg-emerald-50/50';
      case 'CALL_ENDED': return 'border-l-slate-300 bg-slate-50/50';
      case 'CALL_BLOCKED': return 'border-l-red-400 bg-red-50/50';
      case 'CALL_ESCALATED': return 'border-l-amber-400 bg-amber-50/50';
      case 'PAYMENT_RECEIVED': return 'border-l-emerald-500 bg-emerald-50/50';
      case 'PROMISE_BROKEN': return 'border-l-red-300 bg-red-50/30';
      default: return 'border-l-indigo-300 bg-indigo-50/30';
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-800">Live Activity Feed</h3>
        </div>
        <div className="flex items-center gap-2">
          {connected && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              Connected
            </span>
          )}
          {!connected && (
            <span className="text-[10px] text-slate-400 font-medium">Disconnected</span>
          )}
        </div>
      </div>

      {/* Active Calls */}
      {activeCalls.length > 0 && (
        <div className="px-4 py-3 bg-indigo-50/50 border-b border-indigo-100/50">
          <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2">
            In Progress ({activeCalls.length})
          </p>
          <div className="space-y-2">
            {activeCalls.map((call, i) => (
              <div key={call.callSid || i} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-indigo-100 shadow-xs">
                <div className="relative">
                  <Phone className="w-4 h-4 text-indigo-600" />
                  <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{call.customerName}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{call.phoneNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono font-bold text-indigo-600">{call.duration || 0}s</p>
                  <p className="text-[10px] text-slate-400">Turn {call.turnCount || 0}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event Stream */}
      <div className="max-h-[320px] overflow-y-auto">
        {events.length === 0 && activeCalls.length === 0 ? (
          <div className="py-12 text-center">
            <Radio className="w-6 h-6 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-400">No activity yet — calls and events will appear here in real time</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {events.map((evt, i) => (
              <div
                key={`${evt.type}_${evt.timestamp}_${i}`}
                className={`px-4 py-2.5 border-l-2 flex items-start gap-2.5 ${getEventColor(evt.type)}`}
              >
                <div className="mt-0.5">{getEventIcon(evt.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                      {evt.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatTime(evt.timestamp)}
                    </span>
                  </div>
                  {evt.customerName && (
                    <p className="text-xs text-slate-700 mt-0.5">
                      {evt.customerName}
                      {evt.phoneNumber && <span className="text-slate-400 ml-1 font-mono">{evt.phoneNumber}</span>}
                    </p>
                  )}
                  {evt.utterance && (
                    <p className="text-[11px] text-slate-500 mt-0.5 italic truncate">"{evt.utterance}"</p>
                  )}
                  {evt.flags && evt.flags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {evt.flags.map((flag, fi) => (
                        <span key={fi} className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                          {flag}
                        </span>
                      ))}
                    </div>
                  )}
                  {evt.amount && (
                    <p className="text-xs font-bold text-emerald-700 mt-0.5">₹{evt.amount.toLocaleString('en-IN')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
