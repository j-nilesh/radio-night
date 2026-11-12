/**
 * scripts/audition/voice-items.ts
 * Builds the character-voice items of an audition round. DEVELOPMENT-ONLY.
 *
 * Triage: every shortlisted voice reads three short lines (enough to hear its
 * character and catch a robotic moment). Final: the survivors read all eight.
 * Clips are cached by voice, model and text, so a line is only ever paid for once.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { theSittingCase } from "../../content/cases/radio-night-s01/v1/case";
import { FACTS_BY_CHARACTER } from "../../content/cases/radio-night-s01/v1/facts";
import { BEATS } from "../../content/cases/radio-night-s01/v1/beats";
import { CASTING, COST_PER_1K_CHARS, type Candidate } from "./casting";
import { isAllowed, type BuiltItem, type Ctx, type Stats } from "./items";
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
} from "./lib";
import { CONCURRENCY, providerStatus, synthesize } from "./providers";

const LINES_AUTHORED = 4;
const LINES_PLAYTEST = 4;
const NARRATION_MAX = 380;

const candId = (c: Candidate) => `${c.provider}:${c.voice}`;
const sha = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);
const voiceDir = (c: Candidate) => (c.model ? `${c.voice}@${c.model}` : c.voice);

type Ev = { kind: string; character?: string; reply?: string };

function loadPlaytestEvents(): Ev[] {
  const out: Ev[] = [];
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
  return ["beat-opening-narration", "beat-ending-correct-full", "beat-ending-wrong-carol"]
    .map((id) => BEATS.find((b) => b.id === id)?.scriptedText)
    .filter((t): t is string => !!t)
    .map((t) => ({ source: "narration" as const, text: clipAtSentence(t, NARRATION_MAX) }));
}

/**
 * Three lines for the quick sieve, always a subset of the full eight so the
 * clips are already paid for: a calm authored line, one under pressure, and a
 * real reply from the playtest. The narrator reads the opening and the last ending.
 */
export function triageSubset(full: TestLine[]): TestLine[] {
  const authored = full.filter((l) => l.source === "authored");
  const real = full.filter((l) => l.source === "playtest");
  const narration = full.filter((l) => l.source === "narration");
  if (narration.length) return [narration[0], narration[narration.length - 1]].filter((l, i, a) => a.indexOf(l) === i);
  // With three or more authored lines the second is the calm one; with fewer, start from the first
  const firstAuthored = authored.length >= 3 ? authored[1] : authored[0];
  const picks = [firstAuthored, authored.length > 1 ? authored[authored.length - 1] : undefined, real[1] ?? real[0]];
  return picks.filter((l): l is TestLine => !!l).filter((l, i, a) => a.findIndex((x) => x.text === l.text) === i);
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    })
  );
}

