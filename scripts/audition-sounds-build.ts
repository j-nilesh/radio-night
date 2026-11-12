/**
 * scripts/audition-sounds-build.ts
 * DEVELOPMENT-ONLY. Builds a blind audition of room sounds and stings.
 *
 *   npm run audition:sounds -- --round 1 --dry      (plan and estimated credits, calls nothing)
 *   npm run audition:sounds -- --round 1
 *   npm run audition:sounds -- --round 1 --cues amb-tap-room,sting-clue
 *
 * For each cue it makes one candidate per prompt (ElevenLabs sound effects) and
 * adds the current synthetic placeholder as a baseline. Rooms are heard twice:
 * on their own, and underneath a spoken line at roughly the level they would
 * have in the game, because "does it get in the way of the voice" is the real
 * test. Writes reports/audition/round-s<N>/ (gitignored); open index.html, then
 * score with: npm run audition:score -- --round s<N>
 *
 * Anything made while on a free plan is for listening only. Re-generate the
 * winners after the paid plan is in place so the shipped files carry its
 * commercial licence.
 */
import { config } from "dotenv";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ESTIMATED_CREDITS_PER_SECOND, SOUND_CUES } from "./audition/sounds";
import {
  blindLabels,
  encodeWav,
  loopToLength,
  matchLoudness,
  mixWavs,
  parseWav,
  resample,
  seedFor,
  type Wav,
} from "./audition/lib";
import { buildPage, type PageData } from "./audition/page";
import { elevenlabsSound, providerStatus } from "./audition/providers";

config({ path: ".env.local", quiet: true });

const args = process.argv.slice(2);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (n: string) => args.includes(`--${n}`);

const RATE = 24000;
const sha = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);

/** Loudness each kind of sound is brought to before comparison (room beds are quiet by design). */
const TARGET_DB = { ambience: -30, sting: -20, sfx: -22 } as const;

function findSpeechReference(cacheDir: string): Wav | undefined {
  const dg = join(cacheDir, "deepgram", "apollo");
  if (!existsSync(dg)) return undefined;
  for (const f of readdirSync(dg).filter((x) => x.endsWith(".wav"))) {
    const w = parseWav(readFileSync(join(dg, f)));
    if (w.samples.length / w.sampleRate >= 4) return resample(w, RATE);
  }
  return undefined;
}

