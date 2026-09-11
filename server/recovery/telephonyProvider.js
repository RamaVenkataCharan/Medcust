/**
 * Telephony Provider Adapter
 * 
 * Abstracts Exotel (primary) and Twilio behind a common interface.
 * Includes a mock mode for testing without real credentials.
 */

const recoveryConfig = require('./recoveryConfig');

class TelephonyProvider {
  constructor() {
    this.provider = recoveryConfig.TELEPHONY_PROVIDER;
    this.activeCalls = new Map(); // callSid → call metadata
  }

  /**
   * Initiate an outbound call.
   * @param {string} phoneNumber - Customer phone number
   * @param {string} callbackUrl - WebSocket URL for media streaming
   * @param {Object} metadata - { caseId, customerName }
   * @returns {Promise<{ callSid: string, status: string }>}
   */
  async initiateCall(phoneNumber, callbackUrl, metadata = {}) {
    switch (this.provider) {
      case 'exotel':
        return this._initiateExotel(phoneNumber, callbackUrl, metadata);
      case 'twilio':
        return this._initiateTwilio(phoneNumber, callbackUrl, metadata);
      case 'mock':
      default:
        return this._initiateMock(phoneNumber, callbackUrl, metadata);
    }
  }

  /**
   * End an active call.
   * @param {string} callSid
   */
  async endCall(callSid) {
    switch (this.provider) {
      case 'exotel':
        return this._endExotel(callSid);
      case 'twilio':
        return this._endTwilio(callSid);
      case 'mock':
      default:
        return this._endMock(callSid);
    }
  }

  /**
   * Get all currently active calls.
   */
  getActiveCalls() {
    return Array.from(this.activeCalls.entries()).map(([sid, data]) => ({
      callSid: sid,
      ...data,
    }));
  }

  // ── Exotel Implementation ──

  async _initiateExotel(phoneNumber, callbackUrl, metadata) {
    if (!recoveryConfig.EXOTEL_API_KEY || !recoveryConfig.EXOTEL_SID) {
      throw new Error('Exotel credentials not configured');
    }

    try {
      const url = `https://api.exotel.com/v1/Accounts/${recoveryConfig.EXOTEL_SID}/Calls/connect.json`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(
            `${recoveryConfig.EXOTEL_API_KEY}:${recoveryConfig.EXOTEL_API_TOKEN}`
          ).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: phoneNumber,
          CallerId: recoveryConfig.EXOTEL_CALLER_ID,
          StatusCallback: callbackUrl,
          StatusCallbackEvents: 'initiated ringing answered completed',
        }),
      });

      const data = await response.json();
      const callSid = data.Call?.Sid || `exotel_${Date.now()}`;

      this.activeCalls.set(callSid, {
        phoneNumber,
        status: 'initiated',
        startedAt: new Date().toISOString(),
        ...metadata,
      });

      return { callSid, status: 'initiated' };
    } catch (err) {
      console.error('[Exotel] Call initiation failed:', err.message);
      throw err;
    }
  }

  async _endExotel(callSid) {
    // Exotel call termination API
    this.activeCalls.delete(callSid);
    return { callSid, status: 'ended' };
  }

  // ── Twilio Implementation ──

  async _initiateTwilio(phoneNumber, callbackUrl, metadata) {
    if (!recoveryConfig.TWILIO_ACCOUNT_SID || !recoveryConfig.TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured');
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${recoveryConfig.TWILIO_ACCOUNT_SID}/Calls.json`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(
            `${recoveryConfig.TWILIO_ACCOUNT_SID}:${recoveryConfig.TWILIO_AUTH_TOKEN}`
          ).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: phoneNumber,
          From: recoveryConfig.TWILIO_PHONE_NUMBER,
          StatusCallback: callbackUrl,
          Url: callbackUrl, // TwiML endpoint
        }),
      });

      const data = await response.json();
      const callSid = data.sid || `twilio_${Date.now()}`;

      this.activeCalls.set(callSid, {
        phoneNumber,
        status: 'initiated',
        startedAt: new Date().toISOString(),
        ...metadata,
      });

      return { callSid, status: 'initiated' };
    } catch (err) {
      console.error('[Twilio] Call initiation failed:', err.message);
      throw err;
    }
  }

  async _endTwilio(callSid) {
    this.activeCalls.delete(callSid);
    return { callSid, status: 'ended' };
  }

  // ── Mock Implementation (for testing) ──

  async _initiateMock(phoneNumber, callbackUrl, metadata) {
    const callSid = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.activeCalls.set(callSid, {
      phoneNumber,
      status: 'ringing',
      startedAt: new Date().toISOString(),
      ...metadata,
    });

    // Simulate ring → answer after 1s
    setTimeout(() => {
      if (this.activeCalls.has(callSid)) {
        this.activeCalls.get(callSid).status = 'in-progress';
      }
    }, 1000);

    console.log(`[Mock Telephony] Initiated call ${callSid} to ${phoneNumber}`);
    return { callSid, status: 'initiated' };
  }

  async _endMock(callSid) {
    this.activeCalls.delete(callSid);
    console.log(`[Mock Telephony] Ended call ${callSid}`);
    return { callSid, status: 'ended' };
  }
}

// Singleton
const telephonyProvider = new TelephonyProvider();
module.exports = telephonyProvider;
