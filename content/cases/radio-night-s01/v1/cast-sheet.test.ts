/**
 * The "Who's who" sheet: every person the player can meet has a short public
 * line, it reaches the browser through the player view, and it says nothing
 * about motive, timing or guilt.
 */
import { describe, it, expect } from "vitest";
import { buildPlayerView } from "@ai-orchestration/scene-view";
import { createInitialRunState } from "@game-core";
import type { RunId, CaseId } from "@game-core";
import { theSittingCase } from "./case";
import { CHARACTERS } from "./characters";

const state = createInitialRunState({
  runId: "run-cast-sheet" as RunId,
  caseId: "radio-night-s01" as CaseId,
  caseVersion: "v1",
  initialSceneId: theSittingCase.initialSceneId,
  playMode: "solo",
});

describe("who's who lines", () => {
  it("every suspect and witness has one, short and plain", () => {
    for (const c of CHARACTERS) {
      expect(c.blurb, c.id).toBeTruthy();
      expect(c.blurb!.length, c.id).toBeLessThanOrEqual(160);
    }
  });

  it("reach the browser through the player view for the people in the room", () => {
    const v = buildPlayerView(theSittingCase, state);
    expect(v.characters.length).toBeGreaterThan(0);
    for (const p of v.characters) expect(p.about, p.id).toBeTruthy();
  });

  it("do not hint at motive, timing, guilt or what anyone is hiding", () => {
    const banned = /\b(kill|murder|motive|alibi|guilty|suspect|argu|secret|hiding|lie[sd]?|weapon|ashtray|quarter past|nine)\b/i;
    for (const c of CHARACTERS) expect(c.blurb, c.id).not.toMatch(banned);
  });

  it("never include the full backstory", () => {
    const v = JSON.stringify(buildPlayerView(theSittingCase, state));
    for (const c of CHARACTERS) expect(v).not.toContain(c.publicBackstory.slice(0, 40));
  });
});
