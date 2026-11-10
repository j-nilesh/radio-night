/**
 * content/cases/radio-night-s01/v1/case.ts
 * "The Sitting" — the playable CaseContent.
 *
 * This file assembles the authored pieces (characters, scenes, clues, topics,
 * opening, endings).
 *
 * truth.ts is imported for exactly one purpose: grading an accusation. Nothing
 * in the character topics, fallback lines, or player view is derived from it,
 * so there is no path from the canonical solution to a character's mouth.
 */

import type { CaseContent, CharacterFacts } from "@ai-orchestration/case-content";
import { buildFlagView, evaluateCondition } from "@ai-orchestration/case-content";
import type { RunState, SceneId } from "@game-core";
import { CHARACTERS } from "./characters";
import { SCENES } from "./scenes";
import { CLUES } from "./clues";
import { BEATS } from "./beats";
import { FACTS_BY_CHARACTER, FALLBACK_LINES } from "./facts";
import { validateAccusation } from "./truth";
import { VOICES, NARRATOR_VOICE } from "./voices";
import { PERSONAS } from "./personas";

const opening = BEATS.find((b) => b.id === "beat-opening-narration");
if (!opening) throw new Error("Missing scripted beat: beat-opening-narration");

function endingNarration(beatId: string): string {
  const beat = BEATS.find((b) => b.id === beatId);
  if (!beat) throw new Error(`Missing scripted beat: ${beatId}`);
  return beat.scriptedText;
}

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
  characters: CHARACTERS.map((c) => ({
    ...c,
    fallbackLines: FALLBACK_LINES[c.id],
    voiceProfile: VOICES[c.id],
    persona: PERSONAS[c.id],
  })),
  narratorVoice: NARRATOR_VOICE,
  initialSceneId: "scene-tap-room" as unknown as SceneId,
  scenes: SCENES,
  clues: CLUES,
  opening: [{ actor: "narrator", text: opening.scriptedText }],
  sharedWorld: [
    "The Bridgewater Inn is a two-storey clapboard inn on Main Street. Downstairs: the Tap Room (the bar), a small dining room, a snug off the bar called the back room, and the kitchen behind. Upstairs: a hall with six guest rooms; Room 5 is at the far end.",
    "The main stairs go up from the front of the inn. A narrow back staircase runs from the kitchen up to the upstairs hall.",
    "Edna Marsh owns and runs the inn; Ray Kowalski tends bar. They are the only staff on tonight.",
    "Tonight in the Tap Room: Ray, Edna, Dennis Pruett, and a few regulars whose names are not important. Carol Wentworth was in earlier; Dwight Wentworth came in later. A constable now stands at the top of the main stairs.",
  ],
  // Proper nouns the recogniser would otherwise mishear. Public names only.
  speechKeyterms: [
    "Ray Kowalski",
    "Kowalski",
    "Dwight Wentworth",
    "Carol Wentworth",
    "Wentworth",
    "Edna Marsh",
    "Dennis Pruett",
    "Pruett",
    "Gerald Fenn",
    "Fenn",
    "Millhaven",
    "Bridgewater Inn",
    "Tap Room",
  ],

  accusation: {
    // The three primary suspects. Edna and Dennis are witnesses.
    suspectIds: ["char-ray-kowalski", "char-dwight-wentworth", "char-carol-wentworth"],
    minInterviews: 3,
    minClues: 2,
    endings: {
      "ending-correct-full": {
        id: "ending-correct-full",
        title: "Case closed",
        narration: endingNarration("beat-ending-correct-full"),
        solved: true,
      },
      "ending-correct-partial": {
        id: "ending-correct-partial",
        title: "Case closed, with loose ends",
        narration: endingNarration("beat-ending-correct-partial"),
        solved: true,
      },
      "ending-wrong-dwight": {
        id: "ending-wrong-dwight",
        title: "The wrong man",
        narration: endingNarration("beat-ending-wrong-dwight"),
        solved: false,
      },
      "ending-wrong-carol": {
        id: "ending-wrong-carol",
        title: "No case",
        narration: endingNarration("beat-ending-wrong-carol"),
        solved: false,
      },
    },
    evaluate(suspectId, presentedClueIds) {
      const v = validateAccusation(suspectId, presentedClueIds);
      return {
        endingId: v.endingId,
        solved: v.correct,
        assessment: v.assessmentHint,
        debrief: v.debrief,
      };
    },
  },

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
