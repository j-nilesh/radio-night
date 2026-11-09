/**
 * content/cases/radio-night-s01/v1/facts.ts
 * Authored topics for each character in "The Sitting".
 *
 * Each topic has:
 *   triggers      patterns matched against the (lowercased) player question
 *   line          what the character says when the topic is unlocked
 *   lockedLine    what they say instead while it is locked (a lie, denial or evasion)
 *   grantsClueId  casebook entry recorded the first time the line is heard
 *   unlockCondition  flag expression: clue ids, interviewed_<id>, visited_<scene>
 *
 * Selection is deterministic: the first matching UNLOCKED topic wins; if none is
 * unlocked, the first matching LOCKED topic gives its evasive line. Order within a
 * character therefore matters: put the more specific topics first.
 *
 * Voice rules from the bible: Ray goes still when pressed. Carol drops
 * contractions while she is being careful. Dennis self-corrects and
 * underestimates time. Edna is dry and exact. Dwight goes quiet and formal.
 */

import type { FactEntry } from "@ai-orchestration/case-content";
import { BEATS } from "./beats";

function beatText(id: string): string {
  const beat = BEATS.find((b) => b.id === id);
  if (!beat) throw new Error(`Missing scripted beat: ${id}`);
  return beat.scriptedText;
}

// ---------------------------------------------------------------------------
// Ray Kowalski — the bartender
// ---------------------------------------------------------------------------

const RAY: FactEntry[] = [
  {
    factId: "fact-ray-heard",
    description: "Claims he heard nothing from upstairs.",
    isPublic: true,
    triggers: [/\b(hear|heard|noise|noises|sound|sounds|scream|shout|shouting|commotion)\b/],
    line:
      "Not a thing. Saturday night, the television going, a full bar. If there was a sound upstairs, " +
      "it never reached me.",
  },
  {
    factId: "fact-ray-admission",
    description: "Ray went upstairs to see Fenn and struck him.",
    isPublic: false,
    unlockCondition: "clue-fenn-approach AND clue-gap-contradiction",
    triggers: [
      /\bupstairs\b/,
      /\bwent up\b/,
      /\bkitchen\b/,
      /\bhands?\b/,
      /\bsink\b/,
      /\bcame (back )?down\b/,
    ],
    line: beatText("beat-ray-admission"),
    lockedLine:
      "I checked the cellar, Detective. We were running low on lager. Ask Dennis. He'll tell you I wasn't gone long.",
    grantsClueId: "clue-ray-admission-partial",
  },
  {
    factId: "fact-ray-fenn-approach",
    description: "Fenn asked Ray for money to keep quiet about Carol.",
    isPublic: false,
    unlockCondition: "clue-fenn-heard-carol",
    triggers: [
      /\b(fenn|painter|gerald)\b.*\b(money|pay|paid|privately|private|approach|approached|threat|threatened|blackmail|demand|demanded)\b/,
      /\b(money|blackmail|hush)\b/,
      /\b(spoke|speak|talk|talked|talking) (to|with) (him|fenn|the painter)\b/,
      /\b(fenn|painter|gerald)\b.*\b(ask|asked|want|wanted|say|said|tell|told) (you|ray)\b/,
    ],
    line: "He asked me for money. I told him I'd think about it.",
    lockedLine: "We barely spoke. He drank his whiskey and kept to himself.",
    grantsClueId: "clue-fenn-approach",
  },
  {
    factId: "fact-ray-back-stairs",
    description: "Staff use the back stairs; Ray carries ice up that way.",
    isPublic: true,
    triggers: [/\bback (stairs|staircase)\b/, /\bservice stairs\b/, /\b(other|second) (stairs|staircase)\b/],
    line: "The back stairs? Staff use them. I carry ice up that way when the rooms want it. Hardly a secret.",
    grantsClueId: "clue-back-stairs-access",
  },
  {
    factId: "fact-ray-away",
    description: "Ray gives a minimised account of leaving the bar.",
    isPublic: true,
    triggers: [
      /\b(leave|left|leaving) the bar\b/,
      /\bstep(ped)? (away|out|down)\b/,
      /\baway from the bar\b/,
      /\bcellar\b/,
      /\bhow long\b.*\b(away|gone)\b/,
    ],
    line:
      "I stepped down to the cellar once. We were low on lager. Five minutes, ten at the most. " +
      "Dennis will tell you.",
  },
  {
    factId: "fact-ray-alibi",
    description: "Ray claims to have been behind the bar all evening.",
    isPublic: true,
    triggers: [
      /\bwhere were you\b/,
      /\balibi\b/,
      /\ball (night|evening)\b/,
      /\bwhole (night|evening)\b/,
      /\bbehind the bar\b/,
    ],
    line: "Behind this bar, same as every Saturday. Ask anyone who was drinking tonight.",
  },
  {
    factId: "fact-ray-carol",
    description: "Ray confirms he is a friend helping Carol.",
    isPublic: true,
    triggers: [/\b(carol|mrs\.? wentworth)\b/, /\bhelp(ing|ed)? (her|carol)\b/],
    line:
      "Carol's a friend. She's been in a hard spot and I've helped where I could. " +
      "That's all there is to it.",
  },
  {
    factId: "fact-ray-dwight",
    description: "Ray describes Dwight as dangerous.",
    isPublic: true,
    triggers: [/\b(dwight|mr\.? wentworth|wentworth|her husband|businessman)\b/],
    line:
      "Dwight Wentworth? Careful with that one, Detective. He doesn't raise his voice. " +
      "He gets quiet, and you'd want to be somewhere else when he does.",
  },
  {
    factId: "fact-ray-fenn",
    description: "Ray's general view of Fenn.",
    isPublic: true,
    triggers: [/\b(fenn|painter|gerald|victim|dead man)\b/],
    line:
      "Mr. Fenn drank whiskey, tipped fine, and talked more than he listened. " +
      "I won't pretend I'll miss him. But I wouldn't have wished this on anyone.",
  },
];

