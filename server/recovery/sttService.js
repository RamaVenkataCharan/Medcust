/**
 * STT Service — Deepgram Streaming Speech-to-Text
 * 
 * Real-time streaming STT via WebSocket.
 * Emits partial and final transcript events.
 */

const recoveryConfig = require('./recoveryConfig');
const { EventEmitter } = require('events');

class STTService extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.connected = false;
  }

  /**
   * Start a streaming STT session.
   * @param {Object} options - { sampleRate, encoding, channels }
   * @returns {Promise<void>}
   */
  async startSession(options = {}) {
    const { sampleRate = 8000, encoding = 'mulaw', channels = 1 } = options;

    if (!recoveryConfig.DEEPGRAM_API_KEY) {
      console.warn('[STT] Deepgram API key not configured — using mock STT');
      this.connected = true;
      this._useMock = true;
      return;
    }

    try {
      const WebSocket = require('ws');
      const params = new URLSearchParams({
        model: recoveryConfig.DEEPGRAM_MODEL,
        language: recoveryConfig.DEEPGRAM_LANGUAGE,
        punctuate: 'true',
        interim_results: 'true',
        endpointing: '300',
        encoding,
        sample_rate: sampleRate.toString(),
        channels: channels.toString(),
      });

      const url = `wss://api.deepgram.com/v1/listen?${params}`;

      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Token ${recoveryConfig.DEEPGRAM_API_KEY}`,
        },
      });

      this.ws.on('open', () => {
        this.connected = true;
        this.emit('ready');
      });

      this.ws.on('message', (data) => {
        try {
          const response = JSON.parse(data);
          if (response.channel?.alternatives?.[0]) {
            const alt = response.channel.alternatives[0];
            const transcript = alt.transcript || '';
            const isFinal = response.is_final || false;
            const confidence = alt.confidence || 0;

            if (transcript.trim()) {
              this.emit('transcript', {
                text: transcript,
                isFinal,
                confidence,
                words: alt.words || [],
              });
            }
          }
        } catch (err) {
          console.error('[STT] Parse error:', err.message);
        }
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.emit('closed');
      });

      this.ws.on('error', (err) => {
        console.error('[STT] WebSocket error:', err.message);
        this.emit('error', err);
      });
    } catch (err) {
      console.error('[STT] Failed to start session:', err.message);
      // Fallback to mock
      this._useMock = true;
      this.connected = true;
    }
  }

  /**
   * Send audio data to STT.
   * @param {Buffer} audioChunk
   */
  sendAudio(audioChunk) {
    if (this._useMock) {
      // Mock: emit a simulated transcript after receiving some audio
      return;
    }

    if (this.ws && this.ws.readyState === 1) { // WebSocket.OPEN
      this.ws.send(audioChunk);
    }
  }

  /**
   * Inject a mock transcript (for testing).
   * @param {string} text
   * @param {boolean} isFinal
   */
  injectMockTranscript(text, isFinal = true) {
    this.emit('transcript', {
      text,
      isFinal,
      confidence: 0.95,
      words: [],
    });
  }

  /**
   * End the STT session.
   */
  endSession() {
    this.connected = false;
    if (this.ws) {
      try {
        // Send close signal to Deepgram
        this.ws.send(JSON.stringify({ type: 'CloseStream' }));
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }
    this.removeAllListeners();
  }
}

module.exports = { STTService };
