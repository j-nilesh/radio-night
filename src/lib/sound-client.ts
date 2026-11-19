/**
 * lib/sound-client.ts
 * The browser's ambience and sound-effect player for the current case.
 * Created on first use, after the player's first click has unlocked audio.
 */

import { CuePlayer, type CueDef } from "@audio-client";
import { getMixer } from "./mixer-client";
import { track } from "./telemetry-client";
import {
  AUDIO_ASSETS,
  AUDIO_BASE_URL,
  SCENE_AMBIENCE,
  CLUE_STING,
  TRAVEL_SFX,
  ACCUSE_STING,
  ENDING_STING,
  MUSIC,
  THEME_SECONDS,
} from "../../content/cases/radio-night-s01/v1/cues";

export { CLUE_STING, TRAVEL_SFX, ACCUSE_STING, ENDING_STING, MUSIC, THEME_SECONDS };

let player: CuePlayer<AudioBuffer> | null = null;

export function getCuePlayer(): CuePlayer<AudioBuffer> {
  if (!player) {
    const defs: CueDef[] = AUDIO_ASSETS.map((a) => ({
      id: a.id,
      file: a.file,
      kind: a.kind,
      bus: a.bus,
      gain: a.gain,
      fadeInSec: a.fadeInSec,
      fadeOutSec: a.fadeOutSec,
      loop: a.loop,
    }));
    player = new CuePlayer<AudioBuffer>(getMixer(), defs, {
      baseUrl: AUDIO_BASE_URL,
      observe: (event, data) => track(event, data),
    });
    player.preload([...Object.values(SCENE_AMBIENCE), MUSIC.theme, MUSIC.investigation]);
  }
  return player;
}

/** The ambience cue for a scene, or null for silence. */
export function ambienceFor(sceneId: string): string | null {
  return SCENE_AMBIENCE[sceneId] ?? null;
}
