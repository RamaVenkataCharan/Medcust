/**
 * Prediction Model — Priority scoring for recovery cases
 * 
 * Scores cases for recovery likelihood to order the outbound call queue.
 * This is a heuristic stub — in production, replace with ML model inference.
 */

const { getDb } = require('../db/database');

/**
 * Score a case for recovery priority.
 * Higher score = more likely to recover = call sooner.
 * 
 * Factors:
 * - Recency of due (newer dues recover better)
 * - Amount (moderate amounts recover better than extreme highs/lows)
 * - Payment history (customers who've paid before are more likely to pay)
 * - Call attempts (diminishing returns after many attempts)
 * 
 * @param {Object} caseData - { case_id, customer_id, total_due, created_at }
 * @returns {number} priority score 0.0 to 1.0
 */
function scoreCasePriority(caseData) {
  const db = getDb();
  const { customer_id, total_due, created_at } = caseData;

  let score = 0.5; // baseline

  // ── Recency factor (0 to 0.25) ──
  // Newer dues get higher priority
  const daysSinceCreated = Math.max(0,
    (Date.now() - new Date(created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceCreated <= 7) {
    score += 0.25;
  } else if (daysSinceCreated <= 30) {
    score += 0.15;
  } else if (daysSinceCreated <= 90) {
    score += 0.05;
  }
  // > 90 days: no recency bonus

  // ── Amount factor (0 to 0.20) ──
  // Sweet spot: ₹500 - ₹5000 recovers best
  if (total_due >= 500 && total_due <= 5000) {
    score += 0.20;
  } else if (total_due > 5000 && total_due <= 15000) {
    score += 0.10;
  } else if (total_due > 0 && total_due < 500) {
    score += 0.05; // low value, still worth calling
  }
  // > 15000: no bonus (may need human negotiation)

  // ── Payment history factor (0 to 0.20) ──
  try {
    const paymentHistory = db.prepare(`
      SELECT COUNT(*) as pay_count, COALESCE(SUM(amount), 0) as total_paid
      FROM payments
      WHERE customer_id = ?
    `).get(customer_id);

    if (paymentHistory && paymentHistory.pay_count > 0) {
      // Customer has paid before — good signal
      if (paymentHistory.pay_count >= 3) {
        score += 0.20; // reliable payer
      } else {
        score += 0.10;
      }
    }
  } catch (_) {
    // If payments table isn't accessible, skip this factor
  }

  // ── Call attempt decay (-0.15 max) ──
  try {
    const attempts = db.prepare(`
      SELECT COUNT(*) as cnt FROM call_logs
      WHERE case_id = ?
    `).get(caseData.case_id);

    if (attempts && attempts.cnt > 0) {
      // Diminishing returns: each attempt reduces priority slightly
      const decay = Math.min(0.15, attempts.cnt * 0.03);
      score -= decay;
    }
  } catch (_) {
    // Table may not exist yet
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

/**
 * Score all NEW/CONTACTED/PROMISE_BROKEN cases and return sorted queue.
 * @returns {Array<{ case_id, customer_id, total_due, state, priority_score }>}
 */
function getCallQueue() {
  const db = getDb();

  try {
    const cases = db.prepare(`
      SELECT c.case_id, c.customer_id, c.total_due, c.state, c.created_at,
             cu.phone_number, cu.name
      FROM cases c
      JOIN customers cu ON c.customer_id = cu.customer_id
      WHERE c.state IN ('NEW', 'CONTACTED', 'PROMISE_BROKEN')
      ORDER BY c.priority_score DESC
    `).all();

    // Re-score and sort
    const scored = cases.map(c => ({
      ...c,
      priority_score: scoreCasePriority(c),
    }));

    scored.sort((a, b) => b.priority_score - a.priority_score);

    // Update scores in DB
    const updateStmt = db.prepare(`UPDATE cases SET priority_score = ? WHERE case_id = ?`);
    const updateTx = db.transaction(() => {
      for (const c of scored) {
        updateStmt.run(c.priority_score, c.case_id);
      }
    });
    updateTx();

    return scored;
  } catch (err) {
    if (err.message && err.message.includes('no such table')) {
      return [];
    }
    throw err;
  }
}

module.exports = {
  scoreCasePriority,
  getCallQueue,
};
