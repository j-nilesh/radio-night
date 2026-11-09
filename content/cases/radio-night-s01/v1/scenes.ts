/**
 * content/cases/radio-night-s01/v1/scenes.ts
 * Scene definitions for "The Sitting".
 * Public-safe — no truth, no spoilers.
 *
 * Presence rules decide who can be spoken to in each place. Characters whose
 * rule has a condition "arrive" once it is satisfied, and the narrator
 * announces it (arrivalLine).
 */

import type { SceneInfo } from "@ai-orchestration/case-content";

export type SceneDefinition = SceneInfo & { ambienceAssetId: string };

/** The detective has spoken with at least one of the people already at the inn. */
const ONCE_INTERVIEWED =
  "interviewed_char-edna-marsh OR interviewed_char-dennis-pruett OR interviewed_char-ray-kowalski";

export const SCENES: SceneDefinition[] = [
  {
    id: "scene-tap-room",
    name: "The Tap Room",
    ambienceAssetId: "ambience-bar-late-night",
    narratorEntryLine:
      "The Tap Room is quieter than it should be for a Saturday night. A few regulars have stayed — " +
      "curiosity or nerves, hard to say which. The bar smells of stale beer and old wood. " +
      "Ray Kowalski is behind the bar. Dennis Pruett is on the third stool from the left. " +
      "Edna Marsh, the innkeeper, stands at the far end with her arms folded, watching the stairs.",
    presence: [
      { characterId: "char-ray-kowalski" },
      { characterId: "char-dennis-pruett" },
      { characterId: "char-edna-marsh" },
      {
        characterId: "char-dwight-wentworth",
        condition: ONCE_INTERVIEWED,
        arrivalLine:
          "The street door opens on a gust of rain. Dwight Wentworth steps into the Tap Room, " +
          "shaking the water from his coat, and takes a stool as if it had been kept for him.",
      },
    ],
    clueIds: [],
    exits: ["scene-back-room", "scene-kitchen", "scene-upstairs-hall"],
  },
  {
    id: "scene-back-room",
    name: "The Back Room",
    ambienceAssetId: "ambience-small-room-quiet",
    narratorEntryLine:
      "The snug off the bar. A round table, four chairs, and a window that looks out on the alley. " +
      "This is where the inn takes private bookings and, tonight, where a detective takes statements.",
    presence: [
      {
        characterId: "char-carol-wentworth",
        condition: ONCE_INTERVIEWED,
        arrivalLine:
          "Carol Wentworth has come back to the inn. Edna sent for her, and she is waiting in the Back Room.",
      },
    ],
    clueIds: [],
    exits: ["scene-tap-room"],
  },
  {
    id: "scene-kitchen",
    name: "The Kitchen",
    ambienceAssetId: "ambience-kitchen-quiet",
    narratorEntryLine:
      "The kitchen is clean for this time of night. One lamp burning, and the sink still slightly damp. " +
      "Edna Marsh has followed you in and is wiping down the counter with the particular care " +
      "of someone who needs something to do with her hands.",
    presence: [{ characterId: "char-edna-marsh" }],
    clueIds: [],
    unlockCondition: ONCE_INTERVIEWED,
    exits: ["scene-tap-room", "scene-back-stairs"],
  },
  {
    id: "scene-back-stairs",
    name: "The Back Stairs",
    ambienceAssetId: "ambience-stairwell",
    narratorEntryLine:
      "A narrow wooden staircase running up the back of the building from the kitchen. " +
      "The steps creak. Somebody could use these without being seen from the bar.",
    presence: [],
    clueIds: [],
    unlockCondition: "visited_scene-kitchen OR visited_scene-upstairs-hall",
    exits: ["scene-kitchen", "scene-upstairs-hall"],
  },
  {
    id: "scene-upstairs-hall",
    name: "The Upstairs Hall",
    ambienceAssetId: "ambience-corridor-night",
    narratorEntryLine:
      "Six doors along a low corridor. Room 5 is at the far end, nearest the window. " +
      "The hall smells of old carpet and something else, something the rain coming through the window " +
      "isn't quite covering. A constable at the top of the stairs nods you through.",
    presence: [],
    clueIds: ["clue-back-stairs"],
    exits: ["scene-tap-room", "scene-back-stairs", "scene-room-5"],
  },
  {
    id: "scene-room-5",
    name: "Room 5",
    ambienceAssetId: "ambience-crime-scene-quiet",
    narratorEntryLine:
      "Room 5. The bed has been slept in, but not for tonight. A suitcase sits open on the chair, " +
      "half packed or half unpacked; hard to say. On the side table: a glass, a lamp still burning, " +
      "and a glass ashtray that has been moved recently. You can tell by the ring it left on the wood. " +
      "Gerald Fenn is on the floor near the window. He didn't fall there. Someone put him there, " +
      "or he tried to crawl.",
    presence: [],
    clueIds: ["clue-ashtray", "clue-whiskey-glass", "clue-note-under-bed"],
    exits: ["scene-upstairs-hall"],
  },
];
