import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  UserPlus,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  ShoppingCart,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  Edit2,
  Pill,
  ArrowRight,
  Receipt,
  Printer,
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

export default function Customers({ selectedCustomerId, onNewSaleForCustomer, onCollectPaymentForCustomer }) {
  const { addToast } = useToast();
  const searchInputRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);

  // Transactions pagination
  const [transactions, setTransactions] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedTxnId, setExpandedTxnId] = useState(null);

  // Payment history
  const [payments, setPayments] = useState([]);
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'payments'

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: '', phone_number: '', village: '', address: '' });

  // Auto-focus search input on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Keyboard shortcut '/' to search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        if (searchInputRef.current) searchInputRef.current.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle selectedCustomerId from prop
  useEffect(() => {
    if (selectedCustomerId) {
      loadCustomerDetails(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  // Live search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.searchCustomers(searchQuery);
        setSearchResults(res);
      } catch (err) {
        console.error('Search customers error:', err);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadCustomerDetails = async (id) => {
    try {
      const details = await api.getCustomer(id);
      setSelectedCustomer(details);
      setCustomerDetails(details);
      loadCustomerTransactions(id, 1);
      loadCustomerPayments(id);
    } catch (err) {
      addToast('Failed to load customer: ' + err.message, 'error');
    }
  };

  const loadCustomerTransactions = async (id, pageNum) => {
    try {
      const data = await api.getCustomerTransactions(id, pageNum, 10);
      setTransactions(data.transactions || []);
      setPage(data.page || 1);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
  };

  const loadCustomerPayments = async (id) => {
    try {
      const data = await api.getCustomerPayments(id);
      setPayments(data || []);
    } catch (err) {
      console.error('Failed to load payments:', err);
    }
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      const created = await api.createCustomer(customerForm);
      addToast(`Customer "${created.name}" created!`, 'success');
      setIsAddModalOpen(false);
      setCustomerForm({ name: '', phone_number: '', village: '', address: '' });
      loadCustomerDetails(created.customer_id);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    try {
      const updated = await api.updateCustomer(selectedCustomer.customer_id, customerForm);
      addToast('Customer details updated!', 'success');
      setIsEditModalOpen(false);
      loadCustomerDetails(updated.customer_id);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const openEditModal = () => {
    setCustomerForm({
      name: selectedCustomer.name,
      phone_number: selectedCustomer.phone_number,
      village: selectedCustomer.village || '',
      address: selectedCustomer.address || '',
    });
    setIsEditModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Search Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 max-w-xl relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by 10-digit mobile number or name (Press '/' to focus)..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white transition-all"
          />
        </div>

        <button
          onClick={() => {
            setCustomerForm({ name: '', phone_number: searchQuery.replace(/\D/g, ''), village: '', address: '' });
            setIsAddModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Customer Directory / Search Results List (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>{searchQuery ? `Matching Results (${searchResults.length})` : 'Search Customer'}</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
            {searchQuery && searchResults.length === 0 && (
              <div className="p-8 text-center space-y-2">
                <p className="text-xs text-slate-500">No customers found</p>
                <button
                  onClick={() => {
                    setCustomerForm({ name: '', phone_number: searchQuery.replace(/\D/g, ''), village: '', address: '' });
                    setIsAddModalOpen(true);
                  }}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-900"
                >
                  + Add "{searchQuery}" as new customer
                </button>
              </div>
            )}

            {!searchQuery && !selectedCustomer && (
              <div className="p-8 text-center space-y-2 text-slate-400">
                <Phone className="w-7 h-7 mx-auto opacity-50 text-teal-600" />
                <p className="text-xs font-medium text-slate-500">Type mobile number above</p>
                <p className="text-[11px]">Instant 2-second ledger lookup</p>
              </div>
            )}

            {searchResults.map((c) => {
              const isSelected = selectedCustomer?.customer_id === c.customer_id;
              return (
                <div
                  key={c.customer_id}
                  onClick={() => loadCustomerDetails(c.customer_id)}
                  className={`p-4 cursor-pointer transition-colors ${
                    isSelected ? 'bg-teal-50/80 border-l-4 border-teal-700' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{c.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {c.phone_number} {c.village ? `• ${c.village}` : ''}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded ${
                        c.total_due > 0 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                      }`}>
                        Due: ₹{c.total_due?.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Customer Comprehensive Profile View (8 cols) */}
        <div className="lg:col-span-8">
          {!selectedCustomer ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-16 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto">
                <Search className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Select a Customer to View Ledger</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Search by 10-digit mobile number or name to view purchase history, due balances, and recent medicines.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Customer Header Card */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-900">{customerDetails.name}</h2>
                      <button
                        onClick={openEditModal}
                        className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100"
                        title="Edit Customer Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-2">
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {customerDetails.phone_number}
                      </span>
                      {customerDetails.village && (
                        <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {customerDetails.village}
                        </span>
                      )}
                      {customerDetails.address && (
                        <span className="text-slate-500 truncate max-w-xs">{customerDetails.address}</span>
                      )}
                    </div>
                  </div>

                  {/* Total Due Banner */}
                  <div className={`p-4 rounded-xl border text-right min-w-[160px] ${
                    customerDetails.total_due > 0
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider block">Outstanding Due</span>
                    <span className="text-2xl font-bold font-mono block mt-0.5">
                      ₹{customerDetails.total_due?.toFixed(2)}
                    </span>
                    <span className="text-[10px] font-medium opacity-80 block">
                      {customerDetails.total_due > 0 ? 'Pending Payment' : 'Fully Settled'}
                    </span>
                  </div>
                </div>

                {/* Counter Profile Stats & Quick Actions Bar */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div>
                      <span className="font-semibold text-slate-900">{customerDetails.total_visits}</span> visits
                    </div>
                    <div>
                      Lifetime: <span className="font-semibold text-slate-900 font-mono">₹{customerDetails.total_spend?.toFixed(2)}</span>
                    </div>
                    {customerDetails.last_visit_date && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Last: {new Date(customerDetails.last_visit_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onNewSaleForCustomer && onNewSaleForCustomer(customerDetails)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>New Bill</span>
                    </button>

                    {customerDetails.total_due > 0 && (
                      <button
                        onClick={() => onCollectPaymentForCustomer && onCollectPaymentForCustomer(customerDetails)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300/80 rounded-xl text-xs font-semibold transition-colors shadow-xs"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-amber-700" />
                        <span>Collect Due</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* "Recently Bought" Strip (Last 3 distinct medicines) */}
              {customerDetails.recent_medicines?.length > 0 && (
                <div className="bg-teal-50/60 border border-teal-200/80 rounded-2xl p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900 uppercase tracking-wider mb-2.5">
                    <Pill className="w-4 h-4 text-teal-700" />
                    <span>Frequently / Recently Purchased Medicines</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {customerDetails.recent_medicines.map((m, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-xl border border-teal-100 shadow-2xs">
                        <p className="text-xs font-bold text-slate-900 truncate">{m.name}</p>
                        <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1">
                          <span className="font-mono">₹{m.lastPrice?.toFixed(2)}</span>
                          <span className="font-medium text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded">
                            {m.daysAgo === 0 ? 'Today' : `${m.daysAgo}d ago`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transactions & Payments Tabs */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="flex border-b border-slate-100 bg-slate-50/50 px-4">
                  <button
                    onClick={() => setActiveTab('transactions')}
                    className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
                      activeTab === 'transactions'
                        ? 'border-teal-700 text-teal-900'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Visit & Purchase History ({transactions.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('payments')}
                    className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
                      activeTab === 'payments'
                        ? 'border-teal-700 text-teal-900'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Due Clearances / Payments ({payments.length})</span>
                  </button>
                </div>

                {/* Tab 1: Transactions with expandable line items */}
                {activeTab === 'transactions' && (
                  <div>
                    {transactions.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">No visits on record yet.</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {transactions.map((t) => {
                          const isExpanded = expandedTxnId === t.transaction_id;
                          return (
                            <div key={t.transaction_id} className="p-4 hover:bg-slate-50/60 transition-colors">
                              <div
                                onClick={() => setExpandedTxnId(isExpanded ? null : t.transaction_id)}
                                className="flex items-center justify-between cursor-pointer"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-mono font-bold text-xs">
                                    #{t.transaction_id}
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-900">
                                      {new Date(t.txn_date).toLocaleDateString()} • {new Date(t.txn_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                      {t.items?.length || 0} medicines purchased
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-4 text-right">
                                  <div>
                                    <p className="text-xs font-bold font-mono text-slate-900">₹{t.bill_total.toFixed(2)}</p>
                                    <div className="text-[10px] space-x-1.5">
                                      <span className="text-emerald-700 font-medium font-mono">Paid: ₹{t.amount_paid.toFixed(2)}</span>
                                      {t.due_amount > 0 && (
                                        <span className="text-amber-800 font-bold font-mono">Due: ₹{t.due_amount.toFixed(2)}</span>
                                      )}
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(`/api/transactions/${t.transaction_id}/pdf`, '_blank');
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Print PDF Invoice"
                                  >
                                    <Printer className="w-4 h-4" />
                                  </button>

                                  <div className="text-slate-400">
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </div>
                                </div>
                              </div>

                              {/* Expanded Line Items */}
                              {isExpanded && (
                                <div className="mt-3 pt-3 border-t border-slate-100 pl-11 pr-2 space-y-1.5">
                                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex justify-between pb-1">
                                    <span>Medicine</span>
                                    <span>Qty × Price = Amount</span>
                                  </div>
                                  {t.items?.map((item) => (
                                    <div key={item.item_id} className="flex justify-between text-xs text-slate-700">
                                      <span>{item.medicine_name}</span>
                                      <span className="font-mono">
                                        {item.quantity} × ₹{item.price_each.toFixed(2)} = ₹{item.line_total.toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                        <span>Page {page} of {totalPages}</span>
                        <div className="flex gap-2">
                          <button
                            disabled={page <= 1}
                            onClick={() => loadCustomerTransactions(selectedCustomer.customer_id, page - 1)}
                            className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg disabled:opacity-40"
                          >
                            Previous
                          </button>
                          <button
                            disabled={page >= totalPages}
                            onClick={() => loadCustomerTransactions(selectedCustomer.customer_id, page + 1)}
                            className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg disabled:opacity-40"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Standalone Payments History */}
                {activeTab === 'payments' && (
                  <div>
                    {payments.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        No standalone due payments logged. Dues are created during sales and cleared via "Collect Due".
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {payments.map((p) => (
                          <div key={p.payment_id} className="p-4 flex items-center justify-between hover:bg-slate-50/60">
                            <div>
                              <p className="text-xs font-bold text-slate-900">
                                Payment #{p.payment_id} • {new Date(p.pay_date).toLocaleDateString()}
                              </p>
                              <p className="text-[11px] text-slate-500">{p.note || 'Due clearance'}</p>
                            </div>

                            <div className="text-right">
                              <span className="text-sm font-bold font-mono text-emerald-700">
                                -₹{p.amount.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New Customer"
        subtitle="Quick entry for counter billing and due tracking"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Mobile Number (10 digits) *</label>
            <input
              type="tel"
              required
              maxLength={10}
              value={customerForm.phone_number}
              onChange={(e) => setCustomerForm({ ...customerForm, phone_number: e.target.value.replace(/\D/g, '') })}
              placeholder="e.g. 9848012345"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Customer / Patient Name *</label>
            <input
              type="text"
              required
              value={customerForm.name}
              onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
              placeholder="e.g. Ramesh Kumar"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Village / Town</label>
            <input
              type="text"
              value={customerForm.village}
              onChange={(e) => setCustomerForm({ ...customerForm, village: e.target.value })}
              placeholder="e.g. Rampur"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Address / Landmark</label>
            <input
              type="text"
              value={customerForm.address}
              onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
              placeholder="e.g. Near Hanuman Temple"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold shadow-xs"
            >
              Save Customer
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Customer Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Customer Details"
        subtitle="Update customer profile without breaking historical transaction ledger"
      >
        <form onSubmit={handleUpdateCustomer} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Mobile Number (10 digits) *</label>
            <input
              type="tel"
              required
              maxLength={10}
              value={customerForm.phone_number}
              onChange={(e) => setCustomerForm({ ...customerForm, phone_number: e.target.value.replace(/\D/g, '') })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Customer Name *</label>
            <input
              type="text"
              required
              value={customerForm.name}
              onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Village / Town</label>
            <input
              type="text"
              value={customerForm.village}
              onChange={(e) => setCustomerForm({ ...customerForm, village: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Address</label>
            <input
              type="text"
              value={customerForm.address}
              onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold shadow-xs"
            >
              Update Profile
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