// ---------------------------------------------------------------------------
// Dwight Wentworth — red herring
// ---------------------------------------------------------------------------

const DWIGHT: FactEntry[] = [
  {
    factId: "fact-dwight-note",
    description: "Dwight wrote the threatening note.",
    isPublic: false,
    unlockCondition: "clue-note-under-bed",
    triggers: [
      /\b(note|threat|threats|threaten|threatened|warning|letter|wrote|written)\b/,
      /\bunder (his|the) (door|bed)\b/,
      /\bslipped?\b/,
    ],
    line:
      "...Yes. I wrote it. A warning, nothing more. I am a businessman, Detective, not a thug.",
    lockedLine: "A note? I don't know what you are talking about. I wrote the man no note.",
  },
  {
    factId: "fact-dwight-upstairs",
    description: "Dwight went upstairs for about five minutes.",
    isPublic: false,
    unlockCondition: "clue-dwight-went-upstairs",
    triggers: [/\b(upstairs|went up|stairs|room (5|five)|his room)\b/],
    line:
      "I went up to check on something. A private matter. It took five minutes at the most, " +
      "and I came straight back down.",
    lockedLine: "Upstairs? I was at the bar all evening. Ask anyone in the room.",
  },
  {
    factId: "fact-dwight-friday",
    description: "Dwight admits Friday's argument.",
    isPublic: true,
    triggers: [
      /\b(friday|argue|argued|argument|row|fight|quarrel|quarrelled|shout|shouted|dining room)\b/,
    ],
    line:
      "The man was overstepping. Three weeks of sittings, and he looked at my wife as though " +
      "he were appraising her. I told him so. Quietly, as one does.",
    grantsClueId: "clue-friday-argument",
  },
  {
    factId: "fact-dwight-leaving",
    description: "Dwight denies his wife is unhappy.",
    isPublic: true,
    triggers: [
      /\bleav(e|ing) (you|him|dwight)\b/,
      /\bdivorce\b/,
      /\b(unhappy|plans|secret|run away|escape)\b/,
    ],
    line: "My wife is perfectly happy, Detective. I will thank you not to suggest otherwise.",
  },
  {
    factId: "fact-dwight-wife",
    description: "Dwight on his wife's movements.",
    isPublic: true,
    triggers: [/\b(carol|your wife|mrs\.? wentworth|wife)\b/],
    line:
      "My wife left the inn early in the evening and went home. That is all I know of her movements, " +
      "and all that concerns this matter.",
  },
  {
    factId: "fact-dwight-alibi",
    description: "Dwight's partial alibi (omits going upstairs).",
    isPublic: true,
    triggers: [/\bwhere were you\b/, /\balibi\b/, /\ball evening\b/, /\bat the bar\b/, /\byour movements\b/],
    line: "I was in the bar from nine o'clock. A dozen people saw me. I trust that settles it.",
  },
  {
    factId: "fact-dwight-fenn",
    description: "Dwight on Fenn's death.",
    isPublic: true,
    triggers: [/\b(fenn|painter|gerald|portrait|murder|murdered|killed|his death)\b/],
    line:
      "I will not pretend to mourn the man. But I did not lay a hand on him, " +
      "and I will not be spoken to as though I had.",
  },
];

