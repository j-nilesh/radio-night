/**
 * scripts/audition/casting.ts
 * Who to audition for each part. DEVELOPMENT-ONLY.
 *
 * A candidate is a (provider, voice) pair. The listening page hides which is
 * which, and the scorer reveals it afterwards. Add candidates here as keys for
 * other providers arrive; a provider with no key is skipped, not an error.
 *
 * Voice picks come from each provider's own catalogue descriptions (age,
 * register, character). General American is acceptable, but nothing that
 * sounds urban or obviously Californian.
 */

export type ProviderName = "deepgram" | "elevenlabs" | "cartesia" | "fish";

export type Candidate = {
  provider: ProviderName;
  /** Provider's own voice name or id */
  voice: string;
  /** Provider model, where it matters (changes how the voice sounds and how fast it answers) */
  model?: string;
  /** Rounds this candidate is in. Omit for every round. Current-cast voices stay in as the yardstick. */
  rounds?: number[];
  /** Why it was shortlisted (shown only after scoring) */
  note?: string;
};

export type CastingEntry = {
  characterId: string;
  /** What to listen for, in plain words (shown on the listening page) */
  want: string;
  candidates: Candidate[];
};

/**
 * Rough price per 1,000 characters in US dollars, used only to rank cost and
 * to warn before a large run. These are estimates: check each provider's
 * pricing page before relying on them.
 */
export const COST_PER_1K_CHARS: Partial<Record<ProviderName, number>> = {
  deepgram: 0.03,
};

