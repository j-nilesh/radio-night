/**
 * scripts/measure-voice-levels.ts
 * DEVELOPMENT-ONLY. Speaks several authored lines with each cast voice through
 * the real adapters, applies each voice's current levelDb exactly as the speech
 * route does, measures integrated loudness (LUFS) and sample peak with ffmpeg,
 * and prints the levelDb that would bring every voice to the same loudness.
 * Run it again after changing the values to check them.
 *
 *   npm run check:levels
 *
 * Needs ffmpeg on the PATH. Spends roughly 400 characters per voice. Writes
 * WAVs to reports/voice-levels/ (gitignored). Paste the printed values into
 * content/cases/<case>/<version>/voices.ts as `levelDb`.
 */
import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CartesiaTextToSpeechProvider,
  DeepgramTextToSpeechProvider,
  ElevenLabsTextToSpeechProvider,
  RoutingTextToSpeechProvider,
  type VoiceProfile,
} from "@providers";
import { applyGainPcm16 } from "../src/lib/pcm-gain";
import { NARRATOR_VOICE, VOICES } from "../content/cases/radio-night-s01/v1/voices";
import { FACTS_BY_CHARACTER, FALLBACK_LINES } from "../content/cases/radio-night-s01/v1/facts";
import { BEATS } from "../content/cases/radio-night-s01/v1/beats";
config({ path: ".env.local", quiet: true });

/**
 * Voices are balanced on the SPEECH BAND (300 Hz to 4 kHz), not on whole-signal loudness. A phone
 * speaker plays little below 300 Hz, so a bass-heavy voice can measure as loud as the others
 * overall and still be the faint one in the room. Whole-signal loudness only sets a ceiling, so a
 * voice with a lot of bass is not made loud on good speakers or headphones.
 * Loud peaks are rounded off by the soft limiter in pcm-gain.ts.
 */
const TARGET_SPEECH_LUFS = -21;
const CEILING_FULL_LUFS = -16;
/** A larger boost than this starts to distort the loudest syllables. */
const MAX_BOOST_DB = 6;

const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.byteLength;
  }
  return out;
};
function wav(pcm: Uint8Array, sampleRate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, Buffer.from(pcm)]);
}
function measure(file: string, filter = ""): { lufs: number; peakDb: number } {
  // ffmpeg writes its report to stderr
  const chain = `${filter}${filter ? "," : ""}ebur128=peak=sample`;
  const run = spawnSync("ffmpeg", ["-nostats", "-i", file, "-af", chain, "-f", "null", "-"], { encoding: "utf8" });
  if (run.error) throw run.error;
  return parse(run.stderr);
}
/** Loudness of just the part of the voice a small speaker reproduces. */
const SPEECH_BAND = "highpass=f=300:poles=2,lowpass=f=4000:poles=2";
function parse(text: string): { lufs: number; peakDb: number } {
  const summary = text.slice(text.lastIndexOf("Summary:"));
  const lufs = Number(summary.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]);
  const peakDb = Number(summary.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1]);
  return { lufs, peakDb };
}

async function main() {
  const key = (n: string) => process.env[n]?.trim();
  const adapters = [];
  if (key("DEEPGRAM_API_KEY")) adapters.push(new DeepgramTextToSpeechProvider({ apiKey: key("DEEPGRAM_API_KEY")! }));
  if (key("CARTESIA_API_KEY")) adapters.push(new CartesiaTextToSpeechProvider({ apiKey: key("CARTESIA_API_KEY")! }));
  if (key("ELEVENLABS_API_KEY")) adapters.push(new ElevenLabsTextToSpeechProvider({ apiKey: key("ELEVENLABS_API_KEY")! }));
  if (adapters.length === 0) throw new Error("No voice keys found in .env.local.");
  const tts = new RoutingTextToSpeechProvider(adapters);
  const outDir = join(process.cwd(), "reports", "voice-levels");
  mkdirSync(outDir, { recursive: true });

  // LINES=n measures n authored lines per voice (default 3). More lines show how much a voice varies from line to line.
  const count = Math.max(1, Number(process.env.LINES) || 3);
  const clip = (t: string) => (t.length > 240 ? t.slice(0, t.lastIndexOf(" ", 240)) : t);
  const narratorLines = BEATS.filter((b) => b.speakerId === "char-narrator").slice(0, count).map((b) => clip(b.scriptedText));
  const authored = (id: string) =>
    [...(FACTS_BY_CHARACTER[id] ?? []).flatMap((f) => [f.line, f.lockedLine]), ...(FALLBACK_LINES[id] ?? [])]
      .filter((t): t is string => !!t && t.length > 20)
      .slice(0, count)
      .map(clip);
  const cast: Array<{ voice: VoiceProfile; lines: string[] }> = [
    ...Object.values(VOICES).map((voice) => ({ voice, lines: authored(voice.characterId) })),
    { voice: NARRATOR_VOICE, lines: narratorLines },
  ];

  console.log(`Target ${TARGET_SPEECH_LUFS} LUFS in the speech band, whole signal at most ${CEILING_FULL_LUFS}. Measured with each voice's current levelDb applied.\n`);
  console.log("voice                    speech   whole    peak  current  suggested");
  for (const { voice, lines } of cast) {
    if (!tts.servesProviders.includes(voice.provider) || lines.length === 0) {
      console.log(`${voice.characterId.padEnd(24)} skipped`);
      continue;
    }
    const parts: Uint8Array[] = [];
    const perLine: number[] = [];
    let rate = 24_000;
    for (const [i, text] of lines.entries()) {
      const { stream, mimeType } = await tts.synthesizeStream({ text, voice, requestId: "levels" });
      rate = Number(mimeType.match(/rate=(\d+)/)?.[1]) || rate;
      const reader = stream.getReader();
      const one: Uint8Array[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) one.push(value);
      }
      const lineFile = join(outDir, `${voice.characterId}-${i + 1}.wav`);
      const corrected = applyGainPcm16(concat(one), voice.levelDb ?? 0);
      writeFileSync(lineFile, wav(corrected, rate));
      perLine.push(measure(lineFile).lufs);
      parts.push(corrected, new Uint8Array(Math.round(rate * 0.4) * 2)); // 0.4 s of silence between lines
    }
    const file = join(outDir, `${voice.characterId}.wav`);
    writeFileSync(file, wav(concat(parts), rate));
    const { lufs, peakDb } = measure(file);
    const speech = measure(file, SPEECH_BAND).lufs;
    const change = Math.min(TARGET_SPEECH_LUFS - speech, CEILING_FULL_LUFS - lufs);
    const suggested = (voice.levelDb ?? 0) + Math.max(-6, Math.min(MAX_BOOST_DB, change));
    console.log(
      `${voice.characterId.padEnd(24)} ${speech.toFixed(1).padStart(6)} ${lufs.toFixed(1).padStart(7)} ${peakDb.toFixed(1).padStart(7)} ${(voice.levelDb ?? 0).toFixed(1).padStart(8)} ${(Math.round(suggested * 2) / 2).toFixed(1).padStart(10)}   spread ${(Math.max(...perLine) - Math.min(...perLine)).toFixed(1)} dB over ${perLine.length} lines: ${perLine.map((n) => n.toFixed(1)).join(" ")}`
    );
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
