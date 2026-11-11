/**
 * scripts/audition/lib.ts
 * Pure helpers for the voice audition tools: choosing test lines, hiding
 * candidate names behind letters, matching loudness, and scoring.
 * DEVELOPMENT-ONLY.
 */

// ── choosing lines ─────────────────────────────────────────────────────────

/** `n` items spread evenly across the list (keeps variety instead of taking the first few). */
export function pickSpread<T>(items: T[], n: number): T[] {
  if (n <= 0 || items.length === 0) return [];
  if (items.length <= n) return [...items];
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(items[Math.floor(((i + 0.5) * items.length) / n)]);
  return out;
}

export type TestLine = { source: "authored" | "playtest" | "narration"; text: string };

export const MIN_LINE = 50;
export const MAX_LINE = 260;

/** Authored lines (including the cover stories a character gives when holding something back). */
export function authoredLines(facts: Array<{ line?: string; lockedLine?: string }>, n: number): TestLine[] {
  const pool: string[] = [];
  for (const f of facts) {
    for (const t of [f.line, f.lockedLine]) {
      const text = t?.replace(/^\.\.\./, "").trim();
      if (text && text.length >= MIN_LINE && text.length <= MAX_LINE && !pool.includes(text)) pool.push(text);
    }
  }
  return pickSpread(pool, n).map((text) => ({ source: "authored", text }));
}

/** Lines the live model really wrote for this character in a playtest. */
export function playtestLines(
  events: Array<{ kind: string; character?: string; reply?: string }>,
  characterId: string,
  n: number
): TestLine[] {
  const pool: string[] = [];
  for (const e of events) {
    if (e.kind !== "turn" || e.character !== characterId || !e.reply) continue;
    const text = e.reply.trim();
    if (text.length >= MIN_LINE && text.length <= MAX_LINE && !pool.includes(text)) pool.push(text);
  }
  return pickSpread(pool, n).map((text) => ({ source: "playtest", text }));
}

/** Trim long narration at a sentence boundary so a clip stays short enough to compare. */
export function clipAtSentence(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return end > max * 0.4 ? cut.slice(0, end + 1) : cut.trim();
}

// ── hiding names ───────────────────────────────────────────────────────────

/** Small seeded random numbers so a round can be rebuilt with the same letters. */
export function seeded(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Assign letters A, B, C... to candidates in a shuffled order. Returns letter -> candidate id. */
export function blindLabels(ids: string[], seed: number): Record<string, string> {
  const rand = seeded(seed);
  const order = [...ids];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const out: Record<string, string> = {};
  order.forEach((id, i) => (out[String.fromCharCode(65 + i)] = id));
  return out;
}

export function seedFor(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h;
}

// ── audio ──────────────────────────────────────────────────────────────────

export type Wav = { sampleRate: number; channels: number; samples: Int16Array };

/** Read a 16-bit PCM WAV, tolerating streamed files whose header sizes are unset. */
export function parseWav(buf: Buffer): Wav {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("not a WAV file");
  }
  let pos = 12;
  let sampleRate = 24000;
  let channels = 1;
  let bits = 16;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    let size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === "fmt ") {
      channels = buf.readUInt16LE(body + 2);
      sampleRate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
    } else if (id === "data") {
      if (bits !== 16) throw new Error(`only 16-bit WAV is supported (got ${bits})`);
      if (size === 0 || size === 0xffffffff || body + size > buf.length) size = buf.length - body;
      size -= size % 2;
      const samples = new Int16Array(size / 2);
      for (let i = 0; i < samples.length; i++) samples[i] = buf.readInt16LE(body + i * 2);
      return { sampleRate, channels, samples };
    }
    pos = body + size + (size % 2);
  }
  throw new Error("WAV has no data chunk");
}

export function encodeWav(w: Wav): Buffer {
  const dataBytes = w.samples.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(w.channels, 22);
  buf.writeUInt32LE(w.sampleRate, 24);
  buf.writeUInt32LE(w.sampleRate * w.channels * 2, 28);
  buf.writeUInt16LE(w.channels * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataBytes, 40);
  w.samples.forEach((s, i) => buf.writeInt16LE(s, 44 + i * 2));
  return buf;
}

export function rmsDb(samples: Int16Array): number {
  if (samples.length === 0) return -120;
  let sum = 0;
  for (const s of samples) sum += (s / 32768) ** 2;
  return 20 * Math.log10(Math.sqrt(sum / samples.length) || 1e-6);
}

/**
 * Bring a clip to a common loudness so a louder voice does not win by being
 * louder. Scales toward `targetDb` RMS, but never past a safe peak.
 */
export function matchLoudness(w: Wav, targetDb = -22, peakCeiling = 0.95): Wav {
  const current = rmsDb(w.samples);
  let gain = 10 ** ((targetDb - current) / 20);
  let peak = 1;
  for (const s of w.samples) peak = Math.max(peak, Math.abs(s));
  gain = Math.min(gain, (peakCeiling * 32767) / peak);
  const out = new Int16Array(w.samples.length);
  for (let i = 0; i < out.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(w.samples[i] * gain)));
  return { ...w, samples: out };
}

// ── scoring ────────────────────────────────────────────────────────────────

/** Weights from the build plan's rubric. Ear scores are out of 80; latency and cost add 20. */
export const WEIGHTS = { authenticity: 30, emotion: 25, consistency: 15, clarity: 10, latency: 15, cost: 5 } as const;

export type EarScores = { authenticity: number; emotion: number; consistency: number; clarity: number };

/** Each slider is 1 to 10. */
export function earPoints(s: EarScores): number {
  return (
    (WEIGHTS.authenticity * s.authenticity) / 10 +
    (WEIGHTS.emotion * s.emotion) / 10 +
    (WEIGHTS.consistency * s.consistency) / 10 +
    (WEIGHTS.clarity * s.clarity) / 10
  );
}

/** 15 points at or under 0.4 s to first audio, none at or over 1.5 s. */
export function latencyPoints(ttfbMs: number | undefined): number {
  if (ttfbMs === undefined) return WEIGHTS.latency / 2;
  const t = Math.max(0, Math.min(1, (1500 - ttfbMs) / (1500 - 400)));
  return WEIGHTS.latency * t;
}

/** The cheapest candidate gets the full 5; others in proportion. Unknown cost is neutral. */
export function costPoints(cost: number | undefined, cheapest: number | undefined): number {
  if (cost === undefined || cheapest === undefined || cost <= 0) return WEIGHTS.cost / 2;
  return WEIGHTS.cost * Math.min(1, cheapest / cost);
}

export function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
