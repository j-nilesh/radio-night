/**
 * scripts/audition/providers.ts
 * Text-to-speech calls for the audition tools, one function per provider.
 * DEVELOPMENT-ONLY. Keys come from .env.local and are never printed.
 *
 * Only Deepgram is wired so far. The others are listed so the casting file can
 * name them; when a key arrives, add its adapter here and check the request
 * format against that provider's current documentation first.
 */
import type { Candidate, ProviderName } from "./casting";

export type Synth = { wav: Buffer; ttfbMs: number; totalMs: number };

const KEY_NAMES: Record<ProviderName, string> = {
  deepgram: "DEEPGRAM_API_KEY",
  elevenlabs: "ELEVENLABS_API_KEY",
  cartesia: "CARTESIA_API_KEY",
  fish: "FISH_AUDIO_API_KEY",
};

const WIRED: ProviderName[] = ["deepgram"];

/** Can this provider be used right now? If not, say why in one line. */
export function providerStatus(p: ProviderName): { ok: true } | { ok: false; reason: string } {
  const hasKey = !!process.env[KEY_NAMES[p]]?.trim();
  if (!hasKey) return { ok: false, reason: `${KEY_NAMES[p]} is not set in .env.local` };
  if (!WIRED.includes(p)) return { ok: false, reason: `${KEY_NAMES[p]} found, but the ${p} adapter is not written yet` };
  return { ok: true };
}

export async function synthesize(c: Candidate, text: string): Promise<Synth> {
  const status = providerStatus(c.provider);
  if (!status.ok) throw new Error(status.reason);
  // Network blips happen; try a few times before giving up on a clip.
  let last: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      switch (c.provider) {
        case "deepgram":
          return await deepgram(c.voice, text);
        default:
          throw new Error(`${c.provider} is not wired`);
      }
    } catch (e) {
      last = e;
      // A rejected voice name or key will not improve with a retry
      if (e instanceof Error && /HTTP 4\d\d/.test(e.message)) break;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  throw last;
}

async function deepgram(voice: string, text: string): Promise<Synth> {
  const key = process.env.DEEPGRAM_API_KEY!.trim();
  const started = performance.now();
  const res = await fetch(
    `https://api.deepgram.com/v1/speak?model=aura-2-${encodeURIComponent(voice)}-en&encoding=linear16&container=wav&sample_rate=24000`,
    {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }
  );
  if (!res.ok || !res.body) throw new Error(`Deepgram HTTP ${res.status} for voice "${voice}"`);

  const reader = res.body.getReader();
  const chunks: Buffer[] = [];
  let ttfbMs = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value && value.byteLength > 0) {
      if (chunks.length === 0) ttfbMs = performance.now() - started;
      chunks.push(Buffer.from(value));
    }
  }
  return { wav: Buffer.concat(chunks), ttfbMs: Math.round(ttfbMs), totalMs: Math.round(performance.now() - started) };
}
