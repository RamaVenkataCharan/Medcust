/**
 * Recovery Routes — Dashboard analytics API + SSE live feed
 * 
 * All numbers are derived live from cases, call_logs, payment_events.
 * No cached summary tables — always fresh from source data.
 */

const express = require('express');
const router = express.Router();
const {
  getCaseStateCounts,
  getRecoveryRateOverTime,
  getEscalatedCalls,
  getComplianceAuditLog,
  getCasesByState,
  getDb,
} = require('../db/database');
const { getActiveSessions, liveEvents } = require('../recovery/telephonyBridge');
const { getCallQueue } = require('../recovery/predictionModel');

// ══════════════════════════════════════════════════════════
// SSE — Live Activity Feed
// ══════════════════════════════════════════════════════════

const sseClients = new Set();

router.get('/live', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send initial state
  const activeCalls = getActiveSessions();
  res.write(`data: ${JSON.stringify({ type: 'INIT', activeCalls })}\n\n`);

  // Keep-alive ping every 30s
  const pingInterval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'PING', timestamp: new Date().toISOString() })}\n\n`);
  }, 30000);

  // Register client
  const client = { res, pingInterval };
  sseClients.add(client);

  req.on('close', () => {
    clearInterval(pingInterval);
    sseClients.delete(client);
  });
});

// Forward live events to all SSE clients
function broadcastToSSE(eventData) {
  for (const client of sseClients) {
    try {
      client.res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    } catch (_) {
      sseClients.delete(client);
    }
  }
}

// Wire up live events from telephony bridge
liveEvents.on('call_update', (data) => broadcastToSSE(data));
liveEvents.on('payment_update', (data) => broadcastToSSE(data));
liveEvents.on('case_update', (data) => broadcastToSSE(data));

// ══════════════════════════════════════════════════════════
// Recovery Funnel
// ══════════════════════════════════════════════════════════

router.get('/funnel', (req, res) => {
  try {
    const stateCounts = getCaseStateCounts();

    // Compute conversion rates between stages
    const states = ['NEW', 'CONTACTED', 'PROMISED', 'PARTIAL', 'RECOVERED', 'PROMISE_BROKEN'];
    const funnel = states.map(state => ({
      state,
      count: stateCounts[state]?.count || 0,
      total_amount: stateCounts[state]?.total_amount || 0,
    }));

    // Conversion rates
    const totalCases = funnel.reduce((sum, s) => sum + s.count, 0);
    const contacted = (stateCounts['CONTACTED']?.count || 0) +
                      (stateCounts['PROMISED']?.count || 0) +
                      (stateCounts['PARTIAL']?.count || 0) +
                      (stateCounts['RECOVERED']?.count || 0) +
                      (stateCounts['PROMISE_BROKEN']?.count || 0);
    const promised = (stateCounts['PROMISED']?.count || 0) +
                     (stateCounts['RECOVERED']?.count || 0) +
                     (stateCounts['PARTIAL']?.count || 0);
    const recovered = (stateCounts['RECOVERED']?.count || 0);

    const conversionRates = {
      contact_rate: totalCases > 0 ? Math.round((contacted / totalCases) * 100) : 0,
      promise_rate: contacted > 0 ? Math.round((promised / contacted) * 100) : 0,
      recovery_rate: promised > 0 ? Math.round((recovered / promised) * 100) : 0,
      overall_rate: totalCases > 0 ? Math.round((recovered / totalCases) * 100) : 0,
    };

    res.json({ funnel, conversionRates, totalCases });
  } catch (err) {
    console.error('Funnel error:', err);
    res.status(500).json({ error: 'Failed to compute funnel data' });
  }
});

// ══════════════════════════════════════════════════════════
// Recovery Rate Over Time
// ══════════════════════════════════════════════════════════

router.get('/rate', (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const rateData = getRecoveryRateOverTime(days);

    // Also get total delinquent amount for context
    const db = getDb();
    const totalDelinquent = db.prepare(`
      SELECT COALESCE(SUM(total_due), 0) as total FROM cases WHERE state != 'RECOVERED'
    `).get();

    const totalRecovered = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payment_events WHERE status = 'SUCCESS'
    `).get();

    res.json({
      daily: rateData,
      summary: {
        total_delinquent: Math.round((totalDelinquent?.total || 0) * 100) / 100,
        total_recovered: Math.round((totalRecovered?.total || 0) * 100) / 100,
        recovery_rate: totalDelinquent?.total > 0
          ? Math.round(((totalRecovered?.total || 0) / totalDelinquent.total) * 100)
          : 0,
      },
    });
  } catch (err) {
    console.error('Rate error:', err);
    res.status(500).json({ error: 'Failed to compute recovery rate' });
  }
});

// ══════════════════════════════════════════════════════════
// Escalation Monitor
// ══════════════════════════════════════════════════════════

