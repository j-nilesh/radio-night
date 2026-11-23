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
  /**
   * One or two plain sentences for the "Who's who" sheet shown to the player.
   * Written only from facts the player already has (role, setting); it must
   * not hint at motive, timing, or guilt.
   */
  blurb?: string;
  voiceProfile?: VoiceProfile;
  /**
   * Safe, non-committal in-character lines used when a question matches no
   * authored topic. They must never assert a fact, time, name, or clue.
   */
  fallbackLines?: string[];
  /**
   * What a model needs to play this character. Present only for characters a
   * language model may voice. Never shared with any other character's prompt.
   */
  persona?: PersonaInfo;
};

/**
 * A character's inner life, for the model that plays them.
 * Written from the story bible. Secrets the character keeps are here because a
 * character who does not know their own secret cannot act it; the reply guard,
 * not the prompt, is what keeps them from being said.
 */
export type PersonaInfo = {
  /** Who they are, in the second person */
  background: string;
  /** Truthful things they know about tonight and may talk about */
  knows: string[];
  /** What they privately know and will not say (second person) */
  secret?: string;
  /** How they behave when pressed near the secret */
  underPressure: string;
  /** What they genuinely do not know */
  doesNotKnow: string[];
  /** Vocal habits beyond speechStyle */
  habits?: string;
};

/** One question and answer between the detective and a character. */
export type DialogueExchange = { question: string; answer: string };

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
  /**
   * Patterns that show a model-written REPLY has disclosed this topic. If the
   * topic is unlocked, the disclosure earns grantsClueId; if it is locked, the
   * reply is rejected as a leak. First-person and adjacent, so denials do not match.
   */
  revealedBy?: RegExp[];
};

export type OrderedFact = { fact: FactEntry; unlocked: boolean };

export type CharacterFacts = {
  permitted: FactEntry[]; // facts this character CAN reveal in current state
  concealed: FactEntry[]; // facts NOT yet releasable (for validation)
  /** Authored topics in priority order, each with its current unlock state. */
  ordered?: OrderedFact[];
};

// ---------------------------------------------------------------------------
// Pictures
// ---------------------------------------------------------------------------

/**
 * A picture as the browser needs it. Built from the case's image manifest and
 * handed out only through the player view, so the browser is told about a
 * picture only once the player has earned it.
 */
export type ImageRef = {
  src: string;
  /** Optimised alternatives, best first (absent for placeholders) */
  sources?: Array<{ src: string; type: string }>;
  alt: string;
  /** CSS object-position: where the subject sits, so a crop keeps it in view */
  focus: string;
  width: number;
  height: number;
};

export type CaseImages = {
  /** scene id -> room picture */
  scenes: Record<string, ImageRef>;
  /** character id -> portrait */
  characters: Record<string, ImageRef>;
  /** clue id -> evidence picture (only some physical finds have one) */
  clues: Record<string, ImageRef>;
};

/** The person who has died, shown on a casebook card. Public facts only. */
export type VictimCard = { name: string; role: string; image?: ImageRef };

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
  /**
   * Writing that appears on the find's picture (for example a note). It is set
   * in code over a blank picture, because image models draw text badly, and it
   * must repeat words the examine text already gives.
   */
  imageText?: string;
  sceneId?: string;
  unlockCondition?: string;
};

export type EndingInfo = {
  id: string;
  title: string;
  narration: string;
  /** true when the right person was named */
  solved: boolean;
  /** A room picture for the closing screen, graded differently per ending */
  art?: EndingArt;
};

export type EndingArt = { image: ImageRef; grade?: "dawn" | "dim" };

export type AccusationConfig = {
  /** Characters the player may accuse */
  suspectIds: string[];
  /** Distinct people the detective must have spoken with first */
  minInterviews: number;
  /** Clues the detective must have found, and must put forward, first */
  minClues: number;
  endings: Record<string, EndingInfo>;
  /**
   * Grade an accusation. Pure and deterministic, so a refresh can rebuild the
   * ending. The caller guarantees `presentedClueIds` are all discovered.
   */
  evaluate(
    suspectId: string,
    presentedClueIds: string[]
  ): {
    endingId: string;
    solved: boolean;
    assessment: string;
    debrief: Array<{ label: string; established: boolean }>;
  };
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
  /** Voice for the narrator and for game notices. Pinned like any character's. */
  narratorVoice?: VoiceProfile;
  initialSceneId: SceneId;

  /** Optional multi-scene structure. Cases without it are single-room. */
  scenes?: SceneInfo[];
  clues?: ClueInfo[];
  /** Lines shown when a run begins */
  opening?: OpeningLine[];
  /**
   * Said after the opening and the first room, on a new run only: tells a
   * first-time player what they can do. Orientation only, no case facts.
   */
  openingHandoff?: OpeningLine;
  /**
   * Plain facts every character knows about the place and the people in it.
   * Public information only; shared by every persona prompt so no character has
   * to invent the building or its staff.
   */
  sharedWorld?: string[];
  /** Names and places to favour when transcribing speech. Public information only. */
  speechKeyterms?: string[];
  /** Pictures for rooms, people and finds. Never read directly by the browser; see ImageRef. */
  images?: CaseImages;
  /** The victim's casebook card. */
  victim?: VictimCard;
  /** How the case is closed. Cases without it cannot end in an accusation. */
  accusation?: AccusationConfig;

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
