/**
 * scripts/playtest-report.ts
 * DEVELOPMENT-ONLY. Reads playtests/*.jsonl and prints what happened in a playtest.
 *
 *   npm run playtest:report                   latest file
 *   npm run playtest:report -- --file 2026-11-08
 *   npm run playtest:report -- --all
 *   npm run playtest:report -- --run ab12cd34   one run (short id)
 *   npm run playtest:report -- --verbose        also print model text and errors
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Ev = { t: string; ms: number; kind: string; [k: string]: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const dir = process.env.PLAYTEST_DIR || join(process.cwd(), "playtests");
let files: string[] = [];
try {
  files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort();
} catch {
  /* handled below */
}
if (files.length === 0) {
  console.log(`No telemetry in ${dir}. Play a run with the dev server first.`);
  process.exit(0);
}
const wanted = flag("all") ? files : opt("file") ? files.filter((f) => f.startsWith(opt("file")!)) : files.slice(-1);

const events: Ev[] = [];
for (const f of wanted) {
  for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      /* skip a damaged line */
    }
  }
}
const runFilter = opt("run");
const evs = (runFilter ? events.filter((e) => e.run === runFilter) : events).sort((a, b) => a.ms - b.ms);
const verbose = flag("verbose");

// ── helpers ────────────────────────────────────────────────────────────────
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
function pct(values: number[], p: number): number | undefined {
  if (values.length === 0) return undefined;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}
function stat(label: string, values: Array<number | undefined>) {
  const v = values.filter(num);
  if (v.length === 0) return console.log(`  ${label.padEnd(28)} no data`);
  const f = (n?: number) => (n === undefined ? "-" : `${Math.round(n)}`.padStart(6));
  console.log(`  ${label.padEnd(28)} n=${String(v.length).padStart(3)}  p50=${f(pct(v, 50))}  p95=${f(pct(v, 95))}  max=${f(Math.max(...v))} ms`);
}
const clip = (s: unknown, n: number) => {
  const t = String(s ?? "").replace(/\s+/g, " ");
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};
const by = <T,>(items: T[], key: (t: T) => string) => {
  const m = new Map<string, T[]>();
  for (const i of items) m.set(key(i), [...(m.get(key(i)) ?? []), i]);
  return m;
};
const count = (items: string[]) => {
  const m = new Map<string, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join("  ") || "none";
};

console.log(`\nPlaytest report: ${wanted.join(", ")}${runFilter ? `  run ${runFilter}` : ""}  (${evs.length} events)\n`);

// ── sessions ───────────────────────────────────────────────────────────────
console.log("SESSIONS");
for (const e of evs.filter((x) => x.kind === "client.session")) {
  console.log(`  ${e.t.slice(11, 19)} run ${e.run}  ${e.browser}  ${e.viewport}  touch=${e.touch}  mediaRecorder=${e.mediaRecorder}  net=${e.connection ?? "?"}`);
}
const intro = evs.filter((x) => x.kind === "client.intro.choice");
if (intro.length) console.log(`  intro: ${intro.map((e) => (e.sound ? "sound" : "captions")).join(", ")}`);

// ── turns ──────────────────────────────────────────────────────────────────
const turns = evs.filter((e) => e.kind === "turn");
const asks = new Map(evs.filter((e) => e.kind === "client.turn.ask").map((e) => [e.turn as string, e]));
const firstSound = new Map(
  evs.filter((e) => e.kind === "client.audio.first_sound" && e.turn).map((e) => [e.turn as string, e])
);
console.log(`\nTURNS (${turns.length}; ${count(turns.map((t) => t.source))})`);
console.log("  time     key       via    char      path               stt   llm   srv  ask>hear  question -> reply");
for (const t of turns) {
  const h = firstSound.get(t.key);
  const tm = t.timings ?? {};
  console.log(
    "  " +
      [
        t.t.slice(11, 19),
        String(t.key ?? "").padEnd(8),
        String(t.source ?? "").padEnd(5),
        String(t.character ?? "").padEnd(9),
        String(t.path ?? "").padEnd(18),
        String(tm.sttMs ?? "-").padStart(5),
        String(tm.llmMs ?? "-").padStart(5),
        String(tm.requestMs ?? tm.totalMs ?? "-").padStart(5),
        String(h?.askToHearMs ?? "-").padStart(8),
      ].join(" ") +
      `  "${clip(t.question, 60)}" -> "${clip(t.reply, 70)}"`
  );
  if (verbose) {
    if (t.stt?.confidence !== undefined) console.log(`      stt conf=${t.stt.confidence} outcome=${t.stt.outcome}`);
    if (t.model?.rejected) console.log(`      MODEL REJECTED: ${t.model.rejected}\n      raw: ${clip(t.model.rawText, 200)}`);
    if (t.cluesGranted?.length) console.log(`      clues: ${t.cluesGranted.join(", ")}`);
  }
}

console.log("\nPATHS: " + count(turns.map((t) => t.path ?? "?")));
console.log("\nTIMING");
stat("speech-to-text", turns.map((t) => t.timings?.sttMs));
stat("model", turns.filter((t) => t.path === "model").map((t) => t.timings?.llmMs));
stat("server request total", turns.map((t) => t.timings?.requestMs));
stat("round trip (browser)", evs.filter((e) => e.kind === "client.turn.response").map((e) => e.roundTripMs));
stat("ask -> hear first sound", evs.filter((e) => e.kind === "client.audio.first_sound").map((e) => e.askToHearMs));
stat("response -> hear first sound", evs.filter((e) => e.kind === "client.audio.first_sound").map((e) => e.responseToHearMs));
stat("speech first byte (server)", evs.filter((e) => e.kind === "speech").map((e) => e.ttfbMs));
stat("speech first chunk (browser)", evs.filter((e) => e.kind === "client.audio.first_chunk").map((e) => e.sinceRequestMs));

