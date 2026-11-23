/**
 * lib/mic-check.ts
 * Decides whether a recording is worth sending to speech recognition.
 *
 * A muted microphone produces a perfectly valid, perfectly silent recording.
 * Uploading it costs a round trip and a speech-recognition call and returns
 * only "I didn't catch that", which tells the player nothing. Checking the
 * level in the browser lets us say what is actually wrong, immediately.
 *
 * The thresholds are first guesses; the playtest telemetry records every
 * recording's levels so they can be tuned from real data.
 */

/** RMS level (0..1) below which a whole recording counts as silence. */
export const SILENCE_PEAK_RMS = 0.012;
/** Recordings shorter than this are almost always an accidental double tap. */
export const MIN_RECORDING_MS = 350;

export type RecordingStats = {
  durationMs: number;
  /** Highest short-term RMS level seen during the recording, 0..1 */
  peakRms: number;
  /** True if the browser reports the microphone track as muted by the system */
  trackMuted: boolean;
  /**
   * True only if the level meter was actually running (some browsers keep an
   * audio context suspended). If it was not, silence proves nothing and the
   * recording is sent anyway rather than wrongly blaming the microphone.
   */
  levelsMeasured: boolean;
};

export type RecordingVerdict =
  | { ok: true }
  | { ok: false; reason: "muted" | "silent" | "too-short"; message: string };

export function assessRecording(stats: RecordingStats): RecordingVerdict {
  if (stats.trackMuted) {
    return {
      ok: false,
      reason: "muted",
      message:
        "Your microphone seems to be muted. Unmute it (check the system input settings and any mute button), then try again, or type your question.",
    };
  }
  if (stats.durationMs < MIN_RECORDING_MS) {
    return {
      ok: false,
      reason: "too-short",
      message: "That was too short to hear. Tap the button, say your question, then tap it again to send.",
    };
  }
  if (stats.levelsMeasured && stats.peakRms < SILENCE_PEAK_RMS) {
    return {
      ok: false,
      reason: "silent",
      message:
        "I can't hear anything from your microphone. It may be muted, or the wrong input may be selected. Check it, then try again, or type your question.",
    };
  }
  return { ok: true };
}
