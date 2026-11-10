/**
 * scripts/check-deepgram.ts
 * Live smoke test for speech-to-text. Run: npm run check:stt
 *
 * Speaks a few questions from the case with the macOS `say` voice, sends them
 * through the real Deepgram adapter, and prints what came back. It reads the
 * key from .env.local and never prints it. Uses a small amount of your
 * Deepgram credit (a few seconds of audio per phrase).
 */

import { config } from "dotenv";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DeepgramSpeechToTextProvider } from "../packages/providers/src/deepgram-stt";

config({ path: ".env.local", quiet: true });

const KEYTERMS = ["Ray Kowalski", "Kowalski", "Dwight Wentworth", "Wentworth", "Edna Marsh", "Dennis Pruett", "Pruett", "Gerald Fenn", "Fenn", "Millhaven", "Bridgewater Inn"];

const PHRASES = [
  "Was Ray Kowalski behind the bar all night?",
  "Did Dwight Wentworth go upstairs?",
  "What did Edna Marsh see in the kitchen?",
  "Dennis Pruett, how long was he gone?",
];

async function main() {
  const key = process.env.DEEPGRAM_API_KEY?.trim();
  if (!key) {
    console.error("DEEPGRAM_API_KEY is empty. Add it to .env.local and run again.");
    process.exit(1);
  }
  if (process.platform !== "darwin") {
    console.error("This script uses the macOS `say` command to make test audio.");
    process.exit(1);
  }

  const stt = new DeepgramSpeechToTextProvider({ apiKey: key });
  const dir = mkdtempSync(join(tmpdir(), "rn-stt-"));
  let failures = 0;

  try {
    for (const [i, phrase] of PHRASES.entries()) {
      const aiff = join(dir, `p${i}.aiff`);
      const wav = join(dir, `p${i}.wav`);
      execFileSync("say", ["-o", aiff, phrase]);
      execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@16000", aiff, wav]);

      const started = Date.now();
      try {
        const r = await stt.transcribe(new Uint8Array(readFileSync(wav)), {
          mimeType: "audio/wav",
          keyterms: KEYTERMS,
        });
        const ms = Date.now() - started;
        const heard = r.text.toLowerCase().replace(/[^a-z ]/g, "");
        const wanted = phrase.toLowerCase().replace(/[^a-z ]/g, "");
        const same = heard === wanted;
        if (!same) failures++;
        console.log(`\nsaid   : ${phrase}\nheard  : ${r.text || "(nothing)"}\nmatch  : ${same ? "exact" : "differs"}   confidence ${r.confidence.toFixed(2)}   ${ms} ms`);
      } catch (err) {
        failures++;
        console.log(`\nsaid   : ${phrase}\nERROR  : ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  console.log(failures === 0 ? "\nAll phrases matched." : `\n${failures} of ${PHRASES.length} did not match exactly (see above).`);
  process.exit(failures === 0 ? 0 : 2);
}

main();
