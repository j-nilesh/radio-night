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
      { provider: "deepgram", voice: "apollo", note: "current cast: confident, comfortable, casual" },
      { provider: "deepgram", voice: "arcas", note: "natural, smooth, clear" },
      { provider: "deepgram", voice: "aries", note: "warm, caring" },
      { provider: "deepgram", voice: "mars", note: "smooth, patient, baritone" },
    ],
  },
  {
    characterId: "char-dwight-wentworth",
    want:
      "A wealthy local businessman who expects to be listened to. Clipped, formal, status-conscious. Anger comes out as cold politeness, never volume. Should sound older and more controlled than Ray.",
    candidates: [
      { provider: "deepgram", voice: "saturn", note: "current cast: knowledgeable, confident, baritone" },
      { provider: "deepgram", voice: "jupiter", note: "expressive, knowledgeable, baritone" },
      { provider: "deepgram", voice: "zeus", note: "deep, trustworthy, smooth" },
      { provider: "deepgram", voice: "orpheus", note: "professional, clear, confident" },
    ],
  },
  {
    characterId: "char-carol-wentworth",
    want:
      "A woman in a controlling marriage who is quietly planning to leave. Precise, restrained, economical. Calm on the surface with something held underneath. Must never sound flat or robotic, even on short answers.",
    candidates: [
      { provider: "deepgram", voice: "harmonia", note: "current cast: empathetic, clear, calm" },
      { provider: "deepgram", voice: "vesta", note: "natural, patient, empathetic" },
      { provider: "deepgram", voice: "hera", note: "smooth, warm" },
      { provider: "deepgram", voice: "cora", note: "smooth, melodic, caring" },
    ],
  },
  {
    characterId: "char-edna-marsh",
    want:
      "The older owner of the inn. Dry, matter-of-fact, slightly impatient with sloppy questions. Rural New England, a long working life behind her. Should sound mature, not young and bright.",
    candidates: [
      { provider: "deepgram", voice: "athena", note: "current cast: the one mature feminine voice" },
      { provider: "deepgram", voice: "helena", note: "caring, natural, raspy" },
      { provider: "deepgram", voice: "minerva", note: "positive, friendly, natural" },
      { provider: "deepgram", voice: "electra", note: "professional, engaging, knowledgeable" },
    ],
  },
  {
    characterId: "char-dennis-pruett",
    want:
      "A retired mill foreman who is a regular at the bar. Friendly, talkative, a little unreliable about times, trails off and corrects himself. Should sound older and looser than Ray.",
    candidates: [
      { provider: "deepgram", voice: "atlas", note: "current cast: mature, friendly, approachable" },
      { provider: "deepgram", voice: "arcas", note: "natural, comfortable" },
      { provider: "deepgram", voice: "orion", note: "approachable, calm, polite" },
      { provider: "deepgram", voice: "odysseus", note: "calm, smooth, comfortable" },
    ],
  },
  {
    characterId: "char-narrator",
    want:
      "The voice of the broadcast: calm, evocative, late-night public radio. Authority without arrogance, warm but not intimate. Has to carry long passages without tiring the ear.",
    candidates: [
      { provider: "deepgram", voice: "pluto", note: "current cast: smooth, calm, empathetic, baritone" },
      { provider: "deepgram", voice: "mars", note: "smooth, patient, trustworthy" },
      { provider: "deepgram", voice: "odysseus", note: "calm, smooth, professional" },
      { provider: "deepgram", voice: "orpheus", note: "professional, clear, trustworthy" },
    ],
  },
];
