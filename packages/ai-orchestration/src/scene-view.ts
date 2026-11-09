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
