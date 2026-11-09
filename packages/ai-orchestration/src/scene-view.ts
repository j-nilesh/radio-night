/**
 * ai-orchestration/scene-view.ts
 * Player-safe view of a run (scene, people, exits, examinable objects, casebook)
 * and the deterministic scene actions: travel and examine.
 *
 * Nothing here exposes truth, unrevealed clues, or locked locations.
 * Locked exits and not-yet-present characters are simply omitted.
 */

import { applyEvent } from "@game-core";
import type { RunState, GameEvent, RunId, SceneId } from "@game-core";
import {
  buildFlagView,
  evaluateCondition,
  type CaseContent,
  type ClueInfo,
  type SceneInfo,
} from "./case-content";
import { readyToAccuse, NOT_READY_MESSAGE } from "./accusation";

// ---------------------------------------------------------------------------
// View types (safe to send to the browser)
// ---------------------------------------------------------------------------

export type PlayerView = {
  scene: { id: string; name: string };
  characters: Array<{ id: string; name: string; role: string }>;
  exits: Array<{ id: string; name: string }>;
  examinables: Array<{ id: string; label: string; examined: boolean }>;
  casebook: {
    clues: Array<{ id: string; title: string; summary: string; kind: "physical" | "testimony" }>;
    interviewed: Array<{ id: string; name: string }>;
  };
  /** Present only in cases that can be closed by an accusation */
  accusation: null | {
    ready: boolean;
    hint: string;
    suspects: Array<{ id: string; name: string; role: string }>;
  };
  /** Present once the case is closed */
  ending: null | {
    id: string;
    title: string;
    narration: string;
    solved: boolean;
    assessment: string;
    accusedName: string;
    /** The steps of the case, shown only when the right person was named */
    debrief: Array<{ label: string; established: boolean }> | null;
  };
};

export type OpeningView = Array<{ actor: "narrator" | "character"; text: string; speakerName?: string }>;

function findScene(c: CaseContent, id: string): SceneInfo | undefined {
  return c.scenes?.find((s) => s.id === id);
}

function sceneUnlocked(scene: SceneInfo, flags: Record<string, boolean>): boolean {
  return evaluateCondition(scene.unlockCondition, flags);
}

function presentCharacterIds(scene: SceneInfo, flags: Record<string, boolean>): string[] {
  return scene.presence
    .filter((p) => evaluateCondition(p.condition, flags))
    .map((p) => p.characterId);
}

// ---------------------------------------------------------------------------
// Build the view
// ---------------------------------------------------------------------------

export function buildPlayerView(c: CaseContent, state: RunState): PlayerView {
  const flags = buildFlagView(state);
  const scene = findScene(c, state.currentSceneId);

  // Single-room cases (e.g. the test character) have no scene table.
  if (!scene) {
    return {
      scene: { id: state.currentSceneId, name: c.title },
      characters: c.characters.map((ch) => ({ id: ch.id, name: ch.name, role: ch.role })),
      exits: [],
      examinables: [],
      casebook: buildCasebook(c, state),
      accusation: buildAccusation(c, state),
      ending: buildEnding(c, state),
    };
  }

  const characters = presentCharacterIds(scene, flags)
    .map((id) => c.characters.find((ch) => ch.id === id))
    .filter((ch): ch is NonNullable<typeof ch> => !!ch)
    .map((ch) => ({ id: ch.id, name: ch.name, role: ch.role }));

  const exits = scene.exits
    .map((id) => findScene(c, id))
    .filter((s): s is SceneInfo => !!s && sceneUnlocked(s, flags))
    .map((s) => ({ id: s.id, name: s.name }));

  const examinables = scene.clueIds
    .map((id) => c.clues?.find((cl) => cl.id === id))
    .filter((cl): cl is ClueInfo => !!cl && cl.kind === "physical")
    .filter((cl) => evaluateCondition(cl.unlockCondition, flags))
    .map((cl) => ({
      id: cl.id,
      label: cl.label,
      examined: state.discoveredEvidenceIds.some((e) => e === (cl.id as never)),
    }));

  return {
    scene: { id: scene.id, name: scene.name },
    characters,
    exits,
    examinables,
    casebook: buildCasebook(c, state),
    accusation: buildAccusation(c, state),
    ending: buildEnding(c, state),
  };
}

/** Everyone who has appeared somewhere in the case so far. */
function appearedCharacterIds(c: CaseContent, state: RunState): Set<string> {
  const flags = buildFlagView(state);
  const ids = new Set<string>();
  for (const scene of c.scenes ?? []) {
    for (const id of presentCharacterIds(scene, flags)) ids.add(id);
  }
  return ids;
}

function buildAccusation(c: CaseContent, state: RunState): PlayerView["accusation"] {
  const cfg = c.accusation;
  if (!cfg) return null;

  const appeared = appearedCharacterIds(c, state);
  const suspects = cfg.suspectIds
    .filter((id) => appeared.has(id))
    .map((id) => c.characters.find((ch) => ch.id === id))
    .filter((ch): ch is NonNullable<typeof ch> => !!ch)
    .map((ch) => ({ id: ch.id, name: ch.name, role: ch.role }));

  const ready = readyToAccuse(c, state);
  return { ready, hint: ready ? "" : NOT_READY_MESSAGE, suspects };
}

