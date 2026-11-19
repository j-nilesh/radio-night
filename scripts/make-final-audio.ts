/**
 * scripts/make-final-audio.ts
 * DEVELOPMENT-ONLY. Generates the sound that ships: the room beds, effects,
 * stings and music chosen by the blind audition (docs/voice-auditions.md), using
 * the winning prompts, on the paid ElevenLabs plan so the files carry its
 * commercial licence. Writes WAV files to public/audio/radio-night-s01 and
 * records the provenance in the audio manifest.
 *
 *   npx tsx scripts/make-final-audio.ts --dry            plan and credit estimate; calls nothing
 *   npx tsx scripts/make-final-audio.ts                  generate whatever is not generated yet
 *   npx tsx scripts/make-final-audio.ts amb-kitchen      only these cues
 *   npx tsx scripts/make-final-audio.ts --force          generate again even if a result is cached
 *
 * Raw results are cached in reports/final-audio (gitignored), so re-processing
 * (loudness, loop seams) costs no credits. The clue chime keeps our own
 * placeholder: it beat the generated candidates in the audition.
 *
 * Processing:
 *   - Beds and effects are levelled to the placeholder they replace, so the gains
 *     already tuned in playtests still apply. Music has no placeholder: under-speech
 *     beds are levelled to -30 dB RMS and the theme and closing to -22 dB.
 *   - Music beds that loop get an equal-power crossfade of their tail into their
 *     head, so the loop point has no seam. One-shot music gets a short fade-out.
 */
import { config } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { encodeWav, matchLoudness, parseWav, resample, rmsDb, type Wav } from "./audition/lib";
import { elevenlabsMusic, elevenlabsSound, providerStatus } from "./audition/providers";
import { ESTIMATED_CREDITS_PER_SECOND, SOUND_CUES, type SoundCue } from "./audition/sounds";

config({ path: ".env.local", quiet: true });

const RATE = 24000;
const AUDIO_DIR = join(process.cwd(), "public", "audio", "radio-night-s01");
const MANIFEST = join(process.cwd(), "content", "cases", "radio-night-s01", "v1", "audio-manifest.json");
const RAW_DIR = join(process.cwd(), "reports", "final-audio");

/** Which prompt won each cue (1-based, as listed in scripts/audition/sounds.ts and the round summaries). */
export const WINNERS: Record<string, number> = {
  "amb-tap-room": 1,
  "amb-back-room": 2,
  "amb-kitchen": 3,
  "amb-back-stairs": 1,
  "amb-upstairs-hall": 2,
  "amb-room-5": 1,
  "sfx-door": 1,
  "sting-accuse": 2,
  "sting-ending-solved": 2,
  "sting-ending-closed": 2,
  "music-theme": 3,
  "music-investigation": 1,
  "music-tension": 2,
  "music-closing": 3,
};

/** How each music cue plays in the game. */
const MUSIC_PLAY: Record<string, { gain: number; fadeInSec: number; fadeOutSec: number; loop: boolean; targetDb: number; note: string }> = {
  "music-theme": { gain: 0.8, fadeInSec: 0.5, fadeOutSec: 3, loop: false, targetDb: -22, note: "Opening theme, once, under the opening narration" },
  "music-investigation": { gain: 0.5, fadeInSec: 4, fadeOutSec: 3, loop: true, targetDb: -30, note: "Quiet underscore while investigating (loops)" },
  "music-tension": { gain: 0.5, fadeInSec: 3, fadeOutSec: 3, loop: true, targetDb: -30, note: "Tense underscore while the accusation is being made (loops)" },
  "music-closing": { gain: 0.7, fadeInSec: 5, fadeOutSec: 4, loop: false, targetDb: -22, note: "Closing music under the ending narration, once" },
};

type Meta = { cue: string; promptIndex: number; prompt: string; seconds: number; credits?: number; generatedAt: string; targetDb?: number };
type ManifestAsset = Record<string, unknown> & { id: string };
type Manifest = { assets: ManifestAsset[] } & Record<string, unknown>;

function cueById(id: string): SoundCue {
  const cue = SOUND_CUES.find((c) => c.id === id);
  if (!cue) throw new Error(`Unknown cue: ${id}`);
  return cue;
}

/** Blend the last `overlapSec` of a recording into its start, so looping it has no seam. */
export function makeSeamless(w: Wav, overlapSec: number): Wav {
  const x = w.samples;
  const overlap = Math.min(Math.round(overlapSec * w.sampleRate), Math.floor(x.length / 3));
  const length = x.length - overlap;
  const out = new Int16Array(length);
  for (let i = 0; i < length; i++) out[i] = x[i];
  for (let i = 0; i < overlap; i++) {
    const t = (i + 1) / (overlap + 1);
    const fadeIn = Math.sin((t * Math.PI) / 2);
    const fadeOut = Math.cos((t * Math.PI) / 2);
    out[i] = Math.round(x[i] * fadeIn + x[length + i] * fadeOut);
  }
  return { ...w, samples: out };
}

/** A short fade at the end so a one-shot never ends on a click. */
export function fadeOutTail(w: Wav, sec: number): Wav {
  const n = Math.min(Math.round(sec * w.sampleRate), w.samples.length);
  const out = Int16Array.from(w.samples);
  for (let i = 0; i < n; i++) {
    const idx = out.length - n + i;
    out[idx] = Math.round(out[idx] * (1 - (i + 1) / n));
  }
  return { ...w, samples: out };
}

