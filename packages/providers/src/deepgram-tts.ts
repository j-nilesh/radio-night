/**
 * providers/deepgram-tts.ts
 * Text-to-speech through Deepgram Aura-2 (POST /v1/speak).
 * SERVER-ONLY: it holds the API key.
 *
 * A character's VoiceProfile pins the voice: `voiceId` is the Deepgram model
 * name (for example "aura-2-pluto-en"). The adapter refuses a profile pinned
 * to another provider, so a voice can never be swapped silently.
 *
 * Output formats, chosen by the voice's targetFormat:
 *   pcm16  raw 16-bit little-endian mono PCM at 24 kHz (no file header). This is
 *          the default for the game: a browser can play it with Web Audio as it
 *          arrives, in every browser, with no media-element quirks.
 *   mp3    kept for tools and fallbacks.
 *
 * Deepgram's limit is 2,000 characters per request; longer text is split on
 * sentence boundaries and the audio parts are joined. Unsupported delivery
 * settings (pace, stability, expressiveness) are ignored: Aura exposes none.
 *
 * Neither the key nor the text is ever logged, and errors carry the HTTP
 * status only.
 */

import type {
  TextToSpeechProvider,
  TTSRequest,
  TTSAudio,
  TTSStream,
  VoiceProfile,
} from "./types";
import { SpeechProviderError } from "./deepgram-stt";

const ENDPOINT = "https://api.deepgram.com/v1/speak";
const DEFAULT_TIMEOUT_MS = 20_000;
/** Ceiling on one whole streamed line, so a stalled upstream cannot hang forever. */
const STREAM_DEADLINE_MS = 90_000;
/** Deepgram's cap is 2,000; leave headroom. */
const MAX_CHUNK_CHARS = 1800;
/** MP3 from Deepgram defaults to 48 kbps. */
const MP3_BITS_PER_SECOND = 48_000;
export const PCM_SAMPLE_RATE = 24_000;
const PCM_BYTES_PER_SECOND = PCM_SAMPLE_RATE * 2; // 16-bit mono
export const PCM_MIME = `audio/L16;rate=${PCM_SAMPLE_RATE};channels=1`;

export type SpeechFormat = "pcm16" | "mp3";

function mimeFor(format: SpeechFormat): string {
  return format === "pcm16" ? PCM_MIME : "audio/mpeg";
}
/** e.g. aura-2-pluto-en. Validated so a voice id can never inject query parameters. */
const VOICE_ID = /^aura(-2)?-[a-z]+-[a-z]{2}$/;

export type DeepgramTtsOptions = {
  apiKey: string;
  timeoutMs?: number;
  /** Ceiling on one whole streamed line. */
  streamDeadlineMs?: number;
  /** Injected in tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
};

/** Split text into pieces of at most `max` characters, preferring sentence ends. */
export function splitForSpeech(text: string, max = MAX_CHUNK_CHARS): string[] {
  const clean = text.trim();
  if (clean.length <= max) return clean ? [clean] : [];

  const sentences = clean.split(/(?<=[.!?\u2026])\s+/);
  const chunks: string[] = [];
  let current = "";

  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const sentence of sentences) {
    // A single sentence longer than the limit: break it on words.
    if (sentence.length > max) {
      push();
      let line = "";
      for (const word of sentence.split(/\s+/)) {
        if ((line + " " + word).trim().length > max) {
          if (line) chunks.push(line.trim());
          line = word;
        } else {
          line = (line + " " + word).trim();
        }
      }
      if (line) chunks.push(line.trim());
      continue;
    }
    if ((current + " " + sentence).trim().length > max) push();
    current = (current + " " + sentence).trim();
  }
  push();
  return chunks;
}

