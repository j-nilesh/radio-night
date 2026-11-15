/**
 * providers/tts-common.ts
 * Shared plumbing for the streaming voice adapters (Cartesia, ElevenLabs):
 * one connect-with-timeout request per piece of text, errors that carry an HTTP
 * status and never a key or the spoken text, and a stream that requests the
 * later pieces of a long line only as playback needs them.
 * SERVER-ONLY (the adapters that use it hold API keys).
 */
import { SpeechProviderError } from "./deepgram-stt";
import type { TTSStream } from "./types";

export const DEFAULT_TIMEOUT_MS = 20_000;
/** Ceiling on one whole streamed line, so a stalled upstream cannot hang forever. */
export const STREAM_DEADLINE_MS = 90_000;

export type OpenPart = (text: string, signal: AbortSignal) => Promise<ReadableStreamDefaultReader<Uint8Array>>;

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}

/**
 * Sends one request and returns a reader for its audio, or throws with a status only.
 * `busyStatuses` are the codes a provider uses for "another request is still running"
 * or "too many requests"; they get a plain message so the caller can tell them apart.
 */
export async function openSpeechRequest(opts: {
  fetchImpl: typeof fetch;
  url: string;
  init: Omit<RequestInit, "signal">;
  signal: AbortSignal;
  connectTimeoutMs: number;
  busyStatuses?: number[];
}): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  // Two limits: a short one for connecting (cleared once headers arrive), and the
  // caller's signal, which also bounds the body for as long as it is being read.
  const connect = new AbortController();
  const timer = setTimeout(() => connect.abort(), opts.connectTimeoutMs);
  try {
    const response = await opts.fetchImpl(opts.url, {
      ...opts.init,
      signal: AbortSignal.any([opts.signal, connect.signal]),
    });
    if (!response.ok) {
      const busy = (opts.busyStatuses ?? [429]).includes(response.status);
      throw new SpeechProviderError(
        busy ? `Voice synthesis is busy (HTTP ${response.status}).` : `Voice synthesis failed (HTTP ${response.status}).`,
        response.status
      );
    }
    if (!response.body) throw new SpeechProviderError("Voice synthesis returned no audio.");
    return response.body.getReader();
  } catch (err) {
    if (err instanceof SpeechProviderError) throw err;
    const timedOut = err instanceof Error && err.name === "AbortError";
    throw new SpeechProviderError(timedOut ? "Voice synthesis timed out." : "Could not reach the voice synthesis service.");
  } finally {
    clearTimeout(timer);
  }
}

/** Reads every piece to the end and joins them. */
export async function collectSpeech(parts: string[], open: OpenPart, deadlineMs: number): Promise<Uint8Array> {
  const buffers: Uint8Array[] = [];
  for (const part of parts) {
    const reader = await open(part, AbortSignal.timeout(deadlineMs));
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
    const bytes = concatBytes(chunks);
    if (bytes.byteLength === 0) throw new SpeechProviderError("Voice synthesis returned no audio.");
    buffers.push(bytes);
  }
  return buffers.length === 1 ? buffers[0] : concatBytes(buffers);
}

/**
 * Streams the audio. The first piece is requested before returning, so a bad key
 * or voice surfaces as an error here instead of as a silent, empty stream.
 */
export async function streamSpeech(parts: string[], open: OpenPart, deadlineMs: number, mimeType: string): Promise<TTSStream> {
  const deadline = new AbortController();
  const deadlineTimer = setTimeout(() => deadline.abort(), deadlineMs);
  const done = () => clearTimeout(deadlineTimer);

  let current: ReadableStreamDefaultReader<Uint8Array> | null;
  try {
    current = await open(parts[0], deadline.signal);
  } catch (err) {
    done();
    throw err;
  }
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
            current = await open(parts[next++], deadline.signal);
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
        controller.error(err instanceof SpeechProviderError ? err : new SpeechProviderError("Voice stream was interrupted."));
      }
    },
    cancel() {
      done();
      deadline.abort();
    },
  });
  return { stream, mimeType };
}
