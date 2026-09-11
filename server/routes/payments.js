const express = require('express');
const router = express.Router();
const { getDb, recordPayment, getCustomerDue } = require('../db/database');

/**
 * POST /api/payments
 * Record payment to reduce customer due
 */
router.post('/', (req, res) => {
  try {
    const { customer_id, customerId, amount, note, allowOverpayment, allow_overpayment } = req.body;

    const targetCustomerId = parseInt(customer_id || customerId, 10);
    if (!targetCustomerId) {
      return res.status(400).json({ error: 'Valid customer_id is required' });
    }

    const cleanAmount = parseFloat(amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0' });
    }

    const currentDue = getCustomerDue(targetCustomerId);
    const allowOverride = allowOverpayment || allow_overpayment;

    if (cleanAmount > currentDue && !allowOverride) {
      return res.status(400).json({
        error: `Payment of ₹${cleanAmount.toFixed(2)} exceeds current due of ₹${currentDue.toFixed(2)}`,
        exceedsDue: true,
        currentDue,
        attemptedAmount: cleanAmount,
        overage: Math.round((cleanAmount - currentDue) * 100) / 100,
      });
    }

    const result = recordPayment({
      customerId: targetCustomerId,
      amount: cleanAmount,
      note: note || 'Cash counter settlement',
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Record payment error:', err);
    res.status(400).json({ error: err.message || 'Failed to record payment' });
  }
});

/**
 * GET /api/payments?customer_id={id}
 * List payments for customer (or all recent payments)
 */
router.get('/', (req, res) => {
  try {
    const customerId = req.query.customer_id || req.query.customerId;
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 30);
    const db = getDb();

    let query = `
      SELECT
        p.payment_id,
        p.customer_id,
        p.pay_date,
        p.amount,
        p.note,
        c.name AS customer_name,
        c.phone_number,
        c.village
      FROM payments p
      JOIN customers c ON p.customer_id = c.customer_id
    `;
    const params = [];

    if (customerId) {
      query += ` WHERE p.customer_id = ?`;
      params.push(parseInt(customerId, 10));
    }

    query += ` ORDER BY p.pay_date DESC, p.payment_id DESC LIMIT ?`;
    params.push(limit);

    const payments = db.prepare(query).all(...params);
    res.json(payments);
  } catch (err) {
    console.error('List payments error:', err);
    res.status(500).json({ error: 'Failed to retrieve payments' });
  }
});

/**
 * GET /api/payments/pay-link?customer_id={id}&amount={amt}
 * Mobile-friendly payment landing page for WhatsApp & SMS links
 */
router.get('/pay-link', (req, res) => {
  try {
    const customerId = parseInt(req.query.customer_id, 10);
    const amount = parseFloat(req.query.amount);

    if (!customerId) {
      return res.status(400).send('<h3>Invalid or expired payment link. Please contact the pharmacy counter.</h3>');
    }

    const db = getDb();
    const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customerId);
    if (!customer) {
      return res.status(404).send('<h3>Customer record not found.</h3>');
    }

    const currentDue = getCustomerDue(customerId);
    const payAmount = !isNaN(amount) && amount > 0 ? Math.min(amount, currentDue) : currentDue;
    const upiId = process.env.SHOP_UPI_ID || 'medtrack@upi';
    const shopName = process.env.SHOP_NAME || 'MedTrack Pharmacy';
    const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${payAmount}&tr=MED_${customerId}_${Date.now()}&tn=${encodeURIComponent(`Bill Payment - ${customer.name}`)}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${shopName} — Online Bill Payment</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-50 min-h-screen flex items-center justify-center p-4 text-slate-800 font-sans">
  <div class="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden p-6 sm:p-8 space-y-6">
    <div class="text-center space-y-1">
      <span class="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-wider">
        Official Store Payment
      </span>
      <h1 class="text-2xl font-bold text-slate-900">${shopName}</h1>
      <p class="text-xs text-slate-500">Khata Bill Due Clearance</p>
    </div>

    <div class="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
      <div class="flex justify-between items-center text-xs text-slate-500">
        <span>Customer Name</span>
        <span class="font-semibold text-slate-800">${customer.name}</span>
      </div>
      <div class="flex justify-between items-center text-xs text-slate-500">
        <span>Mobile Number</span>
        <span class="font-mono text-slate-700">${customer.phone_number}</span>
      </div>
      <div class="flex justify-between items-center text-xs text-slate-500">
        <span>Current Outstanding</span>
        <span class="font-mono font-bold text-rose-600">₹${currentDue.toFixed(2)}</span>
      </div>
      <div class="border-t border-slate-200 pt-3 flex justify-between items-center">
        <span class="text-sm font-bold text-slate-900">Amount to Pay</span>
        <span class="text-2xl font-extrabold font-mono text-emerald-600">₹${payAmount.toFixed(2)}</span>
      </div>
    </div>

    <div class="space-y-3">
      <a href="${upiLink}" class="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md shadow-emerald-600/20 transition-all text-sm">
        <span>⚡ Pay via UPI (GPay / PhonePe / Paytm)</span>
      </a>

      <button id="simBtn" onclick="simulatePayment()" class="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-3 px-4 rounded-xl text-xs transition-all border border-indigo-200">
        ✓ Simulate Immediate Test Payment (₹${payAmount.toFixed(2)})
      </button>
    </div>

    <div id="statusMsg" class="hidden text-center text-xs font-semibold py-2 px-3 rounded-lg"></div>

    <div class="border-t border-slate-100 pt-4 text-center text-[11px] text-slate-400 space-y-1">
      <p>Need help or have questions about your bill?</p>
      <p class="font-medium text-slate-600">Visit our store counter or call us directly.</p>
    </div>
  </div>

  <script>
    async function simulatePayment() {
      const btn = document.getElementById('simBtn');
      const msg = document.getElementById('statusMsg');
      btn.disabled = true;
      btn.innerText = 'Processing payment...';

      try {
        const res = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: ${customerId},
            amount: ${payAmount},
            note: 'Paid via Courtesy Reminder Link (UPI)'
          })
        });

        if (res.ok) {
          msg.className = 'text-center text-xs font-semibold py-3 px-4 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 block';
          msg.innerText = 'Payment of ₹${payAmount.toFixed(2)} successful! Khata updated.';
          btn.style.display = 'none';
        } else {
          const err = await res.json();
          msg.className = 'text-center text-xs font-semibold py-3 px-4 rounded-xl bg-rose-100 text-rose-800 border border-rose-300 block';
          msg.innerText = err.error || 'Payment failed';
          btn.disabled = false;
          btn.innerText = 'Try Again';
        }
      } catch (e) {
        msg.className = 'text-center text-xs font-semibold py-3 px-4 rounded-xl bg-rose-100 text-rose-800 border border-rose-300 block';
        msg.innerText = 'Network error: ' + e.message;
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`;

    res.send(html);
  } catch (err) {
    console.error('Pay link error:', err);
    res.status(500).send('Internal error generating payment link');
  }
});

module.exports = router;
