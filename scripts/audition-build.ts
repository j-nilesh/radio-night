/**
 * scripts/audition-build.ts
 * DEVELOPMENT-ONLY. Builds a round of the blind voice audition.
 *
 *   npm run audition:build -- --round 1
 *   npm run audition:build -- --round 1 --characters carol,ray
 *   npm run audition:build -- --round 1 --dry         (show the plan and cost, call nothing)
 *
 * For each character it takes a fixed set of test lines (authored lines plus
 * real replies from the latest playtest; for the narrator, scripted narration),
 * has every shortlisted voice read them, brings the clips to the same loudness,
 * and writes a listening page where the voices appear only as letters.
 *
 * Output (gitignored): reports/audition/round-N/
 *   index.html   open this and listen
 *   key.json     which letter is which voice (the scorer reads it; do not peek)
 *   audio/       the clips, by letter
 * Clips are cached by voice and text in reports/audition/cache, so rebuilding
 * costs nothing for anything already made.
 */
import { config } from "dotenv";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { theSittingCase } from "../content/cases/radio-night-s01/v1/case";
import { FACTS_BY_CHARACTER } from "../content/cases/radio-night-s01/v1/facts";
import { BEATS } from "../content/cases/radio-night-s01/v1/beats";
import { CASTING, COST_PER_1K_CHARS, type Candidate } from "./audition/casting";
import {
  authoredLines,
  blindLabels,
  clipAtSentence,
  encodeWav,
  matchLoudness,
  parseWav,
  playtestLines,
  seedFor,
  type TestLine,
} from "./audition/lib";
import { buildPage, type PageData } from "./audition/page";
import { CONCURRENCY, providerStatus, synthesize } from "./audition/providers";

config({ path: ".env.local", quiet: true });

const args = process.argv.slice(2);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (n: string) => args.includes(`--${n}`);

const LINES_AUTHORED = 4;
const LINES_PLAYTEST = 4;
const NARRATION_MAX = 380;

const candId = (c: Candidate) => `${c.provider}:${c.voice}`;
const sha = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);

function loadPlaytestEvents(): Array<{ kind: string; character?: string; reply?: string }> {
  const out: Array<{ kind: string; character?: string; reply?: string }> = [];
  const files = ["playtests", join("playtests", "old")].flatMap((d) => {
    const dir = join(process.cwd(), d);
    return existsSync(dir) ? readdirSync(dir).filter((x) => x.endsWith(".jsonl")).map((x) => join(dir, x)) : [];
  });
  for (const f of files) {
    for (const line of readFileSync(f, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line));
      } catch {
        /* skip a damaged line */
      }
    }
  }
  return out;
}

