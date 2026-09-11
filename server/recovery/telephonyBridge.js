/**
 * Telephony Bridge — WebSocket handler connecting the call pipeline
 * 
 * Sits between telephony provider media stream and voice agent logic:
 * 
 *   Exotel/Twilio outbound call
 *     → Media Stream (raw audio, WebSocket)
 *     → Deepgram streaming STT (partial + final transcripts)
 *     → hinglishVoiceAgent turn logic
 *     → TTS synthesis
 *     → audio back into the call stream
 * 
 * Compliance checks run BEFORE any call is placed.
 * Sentiment monitoring runs LIVE during the call.
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const recoveryConfig = require('./recoveryConfig');
const { runPreCallChecks, checkSentiment } = require('./complianceAdapter');
const { VoiceAgentSession } = require('./hinglishVoiceAgent');
const { STTService } = require('./sttService');
const ttsService = require('./ttsService');
const telephonyProvider = require('./telephonyProvider');
const {
  getCaseById,
  updateCaseState,
  createCallLog,
  generateId,
} = require('../db/database');

// Global event emitter for live dashboard updates
const liveEvents = new EventEmitter();
liveEvents.setMaxListeners(100); // Support many SSE clients

// Store for active call sessions
const activeSessions = new Map();

/**
 * Initiate an outbound recovery call for a case.
 * Runs all compliance checks BEFORE contacting the telephony provider.
 * 
 * @param {string} caseId
 * @returns {Promise<{ success: boolean, callSid?: string, blocked?: boolean, flags?: string[] }>}
 */
async function initiateCall(caseId) {
  const caseData = getCaseById(caseId);
  if (!caseData) {
    throw new Error(`Case ${caseId} not found`);
  }

  const phoneNumber = caseData.phone_number;
  const customerName = caseData.name;

  // ── PRE-CALL COMPLIANCE CHECK (must pass before reaching telephony provider) ──
  const complianceResult = await runPreCallChecks(caseId, phoneNumber);

  if (!complianceResult.allowed) {
    console.log(`[Bridge] Call BLOCKED for case ${caseId}: ${complianceResult.flags.join(', ')}`);

    // Log the blocked attempt
    createCallLog({
      caseId,
      outcome: 'DISCONNECTED',
      aiDisclosed: false,
      complianceFlags: complianceResult.flags,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
    });

    liveEvents.emit('call_update', {
      type: 'CALL_BLOCKED',
      caseId,
      customerName,
      phoneNumber,
      flags: complianceResult.flags,
      timestamp: new Date().toISOString(),
    });

    return { success: false, blocked: true, flags: complianceResult.flags };
  }

  // ── INITIATE CALL ──
  try {
    const callbackUrl = `ws://localhost:${process.env.PORT || 4000}${recoveryConfig.RECOVERY_WS_PATH}`;

    const { callSid } = await telephonyProvider.initiateCall(phoneNumber, callbackUrl, {
      caseId,
      customerName,
    });

    // Create voice agent session
    const agentSession = new VoiceAgentSession({
      caseId,
      customerName,
      phoneNumber,
      totalDue: caseData.total_due,
    });

    // Create STT session
    const sttSession = new STTService();

    activeSessions.set(callSid, {
      caseId,
      callSid,
      agentSession,
      sttSession,
      customerName,
      phoneNumber,
      startedAt: new Date().toISOString(),
      sentimentScores: [],
      complianceFlags: [],
    });

    // Start the call flow
    await startCallFlow(callSid);

    // Update case state to CONTACTED
    if (caseData.state === 'NEW' || caseData.state === 'PROMISE_BROKEN') {
      updateCaseState(caseId, 'CONTACTED');
    }

    liveEvents.emit('call_update', {
      type: 'CALL_STARTED',
      caseId,
      callSid,
      customerName,
      phoneNumber,
      timestamp: new Date().toISOString(),
    });

    return { success: true, callSid };
  } catch (err) {
    console.error(`[Bridge] Call initiation failed for case ${caseId}:`, err.message);
    throw err;
  }
}

/**
 * Start the call flow: STT → Agent → TTS pipeline.
 */