function buildEnding(c: CaseContent, state: RunState): PlayerView["ending"] {
  const cfg = c.accusation;
  if (!cfg || !state.endingId || !state.accusation) return null;

  const ending = cfg.endings[state.endingId];
  if (!ending) return null;

  // Re-grading is deterministic, so a refresh rebuilds the same ending and debrief.
  const verdict = cfg.evaluate(
    state.accusation.suspectId as string,
    state.accusation.evidenceIds as string[]
  );
  const accused = c.characters.find((ch) => ch.id === (state.accusation!.suspectId as string));

  return {
    id: ending.id,
    title: ending.title,
    narration: ending.narration,
    solved: ending.solved,
    assessment: verdict.assessment,
    accusedName: accused?.name ?? "the suspect",
    debrief: ending.solved ? verdict.debrief : null,
  };
}

function buildCasebook(c: CaseContent, state: RunState): PlayerView["casebook"] {
  const clues = state.discoveredEvidenceIds
    .map((id) => c.clues?.find((cl) => cl.id === id))
    .filter((cl): cl is ClueInfo => !!cl)
    .map((cl) => ({ id: cl.id, title: cl.title, summary: cl.summary, kind: cl.kind }));

  const interviewed = c.characters
    .filter((ch) => state.investigationFlags[`interviewed_${ch.id}`])
    .map((ch) => ({ id: ch.id, name: ch.name }));

  return { clues, interviewed };
}

export function buildOpening(c: CaseContent): OpeningView {
  const lines: OpeningView = [...(c.opening ?? [])];
  const first = findScene(c, c.initialSceneId as unknown as string);
  if (first) lines.push({ actor: "narrator", text: first.narratorEntryLine });
  return lines;
}

// ---------------------------------------------------------------------------
// Arrivals — narrator notices when someone becomes available
// ---------------------------------------------------------------------------

export function computeArrivals(c: CaseContent, before: RunState, after: RunState): string[] {
  if (!c.scenes) return [];
  const flagsBefore = buildFlagView(before);
  const flagsAfter = buildFlagView(after);
  const notices: string[] = [];

  for (const scene of c.scenes) {
    for (const p of scene.presence) {
      if (!p.condition || !p.arrivalLine) continue;
      if (!evaluateCondition(p.condition, flagsBefore) && evaluateCondition(p.condition, flagsAfter)) {
        notices.push(p.arrivalLine);
      }
    }
  }
  return notices;
}

// ---------------------------------------------------------------------------
// Scene actions
// ---------------------------------------------------------------------------

export type SceneActionResult =
  | {
      ok: true;
      narration: string;
      newEvents: GameEvent[];
      updatedState: RunState;
    }
  | { ok: false; reason: string };

export function travelTo(
  c: CaseContent,
  state: RunState,
  runId: RunId,
  idempotencyKey: string,
  sceneId: string
): SceneActionResult {
  const here = findScene(c, state.currentSceneId);
  const target = findScene(c, sceneId);
  const flags = buildFlagView(state);

  if (!here || !target) return { ok: false, reason: "Unknown location." };
  if (!here.exits.includes(target.id)) return { ok: false, reason: "You can't get there from here." };
  if (!sceneUnlocked(target, flags)) return { ok: false, reason: "That way isn't open to you yet." };

  const firstVisit = !state.visitedSceneIds.some((s) => (s as string) === target.id);
  const event: GameEvent = {
    eventId: `${idempotencyKey}-scene`,
    runId,
    sequence: state.revision + 1,
    eventType: "SCENE_ENTERED",
    payload: { sceneId: target.id },
    createdAt: new Date(),
  };

  const narration = firstVisit
    ? target.narratorEntryLine
    : `You return to ${target.name}.`;

  return {
    ok: true,
    narration,
    newEvents: [event],
    updatedState: applyEvent(state, event),
  };
}

export function examineClue(
  c: CaseContent,
  state: RunState,
  runId: RunId,
  idempotencyKey: string,
  clueId: string
): SceneActionResult {
  const scene = findScene(c, state.currentSceneId);
  const clue = c.clues?.find((cl) => cl.id === clueId);
  const flags = buildFlagView(state);

  if (!scene || !clue || clue.kind !== "physical") return { ok: false, reason: "There is nothing like that here." };
  if (!scene.clueIds.includes(clue.id)) return { ok: false, reason: "There is nothing like that here." };
  if (!evaluateCondition(clue.unlockCondition, flags)) return { ok: false, reason: "There is nothing like that here." };

  const narration = clue.examineText ?? clue.summary;
  const alreadyFound = state.discoveredEvidenceIds.some((e) => (e as string) === clue.id);

  if (alreadyFound) {
    return { ok: true, narration, newEvents: [], updatedState: state };
  }

  const event: GameEvent = {
    eventId: `${idempotencyKey}-clue`,
    runId,
    sequence: state.revision + 1,
    eventType: "EVIDENCE_DISCOVERED",
    payload: { evidenceId: clue.id, source: "examine" },
    createdAt: new Date(),
  };

  return {
    ok: true,
    narration,
    newEvents: [event],
    updatedState: applyEvent(state, event),
  };
}

export type { SceneId };
