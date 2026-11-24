/**
 * lib/model-budget.ts
 * A daily cap on model-played replies across all visitors. SERVER-ONLY.
 *
 * Each visitor already has their own allowance, but anyone can open many
 * sessions, so the per-visitor cap alone does not bound the model bill. This is
 * the total. Past it, characters answer from their written lines (text only),
 * exactly as when a visitor's own allowance runs out.
 *
 * Two pools, so a flood of anonymous sessions cannot starve people holding an
 * access code (judges, friends).
 *
 * The counter lives in this process's memory and starts again on a restart or a
 * new day, like the daily voice budget (ADR 0003, ADR 0013). One machine only.
 */
export type ModelPool = "public" | "code";

const DEFAULTS: Record<ModelPool, number> = { public: 1500, code: 3000 };
const ENV: Record<ModelPool, string> = { public: "MODEL_DAILY_REPLIES_PUBLIC", code: "MODEL_DAILY_REPLIES_CODE" };

let day = "";
const used: Record<ModelPool, number> = { public: 0, code: 0 };

const today = () => new Date().toISOString().slice(0, 10);
function roll(): void {
  if (day !== today()) {
    day = today();
    used.public = 0;
    used.code = 0;
  }
}
function cap(pool: ModelPool): number {
  const n = Number(process.env[ENV[pool]]);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULTS[pool];
}

export const poolFor = (session: { accessLabel?: string | null }): ModelPool => (session.accessLabel ? "code" : "public");

/** True while today's cap for this pool has room. */
export function modelBudgetLeft(pool: ModelPool): boolean {
  roll();
  return used[pool] < cap(pool);
}
/** Count one model reply against today's cap. */
export function spendModelReply(pool: ModelPool): void {
  roll();
  used[pool] += 1;
}
/** Today's use against the caps, for the usage page and logs. */
export function modelBudgetStatus(): Record<ModelPool, { used: number; cap: number }> {
  roll();
  return { public: { used: used.public, cap: cap("public") }, code: { used: used.code, cap: cap("code") } };
}
/** Start the count again. For tests. */
export function resetModelBudget(): void {
  day = "";
  used.public = 0;
  used.code = 0;
}
