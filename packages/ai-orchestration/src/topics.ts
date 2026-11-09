/**
 * ai-orchestration/topics.ts
 * Deterministic topic selection for authored character answers.
 *
 * A question is matched against each authored topic's trigger patterns.
 * Selection rule — authored order is priority. Walking the topics in order,
 * for each one whose triggers match:
 *   - UNLOCKED: its line is disclosed (first such topic wins).
 *   - LOCKED with a lockedLine: that denial or evasion is given. A locked
 *     specific topic therefore beats a general topic listed after it, which is
 *     what stops a character's general chat from bypassing a lie.
 *   - LOCKED with no lockedLine: skipped; the next topic is considered.
 * If nothing applies, the caller falls back to a generic line.
 *
 * Because answers to evidence-related questions are authored, a paraphrase or
 * a prompt injection cannot make a character say something that is not written.
 */

import type { FactEntry, OrderedFact } from "./case-content";

export type TopicMatch =
  | { kind: "disclose"; fact: FactEntry }
  | { kind: "locked"; fact: FactEntry }
  | null;

/** Lowercase, straighten quotes, collapse whitespace. */
export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function matches(fact: FactEntry, normalized: string): boolean {
  return !!fact.triggers?.some((t) => t.test(normalized));
}

export function matchTopic(question: string, ordered: OrderedFact[]): TopicMatch {
  const normalized = normalizeQuestion(question);

  for (const { fact, unlocked } of ordered) {
    if (!matches(fact, normalized)) continue;
    if (unlocked && fact.line) return { kind: "disclose", fact };
    if (!unlocked && fact.lockedLine) return { kind: "locked", fact };
    // locked with nothing to say: fall through to the next topic
  }

  return null;
}

/** First sentence of a line, capped — used as the "as I was saying" anchor. */
export function firstSentence(text: string, max = 120): string {
  const m = text.match(/^.*?[.!?](\s|$)/);
  const s = (m ? m[0] : text).trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}
