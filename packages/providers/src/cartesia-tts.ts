/**
 * providers/cartesia-tts.ts
 * Text-to-speech through Cartesia (POST /tts/bytes).
 * SERVER-ONLY: it holds the API key.
 *
 * A character's VoiceProfile pins the voice: `voiceId` is the Cartesia voice
 * UUID and `model` the Sonic model (for example "sonic-3.6"). The adapter
 * refuses a profile pinned to another provider, so a voice can never be
 * swapped silently.
 *
 * Output: raw 16-bit little-endian mono PCM at 24 kHz, the same as the other
 * adapters, so the browser plays every voice the same way. No other format.
 *
 * Failure modes (all surface as SpeechProviderError with a status and no text):
 *   401/403  key rejected or plan lacks access
 *   402      credits exhausted
 *   404/400  voice id unknown to this account, or text refused
 *   429      too many concurrent requests (the free plan allows very few)
 *   timeout  no response within `timeoutMs`; a stalled stream ends at `streamDeadlineMs`
 * The game falls back to captions for that line (fallbackPolicy), never to
 * another voice.
 *
 * Long text is split on sentence boundaries. Cartesia's per-request limit was
 * not verified; the 1,800-character piece size is the conservative choice
 * already used for Deepgram. Pace and stability settings are ignored.
 */
import type { TextToSpeechProvider, TTSRequest, TTSAudio, TTSStream, VoiceProfile } from "./types";
import { SpeechProviderError } from "./deepgram-stt";
import { PCM_MIME, PCM_SAMPLE_RATE, splitForSpeech } from "./deepgram-tts";
import { collectSpeech, openSpeechRequest, streamSpeech, DEFAULT_TIMEOUT_MS, STREAM_DEADLINE_MS } from "./tts-common";

const ENDPOINT = "https://api.cartesia.ai/tts/bytes";
/** Cartesia asks every request to name an API version. */
export const CARTESIA_VERSION = "2026-08-14";
export const CARTESIA_DEFAULT_MODEL = "sonic-3.6";
const PCM_BYTES_PER_SECOND = PCM_SAMPLE_RATE * 2;

/** A UUID. Validated so a voice id can never inject anything into the request. */
const VOICE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODEL_ID = /^[a-z0-9][a-z0-9._-]{1,40}$/i;

export type CartesiaTtsOptions = {
  apiKey: string;
  timeoutMs?: number;
  streamDeadlineMs?: number;
  /** Injected in tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
};

export class CartesiaTextToSpeechProvider implements TextToSpeechProvider {
  readonly providerName = "cartesia";
  readonly supportedFormats: VoiceProfile["targetFormat"][] = ["pcm16"];

  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly streamDeadlineMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: CartesiaTtsOptions) {
    if (!opts.apiKey) throw new Error("CartesiaTextToSpeechProvider requires an API key.");
    this.apiKey = opts.apiKey;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.streamDeadlineMs = opts.streamDeadlineMs ?? STREAM_DEADLINE_MS;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  /** The JSON body for one piece of text. Exposed for tests. */
  buildBody(text: string, voiceId: string, model: string): Record<string, unknown> {
    return {
      model_id: model,
      transcript: text,
      voice: { mode: "id", id: voiceId },
      language: "en",
      output_format: { container: "raw", encoding: "pcm_s16le", sample_rate: PCM_SAMPLE_RATE },
    };
  }

  private prepare(request: TTSRequest): { voiceId: string; model: string; parts: string[] } {
    const { voice } = request;
    if (voice.provider !== "cartesia") throw new SpeechProviderError("This voice is pinned to a different provider.");
    if (!VOICE_ID.test(voice.voiceId)) throw new SpeechProviderError("Unrecognised Cartesia voice.");
    const model = voice.model || CARTESIA_DEFAULT_MODEL;
    if (!MODEL_ID.test(model)) throw new SpeechProviderError("Unrecognised Cartesia model.");
    if (voice.targetFormat !== "pcm16") throw new SpeechProviderError("This voice asks for an audio format that is not supported.");
    const parts = splitForSpeech(request.text);
    if (parts.length === 0) throw new SpeechProviderError("There is nothing to say.");
    return { voiceId: voice.voiceId, model, parts };
  }

  private opener(voiceId: string, model: string) {
    return (text: string, signal: AbortSignal) =>
      openSpeechRequest({
        fetchImpl: this.fetchImpl,
        url: ENDPOINT,
        init: {
          method: "POST",
          headers: { "X-API-Key": this.apiKey, "Cartesia-Version": CARTESIA_VERSION, "Content-Type": "application/json" },
          body: JSON.stringify(this.buildBody(text, voiceId, model)),
        },
        signal,
        connectTimeoutMs: this.timeoutMs,
        busyStatuses: [429],
      });
  }

  async synthesize(request: TTSRequest): Promise<TTSAudio> {
    const { voiceId, model, parts } = this.prepare(request);
    const data = await collectSpeech(parts, this.opener(voiceId, model), this.streamDeadlineMs);
    return {
      data,
      mimeType: PCM_MIME,
      sampleRate: PCM_SAMPLE_RATE,
      durationMs: Math.round((data.byteLength * 1000) / PCM_BYTES_PER_SECOND),
    };
  }

  async synthesizeStream(request: TTSRequest): Promise<TTSStream> {
    const { voiceId, model, parts } = this.prepare(request);
    return streamSpeech(parts, this.opener(voiceId, model), this.streamDeadlineMs, PCM_MIME);
  }
}
