import React, { useState, useEffect, useRef } from 'react';
import {
  Activity, Phone, PhoneOff, AlertTriangle, TrendingUp,
  Shield, Download, RefreshCw, Zap, BarChart3, Clock,
  CheckCircle2, XCircle, Users, IndianRupee, PhoneCall,
  ArrowRight, ChevronDown, ChevronUp, Filter, FileText,
  Radio, AlertCircle, Eye,
} from 'lucide-react';
import LiveCallFeed from '../components/recovery/LiveCallFeed';
import RecoveryFunnel from '../components/recovery/RecoveryFunnel';
import RecoveryChart from '../components/recovery/RecoveryChart';
import SentimentMonitor from '../components/recovery/SentimentMonitor';
import ComplianceAudit from '../components/recovery/ComplianceAudit';

const API_BASE = 'http://localhost:4000';

export default function RecoveryDashboard() {
  const [activeTab, setActiveTab] = useState('overview'); // overview | audit
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/recovery/summary`);
      const data = await res.json();
      setSummary(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to load summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
    // Auto-refresh every 30s
    const interval = setInterval(loadSummary, 30000);
    return () => clearInterval(interval);
  }, []);

  const metrics = summary?.metrics || {};
  const stateCounts = summary?.state_counts || {};

  return (
    <div className="max-w-[1440px] mx-auto space-y-5 pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 p-5 rounded-2xl shadow-lg">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center">
              <Zap className="w-4.5 h-4.5 text-indigo-400" />
            </div>
            <span>AI Revenue Recovery</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 ml-10.5">
            Live telephony, payment reconciliation & compliance audit
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-medium text-emerald-400">Live</span>
          </div>

          <button
            onClick={loadSummary}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white border border-white/10 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          icon={<PhoneCall className="w-4 h-4" />}
          label="Active Calls"
          value={summary?.active_calls || 0}
          accent="indigo"
          pulse={summary?.active_calls > 0}
        />
        <MetricCard
          icon={<Phone className="w-4 h-4" />}
          label="Calls Today"
          value={metrics.today_calls || 0}
          sub={`${metrics.total_calls || 0} total`}
          accent="blue"
        />
        <MetricCard
          icon={<IndianRupee className="w-4 h-4" />}
          label="Recovered Today"
          value={`₹${(metrics.today_recovered || 0).toLocaleString('en-IN')}`}
          sub={`₹${(metrics.total_recovered || 0).toLocaleString('en-IN')} total`}
          accent="emerald"
        />
        <MetricCard
          icon={<Users className="w-4 h-4" />}
          label="Open Cases"
          value={
            (stateCounts.NEW?.count || 0) +
            (stateCounts.CONTACTED?.count || 0) +
            (stateCounts.PROMISED?.count || 0) +
            (stateCounts.PARTIAL?.count || 0) +
            (stateCounts.PROMISE_BROKEN?.count || 0)
          }
          sub={`${stateCounts.RECOVERED?.count || 0} recovered`}
          accent="amber"
        />
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200/80 p-1 shadow-xs">
        <TabButton
          active={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
          icon={<BarChart3 className="w-3.5 h-3.5" />}
          label="Operations"
        />
        <TabButton
          active={activeTab === 'audit'}
          onClick={() => setActiveTab('audit')}
          icon={<Shield className="w-3.5 h-3.5" />}
          label="Compliance Audit"
        />
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Live Activity + Funnel side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-2">
              <LiveCallFeed activeCalls={summary?.active_call_details || []} />
            </div>
            <div className="lg:col-span-3">
              <RecoveryFunnel />
            </div>
          </div>

          {/* Recovery Rate Chart */}
          <RecoveryChart />

          {/* Sentiment Monitor */}
          <SentimentMonitor />
        </div>
      )}

      {activeTab === 'audit' && (
        <ComplianceAudit />
      )}

      {/* ── Footer timestamp ── */}
      {lastRefresh && (
        <p className="text-center text-[10px] text-slate-400">
          Last refreshed: {lastRefresh.toLocaleTimeString()} •
          Data sourced live from Case, CallLog & PaymentEvent tables
        </p>
      )}
    </div>
  );
}

// ── Sub-components ──

function MetricCard({ icon, label, value, sub, accent = 'slate', pulse }) {
  const colorMap = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    blue: 'bg-blue-50 text-blue-700 border-blue-200/80',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    amber: 'bg-amber-50 text-amber-700 border-amber-200/80',
    slate: 'bg-slate-50 text-slate-700 border-slate-200/80',
  };

  const iconColorMap = {
    indigo: 'bg-indigo-100 text-indigo-600',
    blue: 'bg-blue-100 text-blue-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorMap[accent]} shadow-xs`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconColorMap[accent]}`}>
          {icon}
        </div>
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
        )}
      </div>
      <p className="text-2xl font-bold font-mono tracking-tight">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] opacity-50 mt-0.5">{sub}</p>}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
        active
          ? 'bg-slate-900 text-white shadow-sm'
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
