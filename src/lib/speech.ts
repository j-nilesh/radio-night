/**
 * lib/speech.ts
 * Signed speech links, a synthesis cache, and a daily spend cap.
 * SERVER-ONLY.
 *
 * The browser never asks for "speak this text". The server decides what is
 * said, signs {voice, text} into a link, and hands that link out. The audio
 * endpoint verifies the signature before it spends anything, so it cannot be
 * used as a free general-purpose voice service.
 *
 * The link is stateless (the text rides inside it), so it works across
 * serverless instances. The cache and the budget below are per-instance and
 * reset on restart: a guard against runaway cost, not a ledger.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { VoiceProfile } from "@providers";
import type { CaseContent } from "@ai-orchestration/case-content";
import { getProviders } from "./providers";

/** Longest line we will ever voice. Game text is far shorter. */
const MAX_SPOKEN_CHARS = 4000;

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

function secret(): string {
  const s = process.env.GUEST_TOKEN_SECRET;
  if (!s || s.length < 16) throw new Error("GUEST_TOKEN_SECRET is not set or too short.");
  return s;
}

function mac(payload: string): string {
  return createHmac("sha256", secret()).update(`speech-v1:${payload}`).digest("base64url");
}

export type SpeechFormat = "pcm16" | "mp3";
const FORMATS: ReadonlySet<string> = new Set<SpeechFormat>(["pcm16", "mp3"]);

export type SpeechClaim = {
  provider: VoiceProfile["provider"];
  voiceId: string;
  text: string;
  format: SpeechFormat;
};

export function signSpeech(voice: VoiceProfile, text: string): string {
  const payload = Buffer.from(
    JSON.stringify({ p: voice.provider, v: voice.voiceId, t: text, f: voice.targetFormat })
  ).toString("base64url");
  return `${payload}.${mac(payload)}`;
}

