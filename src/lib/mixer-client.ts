/**
 * lib/mixer-client.ts
 * Client-side re-export of the AudioMixer singleton.
 * This is a thin wrapper so the room page can lazy-import the mixer
 * without creating a direct dependency on the Web Audio API at module load time.
 */

export { getMixer } from "@audio-client";
export type { Clip, ClipObserver } from "@audio-client";
