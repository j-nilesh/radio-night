/**
 * game-core/reducer.ts
 * Deterministic RunState reducer.
 * The LLM never calls this directly — only server validators do.
 * All mutations go through here to maintain invariants.
 */

import type {
  RunState,
  GameEvent,
  GameEventType,
  FactId,
  ClaimId,
  EvidenceId,
  SceneId,
  BeatId,
  CharacterId,
  RunId,
  CaseId,
} from "./types";

// ---------------------------------------------------------------------------
// Initial state factory
// ---------------------------------------------------------------------------

export function createInitialRunState(opts: {
  runId: RunId;
  caseId: CaseId;
  caseVersion: string;
  initialSceneId: SceneId;
  playMode: "solo" | "together";
}): RunState {
  return {
    runId: opts.runId,
    caseId: opts.caseId,
    caseVersion: opts.caseVersion,
    revision: 0,
    playMode: opts.playMode,
    currentSceneId: opts.initialSceneId,
    knownFactIds: [],
    heardClaimIds: [],
    discoveredEvidenceIds: [],
    visitedSceneIds: [opts.initialSceneId],
    openedBeatIds: [],
    bookmarkedClaimIds: [],
    investigationFlags: {},
    endingId: undefined,
    lastSafeTopic: undefined,
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function applyEvent(state: RunState, event: GameEvent): RunState {
  const next = { ...state, revision: state.revision + 1 };

  switch (event.eventType as GameEventType) {
    case "SCENE_ENTERED": {
      const sceneId = event.payload.sceneId as SceneId;
      next.currentSceneId = sceneId;
      if (!next.visitedSceneIds.includes(sceneId)) {
        next.visitedSceneIds = [...next.visitedSceneIds, sceneId];
      }
      return next;
    }

    case "CHARACTER_INTERVIEWED": {
      const characterId = event.payload.characterId as CharacterId;
      const flag = `interviewed_${characterId}`;
      next.investigationFlags = { ...next.investigationFlags, [flag]: true };
      return next;
    }

    case "CLAIM_HEARD": {
      const claimId = event.payload.claimId as ClaimId;
      if (!next.heardClaimIds.includes(claimId)) {
        next.heardClaimIds = [...next.heardClaimIds, claimId];
      }
      if (event.payload.characterId && event.payload.shortRecap) {
        next.lastSafeTopic = {
          characterId: event.payload.characterId as CharacterId,
          beatId: event.payload.beatId as BeatId | undefined,
          shortRecap: event.payload.shortRecap as string,
        };
      }
      return next;
    }

    case "EVIDENCE_DISCOVERED": {
      const evidenceId = event.payload.evidenceId as EvidenceId;
      if (!next.discoveredEvidenceIds.includes(evidenceId)) {
        next.discoveredEvidenceIds = [...next.discoveredEvidenceIds, evidenceId];
      }
      return next;
    }

    case "OBJECT_EXAMINED": {
      const objectId = event.payload.objectId as string;
      const flag = `examined_${objectId}`;
      next.investigationFlags = { ...next.investigationFlags, [flag]: true };
      return next;
    }

    case "CLAIM_BOOKMARKED": {
      const claimId = event.payload.claimId as ClaimId;
      if (!next.bookmarkedClaimIds.includes(claimId)) {
        next.bookmarkedClaimIds = [...next.bookmarkedClaimIds, claimId];
      }
      return next;
    }

    case "BEAT_UNLOCKED": {
      const beatId = event.payload.beatId as BeatId;
      if (!next.openedBeatIds.includes(beatId)) {
        next.openedBeatIds = [...next.openedBeatIds, beatId];
      }
      return next;
    }

    case "ACCUSATION_MADE": {
      const flag = `accused_${event.payload.suspectId}`;
      next.investigationFlags = { ...next.investigationFlags, [flag]: true };
      next.accusation = {
        suspectId: event.payload.suspectId as CharacterId,
        evidenceIds: (event.payload.evidenceIds as EvidenceId[] | undefined) ?? [],
      };
      return next;
    }

    case "ENDING_REACHED": {
      next.endingId = event.payload.endingId as string;
      return next;
    }

    case "RUN_CREATED":
    case "SESSION_RESUMED":
      // Metadata events — no state mutation
      return next;

    default:
      // Unknown event types are logged server-side but do not mutate state
      console.warn(`[game-core] Unknown event type: ${event.eventType}`);
      return state;
  }
}

// ---------------------------------------------------------------------------
// Invariant checks
// ---------------------------------------------------------------------------

export type InvariantViolation = {
  invariant: string;
  details: string;
};

/**
 * Validates a proposed RunState against core invariants.
 * Returns an array of violations (empty = valid).
 */
export function checkInvariants(state: RunState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  // Invariant: caseId and caseVersion must be set
  if (!state.caseId || !state.caseVersion) {
    violations.push({
      invariant: "case_identity",
      details: "RunState missing caseId or caseVersion",
    });
  }

  // Invariant: currentSceneId must be in visitedSceneIds
  if (!state.visitedSceneIds.includes(state.currentSceneId)) {
    violations.push({
      invariant: "scene_in_visited",
      details: `currentSceneId ${state.currentSceneId} not in visitedSceneIds`,
    });
  }

  // Invariant: revision must be non-negative
  if (state.revision < 0) {
    violations.push({
      invariant: "revision_non_negative",
      details: `revision is ${state.revision}`,
    });
  }

  return violations;
}

/**
 * Replays a sequence of events from scratch to rebuild RunState.
 * Used for recovery and audit.
 */
export function replayEvents(
  initialState: RunState,
  events: GameEvent[]
): RunState {
  return events.reduce(applyEvent, initialState);
}
