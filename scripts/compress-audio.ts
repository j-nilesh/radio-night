/**
 * scripts/compress-audio.ts
 * DEVELOPMENT-ONLY. Makes small MP3 copies of the sounds that play once (stings,
 * the door, the opening theme and the closing music) and points the audio manifest
 * at them, keeping the WAV as the fallback the player uses if a browser cannot
 * decode the MP3. Needs ffmpeg with libmp3lame.
 *
 *   npx tsx scripts/compress-audio.ts          (or: npm run audio:compress)
 *
 * Looping beds (the six rooms and the two music beds) stay WAV: an MP3 carries a
 * few milliseconds of encoder padding, which would be heard as a tick each time a
 * loop comes round. Re-run after `npm run audio:final` regenerates a file.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Asset = { id: string; file: string; fallbackFile?: string; kind: string; loop?: boolean };

const MANIFEST = join(process.cwd(), "content", "cases", "radio-night-s01", "v1", "audio-manifest.json");
const DIR = join(process.cwd(), "public", "audio", "radio-night-s01");

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as { assets: Asset[] };
const loops = (a: Asset) => a.kind === "ambience" || (a.kind === "music" && a.loop !== false);
const kb = (p: string) => Math.round(statSync(p).size / 1024);

let before = 0;
let after = 0;
for (const a of manifest.assets) {
  if (loops(a)) continue;
  const wav = a.fallbackFile ?? a.file;
  if (!wav.endsWith(".wav")) continue;
  const src = join(DIR, wav);
  if (!existsSync(src)) throw new Error(`Missing ${wav}`);
  const mp3 = wav.replace(/\.wav$/, ".mp3");
  // Mono VBR, quality 4 (about 100 kbps for music): clear on a phone and a speaker
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-ac", "1", "-codec:a", "libmp3lame", "-q:a", "4", join(DIR, mp3)]);
  a.file = mp3;
  a.fallbackFile = wav;
  before += kb(src);
  after += kb(join(DIR, mp3));
  console.log(`${a.id.padEnd(22)} ${String(kb(src)).padStart(5)} KB -> ${String(kb(join(DIR, mp3))).padStart(4)} KB`);
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(`\nOne-shot sounds: ${before} KB -> ${after} KB. Looping beds left as WAV.`);
