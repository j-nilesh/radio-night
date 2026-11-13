/**
 * content/cases/radio-night-s01/v1/clues.ts
 * Clue definitions for "The Sitting" — what the casebook shows.
 *
 * "physical" clues are found by examining the scene.
 * "testimony" clues are things a witness said: they are recorded as claims
 * and are never promoted to established fact.
 *
 * Summaries are player-facing. They describe what the detective learned,
 * not what is true.
 */

import type { ClueInfo } from "@ai-orchestration/case-content";

export const CLUES: ClueInfo[] = [
  // ── Tier 1: physical, Room 5 and the hall ────────────────────────────────
  {
    id: "clue-ashtray",
    kind: "physical",
    sceneId: "scene-room-5",
    label: "The ashtray",
    title: "The ashtray",
    summary:
      "A heavy glass ashtray in Room 5, wiped clean and moved from the ring it left on the table.",
    examineText:
      "A heavy glass ashtray on the side table. It has been wiped; the glass is smeared and slightly tacky, " +
      "and there is no ash in it. It left a ring on the wood where it used to sit. Whatever struck Gerald Fenn, " +
      "this would fit the wound: heavy, smooth, no edges. Whoever used it took the trouble to wipe it afterwards.",
  },
  {
    id: "clue-whiskey-glass",
    kind: "physical",
    sceneId: "scene-room-5",
    label: "The whiskey glass",
    title: "One whiskey glass",
    summary: "A single empty glass in Room 5. There is no second glass. Fenn's last drink was taken alone.",
    examineText:
      "One empty tumbler beside the lamp, a thin brown film in the bottom. Only the one glass. " +
      "If Gerald Fenn had company, he finished this drink before it arrived.",
  },
  {
    id: "clue-note-under-bed",
    kind: "physical",
    sceneId: "scene-room-5",
    label: "Under the bed",
    title: "A threatening note",
    summary:
      "A note found under the bed in Room 5: \u201CStay away from my wife. This is your last warning. \u2014 D.W.\u201D",
    examineText:
      "A folded sheet of paper, pushed under the bed frame as if it had been kicked there. " +
      "Block capitals: \u201CSTAY AWAY FROM MY WIFE. THIS IS YOUR LAST WARNING. \u2014 D.W.\u201D",
    // Set in code over the blank paper in the picture (the picture itself has no writing)
    imageText: "STAY AWAY FROM MY WIFE. THIS IS YOUR LAST WARNING. \u2014 D.W.",
  },
  {
    id: "clue-back-stairs",
    kind: "physical",
    sceneId: "scene-upstairs-hall",
    label: "The far end of the hall",
    title: "A second staircase",
    summary:
      "A door at the end of the upstairs hall opens onto a back staircase that leads down toward the kitchen.",
    examineText:
      "A narrow door at the far end of the hall, beyond Room 5. Behind it, a plain wooden staircase drops " +
      "toward the back of the building and the kitchen. You would never see someone using it from the bar.",
  },

  // ── Tier 1 testimony ─────────────────────────────────────────────────────
  {
    id: "clue-friday-argument",
    kind: "testimony",
    label: "",
    title: "Friday\u2019s argument",
    summary:
      "Dwight Wentworth and Gerald Fenn argued in the dining room the night before the murder, over the portrait sittings.",
  },

  // ── Tier 2 testimony ─────────────────────────────────────────────────────
  {
    id: "clue-dwight-went-upstairs",
    kind: "testimony",
    label: "",
    title: "Dwight went upstairs",
    summary:
      "Edna Marsh says Dwight Wentworth went upstairs around half past nine and was back down within five minutes.",
  },
  {
    id: "clue-carol-left-early",
    kind: "testimony",
    label: "",
    title: "Carol left early",
    summary: "Carol Wentworth left the inn a little after a quarter past nine and did not return that night.",
  },
  {
    id: "clue-ray-was-away",
    kind: "testimony",
    label: "",
    title: "Ray stepped away",
    summary:
      "Dennis Pruett says Ray left the bar for ten or fifteen minutes around ten o\u2019clock, mentioning the cellar.",
  },
  {
    id: "clue-kitchen-sink",
    kind: "testimony",
    label: "",
    title: "Ray in the kitchen",
    summary: "Edna Marsh says Ray came through the kitchen around ten and washed his hands at the sink.",
  },
  {
    id: "clue-back-stairs-access",
    kind: "testimony",
    label: "",
    title: "Who uses the back stairs",
    summary: "The back stairs are used by staff. Ray carries ice up that way.",
  },

  // ── Tier 3 testimony ─────────────────────────────────────────────────────
  {
    id: "clue-gap-contradiction",
    kind: "testimony",
    label: "",
    title: "A longer absence",
    summary:
      "Pressed, Dennis admits Ray may have been gone closer to half an hour, and that he did not check the clock.",
  },
  {
    id: "clue-fenn-heard-carol",
    kind: "testimony",
    label: "",
    title: "Fenn knew",
    summary:
      "Carol Wentworth says she was planning to leave her husband, that Fenn learned of it, and that he approached Ray.",
  },
  {
    id: "clue-fenn-approach",
    kind: "testimony",
    label: "",
    title: "Fenn wanted money",
    summary: "Ray admits Gerald Fenn asked him for money, and says he told Fenn he would think about it.",
  },
  {
    id: "clue-ray-admission-partial",
    kind: "testimony",
    label: "",
    title: "Ray went upstairs",
    summary: "Ray admits he went upstairs to see Fenn that night.",
  },
];
