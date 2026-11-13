/**
 * scripts/audition-build.ts
 * DEVELOPMENT-ONLY. Builds either step of the two-step blind audition for
 * character voices, room sounds, effects, stings and music.
 *
 *   STEP 1, a quick sieve by one person:
 *     npm run audition:build -- --stage triage --name t1 --dry     (plan and cost, calls nothing)
 *     npm run audition:build -- --stage triage --name t1
 *     npm run audition:build -- --stage triage --name t1 --music   (also compose the music)
 *
 *   STEP 2, the survivors scored by each listener, blind again:
 *     npm run audition:build -- --stage final --from t1 --name f1
 *
 * Output (gitignored): reports/audition/round-<name>/ with index.html (open it),
 * key.json (which letter is which; the scorer reads it, do not peek) and audio/.
 * Clips are cached in reports/audition/cache, so rebuilding costs nothing for
 * anything already made.
 */
import { config } from "dotenv";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BuiltItem, Ctx, Stage } from "./audition/items";
import { buildPage, type PageData } from "./audition/page";
import { collectSoundItems } from "./audition/sound-items";
import { collectVoiceItems } from "./audition/voice-items";
import { autoChosen, shortlistToAllow, type ShortlistFile } from "./audition/shortlist";

config({ path: ".env.local", quiet: true });

const args = process.argv.slice(2);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (n: string) => args.includes(`--${n}`);

const GROUP_ORDER = ["Character voices", "Room sounds", "Effects and stings", "Music"];

async function main() {
  const stage = (opt("stage") ?? "triage") as Stage;
  if (stage !== "triage" && stage !== "final") throw new Error('--stage must be "triage" or "final"');
  const name = opt("name") ?? (stage === "triage" ? "t1" : "f1");
  const root = join(process.cwd(), "reports", "audition");
  const roundDir = join(root, `round-${name}`);

  let allow: Ctx["allow"];
  let fromNotes: Record<string, string> = {};
  let fromNote = "";
  if (stage === "final") {
    const from = opt("from") ?? "t1";
    const fromDir = join(root, `round-${from}`);
    if (!existsSync(join(fromDir, "key.json"))) throw new Error(`No step-1 round "${from}" found. Build it first: npm run audition:build -- --stage triage --name ${from}`);
    const files = readdirSync(fromDir).filter((f) => /^shortlist-.*\.json$/.test(f));
    if (files.length === 0) throw new Error(`No shortlist-*.json files in ${fromDir}. Use "Save my shortlist" on the step-1 page, then move the downloaded file there.`);
    const key = JSON.parse(readFileSync(join(fromDir, "key.json"), "utf8")) as { key: Record<string, Record<string, string>>; notes?: Record<string, string> };
    fromNotes = key.notes ?? {};
    const lists = files.map((f) => JSON.parse(readFileSync(join(fromDir, f), "utf8")) as ShortlistFile);
    const include = (opt("include") ?? "keep,maybe").split(",").map((s) => s.trim());
    const result = shortlistToAllow(key.key, lists, include);
    allow = result.allow;
    fromNote = `Step 1 shortlist from ${lists.map((l) => l.listener).join(", ")} (kept: ${include.join(" + ")})`;
    console.log(fromNote);
    for (const line of result.report) console.log("  " + line);
  }

  const ctx: Ctx = {
    stage,
    name,
    roundDir,
    cacheDir: join(root, "cache"),
    only: opt("only")?.split(",").map((s) => s.trim().toLowerCase()),
    dry: flag("dry"),
    includeMusic: flag("music"),
    maxChars: Number(opt("max-chars") ?? 60000),
    maxCredits: Number(opt("max-credits") ?? 4000),
    allow,
  };

  console.log(`\n${stage === "triage" ? "Step 1 (quick sieve)" : "Step 2 (scoring)"}: round "${name}"\n`);
  mkdirSync(roundDir, { recursive: true });
  const built: BuiltItem[] = [...(await collectVoiceItems(ctx)), ...(await collectSoundItems(ctx))];
  if (ctx.dry) return console.log("\nDry run: nothing was called.");
  if (built.length === 0) throw new Error("Nothing to show.");

  built.sort((a, b) => GROUP_ORDER.indexOf(a.page.group ?? "") - GROUP_ORDER.indexOf(b.page.group ?? ""));

  const page: PageData = {
    round: name,
    mode: stage === "triage" ? "triage" : "score",
    title: stage === "triage" ? `Radio Night audition, step 1 (${name})` : `Radio Night audition, step 2 (${name})`,
    characters: built.map((b) => b.page),
  };
  writeFileSync(join(roundDir, "index.html"), buildPage(page));
  writeFileSync(
    join(roundDir, "key.json"),
    JSON.stringify(
      {
        round: name,
        stage,
        from: stage === "final" ? (opt("from") ?? "t1") : undefined,
        autoChosen: allow
          ? Object.fromEntries(Object.entries(autoChosen(allow)).filter(([id]) => !ctx.only || ctx.only.some((o) => id.includes(o))))
          : undefined,
        key: Object.fromEntries(built.map((b) => [b.page.id, b.letters])),
        itemKind: Object.fromEntries(built.map((b) => [b.page.id, b.kind])),
        stats: Object.assign({}, ...built.map((b) => b.stats)),
        // Notes (including each winning prompt) for what was built, plus those of options chosen without scoring
        notes: Object.assign(
          {},
          ...(allow
            ? Object.entries(autoChosen(allow)).map(([itemId, candidateId]) => ({ [`${itemId}|${candidateId}`]: fromNotes[`${itemId}|${candidateId}`] ?? "" }))
            : []),
          ...built.map((b) => b.notes)
        ),
      },
      null,
      2
    )
  );

  const counts = GROUP_ORDER.map((g) => `${g}: ${built.filter((b) => b.page.group === g).length}`).join(", ");
  console.log(`\nDone. ${counts}\nOpen this and listen:\n  ${join(roundDir, "index.html")}\n`);
  if (stage === "triage") {
    console.log("Mark each option Keep, Maybe or Drop, press 'Save my shortlist', and move the downloaded file into that folder. Then:");
    console.log(`  npm run audition:build -- --stage final --from ${name} --name f1`);
  } else {
    console.log("Each listener scores on their own, saves, and moves their scores-*.json file into that folder. Then:");
    console.log(`  npm run audition:score -- --round ${name}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
