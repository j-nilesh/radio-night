/**
 * scripts/audition-score.ts
 * DEVELOPMENT-ONLY. Reveals and ranks the voices of a finished audition round.
 *
 *   npm run audition:score -- --round 1
 *
 * Reads key.json and every scores-*.json in reports/audition/round-N/, combines
 * the listeners' ear scores with measured latency and estimated cost using the
 * build plan's rubric (ear 80, latency 15, cost 5), and writes summary.md.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COST_PER_1K_CHARS, type ProviderName } from "./audition/casting";
import { costPoints, earPoints, latencyPoints, median, WEIGHTS, type EarScores } from "./audition/lib";

const args = process.argv.slice(2);
const round = args.includes("--round") ? args[args.indexOf("--round") + 1] : "1";
const dir = join(process.cwd(), "reports", "audition", `round-${round}`);

type Key = {
  /** "sound" rounds are judged by ear alone: there is no latency or running cost to weigh */
  kind?: "sound";
  key: Record<string, Record<string, string>>;
  stats: Record<string, { ttfbMs: number[]; chars: number; clips: number }>;
  notes: Record<string, string>;
};
type Entry = { scores: Partial<EarScores>; verdict: string; notes: string };
type ScoreFile = { listener: string; scores: Record<string, Record<string, Entry>> };

if (!existsSync(join(dir, "key.json"))) {
  console.error(`No key.json in ${dir}. Run npm run audition:build -- --round ${round} first.`);
  process.exit(1);
}
const { key, stats, notes, kind } = JSON.parse(readFileSync(join(dir, "key.json"), "utf8")) as Key;
const isSound = kind === "sound";
const files = readdirSync(dir).filter((f) => /^scores-.*\.json$/.test(f));
if (files.length === 0) {
  console.error(`No scores-*.json files in ${dir}. Use "Save my scores" on the page, then move the downloaded files here.`);
  process.exit(1);
}
const listeners = files.map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as ScoreFile);
const complete = (e?: Entry): e is Entry & { scores: EarScores } =>
  !!e && ["authenticity", "emotion", "consistency", "clarity"].every((k) => (e.scores as Record<string, number>)[k] > 0);

const out: string[] = [`# ${isSound ? "Sound" : "Voice"} audition, round ${round}`, "", `Listeners: ${listeners.map((l) => l.listener).join(", ")}`, "",
  isSound
    ? `Points: by ear alone, out of ${WEIGHTS.authenticity + WEIGHTS.emotion + WEIGHTS.consistency + WEIGHTS.clarity} (fits the place ${WEIGHTS.authenticity}, mood ${WEIGHTS.emotion}, holds together ${WEIGHTS.consistency}, stays out of the way ${WEIGHTS.clarity}).`
    : `Points: ear ${WEIGHTS.authenticity + WEIGHTS.emotion + WEIGHTS.consistency + WEIGHTS.clarity} (believable ${WEIGHTS.authenticity}, feeling ${WEIGHTS.emotion}, consistency ${WEIGHTS.consistency}, clarity ${WEIGHTS.clarity}), latency ${WEIGHTS.latency}, cost ${WEIGHTS.cost}. Latency and cost are measured or estimated, not heard.`, ""];

for (const [characterId, labels] of Object.entries(key)) {
  const costs = Object.values(labels).map((id) => {
    const s = stats[id];
    return s && s.chars > 0 ? ((COST_PER_1K_CHARS[id.split(":")[0] as ProviderName] ?? 0) * 1) : undefined;
  }).filter((c): c is number => c !== undefined && c > 0);
  const cheapest = costs.length ? Math.min(...costs) : undefined;

  const rows = Object.entries(labels).map(([letter, id]) => {
    const perListener = listeners.map((l) => ({ name: l.listener, entry: l.scores[characterId]?.[letter] })).filter((x) => complete(x.entry));
    const ear = perListener.map((x) => earPoints((x.entry as Entry & { scores: EarScores }).scores));
    const earAvg = ear.length ? ear.reduce((a, b) => a + b, 0) / ear.length : undefined;
    const ttfb = median(stats[id]?.ttfbMs ?? []);
    const cost = COST_PER_1K_CHARS[id.split(":")[0] as ProviderName];
    const lat = isSound ? 0 : latencyPoints(ttfb);
    const cst = isSound ? 0 : costPoints(cost, cheapest);
    const verdicts = perListener.map((x) => (x.entry as Entry).verdict);
    return {
      letter, id, earAvg, ttfb, lat, cst,
      total: earAvg === undefined ? undefined : earAvg + lat + cst,
      spread: ear.length > 1 ? Math.max(...ear) - Math.min(...ear) : 0,
      no: verdicts.filter((v) => v === "no").length,
      yes: verdicts.filter((v) => v === "yes").length,
      listeners: perListener.length,
      notes: perListener.map((x) => ((x.entry as Entry).notes ? `${x.name}: ${(x.entry as Entry).notes}` : "")).filter(Boolean),
    };
  }).sort((a, b) => (b.total ?? -1) - (a.total ?? -1));

  out.push(`## ${characterId.replace("char-", "")}`, "", "| Rank | Voice | Heard as | Total | Ear | Latency | Cost | Yes / No | Disagreement |", "|---|---|---|---|---|---|---|---|---|");
  rows.forEach((r, i) => {
    const f = (n?: number) => (n === undefined ? "n/a" : n.toFixed(1));
    out.push(`| ${i + 1} | ${r.id} | ${r.letter} | ${f(r.total)} | ${f(r.earAvg)} | ${f(r.lat)}${r.ttfb !== undefined ? ` (${Math.round(r.ttfb)} ms)` : ""} | ${f(r.cst)} | ${r.yes} / ${r.no} | ${r.spread.toFixed(1)} |`);
  });
  out.push("");
  for (const r of rows) {
    const shortlist = notes[`${characterId}|${r.id}`];
    if (r.notes.length || shortlist) out.push(`- **${r.id}** (${shortlist || "no shortlist note"})${r.notes.length ? ": " + r.notes.join(" | ") : ""}`);
  }
  out.push("");
}

writeFileSync(join(dir, "summary.md"), out.join("\n"));
console.log(out.join("\n"));
console.log(`\nWritten to ${join(dir, "summary.md")}`);
