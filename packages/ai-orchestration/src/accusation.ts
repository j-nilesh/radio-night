/**
 * ai-orchestration/accusation.ts
 * Server-side rules for naming a suspect and closing the case.
 *
 * The browser sends who it accuses and which discovered clues it puts forward.
 * Everything else is decided here: whether the detective is ready, whether the
 * evidence is real, which ending follows. Rejections are deliberately neutral
 * and identical for every suspect, so a refusal never hints at the answer.
 */

import { applyEvent } from "@game-core";
import type { RunState, GameEvent, RunId } from "@game-core";
import type { CaseContent } from "./case-content";

export type AccuseResult =
  | { ok: true; newEvents: GameEvent[]; updatedState: RunState }
  | { ok: false; reason: string };

export const NOT_READY_MESSAGE =
  "You\u2019re not ready to accuse anyone. Speak with at least three people, find some evidence, " +
  "and put at least two pieces of it forward.";

/** How many distinct people the detective has spoken with. */
export function interviewCount(c: CaseContent, state: RunState): number {
  return c.characters.filter((ch) => state.investigationFlags[`interviewed_${ch.id}`]).length;
}

/** Whether the detective has done enough to be allowed to accuse. */
export function readyToAccuse(c: CaseContent, state: RunState): boolean {
  const cfg = c.accusation;
  if (!cfg || state.endingId) return false;
  return interviewCount(c, state) >= cfg.minInterviews && state.discoveredEvidenceIds.length >= cfg.minClues;
}

export function accuse(
  c: CaseContent,
  state: RunState,
  runId: RunId,
  idempotencyKey: string,
  suspectId: string,
  evidenceIds: string[]
): AccuseResult {
  const cfg = c.accusation;
  if (!cfg) return { ok: false, reason: "There is nobody to accuse in this case." };
  if (state.endingId) return { ok: false, reason: "The case is closed." };

  if (!cfg.suspectIds.includes(suspectId)) {
    return { ok: false, reason: "That is not someone you can accuse." };
  }

  // Only evidence the detective actually holds may be presented.
  const held = new Set(state.discoveredEvidenceIds as string[]);
  const presented = Array.from(new Set(evidenceIds));
  if (presented.some((id) => !held.has(id))) {
    return { ok: false, reason: "You can only present evidence you have found." };
  }

  if (!readyToAccuse(c, state) || presented.length < cfg.minClues) {
    return { ok: false, reason: NOT_READY_MESSAGE };
  }

  const verdict = cfg.evaluate(suspectId, presented);

  const accusationEvent: GameEvent = {
    eventId: `${idempotencyKey}-accuse`,
    runId,
    sequence: state.revision + 1,
    eventType: "ACCUSATION_MADE",
    payload: { suspectId, evidenceIds: presented },
    createdAt: new Date(),
  };
  const afterAccusation = applyEvent(state, accusationEvent);

  const endingEvent: GameEvent = {
    eventId: `${idempotencyKey}-ending`,
    runId,
    sequence: afterAccusation.revision + 1,
    eventType: "ENDING_REACHED",
    payload: { endingId: verdict.endingId },
    createdAt: new Date(),
  };

  return {
    ok: true,
    newEvents: [accusationEvent, endingEvent],
    updatedState: applyEvent(afterAccusation, endingEvent),
  };
}