function loadMeta(id: string): Meta | undefined {
  const p = join(RAW_DIR, `${id}.json`);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Meta) : undefined;
}

async function generate(cue: SoundCue, force: boolean): Promise<{ raw: Wav; meta: Meta }> {
  const rawPath = join(RAW_DIR, `${cue.id}.wav`);
  const cached = loadMeta(cue.id);
  const promptIndex = WINNERS[cue.id];
  const prompt = cue.prompts[promptIndex - 1];
  if (!prompt) throw new Error(`${cue.id}: no prompt ${promptIndex}`);
  if (!force && cached && existsSync(rawPath) && cached.prompt === prompt) {
    return { raw: parseWav(readFileSync(rawPath)), meta: cached };
  }
  const result = cue.kind === "music" ? await elevenlabsMusic(prompt, cue.seconds) : await elevenlabsSound(prompt, cue.seconds, cue.loop);
  writeFileSync(rawPath, result.wav);
  const meta: Meta = {
    cue: cue.id,
    promptIndex,
    prompt,
    seconds: cue.seconds,
    credits: result.credits,
    generatedAt: new Date().toISOString(),
    targetDb: cached?.targetDb,
  };
  return { raw: parseWav(result.wav), meta };
}

/** The level to bring a cue to: the placeholder it replaces (remembered from the first run), or the music target. */
function targetLevel(cue: SoundCue, meta: Meta): number {
  if (cue.kind === "music") return MUSIC_PLAY[cue.id].targetDb;
  if (meta.targetDb !== undefined) return meta.targetDb;
  const placeholder = join(AUDIO_DIR, `${cue.id}.wav`);
  const w = resample(parseWav(readFileSync(placeholder)), RATE);
  return rmsDb(w.samples);
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const force = args.includes("--force");
  const only = args.filter((a) => !a.startsWith("--"));
  const ids = Object.keys(WINNERS).filter((id) => only.length === 0 || only.includes(id));
  if (ids.length === 0) throw new Error("No matching cues.");

  const soundSeconds = ids.map(cueById).filter((c) => c.kind !== "music").reduce((n, c) => n + c.seconds, 0);
  const musicSeconds = ids.map(cueById).filter((c) => c.kind === "music").reduce((n, c) => n + c.seconds, 0);
  console.log(`${ids.length} cues. Sound effects: ${soundSeconds} s (about ${Math.round(soundSeconds * ESTIMATED_CREDITS_PER_SECOND)} credits). Music: ${musicSeconds} s (no cost is reported; the plan's music allowance is what limits it).`);
  for (const id of ids) {
    const c = cueById(id);
    const cached = loadMeta(id) && existsSync(join(RAW_DIR, `${id}.wav`)) && !force ? "cached" : "to generate";
    console.log(`  ${id.padEnd(22)} ${c.kind.padEnd(8)} ${String(c.seconds).padStart(3)} s  prompt ${WINNERS[id]}  ${cached}`);
  }
  if (dry) return;

  const status = providerStatus("elevenlabs");
  if (!status.ok) throw new Error(status.reason);
  mkdirSync(RAW_DIR, { recursive: true });
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
  const today = new Date().toISOString().slice(0, 10);
  let spent = 0;

  for (const id of ids) {
    const cue = cueById(id);
    process.stdout.write(`${id}: `);
    const { raw, meta } = await generate(cue, force);
    if (meta.credits) spent += meta.credits;
    meta.targetDb ??= targetLevel(cue, meta);
    writeFileSync(join(RAW_DIR, `${id}.json`), JSON.stringify(meta, null, 2));

    let w = resample(raw, RATE);
    if (cue.kind === "music") {
      const play = MUSIC_PLAY[id];
      w = play.loop ? makeSeamless(w, 3) : fadeOutTail(w, 0.5);
    }
    w = matchLoudness(w, meta.targetDb);
    writeFileSync(join(AUDIO_DIR, `${id}.wav`), encodeWav({ ...w, channels: 1 }));
    console.log(`ok ${(w.samples.length / w.sampleRate).toFixed(1)} s, level ${meta.targetDb.toFixed(1)} dB${meta.credits ? `, ${meta.credits} credits` : ""}`);

    // Manifest entry
    const generatedNote = `ElevenLabs ${cue.kind === "music" ? "Music (music_v1)" : "sound generation"}, prompt ${WINNERS[id]}: "${meta.prompt}"`;
    const license =
      `Generated ${today} on a paid ElevenLabs plan (Starter), which licenses commercial use of the output without attribution; ` +
      (cue.kind === "music" ? "music terms: not for film, TV, radio or Studio Games, and individual use only on this plan. " : "") +
      "See docs/voice-auditions.md and ADR 0011.";
    let entry = manifest.assets.find((a) => a.id === id);
    if (!entry) {
      const play = MUSIC_PLAY[id];
      entry = { id, file: `${id}.wav`, kind: "music", bus: "music", gain: play.gain, fadeInSec: play.fadeInSec, fadeOutSec: play.fadeOutSec, status: "placeholder", source: "", license: "", notes: play.note };
      manifest.assets.push(entry);
    }
    Object.assign(entry, { status: "final", source: generatedNote, license, ...(cue.kind === "music" ? { loop: MUSIC_PLAY[id].loop } : {}) });
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\nDone. Credits reported: ${spent || "none"}. Manifest updated.`);
}

// Run only when executed directly, so tests can import the helpers.
if (process.argv[1] && /make-final-audio\.ts$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
