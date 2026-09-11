/**
 * Hinglish Voice Agent — Conversation & negotiation engine
 * 
 * Turn-based dialogue with Hindi-English code-switching.
 * Handles objections, negotiation, and payment commitment flow.
 * 
 * Designed for streaming compatibility:
 * - Accepts partial transcripts
 * - Emits { action: 'wait' | 'respond', utterance?: string }
 * - AI disclosure is mandatory first utterance
 */

const recoveryConfig = require('./recoveryConfig');

// ── Dialogue Templates (Hinglish) ──

const TEMPLATES = {
  AI_DISCLOSURE: (customerName) =>
    `Namaste ${customerName} ji, yeh ek automated assistant hai ${recoveryConfig.SHOP_NAME || 'MedTrack Medical Store'} ki taraf se. ` +
    `Aapke account mein kuch pending payment hai, kya main aapko iske baare mein bata sakta hoon?`,

  AMOUNT_INFO: (amount) =>
    `Aapke account mein total ₹${amount.toFixed(2)} ka outstanding balance hai. ` +
    `Kya aap iske liye payment arrange kar sakte hain?`,

  PAYMENT_LINK: (amount) =>
    `Main aapko ek payment link bhej raha hoon ₹${amount.toFixed(2)} ke liye. ` +
    `Aap UPI, card ya net banking se pay kar sakte hain. Link aapke phone pe aa jayega.`,

  PROMISE_ACKNOWLEDGE: (days) =>
    `Theek hai, main note kar raha hoon ki aap ${days} din mein payment karenge. ` +
    `Hum aapko yaad dilayenge. Dhanyavaad!`,

  SETTLEMENT_OFFER: (originalAmount, settlementAmount, discountPercent) =>
    `Main aapke liye ek special offer de sakta hoon — agar aap aaj hi ₹${settlementAmount.toFixed(2)} pay karte hain, ` +
    `toh ${discountPercent}% ki chhoot milegi. Original amount ₹${originalAmount.toFixed(2)} tha.`,

  ESCALATE_TO_HUMAN: () =>
    `Main samajhta hoon ki aap kisi mushkil mein hain. Main aapko hamare team member se connect kar raha hoon ` +
    `jo aapki madad kar sakenge. Please hold karein.`,

  GOODBYE: () =>
    `Bahut dhanyavaad aapke time ke liye. Agar koi sawal ho toh hamare store pe call kar sakte hain. Namaste!`,

  REFUSED_GOODBYE: () =>
    `Theek hai, main samajhta hoon. Agar aap baad mein payment karna chahein toh hamare store pe sampark karein. Dhanyavaad!`,
};

// ── Objection Handlers ──

