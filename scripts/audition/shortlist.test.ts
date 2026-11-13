import { describe, expect, it } from "vitest";
import { autoChosen, shortlistToAllow, type ShortlistFile } from "./shortlist";
import { triageSubset } from "./voice-items";
import { toMono24k } from "./providers";
import type { TestLine } from "./lib";

const key = { "char-ray": { A: "deepgram:apollo", B: "cartesia:x", C: "elevenlabs:y", D: "deepgram:mars" } };
const list = (listener: string, marks: Record<string, string>): ShortlistFile => ({
  listener,
  scores: { "char-ray": Object.fromEntries(Object.entries(marks).map(([l, verdict]) => [l, { verdict }])) },
});

describe("shortlistToAllow", () => {
  it("carries forward keeps and maybes, and drops the rest", () => {
    const { allow } = shortlistToAllow(key, [list("a", { A: "keep", B: "drop", C: "maybe", D: "drop" })]);
    expect([...allow.get("char-ray")!].sort()).toEqual(["deepgram:apollo", "elevenlabs:y"]);
  });

  it("keeps an option if any listener wanted it", () => {
    const { allow } = shortlistToAllow(key, [list("a", { A: "drop", B: "drop", C: "drop", D: "drop" }), list("b", { B: "keep" })]);
    expect([...allow.get("char-ray")!]).toEqual(["cartesia:x"]);
  });

  it("can be limited to keeps only", () => {
    const { allow } = shortlistToAllow(key, [list("a", { A: "keep", C: "maybe" })], ["keep"]);
    expect([...allow.get("char-ray")!]).toEqual(["deepgram:apollo"]);
  });

  it("does not carry forward an option nobody marked, and says so", () => {
    const { allow, report } = shortlistToAllow(key, [list("a", { A: "keep", B: "keep" })]);
    expect(allow.get("char-ray")!.has("elevenlabs:y")).toBe(false);
    expect(report[0]).toContain("2 not marked");
  });

  it("reports when nothing, or only one thing, is left", () => {
    expect(shortlistToAllow(key, [list("a", { A: "drop", B: "drop", C: "drop", D: "drop" })]).report[0]).toContain("none kept");
    expect(shortlistToAllow(key, [list("a", { A: "keep", B: "drop", C: "drop", D: "drop" })]).report[0]).toContain("nothing to compare");
  });
});

describe("triageSubset", () => {
  const a = (n: number): TestLine => ({ source: "authored", text: `authored ${n}` });
  const p = (n: number): TestLine => ({ source: "playtest", text: `playtest ${n}` });

  it("takes three lines that are all part of the full set, so they are already made", () => {
    const full = [a(1), a(2), a(3), a(4), p(1), p(2), p(3), p(4)];
    const sub = triageSubset(full);
    expect(sub).toHaveLength(3);
    for (const l of sub) expect(full).toContain(l);
    expect(sub.map((l) => l.source).sort()).toEqual(["authored", "authored", "playtest"]);
  });

  it("copes with a character who has few lines", () => {
    expect(triageSubset([a(1)]).length).toBe(1);
    expect(triageSubset([a(1), a(2), p(1)]).length).toBe(3);
  });

  it("gives the narrator the first and last passage", () => {
    const n = (i: number): TestLine => ({ source: "narration", text: `n${i}` });
    expect(triageSubset([n(1), n(2), n(3)]).map((l) => l.text)).toEqual(["n1", "n3"]);
  });
});

describe("toMono24k", () => {
  it("leaves mono audio alone and mixes stereo down, judged by size against the length asked for", () => {
    const mono = Buffer.alloc(24000 * 2 * 2); // 2 seconds of mono
    const stereo = Buffer.alloc(24000 * 2 * 2 * 2); // 2 seconds of stereo
    expect(toMono24k(mono, 2).length).toBe(mono.length);
    expect(toMono24k(stereo, 2).length).toBe(stereo.length / 2);
  });
});

describe("autoChosen", () => {
  it("records a part with a single survivor, and only those", () => {
    const allow = new Map<string, Set<string>>([
      ["a", new Set(["deepgram:x"])],
      ["b", new Set(["deepgram:x", "cartesia:y"])],
      ["c", new Set<string>()],
    ]);
    expect(autoChosen(allow)).toEqual({ a: "deepgram:x" });
  });
});
