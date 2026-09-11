/**
 * Webhook Routes — Payment provider webhook handlers
 * 
 * Razorpay and Cashfree webhooks with:
 * - HMAC signature verification (reject + log on failure)
 * - Idempotent event processing (no duplicate PaymentEvents)
 * - Case state updates (RECOVERED for full, PARTIAL for partial)
 * - Promise-to-pay timer cancellation on successful payment
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const recoveryConfig = require('../recovery/recoveryConfig');
const {
  createPaymentEvent,
  updateCaseState,
  writeAuditTrail,
  getDb,
} = require('../db/database');
const { liveEvents } = require('../recovery/telephonyBridge');

// ══════════════════════════════════════════════════════════
// Razorpay Webhook
// ══════════════════════════════════════════════════════════

router.post('/razorpay', express.raw({ type: '*/*' }), (req, res) => {
  const rawBody = typeof req.body === 'string' ? req.body : req.body.toString('utf8');

  // ── Signature Verification ──
  const signature = req.headers['x-razorpay-signature'];
  if (!verifyRazorpaySignature(rawBody, signature)) {
    console.error('[Webhook] Razorpay signature verification FAILED');
    writeAuditTrail({
      entityType: 'webhook',
      entityId: `razorpay_rejected_${Date.now()}`,
      action: 'SIGNATURE_REJECTED',
      details: JSON.stringify({
        provider: 'razorpay',
        signature: signature || 'missing',
        timestamp: new Date().toISOString(),
      }),
    });
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const entity = payload.payload?.payment?.entity;

    if (!entity) {
      return res.status(400).json({ error: 'Missing payment entity' });
    }

    const eventId = entity.id || `rzp_${Date.now()}`;
    const caseId = entity.notes?.case_id;
    const customerId = entity.notes?.customer_id ? parseInt(entity.notes.customer_id, 10) : null;
    const amount = (entity.amount || 0) / 100; // Convert from paise
    const status = mapRazorpayStatus(entity.status);

    // Auto-reconcile customer khata ledger if customer_id present and payment successful
    if (customerId && status === 'SUCCESS') {
      try {
        const { recordPayment } = require('../db/database');
        recordPayment({
          customerId,
          amount,
          note: `Online Payment (Razorpay: ${eventId})`,
        });
        console.log(`[Webhook] Reconciled ₹${amount} to customer ${customerId} ledger`);
      } catch (e) {
        console.warn(`[Webhook] Ledger auto-reconcile notice for customer ${customerId}:`, e.message);
      }
    }

    if (!caseId) {
      console.log('[Webhook] Razorpay event processed for customer:', customerId || 'unknown', eventId);
      writeAuditTrail({
        entityType: 'webhook',
        entityId: eventId,
        action: customerId ? 'CUSTOMER_PAYMENT_RECONCILED' : 'UNRESOLVED_CASE',
        details: JSON.stringify({ provider: 'razorpay', amount, customerId, event }),
      });
      return res.status(200).json({ received: true, customerId, reconciled: !!customerId });
    }

    // ── Idempotent Processing ──
    const result = processPaymentEvent({
      eventId,
      caseId,
      provider: 'razorpay',
      amount,
      status,
      rawPayload: rawBody,
    });

    res.status(200).json({ received: true, ...result });
  } catch (err) {
    console.error('[Webhook] Razorpay processing error:', err.message);
    res.status(500).json({ error: 'Processing failed' });
  }
});

// ══════════════════════════════════════════════════════════
// Cashfree Webhook
// ══════════════════════════════════════════════════════════

router.post('/cashfree', express.raw({ type: '*/*' }), (req, res) => {
  const rawBody = typeof req.body === 'string' ? req.body : req.body.toString('utf8');

  // ── Signature Verification ──
  const signature = req.headers['x-cashfree-signature'];
  const timestamp = req.headers['x-cashfree-timestamp'];
  if (!verifyCashfreeSignature(rawBody, timestamp, signature)) {
    console.error('[Webhook] Cashfree signature verification FAILED');
    writeAuditTrail({
      entityType: 'webhook',
      entityId: `cashfree_rejected_${Date.now()}`,
      action: 'SIGNATURE_REJECTED',
      details: JSON.stringify({
        provider: 'cashfree',
        signature: signature || 'missing',
        timestamp: new Date().toISOString(),
      }),
    });
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    const payload = JSON.parse(rawBody);
    const data = payload.data || {};
    const order = data.order || {};
    const payment = data.payment || {};

    const eventId = payment.cf_payment_id?.toString() || `cf_${Date.now()}`;
    const caseId = order.order_meta?.case_id || data.link_meta?.case_id;
    const customerId = order.order_meta?.customer_id ? parseInt(order.order_meta.customer_id, 10) : null;
    const amount = parseFloat(payment.payment_amount || order.order_amount || 0);
    const status = mapCashfreeStatus(payment.payment_status || order.order_status);

    // Auto-reconcile customer khata ledger if customer_id present and payment successful
    if (customerId && status === 'SUCCESS') {
      try {
        const { recordPayment } = require('../db/database');
        recordPayment({
          customerId,
          amount,
          note: `Online Payment (Cashfree: ${eventId})`,
        });
        console.log(`[Webhook] Reconciled ₹${amount} to customer ${customerId} ledger`);
      } catch (e) {
        console.warn(`[Webhook] Ledger auto-reconcile notice for customer ${customerId}:`, e.message);
      }
    }

    if (!caseId) {
      console.log('[Webhook] Cashfree event processed for customer:', customerId || 'unknown', eventId);
      writeAuditTrail({
        entityType: 'webhook',
        entityId: eventId,
        action: customerId ? 'CUSTOMER_PAYMENT_RECONCILED' : 'UNRESOLVED_CASE',
        details: JSON.stringify({ provider: 'cashfree', amount, customerId }),
      });
      return res.status(200).json({ received: true, customerId, reconciled: !!customerId });
    }

    const result = processPaymentEvent({
      eventId,
      caseId,
      provider: 'cashfree',
      amount,
      status,
      rawPayload: rawBody,
    });

    res.status(200).json({ received: true, ...result });
  } catch (err) {
    console.error('[Webhook] Cashfree processing error:', err.message);
    res.status(500).json({ error: 'Processing failed' });
  }
});