async function startCallFlow(callSid) {
  const session = activeSessions.get(callSid);
  if (!session) return;

  const { agentSession, sttSession } = session;

  // Start STT
  await sttSession.startSession({ sampleRate: 8000, encoding: 'mulaw' });

  // ── AI DISCLOSURE (mandatory first utterance) ──
  const disclosureText = agentSession.getDisclosureUtterance();
  const disclosureAudio = await ttsService.synthesize(disclosureText, { sampleRate: 8000 });

  // In a real integration, we'd stream this audio into the call
  // For now, log it and mark disclosure as confirmed
  console.log(`[Bridge] AI Disclosure spoken for ${callSid}: "${disclosureText.substring(0, 80)}..."`);

  liveEvents.emit('call_update', {
    type: 'AI_DISCLOSED',
    callSid,
    caseId: session.caseId,
    timestamp: new Date().toISOString(),
  });

  // ── STT TRANSCRIPT HANDLER ──
  sttSession.on('transcript', async (data) => {
    try {
      const { text, isFinal } = data;

      // Live sentiment analysis on every transcript
      const sentimentScore = estimateSentiment(text);
      session.sentimentScores.push(sentimentScore);

      const sentimentCheck = checkSentiment(sentimentScore);
      if (sentimentCheck.shouldEscalate) {
        console.log(`[Bridge] Sentiment escalation triggered for ${callSid}`);
        session.complianceFlags.push(sentimentCheck.flag);
        await escalateToHuman(callSid);
        return;
      }

      // Process through voice agent
      const agentResponse = agentSession.processTurn(text, isFinal);

      if (agentResponse.action === 'respond' && agentResponse.utterance) {
        // Synthesize response
        const audioBuffer = await ttsService.synthesize(agentResponse.utterance, { sampleRate: 8000 });

        // In real integration, stream audioBuffer back into the call
        console.log(`[Bridge] Agent response for ${callSid}: "${agentResponse.utterance.substring(0, 80)}..."`);

        liveEvents.emit('call_update', {
          type: 'AGENT_SPOKE',
          callSid,
          caseId: session.caseId,
          utterance: agentResponse.utterance.substring(0, 100),
          timestamp: new Date().toISOString(),
        });

        // Handle payment link generation
        if (agentResponse.generatePaymentLink) {
          liveEvents.emit('call_update', {
            type: 'PAYMENT_LINK_REQUESTED',
            callSid,
            caseId: session.caseId,
            timestamp: new Date().toISOString(),
          });
        }

        // Handle call end
        if (agentResponse.endCall) {
          await endCall(callSid, agentResponse.outcome);
        }
      }
    } catch (err) {
      console.error(`[Bridge] Transcript processing error for ${callSid}:`, err.message);
    }
  });
}

/**
 * Handle incoming audio from the telephony media stream.
 * @param {string} callSid
 * @param {Buffer} audioData
 */
function handleIncomingAudio(callSid, audioData) {
  const session = activeSessions.get(callSid);
  if (!session) return;

  // Forward audio to STT
  session.sttSession.sendAudio(audioData);
}

/**
 * Escalate a call to a human operator.
 * Ends the automated portion gracefully.
 */
async function escalateToHuman(callSid) {
  const session = activeSessions.get(callSid);
  if (!session) return;

  const { agentSession } = session;

  // Speak the escalation message
  const escalationText = agentSession.processTurn('escalate', true);
  const farewell = 'Main samajhta hoon ki aap kisi mushkil mein hain. Main aapko hamare team member se connect kar raha hoon jo aapki madad kar sakenge. Please hold karein.';

  await ttsService.synthesize(farewell, { sampleRate: 8000 });
  console.log(`[Bridge] Escalating call ${callSid} to human operator`);

  liveEvents.emit('call_update', {
    type: 'CALL_ESCALATED',
    callSid,
    caseId: session.caseId,
    customerName: session.customerName,
    timestamp: new Date().toISOString(),
  });

  await endCall(callSid, 'ESCALATED_TO_HUMAN');
}

/**
 * End a call and persist all data.
 */