async function main() {
  const round = opt("round") ?? "1";
  const only = opt("cues")?.split(",").map((s) => s.trim());
  const maxCredits = Number(opt("max-credits") ?? 4000);
  const root = join(process.cwd(), "reports", "audition");
  const roundDir = join(root, `round-s${round}`);
  const cacheDir = join(root, "cache");
  const soundCache = join(cacheDir, "sounds");

  const cues = SOUND_CUES.filter((c) => !only || only.includes(c.id));
  const status = providerStatus("elevenlabs");
  if (!status.ok) throw new Error(`Cannot generate sounds: ${status.reason}`);

  type Job = { cueId: string; prompt: string; seconds: number; loop: boolean; file: string };
  const jobs: Job[] = cues.flatMap((c) =>
    c.prompts.map((prompt) => ({
      cueId: c.id,
      prompt,
      seconds: c.seconds,
      loop: c.loop,
      file: join(soundCache, `${sha(`${prompt}|${c.seconds}|${c.loop}`)}.wav`),
    }))
  );
  const todo = jobs.filter((j) => !existsSync(j.file));
  const estCredits = Math.round(todo.reduce((n, j) => n + j.seconds * ESTIMATED_CREDITS_PER_SECOND, 0));

  console.log(`Sound round ${round}: ${cues.length} cues, ${jobs.length} generated sounds (${todo.length} new, ${jobs.length - todo.length} cached)`);
  console.log(`Estimated credits for the new ones: about ${estCredits} (a guess from one measured request; the real cost is totalled below)`);
  if (flag("dry")) return console.log("Dry run: nothing was called.");
  if (estCredits > maxCredits) throw new Error(`Estimated ${estCredits} credits is over the ${maxCredits} limit. Re-run with --max-credits ${estCredits} to allow it.`);

  // ── generate (one at a time: the plan allows very few concurrent requests) ─
  mkdirSync(soundCache, { recursive: true });
  let spent = 0;
  let failures = 0;
  for (const j of todo) {
    try {
      const r = await elevenlabsSound(j.prompt, j.seconds, j.loop);
      writeFileSync(j.file, r.wav);
      writeFileSync(j.file.replace(/\.wav$/, ".json"), JSON.stringify({ credits: r.credits, prompt: j.prompt, downmixed: true }));
      spent += r.credits ?? 0;
      process.stdout.write(".");
    } catch (e) {
      failures += 1;
      console.error(`\n  failed ${j.cueId}: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`\nCredits actually spent this run: ${spent}${failures ? `   (${failures} failed)` : ""}`);

  // ── assemble the round ────────────────────────────────────────────────────
  const speech = findSpeechReference(cacheDir);
  if (!speech) console.log("No reference spoken line found in the cache; rooms will be heard on their own only.");

  const key: Record<string, Record<string, string>> = {};
  const notes: Record<string, string> = {};
  const pageData: PageData = {
    round: `s${round}`,
    title: `Radio Night sound audition, round ${round}`,
    noun: "Sound",
    intro:
      "Listen to each sound without knowing where it came from. Room sounds loop; play them for a while, because a loop that is fine for ten seconds can wear on you after a minute. Rooms are heard twice: on their own, and under a spoken line about as loud as in the game. Score on the sliders (1 poor, 10 excellent), say whether you would accept the sound, and note anything odd. Your scores save in this browser as you go.",
    notesHint: "What did you notice? A click at the loop point, a sound that repeats, anything distracting or out of place?",
    criteria: [
      { key: "authenticity", label: "Fits the place", help: "Sounds like exactly this place or moment in a small New Hampshire inn in 1981" },
      { key: "emotion", label: "Mood", help: "Adds atmosphere and tension without drawing attention to itself" },
      { key: "consistency", label: "Holds together", help: "Rooms: loops without a click or a sound you notice repeating. Stings: starts and ends cleanly" },
      { key: "clarity", label: "Stays out of the way", help: "You could follow every word if a character spoke over it, and it would not tire you" },
    ],
    characters: [],
  };

  for (const cue of cues) {
    const baselinePath = join(process.cwd(), "public", "audio", "radio-night-s01", cue.baseline);
    const cands: Array<{ id: string; wav: Wav; note: string }> = [];
    if (existsSync(baselinePath)) cands.push({ id: "baseline", wav: resample(parseWav(readFileSync(baselinePath)), RATE), note: "our current synthetic placeholder" });
    cue.prompts.forEach((prompt, i) => {
      const file = join(soundCache, `${sha(`${prompt}|${cue.seconds}|${cue.loop}`)}.wav`);
      if (existsSync(file)) cands.push({ id: `elevenlabs-sound:${i + 1}`, wav: resample(parseWav(readFileSync(file)), RATE), note: `prompt ${i + 1}: ${prompt}` });
    });
    if (cands.length < 2) {
      console.log(`  skipping ${cue.id}: nothing to compare`);
      continue;
    }

    const labels = blindLabels(cands.map((c) => c.id), seedFor(cue.id + round));
    key[cue.id] = labels;
    const voices: Record<string, string[]> = {};
    for (const [letter, id] of Object.entries(labels)) {
      const cand = cands.find((c) => c.id === id)!;
      notes[`${cue.id}|${id}`] = cand.note;
      const level = matchLoudness(cand.wav, TARGET_DB[cue.kind]);
      const outDir = join(roundDir, "audio", cue.id, letter);
      mkdirSync(outDir, { recursive: true });
      const rels: string[] = [];
      const write = (name: string, w: Wav) => {
        writeFileSync(join(outDir, name), encodeWav(w));
        rels.push(`audio/${cue.id}/${letter}/${name}`);
      };
      write("01.wav", level);
      if (cue.kind === "ambience" && speech) {
        // Speech at its normal level, the room beneath it at the level the game would use
        const bed = loopToLength(level, speech.samples.length + RATE);
        write("02.wav", mixWavs(bed, matchLoudness(speech, -22)));
      }
      voices[letter] = rels;
    }
    const withSpeech = cue.kind === "ambience" && !!speech;
    pageData.characters.push({
      id: cue.id,
      name: cue.name,
      role: cue.kind === "ambience" ? "Room sound (loops)" : cue.kind === "sfx" ? "Sound effect" : "Musical sting",
      want: cue.want,
      loop: cue.kind === "ambience",
      lines: withSpeech
        ? [{ text: "On its own, looping", source: "cue" }, { text: "Under a spoken line, about as loud as in the game", source: "cue" }]
        : [{ text: "Plays once", source: "cue" }],
      voices,
    });
  }

  if (pageData.characters.length === 0) throw new Error("Nothing to show.");
  mkdirSync(roundDir, { recursive: true });
  writeFileSync(join(roundDir, "index.html"), buildPage(pageData));
  writeFileSync(join(roundDir, "key.json"), JSON.stringify({ round: `s${round}`, kind: "sound", key, stats: {}, notes }, null, 2));

  console.log(`\nDone. Open this and listen:\n  ${join(roundDir, "index.html")}\n`);
  console.log(`When you have saved your scores, move the downloaded files into that folder and run:\n  npm run audition:score -- --round s${round}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
