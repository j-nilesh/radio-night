/**
 * content/cases/radio-night-s01/v1/truth.ts
 * SERVER ONLY — canonical facts, culprit, and solution.
 *
 * THIS FILE MUST NEVER BE IMPORTED CLIENT-SIDE.
 * It must never be included in any LLM context without being filtered.
 * It must never appear in API responses.
 *
 * This is the sole source of truth for the accusation validator.
 */

export const CANONICAL_TRUTH = {
  caseId: "radio-night-s01",
  version: "v1",
  title: "The Sitting",

  // ── The killer ─────────────────────────────────────────────────────────────
  killerId: "char-ray-kowalski",
  killerName: "Ray Kowalski",

  // ── The crime ──────────────────────────────────────────────────────────────
  victim: "Gerald Fenn",
  method: "Single blow to the back of the head with a glass ashtray",
  weapon: "Glass ashtray (wiped, found on side table in Room 5)",
  location: "Room 5, Bridgewater Inn, upstairs",
  timeOfDeath: "Between 9:50 PM and 10:15 PM, October 17, 1981",

  // ── Motive ─────────────────────────────────────────────────────────────────
  motive:
    "Fenn overheard Carol Wentworth planning to leave her husband and attempted " +
    "to extort Ray Kowalski for his silence. Ray believed Dwight Wentworth was " +
    "dangerous and that disclosure would put Carol at physical risk. He went to " +
    "Fenn's room to refuse the demand; the confrontation turned physical and " +
    "Ray struck Fenn. He did not plan to kill him.",

  // ── Key facts (for accusation validation) ──────────────────────────────────
  requiredCluesForFullEnding: [
    "clue-ray-was-away",
    "clue-gap-contradiction",
    "clue-kitchen-sink",
    "clue-back-stairs-access",
    "clue-fenn-approach", // OR clue-fenn-heard-carol
    "clue-ray-admission-partial",
  ],

  minimumCluesForPartialEnding: 4,
  minimumCluesRequired: ["clue-ray-was-away", "clue-kitchen-sink"], // at least one of these must be present

  // ── Red herring verdicts ────────────────────────────────────────────────────
  falseSuspects: [
    {
      characterId: "char-dwight-wentworth",
      exonerationFact:
        "Edna Marsh places Dwight upstairs for only 5 minutes around 9:30 PM. " +
        "The death window requires 25–35 minutes. He wrote a threatening note " +
        "but did not commit the murder.",
    },
    {
      characterId: "char-carol-wentworth",
      exonerationFact:
        "Carol left the Bridgewater Inn at approximately 9:15 PM, confirmed by " +
        "Dennis Pruett and Edna Marsh. She was home by 9:30. Neighbor corroborates.",
    },
  ],

  // ── Endings ────────────────────────────────────────────────────────────────
  endings: {
    "ending-correct-full": {
      accusedId: "char-ray-kowalski",
      minimumClues: 6,
      description: "Full confession and emotional resolution.",
    },
    "ending-correct-partial": {
      accusedId: "char-ray-kowalski",
      minimumClues: 4,
      description: "Ray admits going upstairs. Detective assessment is confident.",
    },
    "ending-wrong-dwight": {
      accusedId: "char-dwight-wentworth",
      minimumClues: 0,
      description: "Wrong accusation. Dwight arrested. Timeline later exonerates him.",
    },
    "ending-wrong-carol": {
      accusedId: "char-carol-wentworth",
      minimumClues: 0,
      description: "Wrong accusation. Carol has corroborated alibi. Killer goes free.",
    },
  },
} as const;

export type EndingId = keyof typeof CANONICAL_TRUTH.endings;

/**
 * The six steps of the case against Ray. A step is established when the player
 * presents at least one of its clues. The motive step accepts either of two
 * clues, as the bible's rubric allows.
 */
export const CASE_STEPS = [
  { id: "away", label: "Ray left the bar around ten", clues: ["clue-ray-was-away"] },
  { id: "gap", label: "He was gone far longer than he said", clues: ["clue-gap-contradiction"] },
  { id: "washed", label: "He washed his hands in the kitchen afterward", clues: ["clue-kitchen-sink"] },
  { id: "route", label: "He knew the back stairs, which reach the upper floor unseen", clues: ["clue-back-stairs-access"] },
  {
    id: "motive",
    label: "Fenn had a hold over him, with Carol\u2019s safety at stake",
    clues: ["clue-fenn-approach", "clue-fenn-heard-carol"],
  },
  { id: "admission", label: "He admitted going up to Fenn\u2019s room", clues: ["clue-ray-admission-partial"] },
] as const;

export type DebriefLine = { label: string; established: boolean };

export type AccusationVerdict = {
  endingId: EndingId;
  correct: boolean;
  /** The detective's assessment, shown after the ending */
  assessmentHint: string;
  /** Only meaningful when the right person was named */
  debrief: DebriefLine[];
};

/**
 * Grades an accusation against the canonical truth.
 *
 * `presentedClueIds` is the evidence the player chose to put forward. The
 * caller guarantees every id is one the player has actually discovered.
 */
export function validateAccusation(
  accusedId: string,
  presentedClueIds: string[]
): AccusationVerdict {
  const truth = CANONICAL_TRUTH;
  const presented = new Set(presentedClueIds);

  const debrief: DebriefLine[] = CASE_STEPS.map((step) => ({
    label: step.label,
    established: step.clues.some((c) => presented.has(c)),
  }));
  const established = debrief.filter((d) => d.established).length;

  if (accusedId === truth.killerId) {
    if (established === CASE_STEPS.length) {
      return {
        endingId: "ending-correct-full",
        correct: true,
        assessmentHint: "Every step holds. The evidence speaks clearly, and so did Ray, in the end.",
        debrief,
      };
    }
    return {
      endingId: "ending-correct-partial",
      correct: true,
      assessmentHint:
        established >= 4
          ? "The right man, and enough to bring him in. There were threads you didn\u2019t pull."
          : "The right man, but a thin case. You were closer to a hunch than a proof.",
      debrief,
    };
  }

  if (accusedId === "char-dwight-wentworth") {
    return {
      endingId: "ending-wrong-dwight",
      correct: false,
      assessmentHint:
        "Dwight Wentworth had a motive and left a note. But five minutes upstairs doesn\u2019t fit the window. " +
        "Look again at who was gone longer.",
      debrief,
    };
  }

  return {
    endingId: "ending-wrong-carol",
    correct: false,
    assessmentHint:
      "Carol Wentworth had the most to lose, and she had left the inn before the window. " +
      "A motive is not an opportunity.",
    debrief,
  };
}
