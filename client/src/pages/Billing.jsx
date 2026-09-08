import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  UserCheck,
  UserPlus,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Receipt,
  RotateCcw,
  IndianRupee,
  ShoppingBag,
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import BillModal from '../components/BillModal';
import Modal from '../components/Modal';

export default function Billing({ preselectedCustomer, onClearPreselected }) {
  const { addToast } = useToast();

  // Customer state
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone_number: '', village: '', address: '' });

  // Medicine state
  const [medicineQuery, setMedicineQuery] = useState('');
  const [medicineResults, setMedicineResults] = useState([]);
  const [isMedDropdownOpen, setIsMedDropdownOpen] = useState(false);

  // Cart state
  const [cart, setCart] = useState([]); // [{ medicineId, name, unitPrice, quantity, stockQty }]
  const [amountPaidInput, setAmountPaidInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Completed sale modal
  const [completedBill, setCompletedBill] = useState(null);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);

  const phoneInputRef = useRef(null);
  const medInputRef = useRef(null);

  // Handle preselected customer from another screen (e.g. Customers page)
  useEffect(() => {
    if (preselectedCustomer) {
      setSelectedCustomer(preselectedCustomer);
      if (onClearPreselected) onClearPreselected();
    }
  }, [preselectedCustomer, onClearPreselected]);

  // Customer Search debounce
  useEffect(() => {
    if (!customerSearchQuery.trim()) {
      setCustomerSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await api.searchCustomers(customerSearchQuery);
        setCustomerSearchResults(results);
        setIsCustomerSearchOpen(true);
      } catch (err) {
        console.error('Error searching customers:', err);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [customerSearchQuery]);

  // Medicine Search debounce
  useEffect(() => {
    if (!medicineQuery.trim()) {
      setMedicineResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await api.searchMedicines(medicineQuery);
        setMedicineResults(results);
        setIsMedDropdownOpen(true);
      } catch (err) {
        console.error('Error searching medicines:', err);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [medicineQuery]);

  // Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const billTotal = Math.round(cartSubtotal * 100) / 100;
  const parsedPaid = amountPaidInput === '' ? billTotal : parseFloat(amountPaidInput) || 0;
  const liveDueCreated = Math.max(0, Math.round((billTotal - parsedPaid) * 100) / 100);

  // Add medicine to cart
  const addToCart = (med) => {
    if (med.stock_qty <= 0) {
      addToast(`"${med.name}" is out of stock!`, 'error');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.medicineId === med.medicine_id);
      if (existing) {
        if (existing.quantity >= med.stock_qty) {
          addToast(`Cannot add more. Only ${med.stock_qty} in stock for "${med.name}"`, 'warning');
          return prev;
        }
        return prev.map((i) =>
          i.medicineId === med.medicine_id ? { ...i, quantity: i.quantity + 1 } : i
        );
      } else {
        return [
          ...prev,
          {
            medicineId: med.medicine_id,
            name: med.name,
            unitPrice: med.unit_price,
            quantity: 1,
            stockQty: med.stock_qty,
          },
        ];
      }
    });

    setMedicineQuery('');
    setIsMedDropdownOpen(false);
    if (medInputRef.current) medInputRef.current.focus();
  };

  const updateQuantity = (medicineId, newQty) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.medicineId !== medicineId) return item;
          const clamped = Math.max(1, Math.min(item.stockQty, newQty));
          if (newQty > item.stockQty) {
            addToast(`Max available stock for "${item.name}" is ${item.stockQty}`, 'warning');
          }
          return { ...item, quantity: clamped };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (medicineId) => {
    setCart((prev) => prev.filter((i) => i.medicineId !== medicineId));
  };

  const handleQuickAddCustomer = async (e) => {
    e.preventDefault();
    try {
      const created = await api.createCustomer(newCustomerForm);
      setSelectedCustomer(created);
      setIsAddCustomerModalOpen(false);
      setCustomerSearchQuery('');
      setNewCustomerForm({ name: '', phone_number: '', village: '', address: '' });
      addToast(`Customer "${created.name}" registered successfully!`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleCheckout = async () => {
    if (!selectedCustomer) {
      addToast('Please select or add a customer first', 'warning');
      return;
    }

    if (cart.length === 0) {
      addToast('Cart is empty. Add at least one medicine.', 'warning');
      return;
    }

    const payloadPaid = amountPaidInput === '' ? billTotal : parseFloat(amountPaidInput) || 0;

    setIsSubmitting(true);
    try {
      const result = await api.createTransaction({
        customerId: selectedCustomer.customer_id,
        items: cart.map((i) => ({ medicineId: i.medicineId, quantity: i.quantity })),
        amountPaid: payloadPaid,
      });

      setCompletedBill(result);
      setIsBillModalOpen(true);
      // Reset cart and paid input
      setCart([]);
      setAmountPaidInput('');
    } catch (err) {
      addToast('Transaction failed: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextSale = () => {
    setSelectedCustomer(null);
    setCart([]);
    setAmountPaidInput('');
    setCustomerSearchQuery('');
    if (phoneInputRef.current) phoneInputRef.current.focus();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-teal-700" />
            <span>Counter Billing & POS</span>
          </h1>
          <p className="text-xs text-slate-500">
            Speed-optimized counter checkout with live stock validation and instant due calculation.
          </p>
        </div>

        {cart.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm('Clear current cart?')) {
                setCart([]);
                setAmountPaidInput('');
              }
            }}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 self-start sm:self-auto py-1 px-2.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Cart</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Customer Selection + Medicine Entry + Cart Items (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* STEP 1: Customer Card */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Step 1: Patient / Customer</span>
              {selectedCustomer && (
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-xs text-teal-700 hover:text-teal-900 font-medium"
                >
                  Change Customer
                </button>
              )}
            </div>

            {!selectedCustomer ? (
              <div className="relative">
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    ref={phoneInputRef}
                    type="text"
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    onFocus={() => setIsCustomerSearchOpen(true)}
                    placeholder="Search customer by 10-digit mobile number or name..."
                    className="w-full pl-10 pr-24 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setNewCustomerForm({ name: '', phone_number: customerSearchQuery.replace(/\D/g, ''), village: '', address: '' });
                      setIsAddCustomerModalOpen(true);
                    }}
                    className="absolute right-1.5 flex items-center gap-1 px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg text-xs font-medium transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Quick Add</span>
                  </button>
                </div>

                {/* Dropdown search results */}
                {isCustomerSearchOpen && customerSearchQuery.trim() && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 divide-y divide-slate-100 z-40 max-h-56 overflow-y-auto">
                    {customerSearchResults.length === 0 ? (
                      <div className="p-4 text-center">
                        <p className="text-xs text-slate-500">No customer found with "{customerSearchQuery}"</p>
                        <button
                          onClick={() => {
                            setNewCustomerForm({ name: '', phone_number: customerSearchQuery.replace(/\D/g, ''), village: '', address: '' });
                            setIsAddCustomerModalOpen(true);
                            setIsCustomerSearchOpen(false);
                          }}
                          className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Register New Customer</span>
                        </button>
                      </div>
                    ) : (
                      customerSearchResults.map((c) => (
                        <div
                          key={c.customer_id}
                          onClick={() => {
                            setSelectedCustomer(c);
                            setIsCustomerSearchOpen(false);
                            setCustomerSearchQuery('');
                          }}
                          className="p-3 hover:bg-teal-50/70 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-900">{c.name}</p>
                            <p className="text-[11px] text-slate-500">
                              Ph: <span className="font-mono text-slate-700">{c.phone_number}</span> {c.village ? `• Village: ${c.village}` : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${c.total_due > 0 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
                              Due: ₹{c.total_due?.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Selected Customer Pill */
              <div className="flex items-center justify-between bg-teal-50/70 border border-teal-200/80 rounded-xl p-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-700 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>{selectedCustomer.name}</span>
                      {selectedCustomer.village && (
                        <span className="text-[11px] font-normal text-teal-800 bg-teal-100/70 px-2 py-0.5 rounded-full">
                          {selectedCustomer.village}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-600 font-mono mt-0.5">
                      Ph: {selectedCustomer.phone_number} {selectedCustomer.address ? `• ${selectedCustomer.address}` : ''}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Existing Due</p>
                  <p className={`text-sm font-bold font-mono ${selectedCustomer.total_due > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                    ₹{selectedCustomer.total_due?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: Medicine Search & Cart Items */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4.5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Step 2: Add Medicines to Cart</span>
              <span className="text-xs text-slate-500 font-medium">{cart.length} item{cart.length !== 1 ? 's' : ''} added</span>
            </div>

            {/* Medicine Autocomplete Input */}
            <div className="relative">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  ref={medInputRef}
                  type="text"
                  value={medicineQuery}
                  onChange={(e) => setMedicineQuery(e.target.value)}
                  onFocus={() => setIsMedDropdownOpen(true)}
                  placeholder="Type medicine name to add (e.g. Paracetamol, Novamox, Cetirizine)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white transition-all"
                />
              </div>

              {isMedDropdownOpen && medicineQuery.trim() && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 divide-y divide-slate-100 z-40 max-h-60 overflow-y-auto">
                  {medicineResults.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No medicine matching "{medicineQuery}" in inventory.
                    </div>
                  ) : (
                    medicineResults.map((m) => (
                      <div
                        key={m.medicine_id}
                        onClick={() => addToCart(m)}
                        className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                          m.stock_qty <= 0
                            ? 'bg-slate-50 opacity-60 cursor-not-allowed'
                            : 'hover:bg-teal-50/70'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-900">{m.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-mono font-semibold text-slate-700">₹{m.unit_price.toFixed(2)}</span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                              m.stock_qty <= 0
                                ? 'bg-rose-100 text-rose-800'
                                : m.is_low_stock
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              Stock: {m.stock_qty}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={m.stock_qty <= 0}
                          className="px-2.5 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold disabled:opacity-40"
                        >
                          + Add
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Cart Items List */}
            {cart.length === 0 ? (
              <div className="py-12 border-2 border-dashed border-slate-200 rounded-xl text-center space-y-2">
                <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-medium text-slate-500">Your counter cart is empty</p>
                <p className="text-[11px] text-slate-400">Search above to add medicines</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden">
                <div className="bg-slate-50/80 px-4 py-2 flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <span className="w-1/2">Medicine</span>
                  <span className="w-1/6 text-center">Qty</span>
                  <span className="w-1/6 text-right">Price</span>
                  <span className="w-1/6 text-right">Total</span>
                </div>

                {cart.map((item) => {
                  const lineTotal = item.unitPrice * item.quantity;
                  const isNearStockLimit = item.quantity >= item.stockQty;

                  return (
                    <div key={item.medicineId} className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div className="w-1/2 pr-2">
                        <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">Max stock: {item.stockQty}</p>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="w-1/6 flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => updateQuantity(item.medicineId, item.quantity - 1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          min="1"
                          max={item.stockQty}
                          onChange={(e) => updateQuantity(item.medicineId, parseInt(e.target.value, 10) || 1)}
                          className="w-10 text-center text-xs font-mono font-bold bg-white border border-slate-200 rounded py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-600"
                        />
                        <button
                          onClick={() => updateQuantity(item.medicineId, item.quantity + 1)}
                          disabled={isNearStockLimit}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs transition-colors disabled:opacity-40"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Unit Price */}
                      <div className="w-1/6 text-right font-mono text-xs text-slate-600">
                        ₹{item.unitPrice.toFixed(2)}
                      </div>

                      {/* Line Total & Remove */}
                      <div className="w-1/6 text-right flex items-center justify-end gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          ₹{lineTotal.toFixed(2)}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.medicineId)}
                          className="text-slate-300 hover:text-rose-600 p-1 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Bill Calculation & Checkout Card (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payment & Checkout</h2>

            {/* Bill Summary Breakdown */}
            <div className="space-y-2.5 pb-4 border-b border-slate-100 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal:</span>
                <span className="font-mono font-medium">₹{billTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-900 font-bold text-base pt-1">
                <span>Bill Total:</span>
                <span className="font-mono text-xl text-teal-800">₹{billTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Amount Paid Input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Amount Paid Now (₹)
              </label>
              <div className="relative">
                <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="number"
                  step="any"
                  value={amountPaidInput}
                  onChange={(e) => setAmountPaidInput(e.target.value)}
                  placeholder={billTotal > 0 ? String(billTotal) : '0'}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white transition-all"
                />
              </div>

              {/* Quick shortcut chips */}
              {billTotal > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setAmountPaidInput(String(billTotal))}
                    className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-semibold border border-emerald-200 transition-colors"
                  >
                    Full (₹{billTotal})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmountPaidInput('0')}
                    className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-semibold border border-amber-200 transition-colors"
                  >
                    Full Due (₹0)
                  </button>
                  {billTotal > 50 && (
                    <button
                      type="button"
                      onClick={() => setAmountPaidInput(String(Math.floor(billTotal / 50) * 50))}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-medium transition-colors"
                    >
                      Round ₹{Math.floor(billTotal / 50) * 50}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Live Due Calculation Banner */}
            <div className={`p-3 rounded-xl border ${
              liveDueCreated > 0
                ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
            }`}>
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium">Due Created on this Bill:</span>
                <span className="font-bold font-mono text-sm">₹{liveDueCreated.toFixed(2)}</span>
              </div>
              {liveDueCreated > 0 && (
                <p className="text-[10px] text-amber-700 mt-1">
                  Will be appended to customer's outstanding ledger.
                </p>
              )}
            </div>

            {/* Total Balance Preview if customer selected */}
            {selectedCustomer && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Current Balance:</span>
                  <span className="font-mono">₹{selectedCustomer.total_due?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-slate-200/60">
                  <span>New Balance After Bill:</span>
                  <span className="font-mono text-amber-800">
                    ₹{(selectedCustomer.total_due + liveDueCreated).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="button"
              disabled={isSubmitting || cart.length === 0 || !selectedCustomer}
              onClick={handleCheckout}
              className="w-full py-3.5 px-4 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Processing Bill...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Confirm & Print Bill</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Add Customer Modal */}
      <Modal
        isOpen={isAddCustomerModalOpen}
        onClose={() => setIsAddCustomerModalOpen(false)}
        title="Quick Register Customer"
        subtitle="Add patient details for billing and due ledger tracking"
      >
        <form onSubmit={handleQuickAddCustomer} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Mobile Number (10 digits) *</label>
            <input
              type="tel"
              required
              maxLength={10}
              value={newCustomerForm.phone_number}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone_number: e.target.value.replace(/\D/g, '') })}
              placeholder="e.g. 9848012345"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Customer / Patient Name *</label>
            <input
              type="text"
              required
              value={newCustomerForm.name}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
              placeholder="e.g. Ramesh Kumar"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Village / Town</label>
            <input
              type="text"
              value={newCustomerForm.village}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, village: e.target.value })}
              placeholder="e.g. Rampur"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Address / Landmark</label>
            <input
              type="text"
              value={newCustomerForm.address}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
              placeholder="e.g. Near Hanuman Temple"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddCustomerModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold transition-colors shadow-xs"
            >
              Save & Select Customer
            </button>
          </div>
        </form>
      </Modal>

      {/* Sale Completion & Print Modal */}
      <BillModal
        isOpen={isBillModalOpen}
        onClose={() => setIsBillModalOpen(false)}
        billData={completedBill}
        onNextSale={handleNextSale}
      />
    </div>
  );
}