// ══════════════════════════════════════════════════════════
// Shared Processing Logic
// ══════════════════════════════════════════════════════════

/**
 * Process a payment event: create PaymentEvent, update Case state.
 * Idempotent — duplicate event IDs are safely rejected.
 */
function processPaymentEvent({ eventId, caseId, provider, amount, status, rawPayload }) {
  // Store raw payload for audit
  const rawRef = storeRawPayload(eventId, rawPayload);

  // Create PaymentEvent (idempotent)
  const { created, paymentEvent } = createPaymentEvent({
    eventId,
    caseId,
    provider,
    amount,
    status,
    receivedAt: new Date().toISOString(),
    rawPayloadRef: rawRef,
  });

  if (!created) {
    console.log(`[Webhook] Duplicate event ${eventId} — idempotency check caught it`);
    return { duplicate: true, eventId };
  }

  // ── Update Case State on SUCCESS ──
  if (status === 'SUCCESS') {
    try {
      const db = getDb();
      const caseData = db.prepare('SELECT * FROM cases WHERE case_id = ?').get(caseId);

      if (caseData) {
        const newRecovered = (caseData.amount_recovered || 0) + amount;
        const isFullPayment = newRecovered >= caseData.total_due;

        const targetState = isFullPayment ? 'RECOVERED' : 'PARTIAL';

        // Only transition if the target state is valid from current state
        const validFromStates = {
          'RECOVERED': ['PROMISED', 'PARTIAL', 'CONTACTED'],
          'PARTIAL': ['PROMISED', 'CONTACTED'],
        };

        if (validFromStates[targetState]?.includes(caseData.state)) {
          updateCaseState(caseId, targetState, {
            amount_recovered: Math.round(newRecovered * 100) / 100,
            // Clear promise deadline if we're resolving the case
            promise_pay_by: targetState === 'RECOVERED' ? null : caseData.promise_pay_by,
          });

          console.log(`[Webhook] Case ${caseId}: ${caseData.state} → ${targetState} (₹${amount})`);
        } else {
          // State is already terminal or incompatible — just update amount
          db.prepare(`UPDATE cases SET amount_recovered = ?, updated_at = datetime('now') WHERE case_id = ?`)
            .run(Math.round(newRecovered * 100) / 100, caseId);
        }

        // Emit live event
        liveEvents.emit('payment_update', {
          type: 'PAYMENT_RECEIVED',
          caseId,
          amount,
          provider,
          totalRecovered: Math.round(newRecovered * 100) / 100,
          isFullPayment,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(`[Webhook] Case state update failed for ${caseId}:`, err.message);
    }
  }

  return { created: true, eventId, status };
}

// ══════════════════════════════════════════════════════════
// Signature Verification
// ══════════════════════════════════════════════════════════

function verifyRazorpaySignature(body, signature) {
  if (!recoveryConfig.RAZORPAY_WEBHOOK_SECRET) {
    console.warn('[Webhook] Razorpay webhook secret not configured — skipping verification');
    return true; // Allow in dev/test
  }
  if (!signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', recoveryConfig.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

function verifyCashfreeSignature(body, timestamp, signature) {
  if (!recoveryConfig.CASHFREE_WEBHOOK_SECRET) {
    console.warn('[Webhook] Cashfree webhook secret not configured — skipping verification');
    return true; // Allow in dev/test
  }
  if (!signature) return false;

  const rawSignature = timestamp + body;
  const expectedSignature = crypto
    .createHmac('sha256', recoveryConfig.CASHFREE_WEBHOOK_SECRET)
    .update(rawSignature)
    .digest('base64');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (_) {
    return false;
  }
}

// ── Status Mapping ──

function mapRazorpayStatus(status) {
  switch (status) {
    case 'captured':
    case 'authorized':
      return 'SUCCESS';
    case 'failed':
      return 'FAILED';
    case 'created':
    default:
      return 'INITIATED';
  }
}

function mapCashfreeStatus(status) {
  switch (status) {
    case 'SUCCESS':
    case 'PAID':
      return 'SUCCESS';
    case 'FAILED':
    case 'CANCELLED':
      return 'FAILED';
    default:
      return 'INITIATED';
  }
}

// ── Raw Payload Storage ──

function storeRawPayload(eventId, rawPayload) {
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(__dirname, '..', 'db', 'webhook_payloads');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filename = `${eventId}_${Date.now()}.json`;
  fs.writeFileSync(path.join(dir, filename), rawPayload, 'utf8');
  return filename;
}

module.exports = router;
