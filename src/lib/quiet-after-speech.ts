/**
 * lib/quiet-after-speech.ts
 * Notices that a player has stopped talking, so the talk button can say
 * "Done? Tap to send". It never sends anything: the player always taps.
 *
 * Feed it one level reading (RMS, 0..1) per animation frame with a timestamp.
 * It reports quiet only after speech has been heard and the level has stayed
 * below the speech threshold for QUIET_AFTER_SPEECH_MS.
 */
/** RMS level above which a frame counts as speech. Matches the meter's "voiced" threshold. */
export const SPEECH_RMS = 0.02;
/** How long the level must stay under SPEECH_RMS, after speech, to count as finished. */
export const QUIET_AFTER_SPEECH_MS = 1500;

export type QuietDetector = {
  /** Record a reading; returns true while the player seems to have finished. */
  push: (rms: number, nowMs: number) => boolean;
  reset: () => void;
};

export function createQuietDetector(
  quietMs: number = QUIET_AFTER_SPEECH_MS,
  threshold: number = SPEECH_RMS,
): QuietDetector {
  let heardSpeech = false;
  let quietSince: number | null = null;
  return {
    push(rms, nowMs) {
      if (rms > threshold) {
        heardSpeech = true;
        quietSince = null;
        return false;
      }
      if (!heardSpeech) return false;
      if (quietSince === null) quietSince = nowMs;
      return nowMs - quietSince >= quietMs;
    },
    reset() {
      heardSpeech = false;
      quietSince = null;
    },
  };
}
