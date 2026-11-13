/**
 * scripts/audition/shortlist.ts
 * Turns the step-1 shortlist files into the set of options that go on to step 2.
 * DEVELOPMENT-ONLY.
 */

export type ShortlistFile = {
  kind?: string;
  listener: string;
  /** itemId -> letter -> { verdict: keep | maybe | drop, notes } */
  scores: Record<string, Record<string, { verdict?: string; notes?: string }>>;
};

/**
 * An option goes through if any listener marked it with one of the `include`
 * verdicts (default keep and maybe). Options nobody marked are not carried
 * forward, and are reported so a missed one is noticed rather than lost.
 * `key` maps item -> letter -> candidate id, from the step-1 key file.
 */
export function shortlistToAllow(
  key: Record<string, Record<string, string>>,
  lists: ShortlistFile[],
  include: string[] = ["keep", "maybe"]
): { allow: Map<string, Set<string>>; report: string[] } {
  const allow = new Map<string, Set<string>>();
  const report: string[] = [];
  for (const [itemId, letters] of Object.entries(key)) {
    const survivors = new Set<string>();
    let unmarked = 0;
    for (const [letter, candidateId] of Object.entries(letters)) {
      const verdicts = lists.map((l) => l.scores?.[itemId]?.[letter]?.verdict).filter((v): v is string => !!v);
      if (verdicts.length === 0) unmarked += 1;
      else if (verdicts.some((v) => include.includes(v))) survivors.add(candidateId);
    }
    allow.set(itemId, survivors);
    const total = Object.keys(letters).length;
    const note =
      survivors.size === 0
        ? "none kept"
        : survivors.size === 1
          ? "one kept, so there is nothing to compare"
          : `${survivors.size} of ${total} go to step 2`;
    report.push(`${itemId.replace("char-", "")}: ${note}${unmarked ? ` (${unmarked} not marked)` : ""}`);
  }
  return { allow, report };
}

/**
 * Options that are the only survivor for their part. They need no scoring, so
 * they are recorded as chosen (itemId -> candidate id) and shown in the summary.
 */
export function autoChosen(allow: Map<string, Set<string>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [itemId, survivors] of allow) {
    if (survivors.size === 1) out[itemId] = [...survivors][0];
  }
  return out;
}
