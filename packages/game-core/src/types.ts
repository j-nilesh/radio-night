/**
 * game-core/types.ts
 * Central type definitions for the Radio Night game engine.
 * These types are shared between server and client where safe.
 * NEVER import truth.ts or server-only secrets from this module.
 */

// ---------------------------------------------------------------------------
// Identity types
// ---------------------------------------------------------------------------

export type RunId = string & { readonly _brand: "RunId" };
export type CaseId = string & { readonly _brand: "CaseId" };
export type CharacterId = string & { readonly _brand: "CharacterId" };
export type SceneId = string & { readonly _brand: "SceneId" };
export type FactId = string & { readonly _brand: "FactId" };
export type ClaimId = string & { readonly _brand: "ClaimId" };
export type EvidenceId = string & { readonly _brand: "EvidenceId" };
export type BeatId = string & { readonly _brand: "BeatId" };
export type ObjectId = string & { readonly _brand: "ObjectId" };

// ---------------------------------------------------------------------------
// Player intent — the normalized action contract
// ---------------------------------------------------------------------------

export type PlayerIntent =
  | { type: "ASK_CHARACTER"; targetId: CharacterId; question: string }
  | {
      type: "CHALLENGE_CLAIM";
      targetId: CharacterId;
      claimId?: ClaimId;
      evidenceIds?: EvidenceId[];
      utterance: string;
    }
  | { type: "EXAMINE_OBJECT"; objectId: ObjectId; query?: string }
  | { type: "TRAVEL"; sceneId: SceneId }
  | { type: "REQUEST_RECAP"; scope: "current" | "case" | "character" }
  | { type: "REPEAT_LAST" }
  | {
      type: "OPEN_CASEBOOK";
      section?: "notes" | "suspects" | "evidence" | "timeline";
    }
  | { type: "BOOKMARK_CLAIM"; claimId: ClaimId }
  | {
      type: "ACCUSATION";
      suspectId: CharacterId;
      evidenceIds: EvidenceId[];
      theory?: string;
    }
  | { type: "PAUSE" | "RESUME" | "MUTE" | "HELP" }
  | { type: "UNRECOGNIZED"; rawText?: string };

// ---------------------------------------------------------------------------
// Classification — the output of the relevance/safety gate
// ---------------------------------------------------------------------------

export type ClassificationCategory =
  | "IN_SCOPE"
  | "OUT_OF_SCOPE"
  | "OUT_OF_PERIOD"
  | "INAPPROPRIATE"
  | "UNCLEAR"
  | "CONTROL_COMMAND";

export type Classification = {
  category: ClassificationCategory;
  intent?: PlayerIntent;
  confidence: number;
  reasonCode?: string; // internal only, never sent to client
};

// ---------------------------------------------------------------------------
// Run state — the authoritative server-side projection of a player's progress
// ---------------------------------------------------------------------------

export type PlayMode = "solo" | "together";

export type RunState = {
  runId: RunId;
  caseId: CaseId;
  caseVersion: string;
  revision: number;
  playMode: PlayMode;
  currentSceneId: SceneId;
  knownFactIds: FactId[];
  heardClaimIds: ClaimId[];
  discoveredEvidenceIds: EvidenceId[];
  visitedSceneIds: SceneId[];
  openedBeatIds: BeatId[];
  bookmarkedClaimIds: ClaimId[];
  investigationFlags: Record<string, boolean>;
  endingId?: string;
  /** What the player put forward when they accused someone */
  accusation?: {
    suspectId: CharacterId;
    evidenceIds: EvidenceId[];
  };
  lastSafeTopic?: {
    characterId: CharacterId;
    beatId?: BeatId;
    shortRecap: string;
  };
};

// ---------------------------------------------------------------------------
// Player-safe state projection — what the client can see
// ---------------------------------------------------------------------------

export type PlayerSafeRunState = Omit<RunState, "investigationFlags"> & {
  investigationFlags: Record<string, boolean>; // filtered to non-spoiler flags only
};

// ---------------------------------------------------------------------------
// Game events — append-only, server-validated progression log
// ---------------------------------------------------------------------------

export type GameEventType =
  | "SCENE_ENTERED"
  | "CHARACTER_INTERVIEWED"
  | "CLAIM_HEARD"
  | "EVIDENCE_DISCOVERED"
  | "OBJECT_EXAMINED"
  | "CLAIM_BOOKMARKED"
  | "BEAT_UNLOCKED"
  | "ACCUSATION_MADE"
  | "ENDING_REACHED"
  | "RUN_CREATED"
  | "SESSION_RESUMED";

