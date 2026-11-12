/**
 * scripts/audition/sounds.ts
 * The sounds to audition and the prompts that make the candidates.
 * DEVELOPMENT-ONLY.
 *
 * Every description uses only places and events the mystery bible already
 * establishes (a small New Hampshire inn on a rainy October night in 1981, a
 * bar with a television over it, a kitchen, a narrow back staircase, an upstairs
 * hall, Room 5). Nothing here invents story.
 *
 * Each cue gets our current synthetic placeholder as a baseline (so there is
 * always something to beat) plus one candidate per prompt below. When a prompt
 * wins, it is run again after the paid plan is in place, so the final file is
 * generated under a commercial licence.
 */

export type SoundCue = {
  id: string;
  kind: "ambience" | "sting" | "sfx";
  name: string;
  /** What the listener should judge it against */
  want: string;
  seconds: number;
  loop: boolean;
  /** Placeholder file in public/audio/radio-night-s01, used as the baseline */
  baseline: string;
  prompts: string[];
};

export const SOUND_CUES: SoundCue[] = [
  {
    id: "amb-tap-room",
    kind: "ambience",
    name: "The Tap Room",
    want: "The bar of a small New Hampshire inn on a rainy Saturday night in 1981: a handful of regulars, a television over the bar. It sits under speech all evening, so it must be easy to ignore and never tiring.",
    seconds: 12,
    loop: true,
    baseline: "amb-tap-room.wav",
    prompts: [
      "Quiet bar room ambience, a few people murmuring low, a television faintly playing above the bar, glasses clinking now and then, rain against the windows, small-town inn in 1981",
      "Muffled tavern room tone at night, low indistinct conversation of three or four people, old wood room, steady rain outside, a TV set humming softly, no music",
      "Late night in a small-town bar, very low murmur of a few patrons, ice and glass sounds, distant television, rain on the roof, intimate and tense, no music",
    ],
  },
  {
    id: "amb-back-room",
    kind: "ambience",
    name: "The Back Room",
    want: "A small snug off the bar where private conversations happen. Closer and quieter than the bar: you can just hear the bar through the wall.",
    seconds: 12,
    loop: true,
    baseline: "amb-back-room.wav",
    prompts: [
      "Small quiet room next to a bar, muffled bar chatter through a wall, soft rain at a window, close and private, low room tone",
      "Intimate snug at an old inn, faint murmur of a bar next door, a clock ticking softly, rain outside, hushed",
      "Close quiet room with distant bar noise through a closed door, steady light rain, warm low hum, no music",
    ],
  },
  {
    id: "amb-kitchen",
    kind: "ambience",
    name: "The Kitchen",
    want: "The inn's kitchen late at night. Plain and working: nothing dramatic, a place where someone might wash their hands.",
    seconds: 12,
    loop: true,
    baseline: "amb-kitchen.wav",
    prompts: [
      "Inn kitchen at night, refrigerator humming, a tap dripping into a metal sink, faint rain outside, bar noise muffled through a swing door",
      "Quiet commercial kitchen late at night, low fridge compressor hum, occasional water drip, distant muffled bar, rain on a window",
      "Empty restaurant kitchen after hours, steady appliance hum, dripping tap, faint rain, very quiet",
    ],
  },
  {
    id: "amb-back-stairs",
    kind: "ambience",
    name: "The Back Stairs",
    want: "A narrow wooden staircase from the kitchen up to the hall. Dim and close; the building itself.",
    seconds: 12,
    loop: true,
    baseline: "amb-back-stairs.wav",
    prompts: [
      "Narrow old wooden staircase in a house at night, faint creaks of settling wood, rain outside, kitchen hum far below, close and dim",
      "Enclosed stairwell in an old inn, low draught, wood groans softly, distant muffled bar noise below, light rain",
      "Dark back staircase, quiet, old timbers creaking now and then, rain against a small window, tense",
    ],
  },
  {
    id: "amb-upstairs-hall",
    kind: "ambience",
    name: "The Upstairs Hall",
    want: "The hallway of six guest rooms, with a constable at the top of the stairs. Hushed and watchful.",
    seconds: 12,
    loop: true,
    baseline: "amb-upstairs-hall.wav",
    prompts: [
      "Quiet upstairs hallway of an old inn at night, a clock ticking, floorboards settling, rain outside, bar noise faint from far below",
      "Still corridor with guest rooms, soft ticking clock, old building creaks, light rain on windows, muffled voices from downstairs",
      "Hushed hotel hallway late at night, wall clock ticking, distant murmur from below, rain, tense stillness, no music",
    ],
  },
  {
    id: "amb-room-5",
    kind: "ambience",
    name: "Room 5",
    want: "The guest room where the body was found. Near silence, with unease; it should not tell the player anything, only make them lean in.",
    seconds: 12,
    loop: true,
    baseline: "amb-room-5.wav",
    prompts: [
      "A small guest room at night, near silence, rain on the window, very faint murmur from a bar far below, tense and still",
      "Quiet bedroom in an old inn, steady rain against glass, faint building creaks, muffled sounds from downstairs, uneasy",
      "Hushed room after something terrible happened, low rain on a window, distant muffled voices, an old radiator ticking, no music",
    ],
  },
  {
    id: "sting-clue",
    kind: "sting",
    name: "Clue chime",
    want: "Plays when something goes into the casebook. Short, soft, satisfying; must never startle, and will be heard often.",
    seconds: 2.5,
    loop: false,
    baseline: "sting-clue.wav",
    prompts: [
      "A single soft bell tone, gentle discovery chime, short decay, subtle, noir detective mood",
      "Two soft glass chime notes, delicate, quiet, a small moment of realisation",
      "A gentle piano note with a short soft bell overtone, understated, mysterious",
    ],
  },
  {
    id: "sfx-door",
    kind: "sfx",
    name: "Moving between rooms",
    want: "Plays when the detective walks to another room. Quick, physical, unobtrusive; old wood floors and a door.",
    seconds: 3,
    loop: false,
    baseline: "sfx-door.wav",
    prompts: [
      "An old wooden door opening and closing, two soft footsteps on wooden floorboards, 1980s inn",
      "Footsteps crossing a creaky wooden floor and a latch clicking on a door, quiet, close",
      "A heavy wooden door closing softly behind someone walking away on old floorboards",
    ],
  },
  {
    id: "sting-accuse",
    kind: "sting",
    name: "The accusation",
    want: "The moment the detective names someone. Tension, weight, no melody: a held breath.",
    seconds: 5,
    loop: false,
    baseline: "sting-accuse.wav",
    prompts: [
      "A low tense swell, deep drone rising slowly then holding, noir drama, no melody, suspense",
      "Slow rising dread, low strings and a distant timpani roll, dramatic hold, radio drama style",
      "A single deep cello note swelling with quiet tension, then a pause, minimal",
    ],
  },
  {
    id: "sting-ending-solved",
    kind: "sting",
    name: "Ending: solved",
    want: "Under the narration when the case is solved. Resolution and relief after tension; quiet and warm, not triumphant.",
    seconds: 8,
    loop: false,
    baseline: "sting-ending-solved.wav",
    prompts: [
      "A quiet resolving musical swell, warm strings and soft piano, relief after tension, 1940s radio drama style, fading out",
      "Gentle major chord progression on strings, calm and conclusive, softly fading, noir detective ending",
      "Soft piano and low strings resolving, a sense of quiet closure, subtle, vintage radio drama",
    ],
  },
  {
    id: "sting-ending-closed",
    kind: "sting",
    name: "Ending: case closed, loose ends",
    want: "Under the narration when the case closes without a satisfying answer. Somber and unresolved; an ache, not a punishment.",
    seconds: 8,
    loop: false,
    baseline: "sting-ending-closed.wav",
    prompts: [
      "A somber unresolved swell, low strings in a minor key, melancholic, slowly fading, radio drama",
      "Slow minor-key piano and cello, wistful and unsettled, fading to silence, noir ending",
      "Muted low strings holding an unresolved chord, quiet sadness, vintage radio drama closing",
    ],
  },
];

/** Rough credits per second of generated sound, from one measured 2-second request (11 credits). Used only to warn before a run. */
export const ESTIMATED_CREDITS_PER_SECOND = 6;