async function endCall(callSid, outcome = 'COMPLETED') {
  const session = activeSessions.get(callSid);
  if (!session) return;

  const endedAt = new Date().toISOString();

  // End STT session
  session.sttSession.endSession();

  // End telephony call
  await telephonyProvider.endCall(callSid);

  // Store transcript
  const transcript = session.agentSession.getTranscript();
  const transcriptRef = await storeTranscript(session.caseId, callSid, transcript);

  // Calculate average sentiment
  const avgSentiment = session.sentimentScores.length > 0
    ? session.sentimentScores.reduce((a, b) => a + b, 0) / session.sentimentScores.length
    : null;

  // Create CallLog
  const callLog = createCallLog({
    caseId: session.caseId,
    outcome,
    transcriptRef,
    sentimentScore: avgSentiment ? Math.round(avgSentiment * 100) / 100 : null,
    aiDisclosed: session.agentSession.aiDisclosed,
    complianceFlags: session.complianceFlags,
    startedAt: session.startedAt,
    endedAt,
  });

  // Update case state based on outcome
  if (outcome === 'PROMISED') {
    const promiseDeadline = new Date(
      Date.now() + recoveryConfig.PROMISE_FOLLOWUP_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    try {
      updateCaseState(session.caseId, 'PROMISED', {
        promise_pay_by: promiseDeadline,
      });
    } catch (err) {
      console.error(`[Bridge] Failed to update case state to PROMISED:`, err.message);
    }
  }

  liveEvents.emit('call_update', {
    type: 'CALL_ENDED',
    callSid,
    caseId: session.caseId,
    customerName: session.customerName,
    outcome,
    duration: Math.round((new Date(endedAt) - new Date(session.startedAt)) / 1000),
    sentiment: avgSentiment,
    timestamp: endedAt,
  });

  // Clean up
  activeSessions.delete(callSid);

  console.log(`[Bridge] Call ${callSid} ended: outcome=${outcome}, sentiment=${avgSentiment?.toFixed(2)}`);
  return callLog;
}

/**
 * Store transcript to disk.
 */
async function storeTranscript(caseId, callSid, transcript) {
  const transcriptsDir = path.join(__dirname, '..', 'db', 'transcripts');
  if (!fs.existsSync(transcriptsDir)) {
    fs.mkdirSync(transcriptsDir, { recursive: true });
  }

  const filename = `${caseId}_${callSid}_${Date.now()}.json`;
  const filepath = path.join(transcriptsDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(transcript, null, 2), 'utf8');
  return filename;
}

/**
 * Simple sentiment estimation from text.
 * In production, use a proper NLP model.
 * Returns: -1.0 (distressed/hostile) to +1.0 (calm/positive)
 */
function estimateSentiment(text) {
  const lower = (text || '').toLowerCase();

  // Negative indicators
  const negativeWords = [
    'angry', 'gussa', 'harassment', 'pareshan', 'cheat', 'dhoka',
    'police', 'complaint', 'court', 'sue', 'threatening', 'dhamki',
    'crying', 'ro', 'die', 'marna', 'suicide', 'kill', 'abuse',
    'bakwas', 'fraud', 'scam',
  ];

  // Positive/neutral indicators
  const positiveWords = [
    'okay', 'theek', 'haan', 'yes', 'sure', 'karenge', 'karunga',
    'payment', 'thanks', 'dhanyavaad', 'shukriya', 'accha', 'good',
    'tomorrow', 'kal', 'ready', 'agree',
  ];

  let score = 0;
  for (const word of negativeWords) {
    if (lower.includes(word)) score -= 0.3;
  }
  for (const word of positiveWords) {
    if (lower.includes(word)) score += 0.2;
  }

  return Math.max(-1, Math.min(1, score));
}

/**
 * Set up WebSocket handler for telephony media streams.
 * Called from server.js during WebSocket server initialization.
 */
function setupWebSocketHandler(wss) {
  wss.on('connection', (ws, req) => {
    let callSid = null;

    ws.on('message', (message) => {
      try {
        // Try to parse as JSON (control messages)
        const data = JSON.parse(message);

        if (data.event === 'start') {
          callSid = data.start?.callSid || data.callSid;
          console.log(`[Bridge WS] Media stream started for ${callSid}`);
        } else if (data.event === 'media' && callSid) {
          // Decode base64 audio and forward to STT
          const audioBuffer = Buffer.from(data.media.payload, 'base64');
          handleIncomingAudio(callSid, audioBuffer);
        } else if (data.event === 'stop' && callSid) {
          console.log(`[Bridge WS] Media stream stopped for ${callSid}`);
          endCall(callSid, 'DISCONNECTED');
        }
      } catch (_) {
        // Binary audio data
        if (callSid) {
          handleIncomingAudio(callSid, message);
        }
      }
    });

    ws.on('close', () => {
      if (callSid && activeSessions.has(callSid)) {
        endCall(callSid, 'DISCONNECTED');
      }
    });
  });
}

/**
 * Get info about all active calls (for dashboard).
 */
function getActiveSessions() {
  return Array.from(activeSessions.entries()).map(([callSid, session]) => ({
    callSid,
    caseId: session.caseId,
    customerName: session.customerName,
    phoneNumber: session.phoneNumber,
    startedAt: session.startedAt,
    duration: Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000),
    turnCount: session.agentSession.turnCount,
    state: session.agentSession.state,
    lastSentiment: session.sentimentScores.length > 0
      ? session.sentimentScores[session.sentimentScores.length - 1]
      : null,
  }));
}

module.exports = {
  initiateCall,
  endCall,
  escalateToHuman,
  handleIncomingAudio,
  setupWebSocketHandler,
  getActiveSessions,
  liveEvents,
  estimateSentiment,
};