function narratorLines(): TestLine[] {
  const pick = (id: string) => BEATS.find((b) => b.id === id)?.scriptedText;
  return [
    ["beat-opening-narration", "narration"],
    ["beat-ending-correct-full", "narration"],
    ["beat-ending-wrong-carol", "narration"],
  ]
    .map(([id]) => pick(id))
    .filter((t): t is string => !!t)
    .map((t) => ({ source: "narration" as const, text: clipAtSentence(t, NARRATION_MAX) }));
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

async function main() {
  const round = Number(opt("round") ?? 1);
  const only = opt("characters")?.split(",").map((s) => s.trim().toLowerCase());
  const maxChars = Number(opt("max-chars") ?? 60000);
  const root = join(process.cwd(), "reports", "audition");
  const roundDir = join(root, `round-${round}`);
  const cacheDir = join(root, "cache");

  const events = loadPlaytestEvents();
  const skipped = new Map<string, string>();

  // ── plan ──────────────────────────────────────────────────────────────────
  type Job = { characterId: string; cand: Candidate; lineIndex: number; text: string };
  const plans = CASTING.filter((c) => !only || only.some((o) => c.characterId.includes(o))).map((entry) => {
    const facts = FACTS_BY_CHARACTER[entry.characterId] ?? [];
    const lines =
      entry.characterId === "char-narrator"
        ? narratorLines()
        : [...authoredLines(facts, LINES_AUTHORED), ...playtestLines(events, entry.characterId, LINES_PLAYTEST)];
    const usable = entry.candidates.filter((c) => {
      if (c.rounds && !c.rounds.includes(round)) return false;
      const s = providerStatus(c.provider);
      if (!s.ok) skipped.set(c.provider, s.reason);
      return s.ok;
    });
    return { entry, lines, usable };
  });

  const jobs: Job[] = plans.flatMap(({ entry, lines, usable }) =>
    usable.flatMap((cand) => lines.map((l, i) => ({ characterId: entry.characterId, cand, lineIndex: i, text: l.text })))
  );
  const voiceDir = (c: Candidate) => (c.model ? `${c.voice}@${c.model}` : c.voice);
  const cachePath = (j: Job) => join(cacheDir, j.cand.provider, voiceDir(j.cand), `${sha(j.text)}.wav`);
  const todo = jobs.filter((j) => !existsSync(cachePath(j)));
  const newChars = todo.reduce((n, j) => n + j.text.length, 0);
  const estCost = todo.reduce((n, j) => n + (j.text.length / 1000) * (COST_PER_1K_CHARS[j.cand.provider] ?? 0), 0);

  console.log(`Round ${round}: ${plans.length} characters, ${jobs.length} clips (${todo.length} new, ${jobs.length - todo.length} cached)`);
  for (const { entry, lines, usable } of plans) {
    const real = lines.filter((l) => l.source === "playtest").length;
    console.log(`  ${entry.characterId.replace("char-", "").padEnd(20)} ${usable.length} voices x ${lines.length} lines (${real} from the playtest)`);
  }
  for (const [p, why] of skipped) console.log(`  skipping ${p}: ${why}`);
  console.log(`New characters to synthesise: ${newChars}   estimated cost: about $${estCost.toFixed(2)} (estimate; check pricing)`);

  if (flag("dry")) return console.log("Dry run: nothing was called.");
  if (newChars > maxChars) throw new Error(`That is ${newChars} characters, over the ${maxChars} limit. Re-run with --max-chars ${newChars} to allow it.`);

  // ── synthesise ────────────────────────────────────────────────────────────
  let failures = 0;
  const byProvider = new Map<string, Job[]>();
  for (const j of todo) byProvider.set(j.cand.provider, [...(byProvider.get(j.cand.provider) ?? []), j]);
  const runJob = async (j: Job) => {
    try {
      const r = await synthesize(j.cand, j.text);
      const wav = matchLoudness(parseWav(r.wav));
      mkdirSync(join(cacheDir, j.cand.provider, voiceDir(j.cand)), { recursive: true });
      writeFileSync(cachePath(j), encodeWav(wav));
      writeFileSync(cachePath(j).replace(/\.wav$/, ".json"), JSON.stringify({ ttfbMs: r.ttfbMs, totalMs: r.totalMs, chars: j.text.length }));
    } catch (e) {
      failures += 1;
      console.error(`  failed ${candId(j.cand)} line ${j.lineIndex + 1}: ${e instanceof Error ? e.message : e}`);
    }
  };
  // Each provider runs at its own pace, in parallel with the others
  await Promise.all([...byProvider.entries()].map(([name, list]) => pool(list, CONCURRENCY[name as keyof typeof CONCURRENCY] ?? 1, runJob)));
  if (failures > 0) console.error(`${failures} clip(s) failed; those voices will be left out of the page.`);

  // ── assemble the round ────────────────────────────────────────────────────
  const key: Record<string, Record<string, string>> = {};
  const stats: Record<string, { ttfbMs: number[]; chars: number; clips: number }> = {};
  const pageData: PageData = { round, title: `Radio Night voice audition, round ${round}`, characters: [] };

  for (const { entry, lines, usable } of plans) {
    const complete = usable.filter((c) => lines.every((l) => existsSync(cachePath({ characterId: entry.characterId, cand: c, lineIndex: 0, text: l.text }))));
    if (complete.length === 0 || lines.length === 0) continue;

    const labels = blindLabels(complete.map(candId), seedFor(entry.characterId + round));
    key[entry.characterId] = labels;
    const voices: Record<string, string[]> = {};
    for (const [letter, id] of Object.entries(labels)) {
      const cand = complete.find((c) => candId(c) === id)!;
      voices[letter] = lines.map((l, i) => {
        const src = cachePath({ characterId: entry.characterId, cand, lineIndex: i, text: l.text });
        const rel = `audio/${entry.characterId.replace("char-", "")}/${letter}/${String(i + 1).padStart(2, "0")}.wav`;
        mkdirSync(join(roundDir, rel, ".."), { recursive: true });
        copyFileSync(src, join(roundDir, rel));
        const meta = JSON.parse(readFileSync(src.replace(/\.wav$/, ".json"), "utf8")) as { ttfbMs: number; chars: number };
        const s = (stats[id] ||= { ttfbMs: [], chars: 0, clips: 0 });
        s.ttfbMs.push(meta.ttfbMs);
        s.chars += meta.chars;
        s.clips += 1;
        return rel;
      });
    }
    const def = theSittingCase.characters.find((c) => c.id === entry.characterId);
    pageData.characters.push({
      id: entry.characterId,
      name: def?.name ?? "The Narrator",
      role: def?.role ?? "Scene narrator and case guide",
      want: entry.want,
      lines: lines.map((l) => ({ text: l.text, source: l.source })),
      voices,
    });
  }

  if (pageData.characters.length === 0) throw new Error("Nothing to show: no voice produced a full set of clips.");
  mkdirSync(roundDir, { recursive: true });
  writeFileSync(join(roundDir, "index.html"), buildPage(pageData));
  writeFileSync(join(roundDir, "key.json"), JSON.stringify({ round, key, stats, notes: Object.fromEntries(CASTING.flatMap((c) => c.candidates.map((x) => [`${c.characterId}|${candId(x)}`, x.note ?? ""]))) }, null, 2));

  console.log(`\nDone. Open this and listen:\n  ${join(roundDir, "index.html")}\n`);
  console.log("Tip: use headphones for the first pass and your phone speaker for the second.");
  console.log("When you have both saved your scores, move the downloaded files into the round folder and run:\n  npm run audition:score -- --round " + round);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
