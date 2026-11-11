/**
 * Which sounds play when, for "The Sitting". Public data: nothing here names
 * the killer or reveals the solution, so the browser may import it.
 * (It must stay free of any import from truth.ts.)
 */
import manifest from "./audio-manifest.json";

export type AssetEntry = {
  id: string;
  file: string;
  kind: "ambience" | "music" | "sting" | "sfx";
  bus: "dialogue" | "music" | "fx";
  gain: number;
  fadeInSec?: number;
  fadeOutSec?: number;
  status: string;
  source: string;
  license: string;
  notes?: string;
};

export const AUDIO_BASE_URL: string = manifest.baseUrl;
export const AUDIO_ASSETS = manifest.assets as AssetEntry[];

/** The ambience under each scene. A scene with no entry is silent. */
export const SCENE_AMBIENCE: Record<string, string> = {
  "scene-tap-room": "amb-tap-room",
  "scene-back-room": "amb-back-room",
  "scene-kitchen": "amb-kitchen",
  "scene-back-stairs": "amb-back-stairs",
  "scene-upstairs-hall": "amb-upstairs-hall",
  "scene-room-5": "amb-room-5",
};

export const CLUE_STING = "sting-clue";
export const TRAVEL_SFX = "sfx-door";
export const ACCUSE_STING = "sting-accuse";
export const ENDING_STING = { solved: "sting-ending-solved", closed: "sting-ending-closed" } as const;
