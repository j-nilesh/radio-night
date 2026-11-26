/**
 * Speaking to one person but naming another. The person listening says so in
 * their own voice, the model is never asked, and the game does not move.
 */
import { describe, it, expect } from "vitest";
import { processTurn } from "@ai-orchestration/orchestrator";
import { createInitialRunState } from "@game-core";
import type { RunState, RunId, CaseId } from "@game-core";
import { MockSpeechToTextProvider, MockTextToSpeechProvider, MockDialogueProvider } from "@providers";
import { theSittingCase } from "./case";
import { CHARACTERS } from "./characters";

const runId = "run-misaddress" as RunId;
const fresh = (): RunState =>
  createInitialRunState({ runId, caseId: "radio-night-s01" as CaseId, caseVersion: "v1", initialSceneId: theSittingCase.initialSceneId, playMode: "solo" });

/**
 * A stand-in for a live model that counts how often it is asked. It must look live
 * (not "mock"), because the game only consults a model for a live provider.
 */
class SpyModel {
  readonly providerName = "spy-live";
  readonly modelId = "spy-1";
  calls = 0;
  async respond() {
    this.calls += 1;
    return { text: "I could not say, Detective.", usage: { inputTokens: 1, outputTokens: 1 } };
  }
}

async function ask(text: string, to: string, state = fresh(), dialogue = new SpyModel()) {
  const result = await processTurn({
    runId,
    idempotencyKey: crypto.randomUUID(),
    text,
    state,
    caseContent: theSittingCase,
    providers: { stt: new MockSpeechToTextProvider(), tts: new MockTextToSpeechProvider(), dialogue },
    targetCharacterId: to,
  });
  return { result, dialogue, state };
}

describe("the two cases from the playtest", () => {
  it("Edna, asked 'So, Carol, where were you earlier this evening?', says she is not Carol and tells nothing", async () => {
    const { result, dialogue } = await ask("So, Carol, where were you earlier this evening?", "char-edna-marsh");
    expect(result.responseText).toMatch(/Carol/);
    expect(result.responseText).not.toMatch(/half past|quarter past|eight|nine|left|came/i); // nothing about Carol's evening
    expect(dialogue.calls).toBe(0);
  });

  it("Edna, asked 'So, Ray, how long have you worked at this bar?', does not answer for Ray", async () => {
    const { result, dialogue } = await ask("So, Ray, how long have you worked at this bar?", "char-edna-marsh");
    expect(result.responseText).toMatch(/Ray/);
    expect(result.responseText).not.toMatch(/\b(years?|six|eleven)\b/i);
    expect(dialogue.calls).toBe(0);
  });
});

describe("the check that the model is never asked is a real check", () => {
  it("counts a call when a fair question with no written answer reaches the model", async () => {
    const model = new SpyModel();
    await ask("Do you like working here, Edna?", "char-edna-marsh", fresh(), model);
    // If this stayed at 0, the 'calls is 0' assertions in this file would prove nothing.
    expect(model.calls).toBeGreaterThan(0);
  });
});

describe("zero game mutation", () => {
  it("emits no events, grants no clue, and leaves the run exactly as it was", async () => {
    const before = fresh();
    const snapshot = JSON.stringify(before);
    const { result } = await ask("Carol, where were you?", "char-ray-kowalski", before);
    expect(result.newEvents).toEqual([]);
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(result.classification.category).toBe("OUT_OF_SCOPE");
  });
});

describe("every pair of characters", () => {
  for (const listener of CHARACTERS) {
    for (const other of CHARACTERS) {
      if (listener.id === other.id) continue;
      const first = other.name.split(" ")[0];
      it(`${listener.name} told '${first}, where were you tonight?' says that is not them`, async () => {
        const { result, dialogue } = await ask(`${first}, where were you tonight?`, listener.id);
        expect(result.responseText).toContain(first); // names who was meant (or, for a line that does not, who they are)
        expect(result.responseText).toMatch(/not|Wrong|ask|mean|you're speaking|am /i);
        expect(result.newEvents).toEqual([]);
        expect(dialogue.calls).toBe(0);
        expect(result.responseText).not.toContain("{other}");
      });
    }
  }
});

describe("fair questions still work", () => {
  it("a question about another person, put to the person listening, is still answered", async () => {
    const { result } = await ask("What did Carol say to you earlier?", "char-edna-marsh", fresh(), new SpyModel());
    expect(result.responseText).not.toMatch(/not \{other\}|you're speaking to me/i);
    expect(result.classification.category).toBe("IN_SCOPE");
  });

  it("speaking to the right person by name is fine", async () => {
    const { result } = await ask("Edna, what did Carol say to you earlier?", "char-edna-marsh");
    expect(result.classification.category).toBe("IN_SCOPE");
  });
});

describe("every character has lines for this, in their own voice, that give nothing away", () => {
  it("has at least two lines each, each naming who they are or marking the other", () => {
    for (const c of CHARACTERS) {
      expect(c.misaddressedLines?.length, c.id).toBeGreaterThanOrEqual(2);
      for (const line of c.misaddressedLines!) {
        expect(line, c.id).toMatch(/\{other\}|Carol|Dennis|Edna|Ray|Dwight/);
        expect(line, c.id).not.toMatch(/\b(kill|murder|alibi|upstairs|room 5|ashtray|note|fenn|nine|eight|quarter)\b/i);
      }
    }
  });
  it("every character can be addressed by a title as well as a name", () => {
    for (const c of CHARACTERS) expect(c.aliases?.length, c.id).toBeGreaterThanOrEqual(1);
  });
});