export async function collectVoiceItems(ctx: Ctx): Promise<BuiltItem[]> {
  const events = loadPlaytestEvents();
  const skipped = new Map<string, string>();

  const plans = CASTING.filter((c) => !ctx.only || ctx.only.some((o) => c.characterId.includes(o))).map((entry) => {
    const facts = FACTS_BY_CHARACTER[entry.characterId] ?? [];
    const full: TestLine[] =
      entry.characterId === "char-narrator"
        ? narratorLines()
        : [...authoredLines(facts, LINES_AUTHORED), ...playtestLines(events, entry.characterId, LINES_PLAYTEST)];
    const lines = ctx.stage === "triage" ? triageSubset(full) : full;
    const usable = entry.candidates.filter((c) => {
      if (!isAllowed(ctx, entry.characterId, candId(c))) return false;
      const s = providerStatus(c.provider);
      if (!s.ok) skipped.set(c.provider, s.reason);
      return s.ok;
    });
    return { entry, lines, usable };
  });

  type Job = { characterId: string; cand: Candidate; lineIndex: number; text: string };
  const jobs: Job[] = plans.flatMap(({ entry, lines, usable }) =>
    usable.flatMap((cand) => lines.map((l, i) => ({ characterId: entry.characterId, cand, lineIndex: i, text: l.text })))
  );
  const cachePath = (j: Job) => join(ctx.cacheDir, j.cand.provider, voiceDir(j.cand), `${sha(j.text)}.wav`);
  const todo = jobs.filter((j) => !existsSync(cachePath(j)));
  const newChars = todo.reduce((n, j) => n + j.text.length, 0);
  const estCost = todo.reduce((n, j) => n + (j.text.length / 1000) * (COST_PER_1K_CHARS[j.cand.provider] ?? 0), 0);

  console.log(`Voices: ${plans.length} parts, ${jobs.length} clips (${todo.length} new, ${jobs.length - todo.length} already made)`);
  for (const { entry, lines, usable } of plans) {
    console.log(`  ${entry.characterId.replace("char-", "").padEnd(18)} ${usable.length} voices x ${lines.length} lines`);
  }
  for (const [p, why] of skipped) console.log(`  skipping ${p}: ${why}`);
  console.log(`  New characters to synthesise: ${newChars} (Deepgram portion about $${estCost.toFixed(2)}; other providers bill in plan credits)`);
  if (ctx.dry) return [];
  if (newChars > ctx.maxChars) throw new Error(`That is ${newChars} characters, over the ${ctx.maxChars} limit. Re-run with --max-chars ${newChars} to allow it.`);

  // Each provider runs at its own pace, in parallel with the others
  let failures = 0;
  const byProvider = new Map<string, Job[]>();
  for (const j of todo) byProvider.set(j.cand.provider, [...(byProvider.get(j.cand.provider) ?? []), j]);
  await Promise.all(
    [...byProvider.entries()].map(([name, list]) =>
      pool(list, CONCURRENCY[name as keyof typeof CONCURRENCY] ?? 1, async (j) => {
        try {
          const r = await synthesize(j.cand, j.text);
          const wav = matchLoudness(parseWav(r.wav));
          mkdirSync(join(ctx.cacheDir, j.cand.provider, voiceDir(j.cand)), { recursive: true });
          writeFileSync(cachePath(j), encodeWav(wav));
          writeFileSync(cachePath(j).replace(/\.wav$/, ".json"), JSON.stringify({ ttfbMs: r.ttfbMs, totalMs: r.totalMs, chars: j.text.length }));
        } catch (e) {
          failures += 1;
          console.error(`  failed ${candId(j.cand)} line ${j.lineIndex + 1}: ${e instanceof Error ? e.message : e}`);
        }
      })
    )
  );
  if (failures > 0) console.error(`  ${failures} clip(s) failed; those voices are left out.`);

  const items: BuiltItem[] = [];
  for (const { entry, lines, usable } of plans) {
    const complete = usable.filter((c) =>
      lines.every((l) => existsSync(cachePath({ characterId: entry.characterId, cand: c, lineIndex: 0, text: l.text })))
    );
    if (complete.length === 0 || lines.length === 0) continue;
    if (complete.length === 1) {
      console.log(`  ${entry.characterId.replace("char-", "")}: only one voice left (${candId(complete[0])}); nothing to compare`);
      continue;
    }

    const letters = blindLabels(complete.map(candId), seedFor(entry.characterId + ctx.name));
    const stats: Stats = {};
    const notes: Record<string, string> = {};
    const voices: Record<string, string[]> = {};
    for (const [letter, id] of Object.entries(letters)) {
      const cand = complete.find((c) => candId(c) === id)!;
      notes[`${entry.characterId}|${id}`] = cand.note ?? "";
      voices[letter] = lines.map((l, i) => {
        const src = cachePath({ characterId: entry.characterId, cand, lineIndex: i, text: l.text });
        const rel = `audio/${entry.characterId.replace("char-", "")}/${letter}/${String(i + 1).padStart(2, "0")}.wav`;
        mkdirSync(join(ctx.roundDir, rel, ".."), { recursive: true });
        copyFileSync(src, join(ctx.roundDir, rel));
        const meta = JSON.parse(readFileSync(src.replace(/\.wav$/, ".json"), "utf8")) as { ttfbMs: number; chars: number };
        const s = (stats[id] ||= { ttfbMs: [], chars: 0, clips: 0 });
        s.ttfbMs.push(meta.ttfbMs);
        s.chars += meta.chars;
        s.clips += 1;
        return rel;
      });
    }
    const def = theSittingCase.characters.find((c) => c.id === entry.characterId);
    items.push({
      kind: "voice",
      letters,
      notes,
      stats,
      page: {
        id: entry.characterId,
        group: "Character voices",
        name: def?.name ?? "The Narrator",
        role: def?.role ?? "Scene narrator and case guide",
        want: entry.want,
        lines: lines.map((l) => ({ text: l.text, source: l.source })),
        voices,
      },
    });
  }
  return items;
}
