/**
 * content/cases/radio-night-s01/v1/beats.ts
 * Scripted narrative beats — authored dialogue that is prerecorded/pre-generated.
 * The LLM does not improvise these lines.
 */

export type NarrativeBeat = {
  id: string;
  speakerId: string;
  triggerCondition: string;
  scriptedText: string;
  audioAssetId?: string; // populated after TTS production
  ttsDirection?: string;
};

export const BEATS: NarrativeBeat[] = [
  // ── Opening ──────────────────────────────────────────────────────────────
  {
    id: "beat-opening-narration",
    speakerId: "char-narrator",
    triggerCondition: "game_start",
    scriptedText:
      "Millhaven, New Hampshire. October 17th, 1981. Just past eleven at night, " +
      "and the rain isn't letting up. Someone called the station from a payphone on Main Street — " +
      "a woman's voice, steady but not calm. Gerald Fenn, portrait painter, found dead in Room 5 " +
      "of the Bridgewater Inn. Single blow to the head. The bar was still open when it happened. " +
      "That means people were downstairs. That means someone knows something.",
    ttsDirection:
      "Slow, deliberate. Rain audible underneath. First sentence as a location card. " +
      "Pause after 'not calm.' Pause after 'single blow to the head.' Final two sentences matter-of-fact.",
  },

  // ── Room 5 first entry ────────────────────────────────────────────────────
  {
    id: "beat-room-5-entry",
    speakerId: "char-narrator",
    triggerCondition: "first_visit_scene-room-5",
    scriptedText:
      "Room 5. The bed's been slept in but not for tonight. A suitcase sits open on the chair — " +
      "half packed, or half unpacked; hard to say. On the side table: a glass, a lamp still burning, " +
      "and a glass ashtray that's been moved recently. You can tell because of the ring it left on the wood. " +
      "Gerald Fenn is on the floor near the window. He didn't fall there. Someone put him there, " +
      "or he tried to crawl.",
    ttsDirection:
      "Methodical, almost clinical. Slight pause before 'Gerald Fenn is on the floor.' " +
      "Final sentence delivered quietly, matter-of-fact.",
  },

  // ── Carol disclosure ──────────────────────────────────────────────────────
  {
    id: "beat-carol-disclosure",
    speakerId: "char-carol-wentworth",
    triggerCondition: "clue-fenn-heard-carol_unlocked",
    scriptedText:
      "Yes. I was leaving. I had a date, I had a plan, I had a bag in Ray's storeroom. " +
      "Dwight doesn't know — didn't know. Gerald Fenn apparently did. Ray told me on Saturday afternoon " +
      "that Fenn had approached him. Said he'd keep quiet if Ray paid him. I told Ray not to. " +
      "I said I wasn't afraid of Dwight finding out anymore. I meant it. " +
      "I didn't know about tonight. I want you to understand that. " +
      "Whatever happened, I didn't ask for it.",
    ttsDirection:
      "Even, precise. No wobble until 'I didn't know about tonight' — very slight catch. " +
      "Last sentence back to steady. Carol is not performing grief.",
  },

  // ── Ray partial admission ─────────────────────────────────────────────────
  {
    id: "beat-ray-admission",
    speakerId: "char-ray-kowalski",
    triggerCondition: "clue-ray-admission-partial_unlocked",
    scriptedText:
      "I went upstairs. I'm not going to pretend I didn't. I went up to tell him the deal was off — " +
      "that there was no money, that he could do whatever he wanted. And then — " +
      "He laughed. He said Carol would never leave, that women like her never do. " +
      "And I thought about what Dwight would do when he found out. What he's done before. " +
      "I'm not asking you to understand it. I'm asking you to believe me when I say I didn't plan it.",
    ttsDirection:
      "Opens flat — the admission isn't theatrical. The 'And then —' trails off. " +
      "The Fenn quote comes quietly, not dramatically — that's what makes it land. " +
      "Last two sentences with no pleading, just plainness.",
  },

  // ── Correct full ending ───────────────────────────────────────────────────
  {
    id: "beat-ending-correct-full",
    speakerId: "char-narrator",
    triggerCondition: "ending-correct-full",
    scriptedText:
      "Ray Kowalski was taken into custody at twelve minutes past two in the morning. " +
      "He didn't resist. The Bridgewater Inn went quiet — the kind of quiet that follows " +
      "something that can't be unsaid. Gerald Fenn was not a good man, " +
      "but he deserved a trial, not a verdict from a frightened one. " +
      "Carol Wentworth left Millhaven three weeks later, on her own terms. " +
      "Edna Marsh reopened the bar on Monday. Dennis Pruett was the first customer. " +
      "Some things about a small town don't change. Some things do.",
    ttsDirection:
      "Opening sentence factual, unhurried. Pause before 'He didn't resist.' " +
      "'Gerald Fenn was not a good man' is where the theme lands — not a throwaway. " +
      "Final three sentences spaced out, almost elegiac.",
  },

  // ── Wrong ending: Dwight ──────────────────────────────────────────────────
  {
    id: "beat-ending-wrong-dwight",
    speakerId: "char-narrator",
    triggerCondition: "ending-wrong-dwight",
    scriptedText:
      "Dwight Wentworth was taken in for questioning at one forty in the morning. " +
      "The note under Fenn's bed was enough to hold him for a day. " +
      "Forty-eight hours later, Edna Marsh remembered something she'd forgotten to mention — " +
      "a noise from the kitchen, and Ray Kowalski washing his hands a little too carefully. " +
      "By then the real killer had had time to get his story straight. " +
      "Dwight Wentworth was a hard man who wrote a threatening note to a man who ended up dead. " +
      "That's not nothing. But it isn't murder.",
    ttsDirection:
      "Slightly more clipped than the correct ending. 'That's not nothing' — small beat. " +
      "Final line stated plainly, not triumphantly.",
  },

  // ── Correct accusation, thin case ─────────────────────────────────────────
  {
    id: "beat-ending-correct-partial",
    speakerId: "char-narrator",
    triggerCondition: "ending-correct-partial",
    scriptedText:
      "Ray Kowalski came in quietly, a little before three in the morning. He said very little, " +
      "and what he said was enough to hold him. It was not, the district attorney would remark later, " +
      "a case that closed itself. The sink, the stairs, the long absence from the bar: each could be explained " +
      "on its own, and a good lawyer would have tried. Ray didn\u2019t hire one. " +
      "Carol Wentworth left Millhaven that same month. Edna Marsh kept the bar shut for a week, " +
      "and when it opened there was a new man behind it. For a long time, nobody sat on the third stool from the left.",
    ttsDirection:
      "Quieter than the full ending, with less certainty. 'Enough to hold him' lands plainly. " +
      "The last sentence slowly, almost to himself.",
  },

  // ── Wrong accusation: Carol ───────────────────────────────────────────────
  {
    id: "beat-ending-wrong-carol",
    speakerId: "char-narrator",
    triggerCondition: "ending-wrong-carol",
    scriptedText:
      "Carol Wentworth was asked to account for her evening, and she did, calmly and in order. " +
      "She had left the inn at a quarter past nine. A neighbor across the road had watched her porch light " +
      "come on at half past and not go off again. There was nothing to hold her on, and everyone in the room knew it, " +
      "including the person who had named her. She thanked the detective for the courtesy and went home " +
      "to a house that was already half packed. Gerald Fenn\u2019s killer stayed where he was, " +
      "pouring coffee for the constable. The file was marked open. " +
      "Millhaven did what small towns do. It waited for the story to tell itself, and for a long while, it didn\u2019t.",
    ttsDirection:
      "Level and fair to Carol. The line about the person who named her is not an accusation of the detective. " +
      "'Pouring coffee for the constable' is the quiet gut-punch: no emphasis, just flat.",
  },
];
