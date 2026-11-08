/**
 * ai-orchestration/case-content.ts
 * The CaseContent interface — the server-side abstraction over mystery content.
 *
 * CaseContent is loaded server-side only. It provides:
 * - Character definitions (public portions)
 * - Fact stores (with unlock conditions)
 * - Scene definitions
 *
 * NEVER includes: canonical truth, culprit identity, unrevealed secrets.
 * Those are server-only and filtered before any LLM call.
 */

import type { RunState, SceneId, CharacterId } from "@game-core";
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
};

// ---------------------------------------------------------------------------
// Fact definitions (server-side, with conditions)
// ---------------------------------------------------------------------------

export type FactEntry = {
  factId: string;
  description: string;
  isPublic: boolean;
  /** JS expression evaluated against RunState flags; null = always available */
  unlockCondition?: string;
};

export type CharacterFacts = {
  permitted: FactEntry[];  // facts this character CAN reveal in current state
  concealed: FactEntry[];  // facts NOT yet releasable (for validation)
};

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

  /**
   * Get the facts a character is permitted to reveal given current RunState.
   * Returns { permitted, concealed } — never includes sealed secrets.
   */
  getCharacterFacts(characterId: string, state: RunState): CharacterFacts | null;
}

// ---------------------------------------------------------------------------
// Condition evaluator — simple flag-based expressions
// Supports: "flag_name", "flag_a AND flag_b", "flag_a OR flag_b"
// ---------------------------------------------------------------------------

export function evaluateCondition(
  condition: string | undefined,
  flags: Record<string, boolean>
): boolean {
  if (!condition) return true; // no condition = always available

  // Simple AND / OR evaluation (no nesting — keep it safe and auditable)
  if (condition.includes(" AND ")) {
    return condition.split(" AND ").every((part) => evaluateCondition(part.trim(), flags));
  }
  if (condition.includes(" OR ")) {
    return condition.split(" OR ").some((part) => evaluateCondition(part.trim(), flags));
  }

  // Single flag check
  return flags[condition.trim()] === true;
}