// ---------------------------------------------------------------------------
// Carol Wentworth — red herring
// ---------------------------------------------------------------------------

const CAROL: FactEntry[] = [
  {
    factId: "fact-carol-fenn-knew",
    description: "Carol: Fenn knew of her plan and approached Ray.",
    isPublic: true,
    triggers: [
      /\b(fenn|painter|gerald)\b.*\b(know|knew|overheard|heard|aware|found out|threat|threatened|blackmail|money|approach|approached|told|plans?)\b/,
      /\b(plans?|leaving)\b.*\b(fenn|painter|gerald)\b/,
      /\b(blackmail|extort|hush money)\b/,
    ],
    line: beatText("beat-carol-disclosure"),
    grantsClueId: "clue-fenn-heard-carol",
  },
  {
    factId: "fact-carol-alibi",
    description: "Carol left at about 9:15 and went home.",
    isPublic: true,
    triggers: [
      /\bwhen did you (leave|go)\b/,
      /\bwhere (were|did) you (go|you)\b/,
      /\bwhat time\b/,
      /\balibi\b/,
      /\bwent home\b/,
    ],
    line:
      "I left the inn at about a quarter past nine and went straight home. " +
      "I did not come back until Edna sent for me.",
    grantsClueId: "clue-carol-left-early",
  },
  {
    factId: "fact-carol-leaving",
    description: "Carol confirms she was planning to leave Dwight.",
    isPublic: true,
    triggers: [
      /\bleav(e|ing) (him|your husband|dwight|the marriage)\b/,
      /\bdivorce\b/,
      /\b(plans?|escape|bag|packed|unhappy|marriage)\b/,
    ],
    line:
      "Yes. I was leaving my husband. I will say it plainly, Detective; I am not ashamed of it. " +
      "Ray has been helping me, as a friend, and nothing more than that.",
  },
  {
    factId: "fact-carol-ray",
    description: "Carol on Ray.",
    isPublic: true,
    triggers: [/\bray\b/, /\bbartender\b/],
    line:
      "Ray has been a good friend to me. He helped with practical matters and asked for nothing in return.",
  },
  {
    factId: "fact-carol-dwight",
    description: "Carol on her husband.",
    isPublic: true,
    triggers: [/\b(dwight|your husband|husband)\b/],
    line: "My husband is very careful about appearances. I will leave it at that, for now.",
  },
  {
    factId: "fact-carol-sitting",
    description: "Carol on the portrait sittings.",
    isPublic: true,
    triggers: [/\b(portrait|sitting|sittings|painting|paint)\b/],
    line:
      "Three weeks of sittings. Gerald Fenn watched everything, Detective, " +
      "and kept what he saw like coins in a pocket.",
  },
  {
    factId: "fact-carol-fenn",
    description: "Carol on Fenn.",
    isPublic: true,
    triggers: [/\b(fenn|painter|gerald)\b/],
    line:
      "He noticed things. That was his talent and his habit. " +
      "I never knew when he would spend what he had noticed.",
  },
];

// ---------------------------------------------------------------------------
// Edna Marsh — innkeeper, witness
// ---------------------------------------------------------------------------

