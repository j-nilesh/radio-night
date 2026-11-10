/**
 * content/cases/radio-night-s01/v1/voices.ts
 * Who sounds like whom. One place, so recasting is a one-line change.
 *
 * PROVISIONAL. These are the first Deepgram Aura-2 voices that plausibly fit
 * each character, picked from the catalogue so the game can speak while the
 * real auditions happen. Known limits of this catalogue:
 *   - No New England accent exists. Every voice here is General American.
 *     Ray, Edna and Dennis are the largest compromises.
 *   - The only British voices are Draco (m) and Pandora (f); only Australian
 *     are Hyperion (m), Theia (f). None suits 1981 New Hampshire.
 * If an audition finds nothing better, the bible's accents get softened rather
 * than the cast changed.
 *
 * A voice is pinned per character. Nothing at runtime may swap it.
 */

import type { VoiceProfile } from "@providers";

function aura(characterId: string, voiceName: string): VoiceProfile {
  return {
    characterId,
    provider: "deepgram",
    model: "aura-2",
    voiceId: `aura-2-${voiceName}-en`,
    delivery: {}, // Aura exposes no pace, stability or expressiveness controls
    targetFormat: "mp3",
    fallbackPolicy: "captions_only",
  };
}

export const VOICES: Record<string, VoiceProfile> = {
  // Warm, casual, grounded; the ordinary-guy register Ray needs.
  "char-ray-kowalski": aura("char-ray-kowalski", "apollo"),
  // Baritone, knowledgeable, confident: a man who expects to be listened to.
  "char-dwight-wentworth": aura("char-dwight-wentworth", "saturn"),
  // Calm, clear, empathetic: restraint without coldness.
  "char-carol-wentworth": aura("char-carol-wentworth", "harmonia"),
  // The one "Mature" feminine voice: calm, smooth. Edna's dryness will come from the writing.
  "char-edna-marsh": aura("char-edna-marsh", "athena"),
  // "Mature", friendly, approachable: a talker who means well.
  "char-dennis-pruett": aura("char-dennis-pruett", "atlas"),
};

/** Late-night radio: calm baritone, patient, authority without arrogance. */
export const NARRATOR_VOICE: VoiceProfile = aura("char-narrator", "pluto");
