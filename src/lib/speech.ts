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

export type SpeechClaim = { provider: VoiceProfile["provider"]; voiceId: string; text: string };

export function signSpeech(voice: VoiceProfile, text: string): string {
  const payload = Buffer.from(
    JSON.stringify({ p: voice.provider, v: voice.voiceId, t: text })
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
    };
    if (typeof raw.p !== "string" || typeof raw.v !== "string" || typeof raw.t !== "string") return null;
    if (raw.t.length === 0 || raw.t.length > MAX_SPOKEN_CHARS) return null;
    return { provider: raw.p as VoiceProfile["provider"], voiceId: raw.v, text: raw.t };
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
// Synthesis: stream to the listener, cache as it passes
// ---------------------------------------------------------------------------

const MAX_CACHE_ENTRIES = 200;
type CachedAudio = { data: Uint8Array; mimeType: string };
const cache = new Map<string, CachedAudio>();

function cacheKey(claim: SpeechClaim): string {
  return createHash("sha256").update(`${claim.provider}|${claim.voiceId}|${claim.text}`).digest("hex");
}

function remember(key: string, audio: CachedAudio): void {
  cache.set(key, audio);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Read a stream to the end and keep it, but only if it finished cleanly. */
async function collect(key: string, mimeType: string, stream: ReadableStream<Uint8Array>): Promise<void> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
      }
    }
  } catch {
    return; // an interrupted line is never cached
  }
  if (total === 0) return;
  const data = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    data.set(c, offset);
    offset += c.byteLength;
  }
  remember(key, { data, mimeType });
}

export type OpenedSpeech = {
  /** Bytes already in hand (a cache hit), or a stream that is still being produced */
  body: Uint8Array | ReadableStream<Uint8Array>;
  mimeType: string;
  cached: boolean;
};

/**
 * Open the spoken audio for a verified claim.
 *
 * A repeated line comes straight from the cache. A new line is streamed from the
 * provider: the listener receives the first bytes as soon as they exist, and a
 * second branch of the same stream fills the cache, so the line is paid for once
 * even if the listener leaves early. The spend cap is charged when synthesis starts.
 */
export async function openSpeech(claim: SpeechClaim): Promise<OpenedSpeech> {
  const key = cacheKey(claim);

  const hit = cache.get(key);
  if (hit) {
    cache.delete(key); // refresh recency
    cache.set(key, hit);
    return { body: hit.data, mimeType: hit.mimeType, cached: true };
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
      targetFormat: "mp3" as const,
      fallbackPolicy: "captions_only" as const,
    },
    requestId: key.slice(0, 16),
  };

  try {
    // A provider without streaming still works; it just cannot start early.
    if (!tts.synthesizeStream) {
      const audio = await tts.synthesize(request);
      remember(key, { data: audio.data, mimeType: audio.mimeType });
      return { body: audio.data, mimeType: audio.mimeType, cached: false };
    }

    const { stream, mimeType } = await tts.synthesizeStream(request);
    const [toListener, toCache] = stream.tee();
    void collect(key, mimeType, toCache);
    return { body: toListener, mimeType, cached: false };
  } catch (err) {
    // Nothing was produced, so nothing was billed: give the characters back.
    refundSpeechBudget(claim.text.length);
    throw err;
  }
}

/** For tests. */
export function clearSpeechCache(): void {
  cache.clear();
}
