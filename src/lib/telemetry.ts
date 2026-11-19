/**
 * lib/telemetry.ts
 * DEVELOPMENT-ONLY playtest telemetry. SERVER-ONLY.
 *
 * Appends one JSON object per line to playtests/YYYY-MM-DD.jsonl so a playtest
 * can be analysed afterwards (npm run playtest:report). It records what the
 * player asked, what was answered, how long each stage took, and how audio
 * behaved in the browser.
 *
 * It is NOT part of the shipped game:
 *   - Never runs in a production build, whatever the environment says. In
 *     development it is on unless PLAYTEST_TELEMETRY=off.
 *   - It records no words by default: questions, replies, transcripts and model
 *     text are replaced by their length. PLAYTEST_TEXT=on keeps them, for a
 *     playtest where the developer needs to read what was said.
 *   - Everything goes through logTelemetry(), so removing it is deleting this
 *     file, the /api/dev/telemetry route, and src/lib/telemetry-client.ts.
 *   - playtests/ is gitignored. The files contain raw questions and replies
 *     (including children's), so they stay on the developer's machine.
 */

import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export function telemetryEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.PLAYTEST_TELEMETRY?.toLowerCase() !== "off";
}

/** Fields that hold what a player or a character said. */
const WORDS = new Set(["question", "reply", "transcript", "rawText", "text", "responseText", "narration"]);

/** Replace every field that holds words with its length, at any depth, unless PLAYTEST_TEXT=on. */
export function withoutWords<T>(data: T): T {
  if (process.env.PLAYTEST_TEXT?.toLowerCase() === "on") return data;
  const scrub = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(scrub);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) =>
          WORDS.has(k) && typeof v === "string" ? [`${k}Chars`, v.length] : [k, scrub(v)]
        )
      );
    }
    return value;
  };
  return scrub(data) as T;
}

const MAX_STRING = 4000;

/** JSON.stringify replacer: no single field may bloat a line. */
function limit(_key: string, value: unknown): unknown {
  return typeof value === "string" && value.length > MAX_STRING
    ? value.slice(0, MAX_STRING) + `…[+${value.length - MAX_STRING} chars]`
    : value;
}

/** Writes are chained so events land in the file in the order they happened. */
let writeChain: Promise<unknown> = Promise.resolve();
const madeDirs = new Set<string>();

export function telemetryDir(): string {
  return process.env.PLAYTEST_DIR || join(process.cwd(), "playtests");
}

/** Record one event. Never throws and never blocks the request. */
export function logTelemetry(kind: string, data: Record<string, unknown> = {}): void {
  if (!telemetryEnabled()) return;
  try {
    const now = new Date();
    const line = JSON.stringify({ ...withoutWords(data), t: now.toISOString(), ms: now.getTime(), kind }, limit) + "\n";
    const dir = telemetryDir();
    const file = join(dir, `${now.toISOString().slice(0, 10)}.jsonl`);
    writeChain = writeChain
      .then(async () => {
        if (!madeDirs.has(dir)) {
          await mkdir(dir, { recursive: true });
          madeDirs.add(dir);
        }
        await appendFile(file, line);
      })
      .catch(() => undefined);
  } catch {
    /* telemetry must never break the game */
  }
}

/** First eight characters of an id: enough to tell runs apart in a log. */
export function shortId(id: string | undefined | null): string | undefined {
  return id ? id.slice(0, 8) : undefined;
}

/** "Safari 18", "Chrome 156", "Firefox 130" from a User-Agent. */
export function browserFamily(ua: string | null | undefined): string {
  if (!ua) return "unknown";
  const pick = (re: RegExp, name: string) => {
    const m = ua.match(re);
    return m ? `${name} ${m[1].split(".")[0]}` : null;
  };
  return (
    pick(/Edg\/([\d.]+)/, "Edge") ??
    pick(/Firefox\/([\d.]+)/, "Firefox") ??
    pick(/(?:Chrome|CriOS)\/([\d.]+)/, "Chrome") ??
    pick(/Version\/([\d.]+).*Safari/, "Safari") ??
    "other"
  );
}
