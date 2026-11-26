/**
 * lib/audio-session.ts
 * Tells iPhone Safari what the page is doing with sound.
 *
 * After a page uses the microphone, iOS keeps the audio session in a voice-call
 * mode: everything the page plays comes out much quieter (and can be routed to
 * the earpiece) until the session goes back to playback. A player who speaks a
 * question would then hear every reply at a fraction of the narrator's volume,
 * which was played before the microphone was ever used.
 *
 * Safari 16.4 and later expose navigator.audioSession for this. Other browsers
 * do not have it, and nothing here does anything for them.
 */
export type AudioSessionType = "playback" | "play-and-record";

type AudioSessionLike = { type: string };

/** Set the session type if the browser supports it. Never throws. Returns whether it was set. */
export function setAudioSession(type: AudioSessionType): boolean {
  try {
    const session = (typeof navigator !== "undefined" ? (navigator as Navigator & { audioSession?: AudioSessionLike }).audioSession : undefined);
    if (!session) return false;
    if (session.type !== type) session.type = type;
    return true;
  } catch {
    return false;
  }
}
