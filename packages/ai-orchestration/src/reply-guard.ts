/**
 * ai-orchestration/reply-guard.ts
 * Checks a model-written reply before anyone hears it.
 *
 * The model can propose words; only this code decides whether they are spoken
 * and whether they earn a clue. A reply is rejected (and the authored line used
 * instead) if it:
 *   - reveals a secret that has not been unlocked yet (a locked topic's revealedBy pattern)
 *   - speaks as an AI, a program or an assistant, or refers to prompts and instructions
 *   - names anyone as the killer, other than through an authored line
 * A reply that reveals an UNLOCKED clue topic earns that clue, exactly as the
 * authored line would have.
 *
 * Patterns are deliberately first-person and adjacent ("I went upstairs"), so a
 * denial like "I never went upstairs" is not mistaken for an admission.
 */

import type { OrderedFact } from "./case-content";

export type GuardVerdict =
  | { ok: true; text: string; grantsClueIds: string[] }
  | { ok: false; reason: string };

/** Things no character may ever say in a model-written reply. */
const ALWAYS_FORBIDDEN: Array<{ reason: string; pattern: RegExp }> = [
  {
    reason: "speaks as an AI",
    // An identity claim, not a mention: "I don't know what an AI is" is correct in-character confusion.
    pattern:
      /\b(as an ai\b|i('m| am) (just |only |merely )?(an? )?(ai|artificial intelligence|(large )?language model|ai assistant|assistant|chat ?bot|bot|computer program|program)\b|anthropic|openai|chatgpt|\bclaude\b)/i,
  },
  {
    reason: "refers to its instructions",
    pattern: /\b(system prompt|my (instructions|prompt|programming|guidelines)|i('ve| have) been (instructed|programmed|told to)|role-?play(ing)?|in character|out of character)\b/i,
  },
  {
    reason: "names a killer",
    pattern:
      /\b(ray|kowalski|the bartender|dwight|wentworth|carol|edna|dennis|pruett)\b[^.?!]{0,40}\b(killed|murdered|did it|struck (him|fenn|gerald)|is (the|your) (killer|murderer))\b/i,
  },
];

/**
 * Remove what a voice actor would not say aloud: stage directions, speaker
 * labels, wrapping quotes. Then cap the length at a sentence boundary.
 */
export function sanitizeReply(raw: string, speakerName?: string, maxChars = 600): string {
  let t = raw.trim();

  t = t.replace(/\*[^*\n]{0,200}\*/g, " "); // *leans back*
  t = t.replace(/\[[^\]\n]{0,200}\]/g, " "); // [pause]
  t = t.replace(/^\((?:[^()\n]{0,120})\)\s*/g, ""); // (quietly) at the start

  // A leading speaker label: "Ray:", "RAY KOWALSKI:", "Ray Kowalski —"
  const names = ["Detective", ...(speakerName ? [speakerName, speakerName.split(" ")[0]] : [])];
  for (const n of names) {
    const re = new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:\u2014-]\\s*`, "i");
    t = t.replace(re, "");
  }

  t = t.replace(/\s+/g, " ").trim();

  // Unmarked stage directions at the start: "Frowns, and sets down the glass." / "Sighs."
  // A sentence that opens with an action verb and no subject is narration, not speech.
  // Only unambiguous body-language verbs: "looks", "takes", "turns" also begin ordinary speech.
  const ACTION =
    /^(?:(?:frowns|sighs|pauses|shrugs|leans|nods|smiles|chuckles|glances|stares|winces|hesitates|exhales|straightens|stiffens|bristles|gestures|swallows|stands (?:very )?still|sits back|clears (?:his|her) throat|sets down|puts down|wipes|(?:a |another |long |a long )(?:pause|beat|silence)|silence)\b[^.!?]*[.!?]\s*)+/i;
  const withoutAction = t.replace(ACTION, "").trim();
  if (withoutAction.length > 0) t = withoutAction; // never strip a reply down to nothing

  // Wrapping quotes around the whole reply
  // (whitespace was collapsed above, so the reply is a single line here)
  t = t.replace(/^["\u201C](.*)["\u201D]$/, "$1").trim();

  if (t.length > maxChars) {
    const cut = t.slice(0, maxChars);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
    t = end > maxChars * 0.4 ? cut.slice(0, end + 1) : cut.trimEnd() + "…";
  }
  return t;
}

export function checkReply(raw: string, ordered: OrderedFact[], speakerName?: string): GuardVerdict {
  const text = sanitizeReply(raw, speakerName);
  if (text.length < 2) return { ok: false, reason: "empty reply" };

  for (const rule of ALWAYS_FORBIDDEN) {
    if (rule.pattern.test(text)) return { ok: false, reason: rule.reason };
  }

  const grants: string[] = [];
  for (const { fact, unlocked } of ordered) {
    if (!fact.revealedBy?.some((re) => re.test(text))) continue;
    if (!unlocked) return { ok: false, reason: `reveals locked topic ${fact.factId}` };
    if (fact.grantsClueId && !grants.includes(fact.grantsClueId)) grants.push(fact.grantsClueId);
  }

  return { ok: true, text, grantsClueIds: grants };
}
