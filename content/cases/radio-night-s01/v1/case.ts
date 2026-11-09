/**
 * content/cases/radio-night-s01/v1/case.ts
 * "The Sitting" — the playable CaseContent.
 *
 * This file assembles the authored pieces (characters, scenes, clues, topics,
 * opening). It never imports truth.ts: the engine has no path from the
 * canonical solution to a character's mouth.
 */

import type { CaseContent, CharacterFacts } from "@ai-orchestration/case-content";
import { buildFlagView, evaluateCondition } from "@ai-orchestration/case-content";
import type { RunState, SceneId } from "@game-core";
import { CHARACTERS } from "./characters";
import { SCENES } from "./scenes";
import { CLUES } from "./clues";
import { BEATS } from "./beats";
import { FACTS_BY_CHARACTER, FALLBACK_LINES } from "./facts";

const opening = BEATS.find((b) => b.id === "beat-opening-narration");
if (!opening) throw new Error("Missing scripted beat: beat-opening-narration");

export const theSittingCase: CaseContent = {
  caseId: "radio-night-s01",
  version: "v1",
  title: "The Sitting",
  period: "October 1981, small-town New Hampshire",
  periodConstraints: [
    "October 1981, Millhaven, New Hampshire",
    "No internet, email, mobile phones, or personal computers",
    "Rotary phones and payphones; no answering machines at the inn",
    "AM/FM radio and cassette tapes; television in the bar",
    "Early Reagan years, recession anxiety, mill closures",
    "Nothing from after 1981",
  ],
  characters: CHARACTERS.map((c) => ({ ...c, fallbackLines: FALLBACK_LINES[c.id] })),
  initialSceneId: "scene-tap-room" as unknown as SceneId,
  scenes: SCENES,
  clues: CLUES,
  opening: [{ actor: "narrator", text: opening.scriptedText }],

  getCharacterFacts(characterId: string, state: RunState): CharacterFacts | null {
    const facts = FACTS_BY_CHARACTER[characterId];
    if (!facts) return null;

    const flags = buildFlagView(state);
    const ordered = facts.map((fact) => ({
      fact,
      unlocked: evaluateCondition(fact.unlockCondition, flags),
    }));

    return {
      permitted: ordered.filter((o) => o.unlocked).map((o) => o.fact),
      concealed: ordered.filter((o) => !o.unlocked).map((o) => o.fact),
      ordered,
    };
  },
};
