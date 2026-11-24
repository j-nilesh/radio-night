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
import { FALLBACK_LINES } from "../content/cases/radio-night-s01/v1/facts";
import { BEATS } from "../content/cases/radio-night-s01/v1/beats";
config({ path: ".env.local", quiet: true });

/** Where every voice should land. Loud peaks are rounded off by the soft limiter in pcm-gain.ts. */
const TARGET_LUFS = -19;
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
function measure(file: string): { lufs: number; peakDb: number } {
  // ffmpeg writes its report to stderr
  const run = spawnSync("ffmpeg", ["-nostats", "-i", file, "-af", "ebur128=peak=sample", "-f", "null", "-"], { encoding: "utf8" });
  if (run.error) throw run.error;
  return parse(run.stderr);
}
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

  const narratorLines = BEATS.filter((b) => b.speakerId === "char-narrator").slice(0, 3).map((b) => b.scriptedText.slice(0, 220));
  const cast: Array<{ voice: VoiceProfile; lines: string[] }> = [
    ...Object.values(VOICES).map((voice) => ({ voice, lines: (FALLBACK_LINES[voice.characterId] ?? []).slice(0, 3) })),
    { voice: NARRATOR_VOICE, lines: narratorLines },
  ];

  console.log(`Target ${TARGET_LUFS} LUFS. Measured with each voice's current levelDb applied.\n`);
  console.log("voice                    lufs    peak  current  suggested");
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
    const suggested = (voice.levelDb ?? 0) + Math.max(-6, Math.min(MAX_BOOST_DB, TARGET_LUFS - lufs));
    console.log(
      `${voice.characterId.padEnd(24)} ${lufs.toFixed(1).padStart(5)} ${peakDb.toFixed(1).padStart(7)} ${(voice.levelDb ?? 0).toFixed(1).padStart(8)} ${(Math.round(suggested * 2) / 2).toFixed(1).padStart(10)}   lines: ${perLine.map((n) => n.toFixed(1)).join(", ")}`
    );
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