// ── microphone ─────────────────────────────────────────────────────────────
const mics = evs.filter((e) => e.kind === "client.mic.recording");
const rejected = evs.filter((e) => e.kind === "client.mic.rejected");
const stt = turns.filter((t) => t.stt);
console.log("\nMICROPHONE");
console.log(`  recordings=${mics.length}  rejected before upload=${rejected.length}  mic errors=${evs.filter((e) => e.kind === "client.mic.error").length}`);
console.log(`  track mute/unmute events: ${evs.filter((e) => e.kind === "client.mic.track_mute").length}/${evs.filter((e) => e.kind === "client.mic.track_unmute").length}`);
console.log(`  STT outcomes: ${count(stt.map((t) => t.stt.outcome))}`);
for (const r of rejected) console.log(`  ${r.t.slice(11, 19)} rejected: ${r.message}`);
const peaks = mics.map((m) => m.peakRms).filter(num);
if (peaks.length) console.log(`  peak level: min=${Math.min(...peaks)} p50=${pct(peaks, 50)} max=${Math.max(...peaks)}`);
stat("recording length", mics.map((m) => m.durationMs));
stat("tap-to-stop", mics.map((m) => m.tapToStopMs));
const lowConf = stt.filter((t) => t.stt.outcome !== "ok");
for (const t of lowConf) {
  console.log(`  ${t.t.slice(11, 19)} ${t.stt.outcome} conf=${t.stt.confidence ?? "-"} audio=${t.stt.audioBytes}B transcript="${clip(t.stt.transcript, 60)}"`);
}

// ── audio ──────────────────────────────────────────────────────────────────
const speech = evs.filter((e) => e.kind === "speech");
const perLine = by(speech, (e) => e.line);
const dupes = [...perLine.values()].filter((v) => v.length > 1);
console.log("\nAUDIO");
console.log(`  /api/speech requests=${speech.length} for ${perLine.size} distinct lines; lines requested more than once=${dupes.length}`);
console.log(`  sources: ${count(speech.map((e) => e.source ?? "none"))}`);
console.log(`  outcomes: ${count(speech.map((e) => e.outcome ?? "?"))}  statuses: ${count(speech.map((e) => String(e.status)))}`);
console.log(`  range requests: ${speech.filter((e) => e.range).length}`);
const played = evs.filter((e) => e.kind === "client.audio.ended").length;
console.log(`  clips played to the end=${played}  underruns=${evs.filter((e) => e.kind === "client.audio.underrun").length}  errors=${evs.filter((e) => e.kind === "client.audio.error").length}`);
console.log(`  interruptions: ${count(evs.filter((e) => e.kind === "client.audio.interrupt").map((e) => e.reason))}`);
console.log(`  stopped clips: ${count(evs.filter((e) => e.kind === "client.audio.stopped").map((e) => e.reason))}`);
console.log(`  skipped (voice off): ${evs.filter((e) => e.kind === "client.audio.skipped").length}`);
for (const e of evs.filter((x) => x.kind === "client.audio.error")) console.log(`  ${e.t.slice(11, 19)} audio error [${e.stage ?? "stream"}] ${e.message}`);
for (const e of evs.filter((x) => x.kind === "client.audio.underrun")) console.log(`  ${e.t.slice(11, 19)} underrun late by ${e.lateMs} ms (${e.lineKind})`);
const voiceToggles = evs.filter((e) => e.kind === "client.voice.toggle");
if (voiceToggles.length) console.log(`  voice toggles: ${voiceToggles.map((e) => (e.on ? "on" : "off")).join(", ")}`);

// ── game ───────────────────────────────────────────────────────────────────
console.log("\nGAME");
console.log(`  scene actions=${evs.filter((e) => e.kind === "scene").length}  accusations=${evs.filter((e) => e.kind === "accuse").length}`);
const rejects = turns.filter((t) => t.model?.rejected);
console.log(`  model replies rejected by the guard: ${rejects.length}`);
for (const t of rejects) console.log(`    ${t.t.slice(11, 19)} ${t.character}: ${t.model.rejected}`);
const clues = turns.flatMap((t) => t.cluesGranted ?? []);
console.log(`  clues earned by questioning: ${clues.join(", ") || "none"}`);
for (const a of evs.filter((e) => e.kind === "accuse")) {
  console.log(`  accuse: ${a.suspectId} -> ${a.ending ?? a.outcome ?? a.error ?? JSON.stringify(a).slice(0, 80)}`);
}

// ── problems ───────────────────────────────────────────────────────────────
console.log("\nPROBLEMS");
const problems = evs.filter(
  (e) => e.kind === "client.page.error" || e.kind === "client.page.unhandled_rejection" || e.kind === "client.turn.failed" || (e.kind === "speech" && e.outcome === "error")
);
if (problems.length === 0) console.log("  none");
for (const p of problems) console.log(`  ${p.t.slice(11, 19)} ${p.kind} ${clip(p.message ?? p.error, 100)}`);
console.log();
