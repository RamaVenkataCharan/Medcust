import React, { useState, useEffect } from 'react';
import {
  FileText,
  Building,
  ArrowUpDown,
  ArrowRight,
  Phone,
  CheckCircle2,
  Filter,
  Send,
  Bell,
  Clock,
  PauseCircle,
  PlayCircle,
  MessageSquare,
  Sparkles,
  History,
  X,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../components/Toast';
import { formatCurrency, formatRelativeTime, formatDate } from '../utils/formatting';

export default function DuesReport({ onSelectCustomer }) {
  const { addToast } = useToast();

  const [duesData, setDuesData] = useState(null);
  const [reminderSummary, setReminderSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'reminders'
  const [sortBy, setSortBy] = useState('amount'); // 'amount' | 'village' | 'name' | 'days'
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedVillage, setSelectedVillage] = useState('');

  // Modals & action states
  const [previewModalCustomer, setPreviewModalCustomer] = useState(null);
  const [previewLanguage, setPreviewLanguage] = useState('hinglish');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [sendingNow, setSendingNow] = useState(false);

  // History modal
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Pause modal
  const [pauseCustomer, setPauseCustomer] = useState(null);
  const [pauseDays, setPauseDays] = useState(7);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reportRes, summaryRes] = await Promise.all([
        api.getDuesReport({
          sortBy: sortBy === 'days' ? 'amount' : sortBy,
          order: sortOrder,
          village: selectedVillage,
        }),
        api.getReminderSummary().catch((e) => {
          console.warn('Reminder summary load note:', e);
          return null;
        }),
      ]);

      setDuesData(reportRes);
      if (summaryRes?.summary) {
        setReminderSummary(summaryRes.summary);
      }
    } catch (err) {
      addToast('Failed to load dues report: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sortBy, sortOrder, selectedVillage]);

  // Load preview when preview modal opens or language changes
  useEffect(() => {
    if (previewModalCustomer) {
      fetchPreview(previewModalCustomer.customer_id, previewLanguage);
    }
  }, [previewModalCustomer, previewLanguage]);

  const fetchPreview = async (customerId, lang) => {
    try {
      setPreviewLoading(true);
      const res = await api.previewReminder(customerId, lang);
      setPreviewData(res);
    } catch (err) {
      addToast('Failed to generate preview: ' + err.message, 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleToggleReminder = async (e, customer) => {
    e.stopPropagation();
    const currentEnabled = customer.reminder_settings?.reminders_enabled ?? 1;
    const newEnabled = !currentEnabled;

    try {
      await api.toggleReminder(customer.customer_id, newEnabled);
      addToast(
        `Reminders ${newEnabled ? 'enabled' : 'disabled'} for ${customer.name}`,
        newEnabled ? 'success' : 'info'
      );
      loadData();
    } catch (err) {
      addToast('Failed to update reminder settings: ' + err.message, 'error');
    }
  };

  const handlePauseSubmit = async () => {
    if (!pauseCustomer) return;
    try {
      await api.pauseReminder(pauseCustomer.customer_id, pauseDays);
      addToast(`Paused reminders for ${pauseCustomer.name} for ${pauseDays} days`, 'info');
      setPauseCustomer(null);
      loadData();
    } catch (err) {
      addToast('Failed to pause reminders: ' + err.message, 'error');
    }
  };

  const handleResumeReminders = async (e, customer) => {
    e.stopPropagation();
    try {
      await api.pauseReminder(customer.customer_id, null, null);
      addToast(`Resumed reminders for ${customer.name}`, 'success');
      loadData();
    } catch (err) {
      addToast('Failed to resume reminders: ' + err.message, 'error');
    }
  };

  const handleSendReminderNow = async () => {
    if (!previewModalCustomer) return;
    try {
      setSendingNow(true);
      const res = await api.sendReminderNow(previewModalCustomer.customer_id, previewLanguage);
      if (res.result?.eligible) {
        addToast(
          `Polite reminder dispatched to ${previewModalCustomer.name} via ${res.result.channel.toUpperCase()}`,
          'success'
        );
      } else {
        addToast(`Notice: ${res.result?.reason || 'Not sent'}`, 'info');
      }
      setPreviewModalCustomer(null);
      loadData();
    } catch (err) {
      addToast('Failed to send reminder: ' + err.message, 'error');
    } finally {
      setSendingNow(false);
    }
  };

  const openHistoryModal = async (e, customer) => {
    e.stopPropagation();
    setHistoryCustomer(customer);
    try {
      setHistoryLoading(true);
      const res = await api.getCustomerReminders(customer.customer_id);
      setHistoryLogs(res.history || []);
    } catch (err) {
      addToast('Failed to load history: ' + err.message, 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRunScheduler = async () => {
    try {
      const res = await api.runReminderCycle(true); // manual test bypasses quiet hours
      addToast(
        `Scheduler checked: ${res.result?.sentCount || 0} reminders sent across ${res.result?.processedCount || 0} debtors`,
        'success'
      );
      loadData();
    } catch (err) {
      addToast('Scheduler run error: ' + err.message, 'error');
    }
  };

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const { totalOutstanding = 0, customerCount = 0, villageBreakdown = {}, customers = [] } = duesData || {};

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header Metric Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              Digital Khata Ledger
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Courtesy Reminders</span>
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mt-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <span>Outstanding Dues & Courtesy Reminders</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Polite automated WhatsApp & SMS courtesy bill reminders with direct UPI payment links.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-right">
            <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider block">
              Total Outstanding Dues
            </span>
            <span className="text-2xl font-extrabold font-mono text-amber-900 block mt-0.5">
              {formatCurrency(totalOutstanding)}
            </span>
            <span className="text-[11px] text-amber-700 font-medium">
              Across {customerCount} customer{customerCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Reminder Automation Summary Strip */}
      {reminderSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 block">Sent This Week</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-extrabold font-mono text-slate-900">
                {reminderSummary.remindersSentThisWeek}
              </span>
              <span className="text-[11px] text-slate-400">reminders</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 block">Delivery Success</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-extrabold font-mono text-emerald-600">
                {reminderSummary.deliverySuccessRate}%
              </span>
              <span className="text-[11px] text-emerald-700 font-medium">Delivered/Read</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 block">48h Settled Rate</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-extrabold font-mono text-indigo-600">
                {reminderSummary.responseRate48h}%
              </span>
              <span className="text-[11px] text-indigo-700 font-medium">Cleared via link</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500">Quiet Hours</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                reminderSummary.quietHoursActive
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {reminderSummary.quietHoursActive ? '🌙 20:00 - 09:00' : '🟢 Active'}
              </span>
            </div>
            <button
              onClick={handleRunScheduler}
              className="mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Check Schedule Now</span>
            </button>
          </div>
        </div>
      )}

      {/* Tabs & Filters Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        {/* Tab Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'all'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Ledger Dues ({customerCount})
          </button>
          <button
            onClick={() => setActiveTab('reminders')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'reminders'
                ? 'bg-white text-indigo-600 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Courtesy Reminders View</span>
          </button>
        </div>

        {/* Filter & Sort */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedVillage}
              onChange={(e) => setSelectedVillage(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="">All Villages ({customerCount})</option>
              {Object.keys(villageBreakdown).map((v) => (
                <option key={v} value={v}>
                  {v} ({formatCurrency(villageBreakdown[v])})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => toggleSort('amount')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                sortBy === 'amount'
                  ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Due {sortBy === 'amount' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button
              type="button"
              onClick={() => toggleSort('name')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                sortBy === 'name'
                  ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Name {sortBy === 'name' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
          </div>
        </div>
      </div>

      {/* Dues Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-5">Customer</th>
                <th className="py-3.5 px-4">Village</th>
                <th className="py-3.5 px-4 text-right">Current Due</th>
                <th className="py-3.5 px-4 text-center">Oldest Unpaid Due</th>
                <th className="py-3.5 px-4 text-center">Reminder Status</th>
                <th className="py-3.5 px-4 text-center">Next Schedule</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading dues report & reminder statuses...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                    <p className="text-sm font-bold text-slate-800">All customer dues are settled!</p>
                    <p className="text-xs text-slate-400">Zero outstanding khata balances recorded.</p>
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const settings = c.reminder_settings || { reminders_enabled: 1, paused_until: null };
                  const isPaused = settings.paused_until && new Date(settings.paused_until).getTime() > Date.now();
                  const isEnabled = settings.reminders_enabled === 1 && !isPaused;

                  return (
                    <tr
                      key={c.customer_id}
                      onClick={() => onSelectCustomer(c)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                    >
                      {/* Customer Info */}
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {c.name}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{c.phone_number}</span>
                        </div>
                      </td>

                      {/* Village */}
                      <td className="py-4 px-4 text-slate-600">
                        {c.village ? (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                            {c.village}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Current Due */}
                      <td className="py-4 px-4 text-right font-mono font-bold text-sm text-amber-800">
                        {formatCurrency(c.total_due)}
                      </td>

                      {/* Oldest Unpaid Due */}
                      <td className="py-4 px-4 text-center text-slate-600">
                        {c.oldest_unpaid_date ? (
                          <div>
                            <span className="font-medium text-slate-800">
                              {formatDate(c.oldest_unpaid_date)}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              ({c.days_since_due} days ago)
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Reminder Status & Quick Toggle */}
                      <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleToggleReminder(e, c)}
                            title="Click to toggle reminders on/off for this customer"
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 ${
                              isEnabled
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : isPaused
                                ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                                : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            {isEnabled && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
                            <span>
                              {isEnabled ? 'Active' : isPaused ? `Paused till ${formatDate(settings.paused_until)}` : 'Disabled'}
                            </span>
                          </button>
                        </div>
                      </td>

                      {/* Next Scheduled Stage */}
                      <td className="py-4 px-4 text-center">
                        {c.next_stage ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                            <Clock className="w-3 h-3 text-indigo-500" />
                            <span>Stage {c.next_stage}</span>
                          </span>
                        ) : c.reminders_sent_count >= (c.max_reminders || 3) ? (
                          <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                            Max (3/3 sent)
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Scheduled</span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-4 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Send Courtesy Reminder button */}
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewModalCustomer(c);
                              setPreviewLanguage('hinglish');
                            }}
                            title="Preview & send polite courtesy reminder"
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg font-medium text-xs transition-colors flex items-center gap-1 border border-indigo-200/80"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Send</span>
                          </button>

                          {/* Pause dropdown / button */}
                          {isPaused ? (
                            <button
                              type="button"
                              onClick={(e) => handleResumeReminders(e, c)}
                              title="Resume reminders"
                              className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-lg text-xs transition-colors border border-amber-200"
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPauseCustomer(c)}
                              title="Pause reminders for 7 or 14 days"
                              className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg text-xs transition-colors border border-slate-200"
                            >
                              <PauseCircle className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* History Button */}
                          <button
                            type="button"
                            onClick={(e) => openHistoryModal(e, c)}
                            title="View customer reminder timeline"
                            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg text-xs transition-colors"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal: Preview & Send Courtesy Reminder ── */}
      {previewModalCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">
                  Courtesy Due Reminder
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                  Send to {previewModalCustomer.name}
                </h2>
                <p className="text-xs text-slate-500">
                  Bill Due: <span className="font-bold text-amber-700 font-mono">{formatCurrency(previewModalCustomer.total_due)}</span> • Phone: {previewModalCustomer.phone_number}
                </p>
              </div>
              <button
                onClick={() => setPreviewModalCustomer(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Language Selector */}
            <div className="px-6 pt-4 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Language:</span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                {['hinglish', 'hindi', 'english'].map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setPreviewLanguage(lang)}
                    className={`px-3 py-1 rounded-lg capitalize transition-all ${
                      previewLanguage === lang
                        ? 'bg-white text-indigo-600 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Preview Body */}
            <div className="p-6 space-y-4">
              <div className="text-xs font-semibold text-slate-500">WhatsApp / SMS Message Content:</div>
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 text-xs font-sans text-slate-800 whitespace-pre-wrap leading-relaxed shadow-inner">
                {previewLoading ? (
                  <div className="py-6 text-center text-slate-400">Loading message preview...</div>
                ) : (
                  previewData?.message || 'Generating preview...'
                )}
              </div>

              {previewData?.paymentLink && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                  <div className="truncate pr-2">
                    <span className="text-slate-500 block text-[10px] font-bold uppercase">Embedded Payment Link:</span>
                    <span className="font-mono text-indigo-600 truncate block text-[11px]">
                      {previewData.paymentLink}
                    </span>
                  </div>
                  <a
                    href={previewData.paymentLink}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 text-slate-400 hover:text-indigo-600 shrink-0"
                    title="Open test pay page"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-[11px] text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  This courtesy reminder is gentle and polite. It includes the store phone number for counter queries and a direct link to clear the due.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreviewModalCustomer(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingNow || previewLoading}
                onClick={handleSendReminderNow}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 disabled:opacity-60"
              >
                {sendingNow ? (
                  <span>Sending...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Reminder Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Customer Reminder Timeline & History ── */}
      {historyCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Reminder History — {historyCustomer.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Phone: {historyCustomer.phone_number} • Total Due: {formatCurrency(historyCustomer.total_due)}
                </p>
              </div>
              <button
                onClick={() => setHistoryCustomer(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto space-y-3">
              {historyLoading ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading history...</div>
              ) : historyLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No courtesy reminders sent to this customer yet.
                </div>
              ) : (
                historyLogs.map((log) => (
                  <div
                    key={log.reminder_id}
                    className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 uppercase text-[10px] bg-slate-200 px-2 py-0.5 rounded">
                          {log.channel}
                        </span>
                        <span className="font-bold text-indigo-700 text-[11px]">
                          Stage {log.scheduled_stage}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        log.delivery_status === 'DELIVERED' || log.delivery_status === 'READ'
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.delivery_status === 'FAILED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}>
                        {log.delivery_status}
                      </span>
                    </div>

                    <p className="text-slate-600 text-[11px] italic bg-white p-2.5 rounded-xl border border-slate-100">
                      "{log.message_text}"
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span>Due at send: {formatCurrency(log.due_amount_at_send)}</span>
                      <span>{formatDate(log.sent_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
              <button
                type="button"
                onClick={() => setHistoryCustomer(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Temporary Hardship Pause ── */}
      {pauseCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <PauseCircle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-900">Pause Reminders</h3>
            </div>

            <p className="text-xs text-slate-500">
              Temporarily stop all automated reminders for <span className="font-bold text-slate-800">{pauseCustomer.name}</span> (e.g. for medical emergency, known hardship, or customer request).
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700">Pause Duration</label>
              <select
                value={pauseDays}
                onChange={(e) => setPauseDays(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                <option value={7}>Pause for 7 Days</option>
                <option value={14}>Pause for 14 Days (2 Weeks)</option>
                <option value={30}>Pause for 30 Days (1 Month)</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPauseCustomer(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePauseSubmit}
                className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors shadow-xs"
              >
                Confirm Pause
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