export type GameEvent = {
  eventId: string;
  runId: RunId;
  sequence: number;
  eventType: GameEventType;
  payload: Record<string, unknown>;
  createdAt: Date;
};

// ---------------------------------------------------------------------------
// Case definition schema
// ---------------------------------------------------------------------------

export type FactDefinition = {
  id: FactId;
  characterId?: CharacterId; // null = physical evidence / environmental
  description: string; // human-readable (server-side only for truth)
  isPublic: boolean; // discoverable without restrictions
  unlockCondition?: string; // expression evaluated against RunState flags
};

export type ClaimDefinition = {
  id: ClaimId;
  characterId: CharacterId;
  text: string;
  isTrue: boolean; // server only
  revealCondition?: string;
};

export type EvidenceDefinition = {
  id: EvidenceId;
  title: string;
  description: string;
  source: string; // where/how it's found
  discoveryCondition?: string;
  mediaAssetId?: string;
};

export type SceneDefinition = {
  id: SceneId;
  name: string;
  description: string;
  availableCharacterIds: CharacterId[];
  availableObjectIds: ObjectId[];
  unlockCondition?: string;
};

export type CharacterDefinition = {
  id: CharacterId;
  name: string;
  role: string;
  speechStyle: string;
  voiceProfileId: string;
  publicBackstory: string;
  // knownSecrets is SERVER ONLY — never include in client payloads
};

// ---------------------------------------------------------------------------
// Accusation and endings
// ---------------------------------------------------------------------------

export type AccusationResult = {
  correct: boolean;
  endingId: string;
  assessmentText: string;
  hintsIfWrong?: string[];
};

// ---------------------------------------------------------------------------
// Turn result — what comes back from processing a player action
// ---------------------------------------------------------------------------

/**
 * Why a turn went the way it did. SERVER-SIDE DEVELOPMENT TELEMETRY ONLY:
 * it holds raw transcripts and model text, so routes must never forward it to
 * the browser, and it is dropped from production builds' logs.
 */
export type TurnDiagnostics = {
  path:
    | "no-input"
    | "stt-failed"
    | "stt-empty"
    | "stt-low-confidence"
    | "control"
    | "deflected"
    | "no-character"
    | "authored-disclose"
    | "authored-locked"
    | "model"
    | "legacy-dialogue";
  characterId?: string;
  historyLength?: number;
  stt?: {
    provider: string;
    outcome: "ok" | "empty" | "low-confidence" | "provider-error";
    ms: number;
    audioBytes: number;
    mimeType?: string;
    confidence?: number;
    transcript?: string;
    audioDurationMs?: number;
    error?: string;
  };
  classification?: { category: string; confidence: number; reasonCode?: string; intent?: string };
  topic?: { kind: "disclose" | "locked"; factId: string; grantsClueId?: string } | null;
  model?: {
    id: string;
    ms?: number;
    rejected?: string;
    rawText?: string;
    usage?: { inputTokens: number; outputTokens: number; cachedInputTokens?: number };
  };
};

export type TurnResult = {
  idempotencyKey: string;
  runId: RunId;
  responseText: string;
  /** Development telemetry; see TurnDiagnostics. Never forward to the browser. */
  diagnostics?: TurnDiagnostics;
  /**
   * What happened inside a model-backed turn. SERVER-SIDE diagnostics only:
   * routes must not forward this to the browser (rawText may hold rejected words).
   */
  modelTrace?: {
    used: boolean;
    rejected?: string;
    rawText?: string;
    usage?: { inputTokens: number; outputTokens: number; cachedInputTokens?: number };
  };
  /** True when responseText is a notice from the game, not a character speaking */
  systemMessage?: boolean;
  /**
   * Set when the player gave a command rather than asking a question. The
   * server answers recap and help in words; the browser acts on the rest
   * (pause, resume, mute, repeat, open the casebook), since they concern what
   * is playing on the player's device.
   */
  control?: "PAUSE" | "RESUME" | "MUTE" | "REPEAT_LAST" | "OPEN_CASEBOOK" | "HELP" | "REQUEST_RECAP";
  /** What speech-to-text heard, present only for spoken turns */
  transcribedText?: string;
  newEvents: GameEvent[];
  updatedRunState: PlayerSafeRunState;
  classification: Pick<Classification, "category">;
  timings?: {
    sttMs?: number;
    classifyMs?: number;
    llmMs?: number;
    ttsMs?: number;
    totalMs: number;
  };
};
