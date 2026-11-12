/**
 * scripts/audition/sound-items.ts
 * Builds the room-sound, effect, sting and music items of an audition round.
 * DEVELOPMENT-ONLY.
 *
 * Each cue gets one candidate per prompt plus, where there is one, our current
 * synthetic placeholder as a baseline to beat. Beds are heard twice: alone, and
 * beneath a spoken line at about the level they would have in the game.
 *
 * Anything generated on a free plan is for listening only; re-generate the
 * winners after the paid plan is in place so shipped files carry its licence.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isAllowed, type BuiltItem, type Ctx } from "./items";
import { blindLabels, encodeWav, loopToLength, matchLoudness, mixWavs, parseWav, resample, seedFor, type Wav } from "./lib";
import type { Criterion } from "./page";
import { elevenlabsMusic, elevenlabsSound, providerStatus } from "./providers";
import { ESTIMATED_CREDITS_PER_SECOND, SOUND_CUES, type SoundCue } from "./sounds";

const RATE = 24000;
const sha = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);

/** Loudness each kind of sound is brought to before comparison (beds are quiet by design). */
const TARGET_DB = { ambience: -30, sting: -20, sfx: -22 } as const;
const musicTarget = (cue: SoundCue) => (cue.underSpeech ? -30 : -22);

const SOUND_CRITERIA: Criterion[] = [
  { key: "authenticity", label: "Fits the place", help: "Sounds like exactly this place or moment in a small New Hampshire inn in 1981" },
  { key: "emotion", label: "Mood", help: "Adds atmosphere and tension without drawing attention to itself" },
  { key: "consistency", label: "Holds together", help: "Rooms: loops without a click or a sound you notice repeating. Stings: starts and ends cleanly" },
  { key: "clarity", label: "Stays out of the way", help: "You could follow every word if a character spoke over it, and it would not tire you" },
];

const MUSIC_CRITERIA: Criterion[] = [
  { key: "authenticity", label: "Feels like old radio drama", help: "Sounds like the golden age of radio mystery, not a modern film score or a stock library track" },
  { key: "emotion", label: "Mood", help: "The right feeling for this moment, with restraint" },
  { key: "consistency", label: "Holds together", help: "Builds and ends sensibly; no odd turns, jolts or a melody that wanders" },
  { key: "clarity", label: "Stays out of the way", help: "For beds: you could follow speech over it. For the theme and closing: it does not drown the narrator" },
];

function findSpeechReference(cacheDir: string): Wav | undefined {
  const dg = join(cacheDir, "deepgram", "apollo");
  if (!existsSync(dg)) return undefined;
  for (const f of readdirSync(dg).filter((x) => x.endsWith(".wav"))) {
    const w = parseWav(readFileSync(join(dg, f)));
    if (w.samples.length / w.sampleRate >= 4) return resample(w, RATE);
  }
  return undefined;
}

const candidateFile = (ctx: Ctx, cue: SoundCue, prompt: string) =>
  cue.kind === "music"
    ? join(ctx.cacheDir, "sounds", `music-${sha(`${prompt}|${cue.seconds}|music_v1`)}.wav`)
    : join(ctx.cacheDir, "sounds", `${sha(`${prompt}|${cue.seconds}|${cue.loop}`)}.wav`);

const candidateId = (cue: SoundCue, index: number) => `${cue.kind === "music" ? "elevenlabs-music" : "elevenlabs-sound"}:${index + 1}`;

