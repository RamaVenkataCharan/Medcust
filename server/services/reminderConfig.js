/**
 * Due Reminder Configuration — MedTrack Pharmacy
 * 
 * Courtesy reminder schedule for pharmacy khata dues.
 * Polite, non-alarming shopkeeper follow-up.
 */

module.exports = {
  // Configurable reminder schedule
  scheduleStages: [
    { stage: 'T+3', daysAfterDue: 3 },
    { stage: 'T+7', daysAfterDue: 7 },
    { stage: 'T+14', daysAfterDue: 14 },
  ],

  // Hard stop — maximum reminders per unpaid due cycle (no indefinite nagging)
  maxRemindersPerDue: 3,

  // Quiet hours (24h clock, Indian Standard Time). Never send messages during this window.
  quietHours: {
    start: '20:00', // 8:00 PM
    end: '09:00',   // 9:00 AM
  },

  // Channels priority
  channels: {
    primary: process.env.REMINDER_PRIMARY_CHANNEL || 'whatsapp',
    fallback: process.env.REMINDER_FALLBACK_CHANNEL || 'sms',
  },

  // Shop details embedded in every reminder so customer immediately recognizes the local chemist
  shopInfo: {
    name: process.env.SHOP_NAME || 'MedTrack Pharmacy',
    tagline: 'Neighborhood Medical Store & Khata',
    phone: process.env.SHOP_PHONE || '+91 98765 43210',
    address: 'Main Bazaar Road, Opp. Civil Hospital',
    upiId: process.env.SHOP_UPI_ID || 'medtrack@upi',
  },

  // WhatsApp / SMS Provider Mode ('mock', 'gupshup', 'twilio')
  provider: process.env.REMINDER_PROVIDER || 'mock',

  // Optional courtesy call escalation after maxRemindersPerDue remain unacknowledged (default false)
  enableCourtesyCallEscalation: process.env.ENABLE_COURTESY_CALL === 'true',

  // Check interval for background scheduler (in milliseconds: default 15 minutes)
  schedulerIntervalMs: parseInt(process.env.REMINDER_CHECK_INTERVAL_MS || '900000', 10),
};
