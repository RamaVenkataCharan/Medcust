/**
 * TTS Service — Text-to-Speech (ElevenLabs / Azure Neural)
 * 
 * Supports Hindi-English code-switching for natural Hinglish output.
 * Falls back to mock mode when API keys are missing.
 */

const recoveryConfig = require('./recoveryConfig');

class TTSService {
  constructor() {
    this.provider = recoveryConfig.TTS_PROVIDER;
  }

  /**
   * Synthesize text to audio.
   * @param {string} text - Text to speak
   * @param {Object} options - { format, sampleRate }
   * @returns {Promise<Buffer>} Audio data
   */
  async synthesize(text, options = {}) {
    const { format = 'mp3', sampleRate = 8000 } = options;

    switch (this.provider) {
      case 'elevenlabs':
        return this._synthesizeElevenLabs(text, format);
      case 'azure':
        return this._synthesizeAzure(text, format, sampleRate);
      case 'mock':
      default:
        return this._synthesizeMock(text, format);
    }
  }

  // ── ElevenLabs ──

  async _synthesizeElevenLabs(text, format) {
    if (!recoveryConfig.ELEVENLABS_API_KEY || !recoveryConfig.ELEVENLABS_VOICE_ID) {
      console.warn('[TTS] ElevenLabs credentials not configured — using mock');
      return this._synthesizeMock(text, format);
    }

    try {
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${recoveryConfig.ELEVENLABS_VOICE_ID}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': recoveryConfig.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': format === 'pcm' ? 'audio/pcm' : 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',  // Supports Hindi-English code-switching
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      console.error('[TTS] ElevenLabs synthesis failed:', err.message);
      return this._synthesizeMock(text, format);
    }
  }

  // ── Azure Neural TTS ──

  async _synthesizeAzure(text, format, sampleRate) {
    if (!recoveryConfig.AZURE_TTS_KEY) {
      console.warn('[TTS] Azure TTS key not configured — using mock');
      return this._synthesizeMock(text, format);
    }

    try {
      const region = recoveryConfig.AZURE_TTS_REGION;
      const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

      // Build SSML with Hindi voice that handles code-switching
      const ssml = `
        <speak version='1.0' xml:lang='hi-IN'>
          <voice name='hi-IN-SwaraNeural'>
            <prosody rate='medium' pitch='default'>
              ${escapeXml(text)}
            </prosody>
          </voice>
        </speak>
      `.trim();

      const outputFormat = sampleRate <= 8000
        ? 'audio-8khz-8kbitrate-mono-mulaw'
        : 'audio-16khz-32kbitrate-mono-mp3';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': recoveryConfig.AZURE_TTS_KEY,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': outputFormat,
        },
        body: ssml,
      });

      if (!response.ok) {
        throw new Error(`Azure TTS error: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      console.error('[TTS] Azure synthesis failed:', err.message);
      return this._synthesizeMock(text, format);
    }
  }

  // ── Mock (for testing) ──

  async _synthesizeMock(text, _format) {
    // Return a minimal valid audio buffer (silence)
    // In a real scenario, this would be actual audio
    const silenceDurationMs = Math.min(text.length * 50, 5000); // ~50ms per char
    const sampleRate = 8000;
    const numSamples = Math.floor((silenceDurationMs / 1000) * sampleRate);
    const buffer = Buffer.alloc(numSamples); // mulaw silence = 0xFF
    buffer.fill(0xFF);

    console.log(`[Mock TTS] Generated ${silenceDurationMs}ms silence for: "${text.substring(0, 60)}..."`);
    return buffer;
  }
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Singleton
const ttsService = new TTSService();
module.exports = ttsService;
