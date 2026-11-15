/**
 * providers/elevenlabs-tts.ts
 * Text-to-speech through ElevenLabs (POST /v1/text-to-speech/{voice_id}/stream).
 * SERVER-ONLY: it holds the API key.
 *
 * A character's VoiceProfile pins the voice: `voiceId` is the ElevenLabs voice id
 * and `model` the model (for example "eleven_flash_v2_5"). The adapter refuses a
 * profile pinned to another provider, so a voice can never be swapped silently.
 *
 * Output: raw 16-bit little-endian mono PCM at 24 kHz (output_format=pcm_24000),
 * the same as the other adapters. No other format.
 *
 * Failure modes (all surface as SpeechProviderError with a status and no text):
 *   401      key rejected, or the key lacks the Text to speech permission
 *   402/403  plan or credits do not allow the request
 *   404/422  voice id unknown to this account, or text refused
 *   409/429  another request is still running, or too many at once (the free plan
 *            allows one at a time)
 *   timeout  no response within `timeoutMs`; a stalled stream ends at `streamDeadlineMs`
 * The audition saw an occasional first-audio time of 5 to 15 seconds; the
 * connect timeout bounds that. The game falls back to captions for the line
 * (fallbackPolicy), never to another voice.
 *
 * Long text is split on sentence boundaries (1,800 characters, well under the
 * model limit). `delivery.stability`, when set, is sent as voice_settings.
 */
import type { TextToSpeechProvider, TTSRequest, TTSAudio, TTSStream, VoiceProfile } from "./types";
import { SpeechProviderError } from "./deepgram-stt";
import { PCM_MIME, PCM_SAMPLE_RATE, splitForSpeech } from "./deepgram-tts";
import { collectSpeech, openSpeechRequest, streamSpeech, DEFAULT_TIMEOUT_MS, STREAM_DEADLINE_MS } from "./tts-common";

const BASE = "https://api.elevenlabs.io/v1/text-to-speech";
export const ELEVENLABS_DEFAULT_MODEL = "eleven_flash_v2_5";
const PCM_BYTES_PER_SECOND = PCM_SAMPLE_RATE * 2;

const VOICE_ID = /^[A-Za-z0-9]{12,40}$/;
const MODEL_ID = /^[a-z0-9][a-z0-9._-]{1,40}$/i;

export type ElevenLabsTtsOptions = {
  apiKey: string;
  timeoutMs?: number;
  streamDeadlineMs?: number;
  /** Injected in tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
};

export class ElevenLabsTextToSpeechProvider implements TextToSpeechProvider {
  readonly providerName = "elevenlabs";
  readonly supportedFormats: VoiceProfile["targetFormat"][] = ["pcm16"];

  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly streamDeadlineMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ElevenLabsTtsOptions) {
    if (!opts.apiKey) throw new Error("ElevenLabsTextToSpeechProvider requires an API key.");
    this.apiKey = opts.apiKey;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.streamDeadlineMs = opts.streamDeadlineMs ?? STREAM_DEADLINE_MS;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  /** The request URL for a voice. Exposed for tests. */
  buildUrl(voiceId: string): string {
    return `${BASE}/${encodeURIComponent(voiceId)}/stream?output_format=pcm_${PCM_SAMPLE_RATE}`;
  }

  /** The JSON body for one piece of text. Exposed for tests. */
  buildBody(text: string, model: string, stability?: number): Record<string, unknown> {
    return { text, model_id: model, ...(stability !== undefined ? { voice_settings: { stability } } : {}) };
  }

  private prepare(request: TTSRequest): { voiceId: string; model: string; stability?: number; parts: string[] } {
    const { voice } = request;
    if (voice.provider !== "elevenlabs") throw new SpeechProviderError("This voice is pinned to a different provider.");
    if (!VOICE_ID.test(voice.voiceId)) throw new SpeechProviderError("Unrecognised ElevenLabs voice.");
    const model = voice.model || ELEVENLABS_DEFAULT_MODEL;
    if (!MODEL_ID.test(model)) throw new SpeechProviderError("Unrecognised ElevenLabs model.");
    if (voice.targetFormat !== "pcm16") throw new SpeechProviderError("This voice asks for an audio format that is not supported.");
    const parts = splitForSpeech(request.text);
    if (parts.length === 0) throw new SpeechProviderError("There is nothing to say.");
    return { voiceId: voice.voiceId, model, stability: voice.delivery.stability, parts };
  }

  private opener(voiceId: string, model: string, stability?: number) {
    return (text: string, signal: AbortSignal) =>
      openSpeechRequest({
        fetchImpl: this.fetchImpl,
        url: this.buildUrl(voiceId),
        init: {
          method: "POST",
          headers: { "xi-api-key": this.apiKey, "Content-Type": "application/json" },
          body: JSON.stringify(this.buildBody(text, model, stability)),
        },
        signal,
        connectTimeoutMs: this.timeoutMs,
        busyStatuses: [409, 429],
      });
  }

  async synthesize(request: TTSRequest): Promise<TTSAudio> {
    const { voiceId, model, stability, parts } = this.prepare(request);
    const data = await collectSpeech(parts, this.opener(voiceId, model, stability), this.streamDeadlineMs);
    return {
      data,
      mimeType: PCM_MIME,
      sampleRate: PCM_SAMPLE_RATE,
      durationMs: Math.round((data.byteLength * 1000) / PCM_BYTES_PER_SECOND),
    };
  }

  async synthesizeStream(request: TTSRequest): Promise<TTSStream> {
    const { voiceId, model, stability, parts } = this.prepare(request);
    return streamSpeech(parts, this.opener(voiceId, model, stability), this.streamDeadlineMs, PCM_MIME);
  }
}