export const CASTING: CastingEntry[] = [
  {
    characterId: "char-ray-kowalski",
    want:
      "A decent, tired man who tends bar in a small New Hampshire town and is holding something back. Warm and unhurried, short sentences, grounded working-class register. Should sound like he is thinking before he answers. Not urban, not Californian.",
    candidates: [
      { provider: "deepgram", voice: "apollo", note: "current cast: confident, comfortable, casual", rounds: [1, 2] },
      { provider: "deepgram", voice: "arcas", note: "natural, smooth, clear", rounds: [1] },
      { provider: "deepgram", voice: "aries", note: "warm, caring", rounds: [1] },
      { provider: "deepgram", voice: "mars", note: "smooth, patient, baritone", rounds: [1] },
      { provider: "cartesia", voice: "c961b81c-a935-4c17-bfb3-ba2239de8c2f", model: "sonic-3.6", note: "Kyle: warm, conversational, approachable friend", rounds: [2] },
      { provider: "cartesia", voice: "bbee10a8-4f08-4c5c-8282-e69299115055", model: "sonic-3.6", note: "Ben: slightly raspy middle-aged man", rounds: [2] },
      { provider: "elevenlabs", voice: "iP95p4xoKVk53GoZ742B", model: "eleven_flash_v2_5", note: "Chris (premade): charming, down-to-earth, casual", rounds: [2] },
      { provider: "elevenlabs", voice: "CwhRBWXzGAHq8TQ4Fs17", model: "eleven_flash_v2_5", note: "Roger (premade): laid-back, casual, resonant", rounds: [2] },
    ],
  },
  {
    characterId: "char-dwight-wentworth",
    want:
      "A wealthy local businessman who expects to be listened to. Clipped, formal, status-conscious. Anger comes out as cold politeness, never volume. Should sound older and more controlled than Ray.",
    candidates: [
      { provider: "deepgram", voice: "saturn", note: "current cast: knowledgeable, confident, baritone", rounds: [1, 2] },
      { provider: "deepgram", voice: "jupiter", note: "expressive, knowledgeable, baritone", rounds: [1] },
      { provider: "deepgram", voice: "zeus", note: "deep, trustworthy, smooth", rounds: [1] },
      { provider: "deepgram", voice: "orpheus", note: "professional, clear, confident", rounds: [1] },
      { provider: "cartesia", voice: "68fb6747-b6ea-4c44-a18e-4e29921424d3", model: "sonic-3.6", note: "Derek: low-register, grounded, authoritative", rounds: [2] },
      { provider: "cartesia", voice: "533b2990-5b82-45a4-b9f2-367776972ca6", model: "sonic-3.6", note: "Reed: steady, polished", rounds: [2] },
      { provider: "elevenlabs", voice: "pNInz6obpgDQGcFmaJgB", model: "eleven_flash_v2_5", note: "Adam (premade): dominant, firm", rounds: [2] },
      { provider: "elevenlabs", voice: "cjVigY5qzO86Huf0OWal", model: "eleven_flash_v2_5", note: "Eric (premade): smooth, trustworthy", rounds: [2] },
    ],
  },
  {
    characterId: "char-carol-wentworth",
    want:
      "A woman in a controlling marriage who is quietly planning to leave. Precise, restrained, economical. Calm on the surface with something held underneath. Must never sound flat or robotic, even on short answers.",
    candidates: [
      { provider: "deepgram", voice: "harmonia", note: "current cast: empathetic, clear, calm", rounds: [1, 2] },
      { provider: "deepgram", voice: "vesta", note: "natural, patient, empathetic", rounds: [1] },
      { provider: "deepgram", voice: "hera", note: "smooth, warm", rounds: [1] },
      { provider: "deepgram", voice: "cora", note: "smooth, melodic, caring", rounds: [1] },
      { provider: "cartesia", voice: "f3c7d5d2-c1e1-41a0-bd88-8b5512be5335", model: "sonic-3.6", note: "Whitney: calm, even, composed, warm authority", rounds: [2] },
      { provider: "cartesia", voice: "26403c37-80c1-4a1a-8692-540551ca2ae5", model: "sonic-3.6", note: "Marian: matured, calm, smooth pacing", rounds: [2] },
      { provider: "elevenlabs", voice: "KoVIHoyLDrQyd4pGalbs", model: "eleven_flash_v2_5", note: "Autumn Veil (library): warm and reflective, calm", rounds: [2] },
      { provider: "elevenlabs", voice: "XW70ikSsadUbinwLMZ5w", model: "eleven_flash_v2_5", note: "Annie K (library): grounded narrator, steady and clear", rounds: [2] },
    ],
  },
  {
    characterId: "char-edna-marsh",
    want:
      "The older owner of the inn. Dry, matter-of-fact, slightly impatient with sloppy questions. Rural New England, a long working life behind her. Should sound mature, not young and bright.",
    candidates: [
      { provider: "deepgram", voice: "athena", note: "current cast: the one mature feminine voice", rounds: [1, 2] },
      { provider: "deepgram", voice: "helena", note: "caring, natural, raspy", rounds: [1] },
      { provider: "deepgram", voice: "minerva", note: "positive, friendly, natural", rounds: [1] },
      { provider: "deepgram", voice: "electra", note: "professional, engaging, knowledgeable", rounds: [1] },
      { provider: "cartesia", voice: "489b647b-5662-408f-8c95-82e26ef8d29e", model: "sonic-3.6", note: "Kate: direct, no-nonsense", rounds: [2] },
      { provider: "cartesia", voice: "a2364c9d-1fe3-4553-9eff-100c4fe5ffc8", model: "sonic-3.6", note: "Marge: wise matured voice, expressive warmth", rounds: [2] },
      { provider: "elevenlabs", voice: "8fwYhwfiWkLjR4FKLHSQ", model: "eleven_flash_v2_5", note: "Elise Hart (library): older, warm, intelligent", rounds: [2] },
      { provider: "elevenlabs", voice: "aIu5oHglU5AHNc2x0AZu", model: "eleven_flash_v2_5", note: "Jane Hackett (library): older, confident, conversational", rounds: [2] },
    ],
  },
  {
    characterId: "char-dennis-pruett",
    want:
      "A retired mill foreman who is a regular at the bar. Friendly, talkative, a little unreliable about times, trails off and corrects himself. Should sound older and looser than Ray.",
    candidates: [
      { provider: "deepgram", voice: "atlas", note: "current cast: mature, friendly, approachable", rounds: [1, 2] },
      { provider: "deepgram", voice: "arcas", note: "natural, comfortable", rounds: [1] },
      { provider: "deepgram", voice: "orion", note: "approachable, calm, polite", rounds: [1] },
      { provider: "deepgram", voice: "odysseus", note: "calm, smooth, comfortable", rounds: [1] },
      { provider: "cartesia", voice: "fbf7d2ec-ebea-49f2-8889-a482b9b0a7ed", model: "sonic-3.6", note: "Wade 2.0: warm, unhurried, storytelling host", rounds: [2] },
      { provider: "cartesia", voice: "db69127a-dbaf-4fa9-b425-2fe67680c348", model: "sonic-3.6", note: "Clint: raspy, rugged", rounds: [2] },
      { provider: "elevenlabs", voice: "pqHfZKP75CvOlQylNhV4", model: "eleven_flash_v2_5", note: "Bill (premade): wise, mature, older", rounds: [2] },
      { provider: "elevenlabs", voice: "N2lVS1w4EtoT3dr4eOWO", model: "eleven_flash_v2_5", note: "Callum (premade): husky, a character voice", rounds: [2] },
    ],
  },
  {
    characterId: "char-narrator",
    want:
      "The voice of the broadcast: calm, evocative, late-night public radio. Authority without arrogance, warm but not intimate. Has to carry long passages without tiring the ear.",
    candidates: [
      { provider: "deepgram", voice: "pluto", note: "current cast: smooth, calm, empathetic, baritone", rounds: [1, 2] },
      { provider: "deepgram", voice: "mars", note: "smooth, patient, trustworthy", rounds: [1] },
      { provider: "deepgram", voice: "odysseus", note: "calm, smooth, professional", rounds: [1] },
      { provider: "deepgram", voice: "orpheus", note: "professional, clear, trustworthy", rounds: [1] },
      { provider: "cartesia", voice: "9fb269e7-70fe-4cbe-aa3f-28bdb67e3e84", model: "sonic-3.6", note: "Steve Baritone: deep, firm, for narration", rounds: [2] },
      { provider: "cartesia", voice: "4703c250-66e4-4682-a223-0a60acafcfc0", model: "sonic-3.6", note: "Levi: strong, confident, newscasting", rounds: [2] },
      { provider: "elevenlabs", voice: "nPczCjzI2devNBz1zQrb", model: "eleven_flash_v2_5", note: "Brian (premade): deep, resonant, comforting", rounds: [2] },
      { provider: "elevenlabs", voice: "ppLqTilh7rH7fbUVlXsf", model: "eleven_flash_v2_5", note: "David (library): deep, authoritative, documentary", rounds: [2] },
    ],
  },
];
