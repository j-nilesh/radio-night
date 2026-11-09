/**
 * ai-orchestration/case-content.ts
 * The CaseContent interface — the server-side abstraction over mystery content.
 *
 * CaseContent is loaded server-side only. It provides:
 * - Character definitions (public portions)
 * - Fact stores (with trigger patterns, authored lines, and unlock conditions)
 * - Scene, clue, and presence definitions
 *
 * NEVER includes: canonical truth, culprit identity, or the solution.
 * Those live in truth.ts and are used only by the accusation validator.
 */

import type { RunState, SceneId } from "@game-core";
import type { VoiceProfile } from "@providers";

// ---------------------------------------------------------------------------
// Character (public-safe definition)
// ---------------------------------------------------------------------------

export type CharacterDefinitionFull = {
  id: string;
  name: string;
  role: string;
  speechStyle: string;
  publicBackstory: string;
  voiceProfile?: VoiceProfile;
  /**
   * Safe, non-committal in-character lines used when a question matches no
   * authored topic. They must never assert a fact, time, name, or clue.
   */
  fallbackLines?: string[];
};

// ---------------------------------------------------------------------------
// Fact definitions (server-side, with conditions)
// ---------------------------------------------------------------------------

export type FactEntry = {
  factId: string;
  description: string;
  isPublic: boolean;
  /** Flag expression evaluated against the flag view; undefined = always available */
  unlockCondition?: string;

  /** Patterns (tested against the normalized question) that select this topic. */
  triggers?: RegExp[];
  /** Authored in-character line delivered when the topic is selected and unlocked. */
  line?: string;
  /** Authored line delivered when the topic is selected but still locked (a denial or evasion). */
  lockedLine?: string;
  /** Clue recorded in the casebook the first time this line is delivered. */
  grantsClueId?: string;
};

export type OrderedFact = { fact: FactEntry; unlocked: boolean };

export type CharacterFacts = {
  permitted: FactEntry[]; // facts this character CAN reveal in current state
  concealed: FactEntry[]; // facts NOT yet releasable (for validation)
  /** Authored topics in priority order, each with its current unlock state. */
  ordered?: OrderedFact[];
};

// ---------------------------------------------------------------------------
// Scenes, clues, presence
// ---------------------------------------------------------------------------

export type PresenceRule = {
  characterId: string;
  /** Flag expression; undefined = present from the start */
  condition?: string;
  /** Narrator line shown when this character becomes present */
  arrivalLine?: string;
};

export type SceneInfo = {
  id: string;
  name: string;
  narratorEntryLine: string;
  presence: PresenceRule[];
  clueIds: string[];
  exits: string[];
  unlockCondition?: string;
};

export type ClueInfo = {
  id: string;
  /** Short label for the "Examine" button (physical clues only) */
  label: string;
  /** Casebook title */
  title: string;
  /** Casebook summary */
  summary: string;
  /** physical = found by the detective; testimony = something a witness said */
  kind: "physical" | "testimony";
  /** Narration shown when a physical clue is examined */
  examineText?: string;
  sceneId?: string;
  unlockCondition?: string;
};

export type OpeningLine = { actor: "narrator" | "character"; text: string; speakerName?: string };

// ---------------------------------------------------------------------------
// CaseContent interface
// ---------------------------------------------------------------------------

export interface CaseContent {
  caseId: string;
  version: string;
  title: string;
  /** e.g. "circa 1980, small American town" */
  period: string;
  /** Array of constraint strings for the classifier and LLM */
  periodConstraints: string[];
  characters: CharacterDefinitionFull[];
  initialSceneId: SceneId;

  /** Optional multi-scene structure. Cases without it are single-room. */
  scenes?: SceneInfo[];
  clues?: ClueInfo[];
  /** Lines shown when a run begins */
  opening?: OpeningLine[];

  /**
   * Get the facts a character is permitted to reveal given current RunState.
   * Returns { permitted, concealed } — never includes sealed secrets.
   */
  getCharacterFacts(characterId: string, state: RunState): CharacterFacts | null;
}

// ---------------------------------------------------------------------------
// Condition evaluator — simple flag-based expressions
// Supports: "flag_name", "flag_a AND flag_b", "flag_a OR flag_b"
// Do not mix AND and OR in one expression (no parentheses).
// ---------------------------------------------------------------------------

export function evaluateCondition(
  condition: string | undefined,
  flags: Record<string, boolean>
): boolean {
  if (!condition) return true; // no condition = always available

  if (condition.includes(" AND ")) {
    return condition.split(" AND ").every((part) => evaluateCondition(part.trim(), flags));
  }
  if (condition.includes(" OR ")) {
    return condition.split(" OR ").some((part) => evaluateCondition(part.trim(), flags));
  }

  return flags[condition.trim()] === true;
}

/**
 * The set of facts about a run that unlock conditions may refer to:
 *   - investigation flags (e.g. interviewed_char-edna-marsh)
 *   - discovered clue ids (e.g. clue-ray-was-away)
 *   - visited scenes as visited_<sceneId>
 */
export function buildFlagView(state: RunState): Record<string, boolean> {
  const view: Record<string, boolean> = { ...state.investigationFlags };
  for (const id of state.discoveredEvidenceIds) view[id] = true;
  for (const id of state.visitedSceneIds) view[`visited_${id}`] = true;
  return view;
}
