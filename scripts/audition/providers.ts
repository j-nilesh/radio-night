/**
 * scripts/audition/providers.ts
 * Text-to-speech calls for the audition tools, one function per provider.
 * DEVELOPMENT-ONLY. Keys come from .env.local and are never printed.
 *
 * Deepgram, Cartesia and ElevenLabs are wired. Fish Audio is listed so the
 * casting file can name it; when its key arrives, add an adapter here and check
 * the request format against Fish's current documentation first.
 */
import type { Candidate, ProviderName } from "./casting";

export type Synth = { wav: Buffer; ttfbMs: number; totalMs: number };

const KEY_NAMES: Record<ProviderName, string> = {
  deepgram: "DEEPGRAM_API_KEY",
  elevenlabs: "ELEVENLABS_API_KEY",
  cartesia: "CARTESIA_API_KEY",
  fish: "FISH_AUDIO_API_KEY",
};

/** How many requests may run at once per provider. The new providers' plans allow very few. */
export const CONCURRENCY: Record<ProviderName, number> = { deepgram: 4, cartesia: 1, elevenlabs: 1, fish: 1 };

const WIRED: ProviderName[] = ["deepgram", "cartesia", "elevenlabs"];

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
  return retry(async () => {
    switch (c.provider) {
      case "deepgram":
        return deepgram(c.voice, text);
      case "cartesia":
        return cartesia(c.voice, c.model ?? "sonic-3.6", text);
      case "elevenlabs":
        return elevenlabs(c.voice, c.model ?? "eleven_flash_v2_5", text);
      default:
        throw new Error(`${c.provider} is not wired`);
    }
  });
}

/**
 * Network blips and "too busy" answers happen; try a few times before giving up.
 * A rejected voice name or key will not improve with a retry, but 429 (too many
 * requests) and 409 (a request is still running) clear up if we wait.
 */
export async function retry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const busy = e instanceof Error && /HTTP (429|409)/.test(e.message);
      if (e instanceof Error && /HTTP 4\d\d/.test(e.message) && !busy) break;
      await new Promise((r) => setTimeout(r, busy ? 1500 * attempt : 400 * attempt));
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

/** Read a streamed response, noting when the first bytes arrive. */
async function collect(res: Response, started: number): Promise<{ bytes: Buffer; ttfbMs: number; totalMs: number }> {
  if (!res.body) throw new Error("empty response");
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
  return { bytes: Buffer.concat(chunks), ttfbMs: Math.round(ttfbMs), totalMs: Math.round(performance.now() - started) };
}

/** Average interleaved left/right 16-bit samples into one mono channel. */
export function monoFromStereoPcm(stereo: Buffer): Buffer {
  const frames = Math.floor(stereo.length / 4);
  const mono = Buffer.alloc(frames * 2);
  for (let i = 0; i < frames; i++) {
    const l = stereo.readInt16LE(i * 4);
    const r = stereo.readInt16LE(i * 4 + 2);
    mono.writeInt16LE(Math.round((l + r) / 2), i * 2);
  }
  return mono;
}

/** Wrap raw 16-bit mono PCM in a WAV header. */
function wavFromPcm(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// Cartesia: POST /tts/bytes with a versioned header (docs.cartesia.ai/api-reference/tts/bytes)
async function cartesia(voiceId: string, model: string, text: string): Promise<Synth> {
  const key = process.env.CARTESIA_API_KEY!.trim();
  const started = performance.now();
  const res = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: { "X-API-Key": key, "Cartesia-Version": "2026-08-14", "Content-Type": "application/json" },
    body: JSON.stringify({
      model_id: model,
      transcript: text,
      voice: { id: voiceId },
      language: "en",
      output_format: { container: "wav", encoding: "pcm_s16le", sample_rate: 24000 },
    }),
  });
  if (!res.ok) throw new Error(`Cartesia HTTP ${res.status} for voice ${voiceId.slice(0, 8)}`);
  const r = await collect(res, started);
  return { wav: r.bytes, ttfbMs: r.ttfbMs, totalMs: r.totalMs };
}

// ElevenLabs: POST /v1/text-to-speech/{voice_id}, raw PCM at 24 kHz (elevenlabs.io/docs/api-reference/text-to-speech/convert)
async function elevenlabs(voiceId: string, model: string, text: string): Promise<Synth> {
  const key = process.env.ELEVENLABS_API_KEY!.trim();
  const started = performance.now();
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=pcm_24000`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: model }),
    }
  );
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { detail?: { status?: string; message?: string } };
      detail = j.detail?.status ? ` (${j.detail.status})` : "";
    } catch {
      /* no body */
    }
    throw new Error(`ElevenLabs HTTP ${res.status}${detail} for voice ${voiceId.slice(0, 8)}`);
  }
  const r = await collect(res, started);
  return { wav: wavFromPcm(r.bytes, 24000), ttfbMs: r.ttfbMs, totalMs: r.totalMs };
}

export type SoundSynth = { wav: Buffer; credits: number | undefined; totalMs: number };

/**
 * ElevenLabs sound effects: POST /v1/sound-generation (elevenlabs.io/docs/api-reference/text-to-sound-effects).
 * `loop` asks for a sound that repeats smoothly; duration is 0.5 to 30 seconds.
 * The credits spent are read from the response's character-cost header.
 */
export async function elevenlabsSound(prompt: string, seconds: number, loop: boolean): Promise<SoundSynth> {
  const status = providerStatus("elevenlabs");
  if (!status.ok) throw new Error(status.reason);
  const key = process.env.ELEVENLABS_API_KEY!.trim();
  return retry(async () => {
    const started = performance.now();
    const res = await fetch("https://api.elevenlabs.io/v1/sound-generation?output_format=pcm_24000", {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text: prompt, duration_seconds: seconds, loop, prompt_influence: 0.5 }),
    });
    if (!res.ok) {
      let detail = "";
      try {
        const j = (await res.json()) as { detail?: { status?: string } };
        detail = j.detail?.status ? ` (${j.detail.status})` : "";
      } catch {
        /* no body */
      }
      throw new Error(`ElevenLabs sound HTTP ${res.status}${detail}`);
    }
    // This endpoint returns two interleaved channels (stereo) even though speech is mono.
    // Reading it as mono doubled the length and dropped the pitch an octave, so mix down.
    const pcm = monoFromStereoPcm(Buffer.from(await res.arrayBuffer()));
    const cost = Number(res.headers.get("character-cost"));
    return { wav: wavFromPcm(pcm, 24000), credits: Number.isFinite(cost) ? cost : undefined, totalMs: Math.round(performance.now() - started) };
  });
}