export function verifySpeech(token: string): SpeechClaim | null {
  if (typeof token !== "string" || token.length > 12_000) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const payload = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(mac(payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const raw = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      p?: unknown;
      v?: unknown;
      t?: unknown;
      f?: unknown;
    };
    if (typeof raw.p !== "string" || typeof raw.v !== "string" || typeof raw.t !== "string") return null;
    if (typeof raw.f !== "string" || !FORMATS.has(raw.f)) return null;
    if (raw.t.length === 0 || raw.t.length > MAX_SPOKEN_CHARS) return null;
    return {
      provider: raw.p as VoiceProfile["provider"],
      voiceId: raw.v,
      text: raw.t,
      format: raw.f as SpeechFormat,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Handing out links
// ---------------------------------------------------------------------------

/** True when a real voice provider is configured (not the silent mock). */
export function voiceIsAvailable(): boolean {
  return getProviders().tts.providerName !== "mock";
}

/**
 * A link to the spoken version of `text`, or undefined when nothing should be
 * voiced: no voice is cast, voice is off, or the voice is pinned to a provider
 * other than the one that is live.
 */
export function speechUrl(voice: VoiceProfile | undefined, text: string): string | undefined {
  if (!voice || !text.trim() || text.length > MAX_SPOKEN_CHARS) return undefined;
  const tts = getProviders().tts;
  if (tts.providerName === "mock" || voice.provider !== tts.providerName) return undefined;
  return `/api/speech?t=${encodeURIComponent(signSpeech(voice, text))}`;
}

/** Who speaks the reply to a turn: a character, the narrator, or no one. */
export function voiceForTurn(
  c: CaseContent,
  reply: { responseText: string; systemMessage?: boolean; classification: { category: string } },
  targetCharacterId?: string
): VoiceProfile | undefined {
  if (reply.systemMessage || !reply.responseText.trim()) return undefined;
  if (reply.classification.category === "CONTROL_COMMAND") return c.narratorVoice;
  return c.characters.find((ch) => ch.id === targetCharacterId)?.voiceProfile;
}

/** The voice for an opening line: the narrator, or the named character. */
export function voiceForOpening(
  c: CaseContent,
  line: { actor: "narrator" | "character"; speakerName?: string }
): VoiceProfile | undefined {
  if (line.actor === "narrator") return c.narratorVoice;
  return c.characters.find((ch) => ch.name === line.speakerName)?.voiceProfile;
}

// ---------------------------------------------------------------------------
// Spend cap
// ---------------------------------------------------------------------------

export class SpeechBudgetExceeded extends Error {
  constructor() {
    super("Daily voice budget reached.");
    this.name = "SpeechBudgetExceeded";
  }
}

const DEFAULT_DAILY_CHARS = 100_000;
let budgetDay = "";
let budgetUsed = 0;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Reserve characters against today's cap, or throw. Cache hits cost nothing. */
export function spendSpeechBudget(chars: number): void {
  const cap = Number(process.env.TTS_DAILY_CHAR_BUDGET ?? DEFAULT_DAILY_CHARS);
  const limit = Number.isFinite(cap) && cap >= 0 ? cap : DEFAULT_DAILY_CHARS;
  if (budgetDay !== today()) {
    budgetDay = today();
    budgetUsed = 0;
  }
  if (budgetUsed + chars > limit) throw new SpeechBudgetExceeded();
  budgetUsed += chars;
}

/** Today's spend against the cap, for development telemetry. */
export function speechBudgetStatus(): { used: number; cap: number } {
  const cap = Number(process.env.TTS_DAILY_CHAR_BUDGET ?? DEFAULT_DAILY_CHARS);
  return { used: budgetDay === today() ? budgetUsed : 0, cap: Number.isFinite(cap) && cap >= 0 ? cap : DEFAULT_DAILY_CHARS };
}

/** Give back characters reserved for a line that never started (nothing was billed). */
function refundSpeechBudget(chars: number): void {
  budgetUsed = Math.max(0, budgetUsed - chars);
}

/** For tests. */
export function resetSpeechBudget(): void {
  budgetDay = "";
  budgetUsed = 0;
}

// ---------------------------------------------------------------------------
// Synthesis: one upstream request per line, shared by every listener
// ---------------------------------------------------------------------------

/** Raw PCM is about 48 KB per second of speech, so the cache is bounded by bytes. */
const MAX_CACHE_BYTES = 80 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 300;

type CachedAudio = { data: Uint8Array; mimeType: string };
const cache = new Map<string, CachedAudio>();
let cacheBytes = 0;

function cacheKey(claim: SpeechClaim): string {
  return createHash("sha256")
    .update(`${claim.provider}|${claim.voiceId}|${claim.format}|${claim.text}`)
    .digest("hex");
}

function remember(key: string, audio: CachedAudio): void {
  const prior = cache.get(key);
  if (prior) cacheBytes -= prior.data.byteLength;
  cache.set(key, audio);
  cacheBytes += audio.data.byteLength;
  while ((cache.size > MAX_CACHE_ENTRIES || cacheBytes > MAX_CACHE_BYTES) && cache.size > 1) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cacheBytes -= cache.get(oldest)!.data.byteLength;
    cache.delete(oldest);
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

/**
 * One line of speech being produced right now. Every listener, however many
 * and however late, receives everything from the start and then follows the
 * live feed, so a line is synthesised (and billed) once no matter how many
 * requests arrive for it.
 */
class LiveAudio {
  readonly chunks: Uint8Array[] = [];
  done = false;
  error: Error | null = null;
  private waiting: Array<() => void> = [];

  constructor(readonly mimeType: string) {}

  push(chunk: Uint8Array): void {
    this.chunks.push(chunk);
    this.notify();
  }
  finish(): void {
    this.done = true;
    this.notify();
  }
  fail(err: Error): void {
    this.error = err;
    this.notify();
  }
  private notify(): void {
    const w = this.waiting;
    this.waiting = [];
    for (const wake of w) wake();
  }

  listen(): ReadableStream<Uint8Array> {
    let next = 0;
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the stream callbacks need the entry
    const entry = this;
    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        while (true) {
          if (next < entry.chunks.length) {
            controller.enqueue(entry.chunks[next++]);
            return;
          }
          if (entry.error) {
            controller.error(entry.error);
            return;
          }
          if (entry.done) {
            controller.close();
            return;
          }
          await new Promise<void>((resolve) => entry.waiting.push(resolve));
        }
      },
    });
  }
}

const live = new Map<string, LiveAudio>();

export type OpenedSpeech = {
  /** Bytes already in hand (a cache hit), or a stream that is still being produced */
  body: Uint8Array | ReadableStream<Uint8Array>;
  mimeType: string;
  /** cache: already made; new: this request started the synthesis; shared: joined one in progress */
  source: "cache" | "new" | "shared";
  /** Same as source === "cache" */
  cached: boolean;
};

/**
 * Open the spoken audio for a verified claim.
 *
 * A repeated line comes straight from the cache. A line already being made is
 * shared. Otherwise it is synthesised once, streamed to the listener as it is
 * produced, and kept for next time even if the listener leaves early. The spend
 * cap is charged once, when synthesis starts.
 */
export async function openSpeech(claim: SpeechClaim): Promise<OpenedSpeech> {
  const key = cacheKey(claim);

  const hit = cache.get(key);
  if (hit) {
    cache.delete(key); // refresh recency
    cache.set(key, hit);
    return { body: hit.data, mimeType: hit.mimeType, source: "cache", cached: true };
  }

  const running = live.get(key);
  if (running) {
    return { body: running.listen(), mimeType: running.mimeType, source: "shared", cached: false };
  }

  spendSpeechBudget(claim.text.length);

  const tts = getProviders().tts;
  const request = {
    text: claim.text,
    voice: {
      characterId: "speech",
      provider: claim.provider,
      model: "",
      voiceId: claim.voiceId,
      delivery: {},
      targetFormat: claim.format,
      fallbackPolicy: "captions_only" as const,
    },
    requestId: key.slice(0, 16),
  };

  let upstream: { stream: ReadableStream<Uint8Array>; mimeType: string };
  try {
    // A provider without streaming still works; it just cannot start early.
    if (!tts.synthesizeStream) {
      const audio = await tts.synthesize(request);
      remember(key, { data: audio.data, mimeType: audio.mimeType });
      return { body: audio.data, mimeType: audio.mimeType, source: "new", cached: false };
    }
    upstream = await tts.synthesizeStream(request);
  } catch (err) {
    // Nothing was produced, so nothing was billed: give the characters back.
    refundSpeechBudget(claim.text.length);
    throw err;
  }

  const entry = new LiveAudio(upstream.mimeType);
  live.set(key, entry);

  void (async () => {
    const reader = upstream.stream.getReader();
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          entry.push(value);
          total += value.byteLength;
        }
      }
      if (total === 0) {
        entry.fail(new Error("Voice synthesis returned no audio."));
      } else {
        remember(key, { data: concat(entry.chunks), mimeType: upstream.mimeType });
        entry.finish();
      }
    } catch (err) {
      entry.fail(err instanceof Error ? err : new Error("Voice stream was interrupted."));
    } finally {
      live.delete(key); // an interrupted line is never cached; a retry starts fresh
    }
  })();

  return { body: entry.listen(), mimeType: upstream.mimeType, source: "new", cached: false };
}

/** For tests. */
export function clearSpeechCache(): void {
  cache.clear();
  cacheBytes = 0;
  live.clear();
}
