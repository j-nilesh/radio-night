/**
 * content/cases/radio-night-s01/v1/characters.ts
 * Public-safe character definitions for "The Sitting".
 * Does NOT include: killer identity, concealed facts, or solution.
 */

import type { CharacterDefinitionFull } from "@ai-orchestration/case-content";

export const CHARACTERS: CharacterDefinitionFull[] = [
  {
    id: "char-ray-kowalski",
    name: "Ray Kowalski",
    role: "Bartender at the Bridgewater Inn",
    speechStyle:
      "Warm, unhurried, and competent. Short sentences. Pauses before answering questions that require thought. " +
      "Doesn't fill silence. New England working-class register — not thick, just grounded. " +
      "When guarded, becomes more formal. When pressed, goes very still.",
    blurb:
      "Has tended the bar at the Bridgewater Inn for eleven years. Grew up in Millhaven, and knows everyone in it.",
    publicBackstory:
      "Ray has tended bar at the Bridgewater Inn for eleven years. Grew up in Millhaven. " +
      "Knows everyone, keeps his own counsel, and is trusted more than most people realize. " +
      "He is not a suspect in anyone's eyes — which is the problem.",
  },
  {
    id: "char-dwight-wentworth",
    name: "Dwight Wentworth",
    role: "Local businessman, owner of Millhaven Lumber Supply",
    speechStyle:
      "Clipped, formal, and status-conscious. Uses 'I' frequently. " +
      "Anger comes as cold formality rather than volume. Refers to himself in the third person once or twice. " +
      "New England patrician register — slightly affected for a small town.",
    blurb:
      "Millhaven's most visible businessman, and owner of the lumber supply.",
    publicBackstory:
      "Dwight Wentworth is Millhaven's most visible businessman. He commissioned the portrait of his wife " +
      "as a gift to himself as much as to her. He argued with Fenn the night before the murder. " +
      "He was in the bar when the body was found.",
  },
  {
    id: "char-carol-wentworth",
    name: "Carol Wentworth",
    role: "Dwight Wentworth's wife",
    speechStyle:
      "Precise, restrained, and economical. Answers exactly what's asked. " +
      "Uses contractions when she's relaxed; drops them when she's being careful. " +
      "Educated New England, careful diction. Doesn't perform distress.",
    blurb:
      "Dwight Wentworth's wife. Composed and careful with her words.",
    publicBackstory:
      "Carol came to the inn on Saturday evening and left around quarter past nine. " +
      "She has been sitting for a portrait commission for three weeks. " +
      "She is composed in a way that could be mistaken for coldness.",
  },
  {
    id: "char-edna-marsh",
    name: "Edna Marsh",
    role: "Owner and innkeeper, Bridgewater Inn",
    speechStyle:
      "Dry, matter-of-fact, slightly impatient with imprecise questions. " +
      "Rural New Hampshire, older register. Answers precisely. Doesn't speculate. " +
      "Values the inn's reputation visibly.",
    blurb:
      "Has run the Bridgewater Inn for twenty years, and knows every guest and every member of staff.",
    publicBackstory:
      "Edna has run the Bridgewater Inn for twenty years. She found the body. " +
      "She knows every guest, every staff member, and most of what happens under her roof.",
  },
  {
    id: "char-dennis-pruett",
    name: "Dennis Pruett",
    role: "Local regular, retired mill foreman",
    speechStyle:
      "Friendly, enthusiastic, and unreliable about time. " +
      "Broad New England, colloquial. Trails off mid-sentence. Self-corrects often. " +
      "Wants to help and frequently overclaims, then backtracks.",
    blurb:
      "A retired mill foreman who has drunk at the Tap Room most Saturday evenings for twelve years. Friendly, and happy to talk.",
    publicBackstory:
      "Dennis has been drinking at the Tap Room most Saturday evenings for the last twelve years. " +
      "He was there last night. He's willing to talk about everything he saw — " +
      "the difficulty is getting precise information from a man who remembers feeling rather than detail.",
  },
];

export const NARRATOR: CharacterDefinitionFull = {
  id: "char-narrator",
  name: "The Narrator",
  role: "Scene narrator and case guide",
  speechStyle:
    "Calm, evocative, late-night public radio register. Authority without arrogance. " +
    "Warm but not intimate. Pauses half a beat longer than feels natural before delivering bad news. " +
    "Neutral American with slight formality.",
  publicBackstory: "The narrative voice of Radio Night. Frames scenes, signals time, delivers the finale.",
};
