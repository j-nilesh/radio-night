import { describe, expect, it } from "vitest";
import {
  authoredLines,
  blindLabels,
  clipAtSentence,
  costPoints,
  earPoints,
  encodeWav,
  latencyPoints,
  matchLoudness,
  median,
  parseWav,
  pickSpread,
  playtestLines,
  rmsDb,
  seedFor,
  WEIGHTS,
} from "./lib";

describe("pickSpread", () => {
  it("returns everything when there are fewer items than asked for", () => {
    expect(pickSpread([1, 2], 5)).toEqual([1, 2]);
  });
  it("spreads picks across the list instead of taking the first few", () => {
    const picks = pickSpread([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 4);
    expect(picks).toHaveLength(4);
    expect(picks[0]).toBeLessThan(3);
    expect(picks[3]).toBeGreaterThan(6);
  });
  it("handles nothing", () => {
    expect(pickSpread([], 3)).toEqual([]);
    expect(pickSpread([1, 2, 3], 0)).toEqual([]);
  });
});

describe("test lines", () => {
  const long = (s: string) => s.padEnd(70, ".");
  it("authored lines include cover stories, drop the leading ellipsis and skip very short or long ones", () => {
    const lines = authoredLines(
      [
        { line: "...Yes. I wrote it. " + "x".repeat(60), lockedLine: long("I wrote the man no note") },
        { line: "No." },
        { line: "y".repeat(400) },
      ],
      4
    );
    expect(lines.map((l) => l.source)).toEqual(["authored", "authored"]);
    expect(lines[0].text.startsWith("Yes.")).toBe(true);
  });
  it("playtest lines come only from that character, once each", () => {
    const events = [
      { kind: "turn", character: "a", reply: long("one") },
      { kind: "turn", character: "a", reply: long("one") },
      { kind: "turn", character: "b", reply: long("two") },
      { kind: "scene", character: "a", reply: long("three") },
    ];
    expect(playtestLines(events, "a", 5).map((l) => l.text)).toEqual([long("one")]);
  });
  it("clips narration at a sentence", () => {
    const text = "First sentence here. Second sentence goes on and on and on for a while longer.";
    expect(clipAtSentence(text, 40)).toBe("First sentence here.");
    expect(clipAtSentence("short", 40)).toBe("short");
  });
});

describe("blind labels", () => {
  const ids = ["deepgram:apollo", "deepgram:arcas", "deepgram:aries", "deepgram:mars"];
  it("assigns each candidate exactly one letter", () => {
    const labels = blindLabels(ids, 7);
    expect(Object.keys(labels).sort()).toEqual(["A", "B", "C", "D"]);
    expect(Object.values(labels).sort()).toEqual([...ids].sort());
  });
  it("is repeatable for the same seed, and different seeds can differ", () => {
    expect(blindLabels(ids, 7)).toEqual(blindLabels(ids, 7));
    const orders = new Set([1, 2, 3, 4, 5, 6].map((s) => JSON.stringify(blindLabels(ids, s))));
    expect(orders.size).toBeGreaterThan(1);
  });
  it("seedFor is stable", () => {
    expect(seedFor("char-ray")).toBe(seedFor("char-ray"));
    expect(seedFor("char-ray")).not.toBe(seedFor("char-carol"));
  });
});

describe("audio", () => {
  const tone = (amp: number, n = 4800) =>
    Int16Array.from({ length: n }, (_, i) => Math.round(amp * 32767 * Math.sin((2 * Math.PI * 220 * i) / 24000)));

  it("round-trips a WAV", () => {
    const wav = { sampleRate: 24000, channels: 1, samples: tone(0.3) };
    const back = parseWav(encodeWav(wav));
    expect(back.sampleRate).toBe(24000);
    expect(back.samples).toEqual(wav.samples);
  });
  it("reads a streamed WAV whose header sizes were never filled in", () => {
    const buf = encodeWav({ sampleRate: 24000, channels: 1, samples: tone(0.3, 100) });
    buf.writeUInt32LE(0xffffffff, 40);
    buf.writeUInt32LE(0xffffffff, 4);
    expect(parseWav(buf).samples).toHaveLength(100);
  });
  it("rejects things that are not WAV files", () => {
    expect(() => parseWav(Buffer.from("not audio at all"))).toThrow();
  });
  it("brings a quiet and a loud clip to the same loudness", () => {
    const quiet = matchLoudness({ sampleRate: 24000, channels: 1, samples: tone(0.05) });
    const loud = matchLoudness({ sampleRate: 24000, channels: 1, samples: tone(0.5) });
    expect(Math.abs(rmsDb(quiet.samples) - rmsDb(loud.samples))).toBeLessThan(0.5);
    expect(rmsDb(quiet.samples)).toBeCloseTo(-22, 0);
  });
  it("never clips: gain is limited by the peak", () => {
    const spiky = Int16Array.from({ length: 1000 }, (_, i) => (i === 500 ? 30000 : 10));
    const out = matchLoudness({ sampleRate: 24000, channels: 1, samples: spiky });
    expect(Math.max(...Array.from(out.samples).map(Math.abs))).toBeLessThanOrEqual(Math.round(0.95 * 32767));
  });
});

describe("scoring", () => {
  it("a perfect ear score is worth 80 points", () => {
    expect(earPoints({ authenticity: 10, emotion: 10, consistency: 10, clarity: 10 })).toBe(80);
  });
  it("weights authenticity above clarity", () => {
    const a = earPoints({ authenticity: 10, emotion: 1, consistency: 1, clarity: 1 });
    const c = earPoints({ authenticity: 1, emotion: 1, consistency: 1, clarity: 10 });
    expect(a).toBeGreaterThan(c);
  });
  it("latency: full marks when fast, none when slow, neutral when unknown", () => {
    expect(latencyPoints(300)).toBe(WEIGHTS.latency);
    expect(latencyPoints(2000)).toBe(0);
    expect(latencyPoints(undefined)).toBe(WEIGHTS.latency / 2);
    expect(latencyPoints(950)).toBeCloseTo(WEIGHTS.latency / 2, 0);
  });
  it("cost: cheapest gets full marks, dearer in proportion, unknown is neutral", () => {
    expect(costPoints(0.03, 0.03)).toBe(WEIGHTS.cost);
    expect(costPoints(0.06, 0.03)).toBe(WEIGHTS.cost / 2);
    expect(costPoints(undefined, 0.03)).toBe(WEIGHTS.cost / 2);
  });
  it("the weights add up to 100", () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeUndefined();
  });
});
