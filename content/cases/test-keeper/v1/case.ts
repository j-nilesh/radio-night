/**
 * content/cases/test-keeper/v1/case.ts
 * TEST CHARACTER ONLY — not part of the Radio Night mystery.
 *
 * "The Keeper" — a disposable test character for validating the full pipeline.
 * This character and this case will be REMOVED before the real mystery is shipped.
 *
 * Purpose: verify that the fact disclosure system, classification gate,
 * deflections, and save/resume all work correctly end-to-end.
 */

import type { CaseContent, CharacterFacts, FactEntry } from "@ai-orchestration/case-content";
import type { RunState, SceneId } from "@game-core";
import { evaluateCondition } from "@ai-orchestration/case-content";

// ---------------------------------------------------------------------------
// Character definition
// ---------------------------------------------------------------------------

const KEEPER_ID = "char-keeper";

const keeperCharacter = {
  id: KEEPER_ID,
  name: "The Keeper",
  role: "Archive keeper",
  speechStyle:
    "Formal, precise, unhurried. Uses complete sentences. Slightly defensive when pressed. 1940s register.",
  publicBackstory:
    "Has maintained the town archive for 15 years. Meticulous, private, and proud of his work. " +
    "Served as a courier during the war. Dislikes disorder and cigarettes.",
  voiceProfile: {
    characterId: "char-keeper",
    provider: "deepgram" as const,
    model: "aura-2",
    voiceId: "aura-2-orion-en",
    delivery: {},
    targetFormat: "mp3" as const,
    fallbackPolicy: "captions_only" as const,
  },
};

// ---------------------------------------------------------------------------
// Fact store
// ---------------------------------------------------------------------------

/**
 * Public facts — always permitted to reveal.
 */
const PUBLIC_FACTS: FactEntry[] = [
  {
    factId: "fact-works-archive-15-years",
    description: "Has worked in the archive for fifteen years without incident.",
    isPublic: true,
  },
  {
    factId: "fact-keeps-visitor-records",
    description: "Keeps meticulous records of every visitor who enters the archive.",
    isPublic: true,
  },
  {
    factId: "fact-archive-closes-6pm",
    description: "The archive closes promptly at six o'clock in the evening.",
    isPublic: true,
  },
  {
    factId: "fact-dislikes-cigarettes",
    description: "Strongly dislikes the smell of cigarettes and tobacco in the archive.",
    isPublic: true,
  },
  {
    factId: "fact-west-wing-fire",
    description: "There was a fire in the west wing of the archive two years ago. It was ruled accidental.",
    isPublic: true,
  },
  {
    factId: "fact-woman-blue-coat",
    description: "Saw a woman in a blue coat visiting the archive last Tuesday.",
    isPublic: true,
  },
  {
    factId: "fact-did-not-speak-room-4",
    description: "Did not speak to the visitor in Room 4, though he noted their arrival.",
    isPublic: true,
  },
  {
    factId: "fact-visitor-arrived-after-nine",
    description: "The visitor in Room 4 arrived after nine o'clock in the evening.",
    isPublic: true,
  },
  {
    factId: "fact-served-as-courier",
    description: "Served as a military courier during the war and is proud of his discretion.",
    isPublic: true,
  },
  {
    factId: "fact-cannot-read-shorthand",
    description: "Cannot read shorthand. He uses longhand in all his records.",
    isPublic: true,
  },
  {
    factId: "fact-telephone-broken",
    description: "The archive telephone has been out of service for three weeks.",
    isPublic: true,
  },
  {
    factId: "fact-does-not-own-car",
    description: "Does not own a car. Walks to work every morning.",
    isPublic: true,
  },
];

/**
 * Concealed facts — only revealed when specific conditions are met.
 * Unlock conditions are flag expressions evaluated against RunState.investigationFlags.
 */
const CONCEALED_FACTS: FactEntry[] = [
  {
    factId: "fact-burned-ledger",
    description:
      "Destroyed the visitor ledger from the night of the fire two years ago — the record that would show who was present.",
    isPublic: false,
    unlockCondition: "asked_about_fire_ledger",
  },
  {
    factId: "fact-recognized-blue-coat-woman",
    description:
      "Recognized the woman in the blue coat as the local inspector's wife — but chose not to record her name.",
    isPublic: false,
    unlockCondition: "fact-woman-blue-coat AND asked_about_blue_coat_identity",
  },
  {
    factId: "fact-paid-for-testimony",
    description:
      "Was paid a sum of money to state that the visitor arrived after nine, rather than before eight.",
    isPublic: false,
    unlockCondition:
      "fact-burned-ledger AND fact-recognized-blue-coat-woman AND confronted_about_arrival_time",
  },
];

// ---------------------------------------------------------------------------
// Scene definition
// ---------------------------------------------------------------------------

const ARCHIVE_SCENE_ID = "scene-archive-room" as SceneId;

// ---------------------------------------------------------------------------
// CaseContent implementation
// ---------------------------------------------------------------------------

export const testKeeperCase: CaseContent = {
  caseId: "test-keeper",
  version: "v1",
  title: "The Keeper (Test Character)",
  period: "circa 1942, wartime England",
  periodConstraints: [
    "1940s wartime England",
    "No television",
    "No computers or electronic calculators",
    "No mobile phones or post-war technology",
    "Wartime rationing is in effect",
    "References to the war, blackouts, and rationing are appropriate",
  ],
  characters: [keeperCharacter],
  narratorVoice: {
    characterId: "char-narrator",
    provider: "deepgram",
    model: "aura-2",
    voiceId: "aura-2-pluto-en",
    delivery: {},
    targetFormat: "mp3",
    fallbackPolicy: "captions_only",
  },
  initialSceneId: ARCHIVE_SCENE_ID,
  opening: [
    {
      actor: "narrator",
      text:
        "The archive room is quiet. Shelves of ledgers stretch to the ceiling. " +
        "The Keeper stands behind a broad oak desk, watching you with careful eyes.",
    },
    {
      actor: "character",
      speakerName: "The Keeper",
      text:
        "Detective. I've been expecting someone. I've told the constable everything I know, " +
        "but I suppose you'll want to hear it for yourself.",
    },
  ],

  getCharacterFacts(characterId: string, state: RunState): CharacterFacts | null {
    if (characterId !== KEEPER_ID) return null;

    const flags = state.investigationFlags;

    // All public facts are always permitted
    const permitted: FactEntry[] = [...PUBLIC_FACTS];

    // Also include known public facts from previous turns
    // (they're always in permitted — character can re-confirm them)

    // Evaluate concealed facts against unlock conditions
    const concealed: FactEntry[] = [];
    for (const fact of CONCEALED_FACTS) {
      const isUnlocked = evaluateCondition(fact.unlockCondition, flags);
      if (isUnlocked) {
        // Condition met — character may now reveal this
        permitted.push(fact);
      } else {
        // Still concealed — used for validation (prevent premature reveals)
        concealed.push(fact);
      }
    }

    return { permitted, concealed };
  },
};