router.get('/escalations', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const escalations = getEscalatedCalls(limit);

    // Enrich with transcript snippets
    const enriched = escalations.map(e => ({
      ...e,
      compliance_flags: JSON.parse(e.compliance_flags || '[]'),
    }));

    const db = getDb();
    const totalEscalations = db.prepare(`
      SELECT COUNT(*) as count FROM call_logs WHERE outcome = 'ESCALATED_TO_HUMAN'
    `).get();

    res.json({
      escalations: enriched,
      total_count: totalEscalations?.count || 0,
    });
  } catch (err) {
    console.error('Escalations error:', err);
    res.status(500).json({ error: 'Failed to retrieve escalations' });
  }
});

// ══════════════════════════════════════════════════════════
// Compliance Audit
// ══════════════════════════════════════════════════════════

router.get('/audit', (req, res) => {
  try {
    const { from, to, outcome, limit } = req.query;
    const auditLog = getComplianceAuditLog({
      fromDate: from || null,
      toDate: to || null,
      outcomeFilter: outcome || null,
      limit: parseInt(limit, 10) || 200,
    });

    const enriched = auditLog.map(entry => ({
      ...entry,
      compliance_flags: JSON.parse(entry.compliance_flags || '[]'),
    }));

    res.json({ audit_log: enriched, count: enriched.length });
  } catch (err) {
    console.error('Audit error:', err);
    res.status(500).json({ error: 'Failed to retrieve audit log' });
  }
});

// ══════════════════════════════════════════════════════════
// Compliance Audit Export (CSV)
// ══════════════════════════════════════════════════════════

router.get('/audit/export', (req, res) => {
  try {
    const { from, to, outcome, format } = req.query;
    const auditLog = getComplianceAuditLog({
      fromDate: from || null,
      toDate: to || null,
      outcomeFilter: outcome || null,
      limit: 10000, // Export all
    });

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=compliance_audit.json');
      return res.json(auditLog);
    }

    // Default: CSV
    const headers = [
      'Call ID', 'Case ID', 'Customer Name', 'Phone', 'Started At', 'Ended At',
      'Outcome', 'AI Disclosed', 'Sentiment Score', 'Compliance Flags', 'Case State'
    ];

    const rows = auditLog.map(entry => [
      entry.call_id,
      entry.case_id,
      `"${(entry.name || '').replace(/"/g, '""')}"`,
      entry.phone_number,
      entry.started_at,
      entry.ended_at || '',
      entry.outcome || '',
      entry.ai_disclosed_at_start ? 'Yes' : 'No',
      entry.sentiment_score != null ? entry.sentiment_score.toFixed(2) : '',
      `"${(entry.compliance_flags || '[]').replace(/"/g, '""')}"`,
      entry.case_state || '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=compliance_audit.csv');
    res.send(csv);
  } catch (err) {
    console.error('Audit export error:', err);
    res.status(500).json({ error: 'Failed to export audit log' });
  }
});

// ══════════════════════════════════════════════════════════
// Dashboard Summary (combined endpoint)
// ══════════════════════════════════════════════════════════

router.get('/summary', (req, res) => {
  try {
    const stateCounts = getCaseStateCounts();
    const activeCalls = getActiveSessions();

    const db = getDb();
    const totalCalls = db.prepare('SELECT COUNT(*) as count FROM call_logs').get();
    const todayCalls = db.prepare(`
      SELECT COUNT(*) as count FROM call_logs
      WHERE started_at >= date('now')
    `).get();
    const totalRecovered = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payment_events WHERE status = 'SUCCESS'
    `).get();
    const todayRecovered = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payment_events
      WHERE status = 'SUCCESS' AND received_at >= date('now')
    `).get();

    res.json({
      active_calls: activeCalls.length,
      active_call_details: activeCalls,
      state_counts: stateCounts,
      metrics: {
        total_calls: totalCalls?.count || 0,
        today_calls: todayCalls?.count || 0,
        total_recovered: Math.round((totalRecovered?.total || 0) * 100) / 100,
        today_recovered: Math.round((todayRecovered?.total || 0) * 100) / 100,
      },
    });
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: 'Failed to compute summary' });
  }
});

// ══════════════════════════════════════════════════════════
// Call Queue
// ══════════════════════════════════════════════════════════

router.get('/queue', (req, res) => {
  try {
    const queue = getCallQueue();
    res.json({ queue, count: queue.length });
  } catch (err) {
    console.error('Queue error:', err);
    res.status(500).json({ error: 'Failed to retrieve call queue' });
  }
});

// ══════════════════════════════════════════════════════════
// Trigger Outbound Call
// ══════════════════════════════════════════════════════════

router.post('/call/:caseId', async (req, res) => {
  try {
    const { initiateCall } = require('../recovery/telephonyBridge');
    const result = await initiateCall(req.params.caseId);
    res.json(result);
  } catch (err) {
    console.error('Initiate call error:', err);
    res.status(500).json({ error: err.message || 'Failed to initiate call' });
  }
});

module.exports = router;
