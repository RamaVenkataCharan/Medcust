import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Pill,
  CreditCard,
  PlusCircle,
  Calendar,
  Clock,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import CustomerCard from '../components/CustomerCard';
import EntryList from '../components/EntryList';
import EntryForm from '../components/EntryForm';
import PaymentForm from '../components/PaymentForm';
import { api } from '../utils/api';
import { useToast } from '../components/Toast';
import { formatDate, formatCurrency } from '../utils/formatting';

export default function CustomerProfile({ customerId, onBackToSearch }) {
  const { addToast } = useToast();

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('entries'); // 'entries' | 'recent' | 'payments'

  // Entries
  const [entries, setEntries] = useState([]);
  const [entryPage, setEntryPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntriesCount, setTotalEntriesCount] = useState(0);

  // Payments
  const [payments, setPayments] = useState([]);

  // Modals
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      const cust = await api.getCustomer(customerId);
      setCustomer(cust);

      // Fetch entries
      await fetchEntries(1);

      // Fetch payments
      const payList = await api.getPayments(customerId);
      setPayments(payList || []);
    } catch (err) {
      addToast('Failed to load customer profile: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchEntries = async (page = 1) => {
    try {
      const data = await api.getEntries(customerId, page, 10);
      setEntries(data.entries || []);
      setEntryPage(data.page || 1);
      setTotalPages(data.totalPages || 1);
      setTotalEntriesCount(data.totalCount || 0);
    } catch (err) {
      console.error('Failed to load entries:', err);
    }
  };

  useEffect(() => {
    if (customerId) {
      fetchCustomerData();
    }
  }, [customerId]);

  const handleEntrySuccess = (newEntry) => {
    fetchCustomerData();
  };

  const handlePaymentSuccess = (paymentRes) => {
    fetchCustomerData();
  };

  if (loading && !customer) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-2.5 text-slate-500">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-medium">Loading customer khata ledger...</span>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-sm font-semibold text-slate-600">Customer not found</p>
        <button
          onClick={onBackToSearch}
          className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl"
        >
          Back to search
        </button>
      </div>
    );
  }

  const recentlyBought = customer.recently_bought || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Customer Header Card */}
      <CustomerCard
        customer={customer}
        onAddPurchase={() => setIsEntryModalOpen(true)}
        onCollectPayment={() => setIsPaymentModalOpen(true)}
        onBackToSearch={onBackToSearch}
      />

      {/* Profile Section Tabs */}
      <div className="space-y-4">
        {/* Tab Buttons */}
        <div className="flex items-center border-b border-slate-200 gap-1 bg-white px-4 rounded-2xl shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('entries')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'entries'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Purchase History ({totalEntriesCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recent')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'recent'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Pill className="w-4 h-4" />
            <span>Recently Bought ({recentlyBought.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'payments'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Payment History ({payments.length})</span>
          </button>
        </div>

        {/* Tab 1: Purchase History */}
        {activeTab === 'entries' && (
          <EntryList
            entries={entries}
            totalCount={totalEntriesCount}
            page={entryPage}
            totalPages={totalPages}
            onPageChange={(p) => fetchEntries(p)}
            onAddPurchase={() => setIsEntryModalOpen(true)}
          />
        )}

        {/* Tab 2: Recently Bought */}
        {activeTab === 'recent' && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Pill className="w-4 h-4 text-indigo-600" />
                <span>Frequently & Recently Purchased Medicines</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Quick reference for pharmacists to identify repeating prescriptions and past medicines taken.
              </p>
            </div>

            {recentlyBought.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No distinct medicines recorded yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {recentlyBought.map((med, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 rounded-xl transition-colors space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-2">
                        {med.name}
                      </h4>
                      <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200/60 font-mono">
                        {med.frequency}x bought
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                      <span>Last taken:</span>
                      <span className="font-medium text-slate-700">
                        {med.daysAgo === 0 ? 'Today' : `${med.daysAgo} days ago`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Payment History */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            {payments.length === 0 ? (
              <div className="p-12 text-center space-y-2 text-slate-400">
                <CreditCard className="w-8 h-8 mx-auto opacity-50" />
                <p className="text-xs font-bold text-slate-700">No payment history on record</p>
                <p className="text-[11px] text-slate-400">
                  Payments logged via "Collect Payment" will appear here as due-clearing audit records.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <div
                    key={p.payment_id}
                    className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 font-mono">
                          Receipt #{p.payment_id}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs text-slate-500 font-medium">
                          {formatDate(p.pay_date)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {p.note || 'Due clearance payment'}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-bold font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        -{formatCurrency(p.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Purchase Modal */}
      <EntryForm
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        customer={customer}
        onSuccess={handleEntrySuccess}
      />

      {/* Collect Payment Modal */}
      <PaymentForm
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        customer={customer}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
