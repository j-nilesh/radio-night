import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
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
} from "./cues";
import { theSittingCase } from "./case";

const ids = new Set(AUDIO_ASSETS.map((a) => a.id));
const fileOf = (a: { file: string }) => join(process.cwd(), "public", AUDIO_BASE_URL, a.file);

describe("the sound manifest", () => {
  it("has unique ids", () => {
    expect(ids.size).toBe(AUDIO_ASSETS.length);
  });

  it("points every asset at a file that exists and is not empty", () => {
    for (const a of AUDIO_ASSETS) {
      expect(existsSync(fileOf(a)), `${a.id}: ${a.file}`).toBe(true);
      expect(statSync(fileOf(a)).size, a.id).toBeGreaterThan(1000);
    }
  });

  it("records where every asset came from and its terms of use", () => {
    for (const a of AUDIO_ASSETS) {
      expect(a.source.trim().length, a.id).toBeGreaterThan(0);
      expect(a.license.trim().length, a.id).toBeGreaterThan(0);
      expect(["placeholder", "final"], a.id).toContain(a.status);
    }
  });

  it("uses only sound buses that exist, and never puts a cue on the dialogue bus", () => {
    for (const a of AUDIO_ASSETS) expect(["music", "fx"], a.id).toContain(a.bus);
  });

  it("keeps every cue gentle enough not to cover speech", () => {
    for (const a of AUDIO_ASSETS) expect(a.gain, a.id).toBeLessThanOrEqual(1);
  });

  it("holds real WAV files", () => {
    for (const a of AUDIO_ASSETS) {
      const head = readFileSync(fileOf(a)).subarray(0, 12);
      expect(head.subarray(0, 4).toString(), a.id).toBe("RIFF");
      expect(head.subarray(8, 12).toString(), a.id).toBe("WAVE");
    }
  });
});

describe("the music", () => {
  const music = AUDIO_ASSETS.filter((a) => a.kind === "music");
  it("has all four tracks, on the music bus", () => {
    expect(music.map((a) => a.id).sort()).toEqual(Object.values(MUSIC).sort());
    for (const a of music) expect(a.bus, a.id).toBe("music");
  });
  it("plays the theme and the closing once, and loops the two beds", () => {
    const byId = (id: string) => AUDIO_ASSETS.find((a) => a.id === id)!;
    expect(byId(MUSIC.theme).loop).toBe(false);
    expect(byId(MUSIC.closing).loop).toBe(false);
    expect(byId(MUSIC.investigation).loop).not.toBe(false);
    expect(byId(MUSIC.tension).loop).not.toBe(false);
  });
  it("lets the theme finish within the time the page gives it", () => {
    const wav = readFileSync(fileOf(AUDIO_ASSETS.find((a) => a.id === MUSIC.theme)!));
    const seconds = (wav.length - 44) / (wav.readUInt32LE(24) * 2);
    expect(seconds).toBeLessThanOrEqual(THEME_SECONDS + 1);
  });
  it("holds the beds at 24 kHz mono, long enough to loop without a short repeat", () => {
    for (const id of [MUSIC.investigation, MUSIC.tension]) {
      const wav = readFileSync(fileOf(AUDIO_ASSETS.find((a) => a.id === id)!));
      expect(wav.readUInt32LE(24), id).toBe(24000);
      expect(wav.readUInt16LE(22), id).toBe(1);
      expect((wav.length - 44) / 48000, id).toBeGreaterThan(20);
    }
  });
});

describe("the scene sound map", () => {
  it("gives every scene an ambience, and only uses ambience cues for it", () => {
    for (const scene of theSittingCase.scenes ?? []) {
      const cue = SCENE_AMBIENCE[scene.id];
      expect(cue, `scene ${scene.id}`).toBeDefined();
      expect(AUDIO_ASSETS.find((a) => a.id === cue)?.kind, cue).toBe("ambience");
    }
  });

  it("does not name scenes that do not exist", () => {
    const real = new Set((theSittingCase.scenes ?? []).map((s) => s.id));
    for (const sceneId of Object.keys(SCENE_AMBIENCE)) expect(real.has(sceneId), sceneId).toBe(true);
  });

  it("refers to stings and effects that are in the manifest", () => {
    for (const id of [CLUE_STING, TRAVEL_SFX, ACCUSE_STING, ENDING_STING.solved, ENDING_STING.closed]) {
      expect(ids.has(id), id).toBe(true);
    }
  });
});

describe("what the browser may import", () => {
  it("the cue data never imports the solution file", () => {
    const source = readFileSync(join(__dirname, "cues.ts"), "utf8");
    const imports = source.split("\n").filter((l) => /^\s*import\b/.test(l));
    expect(imports.some((l) => /truth/.test(l))).toBe(false);
  });
});