const OBJECTION_PATTERNS = [
  {
    // "Next week" / "baad mein" / "kal" / "later"
    pattern: /\b(next\s*week|baad\s*mein|kal|later|abhi\s*nahi|not\s*now)\b/i,
    type: 'DELAY',
    response: (ctx) => {
      const days = recoveryConfig.PROMISE_FOLLOWUP_DAYS;
      return {
        action: 'respond',
        utterance: `Main samajhta hoon. Kya aap ${days} din mein payment kar payenge? ` +
          `Main ek reminder set kar doonga aapke liye.`,
        suggestPromise: true,
      };
    },
  },
  {
    // "Don't have money" / "paisa nahi" / "no money"
    pattern: /\b(paisa\s*nahi|paise\s*nahi|no\s*money|don'?t\s*have|nahi\s*hai)\b/i,
    type: 'NO_FUNDS',
    response: (ctx) => {
      const minSettlement = Math.ceil(ctx.totalDue * recoveryConfig.MIN_SETTLEMENT_PERCENT / 100);
      return {
        action: 'respond',
        utterance: `Main samajhta hoon. Kya aap kam se kam ₹${minSettlement} ka partial payment kar sakte hain? ` +
          `Isse aapka balance kam ho jayega.`,
        suggestPartial: true,
      };
    },
  },
  {
    // "Wrong amount" / "galat amount" / "yeh sahi nahi hai"
    pattern: /\b(wrong\s*amount|galat|sahi\s*nahi|incorrect|dispute)\b/i,
    type: 'DISPUTE',
    response: (_ctx) => ({
      action: 'respond',
      utterance: `Agar aapko lagta hai ki amount mein koi galti hai, toh main aapko hamare team se connect karta hoon ` +
        `jo records verify kar sakenge.`,
      suggestEscalate: true,
    }),
  },
  {
    // "Who are you" / "kaun hai" — repeat AI disclosure
    pattern: /\b(who\s*are|kaun\s*hai|kaun\s*bol|kahan\s*se)\b/i,
    type: 'IDENTITY',
    response: (ctx) => ({
      action: 'respond',
      utterance: `Main ek automated assistant hoon ${recoveryConfig.SHOP_NAME || 'MedTrack Medical Store'} ki taraf se. ` +
        `Aapke account mein ₹${ctx.totalDue.toFixed(2)} ka outstanding balance hai.`,
    }),
  },
  {
    // Explicit refusal
    pattern: /\b(nahi\s*karunga|refuse|no\s*way|mat\s*karo|don'?t\s*call|band\s*karo|stop)\b/i,
    type: 'REFUSAL',
    response: (_ctx) => ({
      action: 'respond',
      utterance: TEMPLATES.REFUSED_GOODBYE(),
      outcome: 'REFUSED',
      endCall: true,
    }),
  },
];

// ── Positive Intent Patterns ──

const POSITIVE_PATTERNS = [
  {
    // "OK" / "theek hai" / "haan" / "yes" / "kar dunga"
    pattern: /\b(ok|okay|theek\s*hai|thik\s*hai|haan|yes|ha|kar\s*dunga|kar\s*deta|ready|done|payment\s*kar)\b/i,
    type: 'AGREEMENT',
  },
];

/**
 * Voice Agent Session — manages conversation state for one call
 */
class VoiceAgentSession {
  constructor({ caseId, customerName, phoneNumber, totalDue }) {
    this.caseId = caseId;
    this.customerName = customerName;
    this.phoneNumber = phoneNumber;
    this.totalDue = totalDue;
    this.turnCount = 0;
    this.aiDisclosed = false;
    this.outcome = null;
    this.promisedAmount = null;
    this.transcript = [];
    this.state = 'INIT'; // INIT → DISCLOSED → NEGOTIATING → CLOSING → ENDED
  }

  /**
   * Process a transcript segment (partial or final).
   * Returns the agent's action.
   * 
   * @param {string} text - Transcript text from STT
   * @param {boolean} isFinal - Whether this is a final transcript (vs partial)
   * @returns {{ action: 'wait'|'respond', utterance?: string, outcome?: string, endCall?: boolean, generatePaymentLink?: boolean }}
   */
  processTurn(text, isFinal = false) {
    // Only act on final transcripts (wait for partials)
    if (!isFinal) {
      return { action: 'wait' };
    }

    const trimmed = (text || '').trim();
    if (!trimmed) {
      return { action: 'wait' };
    }

    this.turnCount++;
    this.transcript.push({ speaker: 'customer', text: trimmed, timestamp: new Date().toISOString() });

    const ctx = {
      totalDue: this.totalDue,
      customerName: this.customerName,
      caseId: this.caseId,
    };

    let response;

    // ── State machine ──
    switch (this.state) {
      case 'INIT':
        // Should not receive customer speech before disclosure
        // But if we do, disclose first
        response = this._disclose();
        break;

      case 'DISCLOSED':
        // After disclosure, listen for response and move to negotiation
        response = this._handlePostDisclosure(trimmed, ctx);
        break;

      case 'NEGOTIATING':
        response = this._handleNegotiation(trimmed, ctx);
        break;

      case 'CLOSING':
        response = this._handleClosing(trimmed, ctx);
        break;

      case 'ENDED':
        return { action: 'wait' };

      default:
        response = this._disclose();
    }

    if (response.utterance) {
      this.transcript.push({
        speaker: 'agent',
        text: response.utterance,
        timestamp: new Date().toISOString(),
      });
    }

    if (response.outcome) {
      this.outcome = response.outcome;
    }

    if (response.endCall) {
      this.state = 'ENDED';
    }

    return response;
  }

  /**
   * Get the mandatory AI disclosure utterance.
   * Must be called as the first thing in every call.
   */
  getDisclosureUtterance() {
    const utterance = TEMPLATES.AI_DISCLOSURE(this.customerName);
    this.aiDisclosed = true;
    this.state = 'DISCLOSED';
    this.transcript.push({
      speaker: 'agent',
      text: utterance,
      timestamp: new Date().toISOString(),
    });
    return utterance;
  }

  /** @private */
  _disclose() {
    const utterance = this.getDisclosureUtterance();
    return { action: 'respond', utterance };
  }

  /** @private */
  _handlePostDisclosure(text, ctx) {
    // Check for immediate refusal
    for (const obj of OBJECTION_PATTERNS) {
      if (obj.pattern.test(text)) {
        const result = obj.response(ctx);
        if (result.endCall) {
          this.state = 'ENDED';
        } else {
          this.state = 'NEGOTIATING';
        }
        return result;
      }
    }

    // Check for positive response — tell them the amount
    for (const pos of POSITIVE_PATTERNS) {
      if (pos.pattern.test(text)) {
        this.state = 'NEGOTIATING';
        return {
          action: 'respond',
          utterance: TEMPLATES.AMOUNT_INFO(this.totalDue),
        };
      }
    }

    // Unclear response — provide amount info anyway
    this.state = 'NEGOTIATING';
    return {
      action: 'respond',
      utterance: TEMPLATES.AMOUNT_INFO(this.totalDue),
    };
  }

  /** @private */
  _handleNegotiation(text, ctx) {
    // Check objections first
    for (const obj of OBJECTION_PATTERNS) {
      if (obj.pattern.test(text)) {
        const result = obj.response(ctx);

        if (result.suggestPromise) {
          this.state = 'CLOSING';
          return result;
        }
        if (result.suggestEscalate) {
          this.outcome = 'ESCALATED_TO_HUMAN';
          this.state = 'ENDED';
          return { ...result, outcome: 'ESCALATED_TO_HUMAN', endCall: true };
        }
        return result;
      }
    }

    // Check for agreement to pay
    for (const pos of POSITIVE_PATTERNS) {
      if (pos.pattern.test(text)) {
        this.promisedAmount = this.totalDue;
        this.outcome = 'PROMISED';
        this.state = 'CLOSING';
        return {
          action: 'respond',
          utterance: TEMPLATES.PAYMENT_LINK(this.totalDue),
          outcome: 'PROMISED',
          generatePaymentLink: true,
        };
      }
    }

    // No clear signal — try a settlement offer if discount allowed
    if (recoveryConfig.MAX_DISCOUNT_PERCENT > 0 && this.turnCount >= 3) {
      const discountPercent = Math.min(recoveryConfig.MAX_DISCOUNT_PERCENT, 10);
      const settlementAmount = Math.ceil(this.totalDue * (100 - discountPercent) / 100);
      this.state = 'CLOSING';
      return {
        action: 'respond',
        utterance: TEMPLATES.SETTLEMENT_OFFER(this.totalDue, settlementAmount, discountPercent),
      };
    }

    // Re-ask
    return {
      action: 'respond',
      utterance: `₹${this.totalDue.toFixed(2)} ka payment kaise karna chahenge aap — ` +
        `abhi online ya kuch dinon mein?`,
    };
  }

  /** @private */
  _handleClosing(text, ctx) {
    // Check for promise confirmation
    for (const pos of POSITIVE_PATTERNS) {
      if (pos.pattern.test(text)) {
        if (!this.outcome || this.outcome !== 'PROMISED') {
          this.outcome = 'PROMISED';
          this.promisedAmount = this.totalDue;
        }
        return {
          action: 'respond',
          utterance: TEMPLATES.PROMISE_ACKNOWLEDGE(recoveryConfig.PROMISE_FOLLOWUP_DAYS),
          outcome: 'PROMISED',
          endCall: true,
          generatePaymentLink: !this._paymentLinkSent,
        };
      }
    }

    // Check objections
    for (const obj of OBJECTION_PATTERNS) {
      if (obj.pattern.test(text)) {
        const result = obj.response(ctx);
        if (result.endCall) {
          return result;
        }
        return result;
      }
    }

    // Final goodbye
    return {
      action: 'respond',
      utterance: TEMPLATES.GOODBYE(),
      outcome: this.outcome || 'COMPLETED',
      endCall: true,
    };
  }

  /**
   * Get full transcript for storage.
   */
  getTranscript() {
    return this.transcript;
  }

  /**
   * Get session summary for CallLog.
   */
  getSummary() {
    return {
      caseId: this.caseId,
      turnCount: this.turnCount,
      outcome: this.outcome || 'DISCONNECTED',
      aiDisclosed: this.aiDisclosed,
      promisedAmount: this.promisedAmount,
    };
  }
}

module.exports = {
  VoiceAgentSession,
  TEMPLATES,
  OBJECTION_PATTERNS,
  POSITIVE_PATTERNS,
};
