import { describe, expect, it } from "vitest";
import { advance, settle, startFade } from "./crossfade";

const a = { src: "/a.svg" };
const b = { src: "/b.svg" };
const c = { src: "/c.svg" };

describe("crossfade", () => {
  it("starts with just the first picture", () => {
    expect(startFade(a)).toEqual({ current: a, previous: null });
    expect(startFade(null)).toEqual({ current: null, previous: null });
  });

  it("keeps the old picture underneath while the new one fades in", () => {
    expect(advance(startFade(a), b)).toEqual({ current: b, previous: a });
  });

  it("changes nothing when the same picture is asked for again", () => {
    const state = advance(startFade(a), b);
    expect(advance(state, b)).toBe(state);
  });

  it("drops the picture underneath once the fade has finished", () => {
    const done = settle(advance(startFade(a), b));
    expect(done).toEqual({ current: b, previous: null });
    expect(settle(done)).toBe(done);
  });

  it("handles a quick second change: the one that was fading in becomes the one underneath", () => {
    const s = advance(advance(startFade(a), b), c);
    expect(s).toEqual({ current: c, previous: b });
  });

  it("copes with a room that has no picture", () => {
    expect(advance(startFade(a), null)).toEqual({ current: null, previous: a });
    expect(advance(startFade<{ src: string }>(null), a)).toEqual({ current: a, previous: null });
  });
});
