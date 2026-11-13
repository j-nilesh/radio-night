/**
 * content/cases/radio-night-s01/v1/images.ts
 * Which picture goes with which room, person and clue, for "The Sitting".
 *
 * SERVER-SIDE. Browser code must not import this file: it lists every picture,
 * including the evidence, and a player must only ever be told about pictures
 * they have earned. The player view (scene-view.ts) hands the browser exactly
 * the pictures for the current room, the people present, the clues already
 * found and the victim's card. Always-visible art (the home page hero) is used
 * from server components only.
 *
 * It must also stay free of any import from truth.ts.
 */
import type { CaseImages, ImageRef } from "@ai-orchestration/case-content";
import manifest from "./images-manifest.json";

export type ImageKind = "scene" | "portrait" | "evidence" | "hero";

export type ImageVariant = { file: string; type: string };

export type ImageAsset = {
  id: string;
  /** Default file, relative to the manifest's baseUrl */
  file: string;
  kind: ImageKind;
  width: number;
  height: number;
  alt: string;
  /** CSS object-position: where the subject sits, so a crop keeps it in view */
  focus: string;
  status: "placeholder" | "final";
  /** Optimised alternatives (for example AVIF and WebP), best first */
  variants?: ImageVariant[];
  // Provenance, required once status is "final"
  tool?: string;
  model?: string;
  prompt?: string;
  references?: string[];
  generatedAt?: string;
  licence?: string;
};

export const IMAGE_BASE_URL: string = manifest.baseUrl;
export const IMAGE_ASSETS = manifest.assets as ImageAsset[];

const byId = new Map(IMAGE_ASSETS.map((a) => [a.id, a]));

export function imageAsset(id: string): ImageAsset | undefined {
  return byId.get(id);
}

/** The room picture for each scene. */
export const SCENE_IMAGE: Record<string, string> = {
  "scene-tap-room": "scene-tap-room",
  "scene-back-room": "scene-back-room",
  "scene-kitchen": "scene-kitchen",
  "scene-back-stairs": "scene-back-stairs",
  "scene-upstairs-hall": "scene-upstairs-hall",
  "scene-room-5": "scene-room-5",
};

/** The portrait for each character. */
export const CHARACTER_IMAGE: Record<string, string> = {
  "char-ray-kowalski": "char-ray-kowalski",
  "char-dwight-wentworth": "char-dwight-wentworth",
  "char-carol-wentworth": "char-carol-wentworth",
  "char-edna-marsh": "char-edna-marsh",
  "char-dennis-pruett": "char-dennis-pruett",
};

/** The picture shown when a physical clue is examined. Only the Room 5 finds have one. */
export const CLUE_IMAGE: Record<string, string> = {
  "clue-ashtray": "ev-ashtray",
  "clue-whiskey-glass": "ev-whiskey-glass",
  "clue-note-under-bed": "ev-note",
};

/** The victim's casebook card. */
export const VICTIM_IMAGE = "victim-gerald-fenn";

/** The home page picture. */
export const HERO_IMAGE = "hero-radio";

/** The URL of an asset's default file. */
export function imageUrl(asset: ImageAsset): string {
  return `${IMAGE_BASE_URL}${asset.file}`;
}

/** A picture in the shape the player view hands to the browser. */
export function toImageRef(asset: ImageAsset): ImageRef {
  return {
    src: imageUrl(asset),
    ...(asset.variants?.length ? { sources: asset.variants.map((v) => ({ src: `${IMAGE_BASE_URL}${v.file}`, type: v.type })) } : {}),
    alt: asset.alt,
    focus: asset.focus,
    width: asset.width,
    height: asset.height,
  };
}

function refFor(id: string): ImageRef {
  const asset = imageAsset(id);
  if (!asset) throw new Error(`Missing image in the manifest: ${id}`);
  return toImageRef(asset);
}

/** Rooms, portraits and evidence pictures for the case. The home page hero is not included. */
export function buildCaseImages(): CaseImages {
  const map = (table: Record<string, string>) => Object.fromEntries(Object.entries(table).map(([key, id]) => [key, refFor(id)]));
  return { scenes: map(SCENE_IMAGE), characters: map(CHARACTER_IMAGE), clues: map(CLUE_IMAGE) };
}

/** The victim's card: public facts only (the opening already says who has died, and where). */
export function buildVictimCard() {
  return { name: "Gerald Fenn", role: "Portrait painter, found dead in Room 5", image: refFor(VICTIM_IMAGE) };
}