const EDNA: FactEntry[] = [
  {
    factId: "fact-edna-kitchen-ray",
    description: "Edna saw Ray wash his hands in the kitchen around ten.",
    isPublic: true,
    triggers: [
      /\b(ray|bartender)\b.*\b(kitchen|wash|washed|washing|sink|hands)\b/,
      /\bkitchen\b.*\b(see|saw|anyone|who|come|came|through)\b/,
      /\b(anyone|who|someone)\b.*\bkitchen\b/,
      /\bsink\b/,
      /\bwash(ed|ing)? (his |their |her )?hands\b/,
    ],
    line:
      "Ray came through around ten, or a little after. I thought he'd come for a glass. " +
      "He washed his hands at the sink and went back out. I didn't think a thing of it.",
    grantsClueId: "clue-kitchen-sink",
  },
  {
    factId: "fact-edna-back-stairs",
    description: "Staff use the back stairs; Ray carries ice.",
    isPublic: true,
    triggers: [
      /\bback (stairs|staircase)\b/,
      /\b(other|second) (stairs|staircase)\b/,
      /\bservice stairs\b/,
      /\bwho (uses|used|knows)\b.*\bstairs\b/,
    ],
    line: "Staff, mostly. Guests don't really know about them. Ray uses them to bring up ice.",
    grantsClueId: "clue-back-stairs-access",
  },
  {
    factId: "fact-edna-dwight-up",
    description: "Edna saw Dwight go up around 9:30 for about five minutes.",
    isPublic: true,
    triggers: [
      /\b(dwight|wentworth)\b.*\b(upstairs|went up|stairs|go up)\b/,
      /\b(upstairs|went up)\b.*\b(dwight|wentworth)\b/,
      /\bwho (went|came|go|was|goes) (up|upstairs)\b/,
      /\banyone (go|went|come|came) (up|upstairs)\b/,
    ],
    line:
      "Mr. Wentworth went up around half past nine. Back down inside five minutes. " +
      "I didn't see anyone else go up, though I was in the kitchen from about twenty to ten.",
    grantsClueId: "clue-dwight-went-upstairs",
  },
  {
    factId: "fact-edna-carol",
    description: "Edna on Carol leaving.",
    isPublic: true,
    triggers: [/\b(carol|mrs\.? wentworth)\b/],
    line:
      "Mrs. Wentworth was in from half past eight. She left a little after a quarter past nine " +
      "and she didn't come back.",
    grantsClueId: "clue-carol-left-early",
  },
  {
    factId: "fact-edna-friday",
    description: "Edna overheard the Friday argument.",
    isPublic: true,
    triggers: [/\b(friday|argue|argued|argument|row|fight|quarrel|quarrelled|shout|shouted)\b/],
    line:
      "Friday evening, in my dining room. Mr. Wentworth told Mr. Fenn to keep his eyes on his canvas. " +
      "He said it quietly. I've heard Mr. Wentworth quiet before, and I'd rather hear him shout.",
    grantsClueId: "clue-friday-argument",
  },
  {
    factId: "fact-edna-found",
    description: "Edna found the body.",
    isPublic: true,
    triggers: [/\b(found|body|discover|discovered|light under|find him)\b/],
    line:
      "I went up at about a quarter to eleven because there was a light under the door of Five and he " +
      "hadn't called down. I knocked. Then I opened it. I'll not describe it. I called it in.",
  },
  {
    factId: "fact-edna-fenn",
    description: "Edna on Fenn as a guest.",
    isPublic: true,
    triggers: [/\b(fenn|painter|gerald|guest)\b/],
    line:
      "Mr. Fenn took Five three weeks ago and paid by the week, on time. Quiet. Particular about his coffee. " +
      "He could be difficult, but he was never any trouble to me.",
  },
];

// ---------------------------------------------------------------------------
// Dennis Pruett — regular, unreliable about time
// ---------------------------------------------------------------------------

