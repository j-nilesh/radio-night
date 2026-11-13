/**
 * scripts/audition-score.ts
 * DEVELOPMENT-ONLY. Reveals and ranks a finished step-2 round.
 *
 *   npm run audition:score -- --round f1
 *
 * Reads key.json and every scores-*.json in reports/audition/round-<name>/,
 * combines the listeners' ear scores with measured latency and estimated cost
 * for voices (the build plan's rubric: ear 80, latency 15, cost 5), and judges
 * sounds and music by ear alone. Each listener's score is shown on its own so
 * disagreement is visible. Writes summary.md.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COST_PER_1K_CHARS, type ProviderName } from "./audition/casting";
import { costPoints, earPoints, latencyPoints, median, WEIGHTS, type EarScores } from "./audition/lib";

const args = process.argv.slice(2);
const round = args.includes("--round") ? args[args.indexOf("--round") + 1] : "f1";
const dir = join(process.cwd(), "reports", "audition", `round-${round}`);

type Key = {
  stage?: string;
  key: Record<string, Record<string, string>>;
  itemKind?: Record<string, "voice" | "sound">;
  stats: Record<string, { ttfbMs: number[]; chars: number; clips: number }>;
  notes: Record<string, string>;
  /** Parts with a single survivor in step 1: chosen without scoring */
  autoChosen?: Record<string, string>;
};
type Entry = { scores: Partial<EarScores>; verdict: string; notes: string };
type ScoreFile = { listener: string; scores: Record<string, Record<string, Entry>> };

if (!existsSync(join(dir, "key.json"))) {
  console.error(`No key.json in ${dir}. Build the round first (npm run audition:build -- --stage final --from t1 --name ${round}).`);
  process.exit(1);
}
const { key, stats, notes, itemKind, stage, autoChosen } = JSON.parse(readFileSync(join(dir, "key.json"), "utf8")) as Key;
if (stage === "triage") {
  console.error(`Round "${round}" is a step-1 sieve, not a scoring round. Build step 2 from it:\n  npm run audition:build -- --stage final --from ${round} --name f1`);
  process.exit(1);
}
const files = readdirSync(dir).filter((f) => /^scores-.*\.json$/.test(f));
if (files.length === 0) {
  console.error(`No scores-*.json files in ${dir}. Use "Save my scores" on the page, then move the downloaded files here.`);
  process.exit(1);
}
const listeners = files.map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as ScoreFile);
const complete = (e?: Entry): e is Entry & { scores: EarScores } =>
  !!e && ["authenticity", "emotion", "consistency", "clarity"].every((k) => (e.scores as Record<string, number>)[k] > 0);

const earMax = WEIGHTS.authenticity + WEIGHTS.emotion + WEIGHTS.consistency + WEIGHTS.clarity;
const out: string[] = [
  `# Audition, step 2, round ${round}`,
  "",
  `Listeners: ${listeners.map((l) => l.listener).join(", ")}`,
  "",
  `Voices: ear ${earMax} (believable ${WEIGHTS.authenticity}, feeling ${WEIGHTS.emotion}, consistency ${WEIGHTS.consistency}, clarity ${WEIGHTS.clarity}) + latency ${WEIGHTS.latency} (measured) + cost ${WEIGHTS.cost} (estimated). Sounds and music: by ear alone, out of ${earMax}.`,
  "",
];

const providerOf = (id: string) => id.split(":")[0] as ProviderName;

for (const [itemId, letters] of Object.entries(key)) {
  const isSound = itemKind?.[itemId] === "sound";
  const costs = Object.values(letters)
    .map((id) => COST_PER_1K_CHARS[providerOf(id)])
    .filter((c): c is number => c !== undefined && c > 0);
  const cheapest = costs.length ? Math.min(...costs) : undefined;

  const rows = Object.entries(letters)
    .map(([letter, id]) => {
      const per = listeners
        .map((l) => ({ name: l.listener, entry: l.scores[itemId]?.[letter] }))
        .filter((x): x is { name: string; entry: Entry & { scores: EarScores } } => complete(x.entry));
      const ears = per.map((x) => earPoints(x.entry.scores));
      const earAvg = ears.length ? ears.reduce((a, b) => a + b, 0) / ears.length : undefined;
      const ttfb = median(stats[id]?.ttfbMs ?? []);
      const lat = isSound ? 0 : latencyPoints(ttfb);
      const cst = isSound ? 0 : costPoints(COST_PER_1K_CHARS[providerOf(id)], cheapest);
      const verdicts = per.map((x) => x.entry.verdict);
      return {
        letter,
        id,
        earAvg,
        ttfb,
        lat,
        cst,
        total: earAvg === undefined ? undefined : earAvg + lat + cst,
        byListener: listeners.map((l) => {
          const p = per.find((x) => x.name === l.listener);
          return p ? earPoints(p.entry.scores) : undefined;
        }),
        spread: ears.length > 1 ? Math.max(...ears) - Math.min(...ears) : 0,
        no: verdicts.filter((v) => v === "no").length,
        yes: verdicts.filter((v) => v === "yes").length,
        notes: per.map((x) => (x.entry.notes ? `${x.name}: ${x.entry.notes}` : "")).filter(Boolean),
      };
    })
    .sort((a, b) => (b.total ?? -1) - (a.total ?? -1));

  const f = (n?: number) => (n === undefined ? "n/a" : n.toFixed(1));
  out.push(`## ${itemId.replace("char-", "")}${isSound ? " (by ear only)" : ""}`, "");
  out.push(
    `| Rank | Option | Heard as | Total | Ear avg | ${listeners.map((l) => l.listener).join(" | ")} |${isSound ? "" : " Latency | Cost |"} Yes / No | Disagreement |`,
    `|---|---|---|---|---|${listeners.map(() => "---|").join("")}${isSound ? "" : "---|---|"}---|---|`
  );
  rows.forEach((r, i) => {
    out.push(
      `| ${i + 1} | ${r.id} | ${r.letter} | ${f(r.total)} | ${f(r.earAvg)} | ${r.byListener.map(f).join(" | ")} |${
        isSound ? "" : ` ${f(r.lat)}${r.ttfb !== undefined ? ` (${Math.round(r.ttfb)} ms)` : ""} | ${f(r.cst)} |`
      } ${r.yes} / ${r.no} | ${r.spread.toFixed(1)} |`
    );
  });
  out.push("");
  for (const r of rows) {
    const what = notes[`${itemId}|${r.id}`];
    if (r.notes.length || what) out.push(`- **${r.id}** (${what || "no note"})${r.notes.length ? ": " + r.notes.join(" | ") : ""}`);
  }
  out.push("");
}

if (autoChosen && Object.keys(autoChosen).length > 0) {
  out.push("## Chosen without scoring", "", "Only one option survived step 1 for each of these, so there was nothing to compare.", "");
  for (const [itemId, id] of Object.entries(autoChosen)) {
    const what = notes[`${itemId}|${id}`];
    out.push(`- **${itemId.replace("char-", "")}**: ${id}${what ? ` (${what})` : ""}`);
  }
  out.push("");
}

writeFileSync(join(dir, "summary.md"), out.join("\n"));
console.log(out.join("\n"));
console.log(`\nWritten to ${join(dir, "summary.md")}`);
