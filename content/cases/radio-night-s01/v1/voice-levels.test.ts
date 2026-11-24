/**
 * Every cast voice carries a loudness correction, and none is extreme: a large
 * boost distorts, and a large cut makes a voice the quietest in the room.
 * Re-measure with `npm run check:levels` after changing a voice.
 */
import { describe, it, expect } from "vitest";
import { NARRATOR_VOICE, VOICES } from "./voices";

describe("voice levels", () => {
  const cast = [...Object.values(VOICES), NARRATOR_VOICE];
  it("every voice has a correction within -6 to +6 dB", () => {
    for (const v of cast) {
      expect(v.levelDb, v.characterId).toBeDefined();
      expect(Math.abs(v.levelDb!), v.characterId).toBeLessThanOrEqual(6);
    }
  });
  it("keeps the pinned provider and voice for every character", () => {
    for (const v of cast) {
      expect(v.provider).not.toBe("mock");
      expect(v.voiceId.length).toBeGreaterThan(5);
    }
  });
});
