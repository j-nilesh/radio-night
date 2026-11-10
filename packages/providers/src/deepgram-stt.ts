/**
 * providers/deepgram-stt.ts
 * Speech-to-text through Deepgram's pre-recorded endpoint (POST /v1/listen).
 * SERVER-ONLY: it holds the API key.
 *
 * The recording is sent as raw bytes; Deepgram identifies the container
 * (WebM from Chrome, MP4 from Safari) on its own. Nothing is stored here, and
 * neither the audio, the transcript, nor the key is ever logged.
 *
 * Failure modes are explicit: a network problem, timeout, or non-2xx answer
 * throws SpeechProviderError, which the orchestrator turns into a spoken-style
 * notice instead of a crash. Silence or unintelligible audio is not an error:
 * it returns an empty transcript with zero confidence.
 */

import type { SpeechToTextProvider, SpeechContext, TranscriptResult } from "./types";

const ENDPOINT = "https://api.deepgram.com/v1/listen";
const DEFAULT_MODEL = "nova-3";
const DEFAULT_TIMEOUT_MS = 15_000;
/** Deepgram accepts up to 100 keyterms per request. */
const MAX_KEYTERMS = 100;

export class SpeechProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "SpeechProviderError";
  }
}

export type DeepgramOptions = {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  /** Injected in tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
};

/** Reduce "audio/webm;codecs=opus" to "audio/webm", or undefined if it is not a plain media type. */
export function cleanMediaType(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const base = raw.split(";")[0].trim().toLowerCase();
  return /^(audio|video)\/[a-z0-9.+-]{1,40}$/.test(base) ? base : undefined;
}

type DeepgramResponse = {
  metadata?: { duration?: number };
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
        confidence?: number;
        words?: Array<{ word?: string; start?: number; end?: number }>;
      }>;
    }>;
  };
};

export class DeepgramSpeechToTextProvider implements SpeechToTextProvider {
  readonly providerName = "deepgram";

  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: DeepgramOptions) {
    if (!opts.apiKey) throw new Error("DeepgramSpeechToTextProvider requires an API key.");
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? DEFAULT_MODEL;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  /** The request URL for a given context. Exposed for tests. */
  buildUrl(context: SpeechContext): string {
    const params = new URLSearchParams({
      model: this.model,
      language: "en",
      smart_format: "true",
    });
    // Repeat the parameter for separate terms, as Deepgram requires.
    for (const term of (context.keyterms ?? []).slice(0, MAX_KEYTERMS)) {
      const t = term.trim();
      if (t) params.append("keyterm", t);
    }
    return `${ENDPOINT}?${params.toString()}`;
  }

  async transcribe(audio: Uint8Array, context: SpeechContext): Promise<TranscriptResult> {
    const headers: Record<string, string> = { Authorization: `Token ${this.apiKey}` };
    const mediaType = cleanMediaType(context.mimeType);
    if (mediaType) headers["Content-Type"] = mediaType;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(this.buildUrl(context), {
        method: "POST",
        headers,
        body: audio as unknown as BodyInit,
        signal: controller.signal,
      });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "AbortError";
      throw new SpeechProviderError(
        timedOut ? "Speech recognition timed out." : "Could not reach the speech recognition service."
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      // Status only. The body can echo request details, so it is not propagated.
      throw new SpeechProviderError(
        `Speech recognition failed (HTTP ${response.status}).`,
        response.status
      );
    }

    let data: DeepgramResponse;
    try {
      data = (await response.json()) as DeepgramResponse;
    } catch {
      throw new SpeechProviderError("Speech recognition returned an unreadable answer.");
    }

    const best = data.results?.channels?.[0]?.alternatives?.[0];
    const text = typeof best?.transcript === "string" ? best.transcript.trim() : "";
    const durationMs = Math.round((data.metadata?.duration ?? 0) * 1000);

    // Silence or noise: nothing was said that we can act on.
    if (!text) return { text: "", confidence: 0, durationMs };

    const confidence =
      typeof best?.confidence === "number" && Number.isFinite(best.confidence)
        ? Math.min(1, Math.max(0, best.confidence))
        : 0;

    return {
      text,
      confidence,
      durationMs,
      words: best?.words
        ?.filter((w) => typeof w.word === "string")
        .map((w) => ({
          word: w.word as string,
          startMs: Math.round((w.start ?? 0) * 1000),
          endMs: Math.round((w.end ?? 0) * 1000),
        })),
    };
  }
}
