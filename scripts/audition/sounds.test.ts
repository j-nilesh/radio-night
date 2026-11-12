import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SOUND_CUES } from "./sounds";
import { loopToLength, mixWavs, resample, type Wav } from "./lib";
import { monoFromStereoPcm } from "./providers";
import { AUDIO_ASSETS } from "../../content/cases/radio-night-s01/v1/cues";

const tone = (n: number, amp = 1000, rate = 24000): Wav => ({
  sampleRate: rate,
  channels: 1,
  samples: Int16Array.from({ length: n }, (_, i) => Math.round(amp * Math.sin(i / 10))),
});

describe("sound audition cues", () => {
  it("have unique ids that match cues in the game manifest", () => {
    const ids = SOUND_CUES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const manifest = new Set(AUDIO_ASSETS.map((a) => a.id));
    for (const id of ids) expect(manifest.has(id), id).toBe(true);
  });

  it("cover every cue the game plays", () => {
    const ids = new Set(SOUND_CUES.map((c) => c.id));
    for (const a of AUDIO_ASSETS) expect(ids.has(a.id), a.id).toBe(true);
  });

  it("each have at least three prompts, a valid length, and a placeholder to beat", () => {
    for (const c of SOUND_CUES) {
      expect(c.prompts.length, c.id).toBeGreaterThanOrEqual(3);
      expect(c.seconds, c.id).toBeGreaterThanOrEqual(0.5);
      expect(c.seconds, c.id).toBeLessThanOrEqual(30);
      expect(existsSync(join(process.cwd(), "public", "audio", "radio-night-s01", c.baseline)), c.id).toBe(true);
    }
  });

  it("only loop the room sounds", () => {
    for (const c of SOUND_CUES) expect(c.loop, c.id).toBe(c.kind === "ambience");
  });

  it("do not name the killer or give away the solution in a prompt", () => {
    for (const c of SOUND_CUES) {
      for (const p of c.prompts) expect(p, c.id).not.toMatch(/kowalski|\bray\b|dwight|carol|murder|killer|ashtray/i);
    }
  });
});

describe("audio mixing helpers", () => {
  it("resamples to the requested rate and length", () => {
    const out = resample(tone(11025, 1000, 11025), 24000);
    expect(out.sampleRate).toBe(24000);
    expect(out.samples.length).toBe(24000);
  });

  it("leaves a clip alone when the rate already matches", () => {
    const w = tone(100);
    expect(resample(w, 24000)).toBe(w);
  });

  it("loops a short clip to a longer length without a gap", () => {
    const w = tone(10);
    const out = loopToLength(w, 25);
    expect(out.samples).toHaveLength(25);
    expect(out.samples[10]).toBe(w.samples[0]);
    expect(out.samples[24]).toBe(w.samples[4]);
  });

  it("mixes two clips, clipping rather than wrapping around", () => {
    const loud = { sampleRate: 24000, channels: 1, samples: Int16Array.from([30000, -30000]) };
    const mixed = mixWavs(loud, loud, 1);
    expect(Array.from(mixed.samples)).toEqual([32767, -32768]);
  });

  it("mixes to the length of the longer clip and refuses mismatched rates", () => {
    expect(mixWavs(tone(10), tone(30), 0.5).samples).toHaveLength(30);
    expect(() => mixWavs(tone(10), tone(10, 1000, 11025))).toThrow();
  });
});

describe("sound generation returns stereo", () => {
  it("mixes interleaved left/right down to half as many mono samples (found when clips came out twice as long)", () => {
    const stereo = Buffer.alloc(8);
    stereo.writeInt16LE(1000, 0); // L
    stereo.writeInt16LE(3000, 2); // R
    stereo.writeInt16LE(-500, 4);
    stereo.writeInt16LE(-1500, 6);
    const mono = monoFromStereoPcm(stereo);
    expect(mono.length).toBe(4);
    expect(mono.readInt16LE(0)).toBe(2000);
    expect(mono.readInt16LE(2)).toBe(-1000);
  });
  it("ignores a trailing half-frame", () => {
    expect(monoFromStereoPcm(Buffer.alloc(6)).length).toBe(2);
  });
});
