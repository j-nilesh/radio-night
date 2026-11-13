/**
 * Pictures in the player view: the browser may only be told about a picture the
 * player has earned (the current room, people who are present, finds already in
 * the casebook, and the victim's card).
 */
import { describe, it, expect } from "vitest";
import { processTurn } from "@ai-orchestration/orchestrator";
import { buildPlayerView, travelTo, examineClue } from "@ai-orchestration/scene-view";
import { createInitialRunState } from "@game-core";
import type { RunState, RunId, CaseId } from "@game-core";
import { MockSpeechToTextProvider, MockTextToSpeechProvider, MockDialogueProvider } from "@providers";
import { theSittingCase } from "./case";

const runId = "run-view-images" as RunId;
const providers = { stt: new MockSpeechToTextProvider(), tts: new MockTextToSpeechProvider(), dialogue: new MockDialogueProvider() };

const fresh = (): RunState =>
  createInitialRunState({ runId, caseId: "radio-night-s01" as CaseId, caseVersion: "v1", initialSceneId: theSittingCase.initialSceneId, playMode: "solo" });

async function ask(state: RunState, characterId: string, text: string): Promise<RunState> {
  const r = await processTurn({ runId, idempotencyKey: crypto.randomUUID(), text, state, caseContent: theSittingCase, providers, targetCharacterId: characterId });
  return r.updatedRunState as RunState;
}
const go = (s: RunState, sceneId: string): RunState => {
  const out = travelTo(theSittingCase, s, runId, crypto.randomUUID(), sceneId);
  if (!out.ok) throw new Error(out.reason);
  return out.updatedState;
};
const look = (s: RunState, clueId: string): RunState => {
  const out = examineClue(theSittingCase, s, runId, crypto.randomUUID(), clueId);
  if (!out.ok) throw new Error(out.reason);
  return out.updatedState;
};
const view = (s: RunState) => buildPlayerView(theSittingCase, s);
const json = (s: RunState) => JSON.stringify(view(s));

describe("the first screen", () => {
  it("shows the Tap Room and the portraits of the three people who are here", () => {
    const v = view(fresh());
    expect(v.scene.image?.src).toContain("scene-tap-room");
    expect(v.scene.image?.alt.length).toBeGreaterThan(10);
    expect(v.characters.map((c) => c.id).sort()).toEqual(["char-dennis-pruett", "char-edna-marsh", "char-ray-kowalski"]);
    for (const c of v.characters) expect(c.portrait?.src, c.id).toContain(c.id);
  });

  it("shows the victim's card from the start, with his portrait and public facts only", () => {
    const victim = view(fresh()).casebook.victim;
    expect(victim?.name).toBe("Gerald Fenn");
    expect(victim?.image?.src).toContain("victim-gerald-fenn");
    expect(victim?.role).toMatch(/painter/i);
  });

  it("tells the browser about no picture it has not earned", () => {
    const text = json(fresh());
    for (const secret of ["carol", "dwight", "x-01", "x-02", "x-03", "hero-radio", "scene-room-5", "scene-kitchen", "ev-"]) {
      expect(text, secret).not.toContain(secret);
    }
  });
});

describe("people arriving", () => {
  it("brings Dwight's portrait only once he has arrived, and Carol's only in the Back Room after he has", async () => {
    let s = fresh();
    expect(json(s)).not.toContain("char-dwight-wentworth");
    s = await ask(s, "char-edna-marsh", "Who found the body?");
    const tap = view(s);
    expect(tap.characters.map((c) => c.id)).toContain("char-dwight-wentworth");
    expect(tap.characters.find((c) => c.id === "char-dwight-wentworth")?.portrait?.src).toContain("dwight");
    // She waits in another room: not listed here and her portrait is not handed out yet
    expect(tap.characters.map((c) => c.id)).not.toContain("char-carol-wentworth");
    expect(JSON.stringify(tap)).not.toContain("char-carol-wentworth.svg");

    s = go(s, "scene-back-room");
    const back = view(s);
    expect(back.scene.image?.src).toContain("scene-back-room");
    expect(back.characters.map((c) => c.id)).toEqual(["char-carol-wentworth"]);
    expect(back.characters[0].portrait?.src).toContain("carol");
  });

  it("lists the people spoken with, with portraits, in the casebook", async () => {
    let s = await ask(fresh(), "char-ray-kowalski", "How was your evening?");
    const people = view(s).casebook.interviewed;
    expect(people.map((p) => p.id)).toEqual(["char-ray-kowalski"]);
    expect(people[0].portrait?.src).toContain("ray");
    expect(people[0].role.length).toBeGreaterThan(3);
    s = await ask(s, "char-edna-marsh", "Who found the body?");
    expect(view(s).casebook.interviewed.map((p) => p.id).sort()).toEqual(["char-edna-marsh", "char-ray-kowalski"]);
  });
});

describe("evidence", () => {
  const toRoom5 = async () => {
    let s = await ask(fresh(), "char-edna-marsh", "Who found the body?"); // opens the upstairs route
    s = go(s, "scene-upstairs-hall");
    return go(s, "scene-room-5");
  };

  it("shows the Room 5 picture with no evidence, and no evidence picture before anything is examined", async () => {
    const s = await toRoom5();
    const v = view(s);
    expect(v.scene.image?.src).toContain("scene-room-5");
    expect(v.casebook.clues).toEqual([]);
    const text = JSON.stringify(v);
    for (const secret of ["x-01", "x-02", "x-03"]) expect(text, secret).not.toContain(secret);
  });

  it("attaches an evidence picture only to the find that was examined", async () => {
    let s = await toRoom5();
    s = look(s, "clue-ashtray");
    const v = view(s);
    expect(v.casebook.clues.map((c) => c.id)).toEqual(["clue-ashtray"]);
    expect(v.casebook.clues[0].image?.src).toContain("x-01");
    const text = JSON.stringify(v);
    expect(text).not.toContain("x-02");
    expect(text).not.toContain("x-03");
    s = look(s, "clue-note-under-bed");
    const both = JSON.stringify(view(s));
    expect(both).toContain("x-01");
    expect(both).toContain("x-03");
    expect(both).not.toContain("x-02");
  });

  it("gives testimony and the hall find no picture", async () => {
    let s = await toRoom5();
    s = go(s, "scene-upstairs-hall");
    s = look(s, "clue-back-stairs");
    const find = view(s).casebook.clues.find((c) => c.id === "clue-back-stairs");
    expect(find).toBeDefined();
    expect(find?.image).toBeUndefined();
  });
});

describe("what the view never carries", () => {
  it("never includes manifest ids, provenance, prompts or the solution file", async () => {
    let s = await ask(fresh(), "char-edna-marsh", "Who found the body?");
    s = go(s, "scene-upstairs-hall");
    s = go(s, "scene-room-5");
    s = look(s, "clue-whiskey-glass");
    const text = json(s);
    for (const bad of ["status", "placeholder", "generatedAt", "licence", "prompt", "truth", "ev-whiskey", "images-manifest"]) {
      expect(text, bad).not.toContain(bad);
    }
  });
});
