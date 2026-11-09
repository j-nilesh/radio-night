/**
 * content/cases/radio-night-s01/v1/scenes.ts
 * Scene definitions for "The Sitting".
 * Public-safe — no truth, no spoilers.
 */

/**
 * Scene identifiers are authored as plain strings in content files.
 * The engine brands them to SceneId at load time.
 */
export type SceneDefinition = {
  id: string;
  name: string;
  ambienceAssetId: string;
  narratorEntryLine: string;
  availableCharacterIds: string[];
  availableClueIds: string[];
  unlockCondition?: string;
  exits: string[];
};

export const SCENES: SceneDefinition[] = [
  {
    id: "scene-tap-room",
    name: "The Tap Room",
    ambienceAssetId: "ambience-bar-late-night",
    narratorEntryLine:
      "The Tap Room is quieter than it should be for a Saturday night. A few regulars have stayed — " +
      "curiosity or nerves, hard to say which. The bar still smells of stale beer and old wood. " +
      "Ray Kowalski is behind the bar. Dennis Pruett is on the third stool from the left.",
    availableCharacterIds: ["char-ray-kowalski", "char-dennis-pruett"],
    availableClueIds: [],
    exits: ["scene-back-room", "scene-kitchen", "scene-upstairs-hall"],
  },
  {
    id: "scene-back-room",
    name: "The Back Room",
    ambienceAssetId: "ambience-small-room-quiet",
    narratorEntryLine:
      "The snug off the bar. A round table, four chairs, and a window that looks out on the alley. " +
      "This is where the inn takes private bookings and, apparently, where detectives conduct interviews.",
    availableCharacterIds: [], // populated dynamically when a character is brought here
    availableClueIds: [],
    exits: ["scene-tap-room"],
  },
  {
    id: "scene-kitchen",
    name: "The Kitchen",
    ambienceAssetId: "ambience-kitchen-quiet",
    narratorEntryLine:
      "The kitchen is clean for this time of night. One lamp burning. " +
      "The sink is still slightly damp. Edna Marsh is wiping down the counter " +
      "with the particular care of someone who needs something to do with her hands.",
    availableCharacterIds: ["char-edna-marsh"],
    availableClueIds: ["clue-back-stairs"],
    unlockCondition: "interviewed_char-edna-marsh OR interviewed_char-ray-kowalski",
    exits: ["scene-tap-room", "scene-back-stairs"],
  },
  {
    id: "scene-back-stairs",
    name: "The Back Stairs",
    ambienceAssetId: "ambience-stairwell",
    narratorEntryLine:
      "A narrow wooden staircase running up the back of the building from the kitchen. " +
      "The steps creak. Someone could use these without being seen from the bar.",
    availableCharacterIds: [],
    availableClueIds: ["clue-back-stairs-access"],
    unlockCondition: "visited_scene-kitchen OR visited_scene-upstairs-hall",
    exits: ["scene-kitchen", "scene-upstairs-hall"],
  },
  {
    id: "scene-upstairs-hall",
    name: "The Upstairs Hall",
    ambienceAssetId: "ambience-corridor-night",
    narratorEntryLine:
      "Six doors along a low corridor. Room 5 is at the far end, nearest the window. " +
      "The hall smells of old carpet and something else — something the rain coming through the window " +
      "isn't quite covering.",
    availableCharacterIds: [],
    availableClueIds: [],
    unlockCondition: "interviewed_char-edna-marsh",
    exits: ["scene-tap-room", "scene-back-stairs", "scene-room-5"],
  },
  {
    id: "scene-room-5",
    name: "Room 5",
    ambienceAssetId: "ambience-crime-scene-quiet",
    narratorEntryLine:
      "Room 5. The bed's been slept in but not for tonight. A suitcase sits open on the chair — " +
      "half packed, or half unpacked; hard to say. On the side table: a glass, a lamp still burning, " +
      "and a glass ashtray that's been moved recently. You can tell because of the ring it left on the wood. " +
      "Gerald Fenn is on the floor near the window. He didn't fall there.",
    availableCharacterIds: [],
    availableClueIds: [
      "clue-ashtray",
      "clue-whiskey-glass",
      "clue-note-under-bed",
    ],
    exits: ["scene-upstairs-hall"],
  },
];
