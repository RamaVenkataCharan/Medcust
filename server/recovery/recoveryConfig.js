/**
 * Recovery System Configuration
 * All tunables are env-backed with sensible defaults.
 * Nothing is hardcoded in business logic — everything reads from here.
 */

const config = {
  // ── Calling Hours (IST) ──
  // Fail closed: if timezone is ambiguous, block the call.
  CALLING_HOURS_START: parseInt(process.env.CALLING_HOURS_START || '9', 10),   // 9 AM
  CALLING_HOURS_END: parseInt(process.env.CALLING_HOURS_END || '19', 10),      // 7 PM
  CALLING_TIMEZONE: process.env.CALLING_TIMEZONE || 'Asia/Kolkata',

  // ── Cool-down & Frequency ──
  COOLDOWN_HOURS: parseInt(process.env.COOLDOWN_HOURS || '48', 10),            // hours between calls to same customer
  MAX_CALLS_PER_DAY: parseInt(process.env.MAX_CALLS_PER_DAY || '3', 10),      // max calls to same customer per day
  MAX_CALLS_PER_CASE: parseInt(process.env.MAX_CALLS_PER_CASE || '10', 10),   // total attempts before manual review

  // ── Promise-to-Pay ──
  PROMISE_FOLLOWUP_DAYS: parseInt(process.env.PROMISE_FOLLOWUP_DAYS || '3', 10),
  FOLLOWUP_CHECK_INTERVAL_MS: parseInt(process.env.FOLLOWUP_CHECK_INTERVAL_MS || '900000', 10), // 15 min

  // ── Sentiment & Escalation ──
  SENTIMENT_ESCALATION_THRESHOLD: parseFloat(process.env.SENTIMENT_ESCALATION_THRESHOLD || '-0.6'),
  // Score range: -1.0 (distressed/hostile) to +1.0 (calm/positive)
  // Below threshold → escalate to human operator

  // ── Settlement/Discount Limits ──
  MAX_DISCOUNT_PERCENT: parseFloat(process.env.MAX_DISCOUNT_PERCENT || '10'),
  MIN_SETTLEMENT_PERCENT: parseFloat(process.env.MIN_SETTLEMENT_PERCENT || '80'),
  // Agent can offer up to MAX_DISCOUNT_PERCENT off, settlement must be ≥ MIN_SETTLEMENT_PERCENT of due

  // ── Telephony Provider ──
  TELEPHONY_PROVIDER: process.env.TELEPHONY_PROVIDER || 'exotel',  // 'exotel' | 'twilio' | 'mock'
  EXOTEL_API_KEY: process.env.EXOTEL_API_KEY || '',
  EXOTEL_API_TOKEN: process.env.EXOTEL_API_TOKEN || '',
  EXOTEL_SID: process.env.EXOTEL_SID || '',
  EXOTEL_CALLER_ID: process.env.EXOTEL_CALLER_ID || '',
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',

  // ── STT (Deepgram) ──
  DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY || '',
  DEEPGRAM_MODEL: process.env.DEEPGRAM_MODEL || 'nova-2',
  DEEPGRAM_LANGUAGE: process.env.DEEPGRAM_LANGUAGE || 'hi',  // Hindi primary, with English code-switching

  // ── TTS (ElevenLabs) ──
  TTS_PROVIDER: process.env.TTS_PROVIDER || 'elevenlabs',  // 'elevenlabs' | 'azure' | 'mock'
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
  ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID || '',
  AZURE_TTS_KEY: process.env.AZURE_TTS_KEY || '',
  AZURE_TTS_REGION: process.env.AZURE_TTS_REGION || 'centralindia',

  // ── Payment Providers ──
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  CASHFREE_APP_ID: process.env.CASHFREE_APP_ID || '',
  CASHFREE_SECRET_KEY: process.env.CASHFREE_SECRET_KEY || '',
  CASHFREE_WEBHOOK_SECRET: process.env.CASHFREE_WEBHOOK_SECRET || '',

  // ── DND Registry ──
  DND_CHECK_ENABLED: process.env.DND_CHECK_ENABLED !== 'false',  // default true
  DND_API_URL: process.env.DND_API_URL || '',  // external DND registry API

  // ── Server ──
  RECOVERY_WS_PATH: process.env.RECOVERY_WS_PATH || '/ws/telephony',
  SSE_PATH: process.env.SSE_PATH || '/api/recovery/live',
};

module.exports = config;
