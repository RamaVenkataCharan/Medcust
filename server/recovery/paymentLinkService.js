/**
 * Payment Link Service
 * 
 * Generates payment links via Razorpay/Cashfree with case_id embedded in metadata.
 * Triggered by the voice agent when customer verbally commits to pay.
 */

const recoveryConfig = require('./recoveryConfig');
const { generateId } = require('../db/database');

/**
 * Generate a payment link for a case.
 * Embeds case_id in metadata so webhooks can resolve it without ambiguity.
 * 
 * @param {Object} params - { caseId, amount, customerName, phoneNumber, description }
 * @returns {Promise<{ url: string, linkId: string, provider: string }>}
 */
async function generatePaymentLink({ caseId, amount, customerName, phoneNumber, description }) {
  // Try Razorpay first, then Cashfree, then mock
  if (recoveryConfig.RAZORPAY_KEY_ID && recoveryConfig.RAZORPAY_KEY_SECRET) {
    return _generateRazorpayLink({ caseId, amount, customerName, phoneNumber, description });
  }

  if (recoveryConfig.CASHFREE_APP_ID && recoveryConfig.CASHFREE_SECRET_KEY) {
    return _generateCashfreeLink({ caseId, amount, customerName, phoneNumber, description });
  }

  // Mock fallback
  return _generateMockLink({ caseId, amount, customerName });
}

// ── Razorpay ──

async function _generateRazorpayLink({ caseId, amount, customerName, phoneNumber, description }) {
  try {
    const response = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(
          `${recoveryConfig.RAZORPAY_KEY_ID}:${recoveryConfig.RAZORPAY_KEY_SECRET}`
        ).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Razorpay expects paise
        currency: 'INR',
        description: description || `Payment for outstanding dues - ${caseId}`,
        customer: {
          name: customerName,
          contact: phoneNumber,
        },
        notify: {
          sms: true,
          email: false,
        },
        notes: {
          case_id: caseId,           // ← This is how webhooks resolve back to our case
          source: 'ai_recovery',
        },
        callback_url: '',
        callback_method: 'get',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.description || 'Razorpay link creation failed');
    }

    return {
      url: data.short_url,
      linkId: data.id,
      provider: 'razorpay',
    };
  } catch (err) {
    console.error('[PaymentLink] Razorpay error:', err.message);
    throw err;
  }
}

// ── Cashfree ──

async function _generateCashfreeLink({ caseId, amount, customerName, phoneNumber, description }) {
  try {
    const orderId = `recovery_${caseId}_${Date.now()}`;

    const response = await fetch('https://sandbox.cashfree.com/pg/links', {
      method: 'POST',
      headers: {
        'x-client-id': recoveryConfig.CASHFREE_APP_ID,
        'x-client-secret': recoveryConfig.CASHFREE_SECRET_KEY,
        'x-api-version': '2023-08-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        link_id: orderId,
        link_amount: amount,
        link_currency: 'INR',
        link_purpose: description || `Outstanding dues recovery`,
        customer_details: {
          customer_name: customerName,
          customer_phone: phoneNumber,
        },
        link_meta: {
          case_id: caseId,           // ← Webhook resolution key
          source: 'ai_recovery',
        },
        link_notify: {
          send_sms: true,
          send_email: false,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Cashfree link creation failed');
    }

    return {
      url: data.link_url,
      linkId: data.link_id,
      provider: 'cashfree',
    };
  } catch (err) {
    console.error('[PaymentLink] Cashfree error:', err.message);
    throw err;
  }
}

// ── Mock ──

async function _generateMockLink({ caseId, amount, customerName }) {
  const linkId = generateId('link_');
  const url = `https://pay.mock.local/${linkId}?amount=${amount}&case=${caseId}`;

  console.log(`[Mock PaymentLink] Generated for ${customerName}: ${url}`);

  return {
    url,
    linkId,
    provider: 'mock',
  };
}

module.exports = { generatePaymentLink };
