/**
 * lib/rate-limit.ts
 * Sliding-window request limiter. SERVER-ONLY.
 *
 * Limits are enforced on the server, per guest token and per IP, because
 * browser-side limits can be skipped by anyone.
 *
 * The counters live in this process's memory. That is right for local
 * development and a single server. On serverless hosting each instance has its
 * own counters, so the effective limit is looser; move the counters to shared
 * storage before relying on them there (see docs/adr/0003-rate-limiting.md).
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export type LimitRule = {
  /** Name used in the counter key and in logs. */
  name: string;
  /** Requests allowed inside the window. */
  max: number;
  windowMs: number;
};

export type LimitResult = { ok: true } | { ok: false; retryAfterSec: number };

const hits = new Map<string, number[]>();
const MAX_KEYS = 20_000;
let lastSweep = 0;

/** Drop keys whose newest hit is older than the longest window we use. */
function sweep(now: number, horizonMs: number): void {
  if (now - lastSweep < 60_000 && hits.size < MAX_KEYS) return;
  lastSweep = now;
  for (const [key, stamps] of hits) {
    if (stamps.length === 0 || now - stamps[stamps.length - 1] > horizonMs) hits.delete(key);
  }
  // Still too many keys (a flood of distinct callers): start over rather than grow without bound.
  if (hits.size >= MAX_KEYS) hits.clear();
}

/** Record one request for `subject` against `rule`; say whether it is allowed. */
export function checkLimit(rule: LimitRule, subject: string, now = Date.now()): LimitResult {
  sweep(now, Math.max(rule.windowMs, 3_600_000));
  const key = `${rule.name}:${subject}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < rule.windowMs);

  if (recent.length >= rule.max) {
    hits.set(key, recent);
    const retryAfterSec = Math.max(1, Math.ceil((recent[0] + rule.windowMs - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true };
}

/** Clear all counters. For tests. */
export function resetLimits(): void {
  hits.clear();
  lastSweep = 0;
}

/**
 * The caller's address. Hosting platforms put the real client first in
 * x-forwarded-for; locally there is none, so every caller shares "local".
 */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return (first || req.headers.get("x-real-ip") || "local").slice(0, 64);
}

function fromEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** The rules the game applies. Each can be tuned with an environment variable. */
export const RULES = {
  /** New investigations (each creates a guest session) per IP. */
  createRun: (): LimitRule => ({ name: "create-run", max: fromEnv("RATE_CREATE_RUN_PER_HOUR", 12), windowMs: 3_600_000 }),
  /** Questions and scene actions per guest token. */
  turnToken: (): LimitRule => ({ name: "turn-token", max: fromEnv("RATE_TURNS_PER_MIN", 30), windowMs: 60_000 }),
  /** Questions and scene actions per IP, so one network cannot open many sessions to dodge the token limit. */
  turnIp: (): LimitRule => ({ name: "turn-ip", max: fromEnv("RATE_TURNS_PER_MIN_IP", 90), windowMs: 60_000 }),
  /** Accusations per guest token. */
  accuse: (): LimitRule => ({ name: "accuse", max: fromEnv("RATE_ACCUSE_PER_MIN", 10), windowMs: 60_000 }),
  /** Spoken-line requests per IP. A busy scene fetches a handful of lines at once. */
  speech: (): LimitRule => ({ name: "speech", max: fromEnv("RATE_SPEECH_PER_MIN", 120), windowMs: 60_000 }),
  /** Reading a run's state per guest token. */
  readRun: (): LimitRule => ({ name: "read-run", max: fromEnv("RATE_READS_PER_MIN", 60), windowMs: 60_000 }),
  /** Access-code attempts per IP, so codes cannot be guessed. */
  accessCode: (): LimitRule => ({ name: "access-code", max: fromEnv("RATE_ACCESS_CODE_PER_HOUR", 10), windowMs: 3_600_000 }),
} as const;

/** A 429 response that says when to retry and reveals nothing else. */
export function tooMany(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: "You're going a little fast. Give it a moment and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

/**
 * Apply several rules in order; returns a 429 response for the first one that
 * is exceeded, or null if the request may proceed.
 */
export function enforce(checks: Array<[LimitRule, string]>): NextResponse | null {
  for (const [rule, subject] of checks) {
    const result = checkLimit(rule, subject);
    if (!result.ok) return tooMany(result.retryAfterSec);
  }
  return null;
}
