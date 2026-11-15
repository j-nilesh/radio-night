/**
 * content/cases/radio-night-s01/v1/voices.ts
 * Who sounds like whom. One place, so recasting is a one-line change.
 *
 * LOCKED by the blind audition, step 2 (docs/voice-auditions.md, ADR 0011). Each
 * voice won a Yes from the listener over the other candidates for that part.
 * The cast uses three providers, so each voice is pinned to its provider; the
 * runtime refuses to speak a voice through any other one and never swaps a
 * voice silently. If a provider's key is missing, that character is captions-only.
 *
 * Known limit: no catalogue has a New England accent. Every voice is General
 * American, so Ray, Edna and Dennis are the largest compromises.
 *
 * Licences: the audition ran on free plans, which are for listening only. The
 * shipped game needs plans that allow public, commercial use (see the licence
 * table in docs/voice-auditions.md).
 */
import type { VoiceProfile } from "@providers";

const noDelivery = {}; // none of the cast uses pace, stability or expressiveness settings

function aura(characterId: string, voiceName: string): VoiceProfile {
  return {
    characterId,
    provider: "deepgram",
    model: "aura-2",
    voiceId: `aura-2-${voiceName}-en`,
    delivery: noDelivery,
    targetFormat: "pcm16",
    fallbackPolicy: "captions_only",
  };
}

function cartesia(characterId: string, voiceId: string): VoiceProfile {
  return {
    characterId,
    provider: "cartesia",
    model: "sonic-3.6",
    voiceId,
    delivery: noDelivery,
    targetFormat: "pcm16",
    fallbackPolicy: "captions_only",
  };
}

function elevenlabs(characterId: string, voiceId: string): VoiceProfile {
  return {
    characterId,
    provider: "elevenlabs",
    model: "eleven_flash_v2_5",
    voiceId,
    delivery: noDelivery,
    targetFormat: "pcm16",
    fallbackPolicy: "captions_only",
  };
}

export const VOICES: Record<string, VoiceProfile> = {
  // Deepgram Aura-2 "aries".
  "char-ray-kowalski": aura("char-ray-kowalski", "aries"),
  // Cartesia "Reed": steady, polished.
  "char-dwight-wentworth": cartesia("char-dwight-wentworth", "533b2990-5b82-45a4-b9f2-367776972ca6"),
  // Cartesia "Marian": matured, calm, smooth pacing.
  "char-carol-wentworth": cartesia("char-carol-wentworth", "26403c37-80c1-4a1a-8692-540551ca2ae5"),
  // ElevenLabs "Jane Hackett" (library): older, confident, conversational.
  "char-edna-marsh": elevenlabs("char-edna-marsh", "aIu5oHglU5AHNc2x0AZu"),
  // ElevenLabs "Bill" (premade): wise, mature, older.
  "char-dennis-pruett": elevenlabs("char-dennis-pruett", "pqHfZKP75CvOlQylNhV4"),
};

/** ElevenLabs "Brian" (premade): deep, resonant, comforting. Late-night radio narrator. */
export const NARRATOR_VOICE: VoiceProfile = elevenlabs("char-narrator", "nPczCjzI2devNBz1zQrb");
