/**
 * scripts/audition/items.ts
 * Types shared by the audition builders. DEVELOPMENT-ONLY.
 *
 * The audition runs in two steps over the same items:
 *   triage  one person sieves everything quickly (Keep / Maybe / Drop)
 *   final   the survivors are scored properly by each listener, blind again
 */
import type { PageData } from "./page";

export type Stage = "triage" | "final";

export type PageItem = PageData["characters"][number];

export type Ctx = {
  stage: Stage;
  /** Round name, for example t1 or f1 */
  name: string;
  roundDir: string;
  cacheDir: string;
  only?: string[];
  dry: boolean;
  /** Music costs are not reported by the provider, so it is generated only when asked for */
  includeMusic: boolean;
  maxChars: number;
  maxCredits: number;
  /** Final stage only: itemId -> candidate ids that survived the shortlist */
  allow?: Map<string, Set<string>>;
};

export type Stats = Record<string, { ttfbMs: number[]; chars: number; clips: number }>;

export type BuiltItem = {
  page: PageItem;
  kind: "voice" | "sound";
  /** letter -> candidate id (the key that unblinds the page) */
  letters: Record<string, string>;
  /** "<itemId>|<candidateId>" -> a short note about the candidate, shown only after scoring */
  notes: Record<string, string>;
  stats: Stats;
};

/** In the final stage only shortlisted candidates take part; in triage everything does. */
export function isAllowed(ctx: Ctx, itemId: string, candidateId: string): boolean {
  return !ctx.allow || ctx.allow.get(itemId)?.has(candidateId) === true;
}
