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
 * Validates a player's accusation against the canonical truth.
 * Returns the appropriate ending ID.
 */
export function validateAccusation(
  accusedId: string,
  discoveredClueIds: string[]
): { endingId: EndingId; correct: boolean; assessmentHint: string } {
  const truth = CANONICAL_TRUTH;

  if (accusedId === truth.killerId) {
    const matchingClues = discoveredClueIds.filter((c) =>
      truth.requiredCluesForFullEnding.includes(c as typeof truth.requiredCluesForFullEnding[number])
    );

    // Check at least one anchor clue is present
    const hasAnchor = truth.minimumCluesRequired.some((c) =>
      discoveredClueIds.includes(c)
    );

    if (!hasAnchor) {
      return {
        endingId: "ending-correct-partial",
        correct: true,
        assessmentHint:
          "You named the right person, but the evidence trail is thin. " +
          "The case will be harder to prove.",
      };
    }

    if (matchingClues.length >= truth.requiredCluesForFullEnding.length) {
      return {
        endingId: "ending-correct-full",
        correct: true,
        assessmentHint: "The evidence speaks clearly. Ray Kowalski is your man.",
      };
    }

    return {
      endingId: "ending-correct-partial",
      correct: true,
      assessmentHint:
        "The right accusation. You have enough to bring him in — " +
        "though there are threads you didn't pull.",
    };
  }

  if (accusedId === "char-dwight-wentworth") {
    return {
      endingId: "ending-wrong-dwight",
      correct: false,
      assessmentHint:
        "Dwight Wentworth had motive and opportunity — but the timeline doesn't fit. " +
        "Five minutes upstairs isn't enough. The real answer was closer to you than you knew.",
    };
  }

  return {
    endingId: "ending-wrong-carol",
    correct: false,
    assessmentHint:
      "Carol Wentworth left the inn before the window of death. " +
      "She had the most to lose from Fenn's interference — but she wasn't there.",
  };
}