export class DeepgramTextToSpeechProvider implements TextToSpeechProvider {
  readonly providerName = "deepgram";
  readonly supportedFormats: VoiceProfile["targetFormat"][] = ["pcm16", "mp3"];

  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly streamDeadlineMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: DeepgramTtsOptions) {
    if (!opts.apiKey) throw new Error("DeepgramTextToSpeechProvider requires an API key.");
    this.apiKey = opts.apiKey;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.streamDeadlineMs = opts.streamDeadlineMs ?? STREAM_DEADLINE_MS;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  /** The request URL for a voice. Exposed for tests. */
  buildUrl(voiceId: string, format: SpeechFormat = "mp3"): string {
    const base = `${ENDPOINT}?model=${encodeURIComponent(voiceId)}`;
    return format === "pcm16"
      ? `${base}&encoding=linear16&container=none&sample_rate=${PCM_SAMPLE_RATE}`
      : `${base}&encoding=mp3`;
  }

  /** Validates the request and returns the voice id and the pieces of text to speak. */
  private prepare(request: TTSRequest): { voiceId: string; parts: string[]; format: SpeechFormat } {
    const { voice } = request;

    if (voice.provider !== "deepgram") {
      throw new SpeechProviderError("This voice is pinned to a different provider.");
    }
    if (!VOICE_ID.test(voice.voiceId)) {
      throw new SpeechProviderError("Unrecognised Deepgram voice.");
    }

    if (voice.targetFormat !== "pcm16" && voice.targetFormat !== "mp3") {
      throw new SpeechProviderError("This voice asks for an audio format that is not supported.");
    }

    const parts = splitForSpeech(request.text);
    if (parts.length === 0) throw new SpeechProviderError("There is nothing to say.");
    return { voiceId: voice.voiceId, parts, format: voice.targetFormat };
  }

  async synthesize(request: TTSRequest): Promise<TTSAudio> {
    const { voiceId, parts, format } = this.prepare(request);

    const buffers: Uint8Array[] = [];
    for (const part of parts) {
      buffers.push(await this.speakOne(part, voiceId, format));
    }

    const data = buffers.length === 1 ? buffers[0] : concat(buffers);
    return {
      data,
      mimeType: mimeFor(format),
      sampleRate: format === "pcm16" ? PCM_SAMPLE_RATE : undefined,
      durationMs:
        format === "pcm16"
          ? Math.round((data.byteLength * 1000) / PCM_BYTES_PER_SECOND)
          : Math.round((data.byteLength * 8 * 1000) / MP3_BITS_PER_SECOND),
    };
  }

  /**
   * Streams the audio. The first part is requested before returning, so a bad key
   * or voice surfaces as an error here instead of as a silent, empty stream. Later
   * parts of a long line are requested only as playback needs them.
   */
  async synthesizeStream(request: TTSRequest): Promise<TTSStream> {
    const { voiceId, parts, format } = this.prepare(request);

    const deadline = new AbortController();
    const deadlineTimer = setTimeout(() => deadline.abort(), this.streamDeadlineMs);
    const done = () => clearTimeout(deadlineTimer);

    let first: ReadableStreamDefaultReader<Uint8Array>;
    try {
      first = await this.openOne(parts[0], voiceId, format, deadline.signal);
    } catch (err) {
      done();
      throw err;
    }

    let current: ReadableStreamDefaultReader<Uint8Array> | null = first;
    let next = 1;

    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          while (true) {
            if (!current) {
              if (next >= parts.length) {
                done();
                controller.close();
                return;
              }
              current = await open(parts[next++]);
            }
            const { done: finished, value } = await current.read();
            if (finished) {
              current = null;
              continue;
            }
            if (value && value.byteLength > 0) {
              controller.enqueue(value);
              return;
            }
          }
        } catch (err) {
          done();
          controller.error(
            err instanceof SpeechProviderError ? err : new SpeechProviderError("Voice stream was interrupted.")
          );
        }
      },
      cancel() {
        done();
        deadline.abort();
      },
    });

    const open = (text: string) => this.openOne(text, voiceId, format, deadline.signal);
    return { stream, mimeType: mimeFor(format) };
  }

  /** Sends one request and returns a reader for its audio, or throws with a status only. */
  private async openOne(
    text: string,
    voiceId: string,
    format: SpeechFormat,
    signal: AbortSignal
  ): Promise<ReadableStreamDefaultReader<Uint8Array>> {
    // Two limits: a short one for connecting (cleared once headers arrive), and the
    // caller's signal, which also bounds the body for as long as it is being read.
    const connect = new AbortController();
    const timer = setTimeout(() => connect.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(this.buildUrl(voiceId, format), {
        method: "POST",
        headers: {
          Authorization: `Token ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
        signal: AbortSignal.any([signal, connect.signal]),
      });

      if (!response.ok) {
        throw new SpeechProviderError(
          response.status === 429
            ? "Voice synthesis is busy (HTTP 429)."
            : `Voice synthesis failed (HTTP ${response.status}).`,
          response.status
        );
      }
      if (!response.body) throw new SpeechProviderError("Voice synthesis returned no audio.");
      return response.body.getReader();
    } catch (err) {
      if (err instanceof SpeechProviderError) throw err;
      const timedOut = err instanceof Error && err.name === "AbortError";
      throw new SpeechProviderError(
        timedOut ? "Voice synthesis timed out." : "Could not reach the voice synthesis service."
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private async speakOne(text: string, voiceId: string, format: SpeechFormat): Promise<Uint8Array> {
    const reader = await this.openOne(text, voiceId, format, AbortSignal.timeout(this.streamDeadlineMs));
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
    } catch {
      throw new SpeechProviderError("Voice stream was interrupted.");
    }
    const bytes = concat(chunks);
    if (bytes.byteLength === 0) throw new SpeechProviderError("Voice synthesis returned no audio.");
    return bytes;
  }
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}