export async function collectSoundItems(ctx: Ctx): Promise<BuiltItem[]> {
  const cues = SOUND_CUES.filter((c) => !ctx.only || ctx.only.some((o) => c.id.includes(o)));

  type Job = { cue: SoundCue; prompt: string; file: string; id: string };
  const wanted: Job[] = cues.flatMap((cue) =>
    cue.prompts
      .map((prompt, i) => ({ cue, prompt, file: candidateFile(ctx, cue, prompt), id: candidateId(cue, i) }))
      .filter((j) => isAllowed(ctx, cue.id, j.id))
  );
  const todo = wanted.filter((j) => !existsSync(j.file));
  const todoSound = todo.filter((j) => j.cue.kind !== "music");
  const todoMusic = todo.filter((j) => j.cue.kind === "music");
  const estCredits = Math.round(todoSound.reduce((n, j) => n + j.cue.seconds * ESTIMATED_CREDITS_PER_SECOND, 0));
  const musicSeconds = todoMusic.reduce((n, j) => n + j.cue.seconds, 0);

  console.log(`Sounds and music: ${cues.length} cues, ${wanted.length} generated candidates (${todo.length} new, ${wanted.length - todo.length} already made)`);
  console.log(`  New sound effects: ${todoSound.length}, estimated about ${estCredits} credits (a guess from one measured request)`);
  console.log(
    `  New music: ${todoMusic.length} clips, ${musicSeconds} seconds in total, cost not reported by the provider` +
      (todoMusic.length && !ctx.includeMusic ? " (skipped: add --music to generate it)" : "")
  );
  if (ctx.dry) return [];
  if (estCredits > ctx.maxCredits) throw new Error(`Estimated ${estCredits} credits is over the ${ctx.maxCredits} limit. Re-run with --max-credits ${estCredits} to allow it.`);

  const status = providerStatus("elevenlabs");
  const toMake = [...todoSound, ...(ctx.includeMusic ? todoMusic : [])];
  if (toMake.length > 0 && !status.ok) throw new Error(`Cannot generate sounds: ${status.reason}`);

  mkdirSync(join(ctx.cacheDir, "sounds"), { recursive: true });
  let spent = 0;
  let failures = 0;
  for (const j of toMake) {
    try {
      const r = j.cue.kind === "music" ? await elevenlabsMusic(j.prompt, j.cue.seconds) : await elevenlabsSound(j.prompt, j.cue.seconds, j.cue.loop);
      writeFileSync(j.file, r.wav);
      writeFileSync(j.file.replace(/\.wav$/, ".json"), JSON.stringify({ credits: r.credits, prompt: j.prompt, downmixed: true }));
      spent += r.credits ?? 0;
      process.stdout.write(".");
    } catch (e) {
      failures += 1;
      console.error(`\n  failed ${j.cue.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (toMake.length) console.log(`\n  Sound credits spent this run: ${spent}${failures ? `   (${failures} failed)` : ""}`);

  const speech = findSpeechReference(ctx.cacheDir);
  if (!speech) console.log("  No reference spoken line found in the cache; beds will be heard on their own only.");

  const items: BuiltItem[] = [];
  for (const cue of cues) {
    const cands: Array<{ id: string; wav: Wav; note: string }> = [];
    if (cue.baseline && isAllowed(ctx, cue.id, "baseline")) {
      const path = join(process.cwd(), "public", "audio", "radio-night-s01", cue.baseline);
      if (existsSync(path)) cands.push({ id: "baseline", wav: resample(parseWav(readFileSync(path)), RATE), note: "our current synthetic placeholder" });
    }
    cue.prompts.forEach((prompt, i) => {
      const id = candidateId(cue, i);
      const file = candidateFile(ctx, cue, prompt);
      if (isAllowed(ctx, cue.id, id) && existsSync(file)) cands.push({ id, wav: resample(parseWav(readFileSync(file)), RATE), note: `prompt ${i + 1}: ${prompt}` });
    });
    if (cands.length < 2) {
      if (cands.length === 0 && cue.kind === "music") console.log(`  ${cue.id}: not generated yet`);
      else if (cands.length === 1) console.log(`  ${cue.id}: only one candidate left (${cands[0].id}); nothing to compare`);
      continue;
    }

    const underSpeech = !!speech && (cue.kind === "ambience" || !!cue.underSpeech);
    const target = cue.kind === "music" ? musicTarget(cue) : TARGET_DB[cue.kind];
    const letters = blindLabels(cands.map((c) => c.id), seedFor(cue.id + ctx.name));
    const notes: Record<string, string> = {};
    const voices: Record<string, string[]> = {};
    for (const [letter, id] of Object.entries(letters)) {
      const cand = cands.find((c) => c.id === id)!;
      notes[`${cue.id}|${id}`] = cand.note;
      const level = matchLoudness(cand.wav, target);
      const outDir = join(ctx.roundDir, "audio", cue.id, letter);
      mkdirSync(outDir, { recursive: true });
      const rels: string[] = [];
      const write = (name: string, w: Wav) => {
        writeFileSync(join(outDir, name), encodeWav(w));
        rels.push(`audio/${cue.id}/${letter}/${name}`);
      };
      write("01.wav", level);
      if (underSpeech) {
        // Speech at its normal level, the bed beneath it at the level the game would use
        const bed = loopToLength(level, speech!.samples.length + RATE);
        write("02.wav", mixWavs(bed, matchLoudness(speech!, -22)));
      }
      voices[letter] = rels;
    }

    const music = cue.kind === "music";
    items.push({
      kind: "sound",
      letters,
      notes,
      stats: {},
      page: {
        id: cue.id,
        group: music ? "Music" : cue.kind === "ambience" ? "Room sounds" : "Effects and stings",
        name: cue.name,
        role: music ? "Music" : cue.kind === "ambience" ? "Room sound (loops)" : cue.kind === "sfx" ? "Sound effect" : "Musical sting",
        want: cue.want,
        noun: music ? "Music" : "Sound",
        criteria: music ? MUSIC_CRITERIA : SOUND_CRITERIA,
        loop: cue.kind === "ambience",
        lines: underSpeech
          ? [{ text: "On its own", source: "cue" }, { text: "Under a spoken line, about as loud as in the game", source: "cue" }]
          : [{ text: music ? "Plays through once" : "Plays once", source: "cue" }],
        voices,
      },
    });
  }
  return items;
}
