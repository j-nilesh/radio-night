import { describe, it, expect } from "vitest";
import { createQuietDetector, QUIET_AFTER_SPEECH_MS } from "./quiet-after-speech";

describe("createQuietDetector", () => {
  it("is never quiet before any speech, however long the silence", () => {
    const d = createQuietDetector();
    for (let t = 0; t < 10_000; t += 100) expect(d.push(0.001, t)).toBe(false);
  });

  it("reports quiet only after speech and a full quiet period", () => {
    const d = createQuietDetector();
    expect(d.push(0.1, 0)).toBe(false);
    expect(d.push(0.001, 100)).toBe(false);
    expect(d.push(0.001, 100 + QUIET_AFTER_SPEECH_MS - 1)).toBe(false);
    expect(d.push(0.001, 100 + QUIET_AFTER_SPEECH_MS)).toBe(true);
  });

  it("goes back to not-quiet when the player speaks again", () => {
    const d = createQuietDetector();
    d.push(0.1, 0);
    d.push(0.001, 100);
    expect(d.push(0.001, 2000)).toBe(true);
    expect(d.push(0.1, 2100)).toBe(false);
    expect(d.push(0.001, 2200)).toBe(false);
  });

  it("forgets earlier speech after reset", () => {
    const d = createQuietDetector();
    d.push(0.1, 0);
    d.reset();
    expect(d.push(0.001, 5000)).toBe(false);
    expect(d.push(0.001, 9000)).toBe(false);
  });
});
