/**
 * lib/reveal.ts
 * Shows a spoken line one sentence at a time, in step with the voice, so the
 * player is not reading ahead of the narrator.
 *
 * Each sentence appears when the voice reaches it, estimated from how many
 * words came before it. Once the real length of the audio is known it replaces
 * the estimate.
 */

/**
 * Split text into sentences, keeping closing quotes with the sentence they end.
 * Written without regex lookbehind, which older iPhones do not support.
 */
export function splitSentences(text: string): string[] {
  const t = text.trim();
  const out: string[] = [];
  let start = 0;
  let i = 0;
  while (i < t.length) {
    if (".!?…".includes(t[i])) {
      let end = i + 1;
      while (end < t.length && ".!?…".includes(t[end])) end += 1;
      while (end < t.length && "\"”')]".includes(t[end])) end += 1;
      let next = end;
      while (next < t.length && /\s/.test(t[next])) next += 1;
      const atEnd = next >= t.length;
      const breaks = next > end && /["“'(\[A-Z0-9]/.test(t[next]);
      if (atEnd || breaks) {
        out.push(t.slice(start, end).trim());
        start = next;
        i = next;
        continue;
      }
      i = end;
      continue;
    }
    i += 1;
  }
  if (start < t.length) out.push(t.slice(start).trim());
  return out.filter(Boolean);
}

const words = (s: string) => Math.max(1, s.split(/\s+/).filter(Boolean).length);

/** For each sentence, the fraction (0..1) of the line that is spoken before it starts. */
export function revealPlan(sentences: string[]): number[] {
  const total = sentences.reduce((n, s) => n + words(s), 0);
  let before = 0;
  return sentences.map((s) => {
    const start = total === 0 ? 0 : before / total;
    before += words(s);
    return start;
  });
}

/** Words per second of a slow, deliberate narrator; used until the real length is known. */
export const ESTIMATED_WORDS_PER_SEC = 2.4;

export function estimateSeconds(text: string): number {
  return words(text) / ESTIMATED_WORDS_PER_SEC;
}

/** A sentence appears this long before the voice reaches it, so reading starts with listening. */
export const REVEAL_LEAD_SEC = 0.25;

/** How many sentences should be on screen, given seconds since the voice began. */
export function sentencesShown(plan: number[], elapsedSec: number, totalSec: number): number {
  let shown = 0;
  for (let i = 0; i < plan.length; i += 1) {
    if (plan[i] * totalSec - REVEAL_LEAD_SEC <= elapsedSec) shown = i + 1;
  }
  return shown;
}
