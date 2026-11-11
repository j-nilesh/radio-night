/**
 * scripts/audition-replies.ts
 * DEVELOPMENT-ONLY. Re-voices what a character really said in a playtest, in
 * one or more voices, so you can listen back and compare. Useful for finding
 * the lines where a voice goes flat or robotic, and for trying a replacement.
 *
 *   npm run audition -- --character carol --voices harmonia,vesta,hera,cora
 *   npm run audition -- --character ray --voices apollo --file 2026-11-11
 *
 * Writes WAV files to reports/audition/<character>/<voice>/NN-HHMMSS.wav, plus
 * an index.txt that lists each file with its time and text. Time is the local
 * playtest time (UTC in the log), so lines can be matched to what you remember.
 * Uses a small amount of Deepgram credit (about 200 characters per line).
 */
import { config } from "dotenv";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

config({ path: ".env.local", quiet: true });

const args = process.argv.slice(2);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main() {
  const key = process.env.DEEPGRAM_API_KEY?.trim();
  if (!key) throw new Error("DEEPGRAM_API_KEY is not set in .env.local");

  const who = (opt("character") ?? "").toLowerCase();
  if (!who) throw new Error("Give --character (for example carol, ray, dwight, edna, dennis)");
  const voices = (opt("voices") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  if (voices.length === 0) throw new Error("Give --voices (for example harmonia,vesta,hera)");

  const dir = join(process.cwd(), "playtests");
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort();
  const file = opt("file") ? files.find((f) => f.startsWith(opt("file")!)) : files.at(-1);
  if (!file) throw new Error("No playtest file found");

  const replies = readFileSync(join(dir, file), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { kind: string; t: string; character?: string; reply?: string })
    .filter((e) => e.kind === "turn" && e.character?.toLowerCase().includes(who) && e.reply);

  if (replies.length === 0) throw new Error(`No replies from "${who}" in ${file}`);
  console.log(`${replies.length} replies from ${who} in ${file}; voices: ${voices.join(", ")}`);

  for (const voice of voices) {
    const out = join(process.cwd(), "reports", "audition", who, voice);
    mkdirSync(out, { recursive: true });
    const index: string[] = [];
    let n = 0;
    for (const r of replies) {
      n += 1;
      const res = await fetch(
        `https://api.deepgram.com/v1/speak?model=aura-2-${voice}-en&encoding=linear16&container=wav&sample_rate=24000`,
        {
          method: "POST",
          headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ text: r.reply }),
        }
      );
      if (!res.ok) {
        console.error(`  ${voice}: HTTP ${res.status} (is "${voice}" a real Aura-2 voice name?)`);
        break;
      }
      const name = `${String(n).padStart(2, "0")}-${r.t.slice(11, 19).replace(/:/g, "")}.wav`;
      writeFileSync(join(out, name), Buffer.from(await res.arrayBuffer()));
      index.push(`${name}  ${r.t.slice(11, 19)} UTC  ${r.reply}`);
    }
    writeFileSync(join(out, "index.txt"), index.join("\n") + "\n");
    console.log(`  ${voice}: ${index.length} files in ${out}`);
  }
  console.log("\nPlay one with: afplay <file>.wav   (or open the folder in Finder)");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