const DENNIS: FactEntry[] = [
  {
    factId: "fact-dennis-gap",
    description: "Dennis admits Ray was gone closer to half an hour.",
    isPublic: false,
    unlockCondition: "clue-ray-was-away",
    triggers: [
      /\b(half an hour|thirty minutes|longer|how long|exactly|be sure|certain|sure about|clock|watch)\b/,
      /\b(ten|fifteen) minutes\b/,
      /\bonly (ten|fifteen)\b/,
    ],
    line:
      "Hm. Now you make me say it. It could've been closer to half an hour. Maybe more. " +
      "I just assumed he was down in the cellar, you know? I never thought to look at the clock.",
    // No lockedLine on purpose: until Ray's absence is established, a timing question
    // falls through to the "ray-away" topic below.
    grantsClueId: "clue-gap-contradiction",
  },
  {
    factId: "fact-dennis-ray-away",
    description: "Dennis says Ray stepped away from the bar.",
    isPublic: true,
    triggers: [
      /\b(ray|bartender)\b.*\b(away|step|stepped|leave|left|gone|cellar|all night|all evening|whole night|whole evening|there|behind the bar)\b/,
      /\b(all night|all evening|whole night|whole evening|behind the bar)\b/,
      /\bstep(ped)? away\b/,
      /\bleave the bar\b/,
    ],
    line:
      "Ray? He was here the whole night, near enough. Well, no. Now that you ask, he stepped away for a bit, " +
      "round about ten. Ten minutes, fifteen maybe. Said something about the cellar. I wasn't watching the clock.",
    grantsClueId: "clue-ray-was-away",
  },
  {
    factId: "fact-dennis-friday",
    description: "Dennis recounts Friday's argument.",
    isPublic: true,
    triggers: [/\b(friday|argue|argued|argument|row|fight|fought|quarrel|quarrelled|shout|shouted|angry)\b/],
    line:
      "Oh, that was Friday, in the dining room. Dwight Wentworth and the painter, nose to nose. " +
      "Dwight said Fenn was overstepping with his wife. Quiet, mind, the way he does it. " +
      "Fenn just smiled. Smiled! I thought Dwight might hit him.",
    grantsClueId: "clue-friday-argument",
  },
  {
    factId: "fact-dennis-carol",
    description: "Dennis on Carol leaving around 9:15.",
    isPublic: true,
    triggers: [/\b(carol|mrs\.? wentworth)\b/],
    line:
      "Mrs. Wentworth? Lovely woman. She was in around half past eight, talking low with Ray. " +
      "Left around quarter past nine, I'd say. She didn't come back, not while I was here.",
    grantsClueId: "clue-carol-left-early",
  },
  {
    factId: "fact-dennis-dwight-up",
    description: "Dennis vaguely recalls Dwight going upstairs.",
    isPublic: true,
    triggers: [
      /\b(dwight|wentworth)\b.*\b(upstairs|went up|stairs)\b/,
      /\b(upstairs|went up)\b.*\b(dwight|wentworth)\b/,
    ],
    line:
      "Dwight went up at some point. I think. Hard to say when, exactly. " +
      "Everybody's coming and going on a Saturday.",
  },
  {
    factId: "fact-dennis-dwight",
    description: "Dennis on Dwight.",
    isPublic: true,
    triggers: [/\b(dwight|wentworth)\b/],
    line:
      "Dwight Wentworth. Big man in Millhaven. Has the lumber yard. " +
      "Not a man you cross, if you take my meaning.",
  },
  {
    factId: "fact-dennis-fenn",
    description: "Dennis on Fenn.",
    isPublic: true,
    triggers: [/\b(fenn|painter|gerald)\b/],
    line:
      "Gerald Fenn? Kept to himself, mostly. Talked a good game about art when he'd had a few. " +
      "I didn't have a thing against him, God rest him.",
  },
  {
    factId: "fact-dennis-night",
    description: "Dennis's general account of the evening.",
    isPublic: true,
    triggers: [
      /\b(saturday|tonight|last night|that evening)\b/,
      /\bwhat (did you|happened)\b/,
      /\b(see|saw) anything\b/,
      /\bnotice\b/,
    ],
    line:
      "Same as any Saturday. I was on my stool, Edna was in and out, and then Edna came down the stairs " +
      "white as a sheet.",
  },
];

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const FACTS_BY_CHARACTER: Record<string, FactEntry[]> = {
  "char-ray-kowalski": RAY,
  "char-dwight-wentworth": DWIGHT,
  "char-carol-wentworth": CAROL,
  "char-edna-marsh": EDNA,
  "char-dennis-pruett": DENNIS,
};

/**
 * Safe lines for questions that match no authored topic. None of these may
 * assert a fact, a time, a name, or a clue.
 */
export const FALLBACK_LINES: Record<string, string[]> = {
  "char-ray-kowalski": [
    "I couldn't tell you anything useful on that one, Detective.",
    "You'll have to ask me something I can answer.",
    "Can't say that I know. Anything else?",
  ],
  "char-dwight-wentworth": [
    "I fail to see the relevance of that, Detective.",
    "I have nothing to add. Perhaps you would care to ask something to the point.",
    "That is not a matter I intend to discuss.",
  ],
  "char-carol-wentworth": [
    "I do not think I can help you with that, Detective.",
    "Ask me what you need to know. I will answer if I can.",
    "I do not have anything to add to that.",
  ],
  "char-edna-marsh": [
    "I've told you what I saw, Detective, and I'll not guess at the rest.",
    "That's not something I can help you with. I run an inn, not an inquiry.",
    "Ask me what I saw and I'll tell you. Ask me what I think and I'll say I don't know.",
  ],
  "char-dennis-pruett": [
    "Ah, now you've got me, Detective. I'd only be guessing.",
    "Hm. Can't say as I noticed. Ask me something else?",
    "I wish I could help you there, I really do.",
  ],
};
