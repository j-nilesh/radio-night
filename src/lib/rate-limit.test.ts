import { beforeEach, describe, expect, it } from "vitest";
import { checkLimit, resetLimits, type LimitRule } from "./rate-limit";

const rule: LimitRule = { name: "t", max: 3, windowMs: 1000 };

describe("checkLimit", () => {
  beforeEach(() => resetLimits());

  it("allows requests up to the maximum, then refuses", () => {
    for (let i = 0; i < 3; i++) expect(checkLimit(rule, "a", 1000 + i).ok).toBe(true);
    const blocked = checkLimit(rule, "a", 1010);
    expect(blocked.ok).toBe(false);
  });

  it("tells the caller how long to wait, rounded up to whole seconds", () => {
    for (let i = 0; i < 3; i++) checkLimit(rule, "a", 1000);
    const blocked = checkLimit(rule, "a", 1400);
    expect(blocked).toEqual({ ok: false, retryAfterSec: 1 });
  });

  it("lets requests through again once the window has passed", () => {
    for (let i = 0; i < 3; i++) checkLimit(rule, "a", 1000);
    expect(checkLimit(rule, "a", 1500).ok).toBe(false);
    expect(checkLimit(rule, "a", 2001).ok).toBe(true);
  });

  it("counts each subject separately", () => {
    for (let i = 0; i < 3; i++) checkLimit(rule, "a", 1000);
    expect(checkLimit(rule, "a", 1001).ok).toBe(false);
    expect(checkLimit(rule, "b", 1001).ok).toBe(true);
  });

  it("does not count refused requests against the caller", () => {
    for (let i = 0; i < 3; i++) checkLimit(rule, "a", 1000);
    for (let i = 0; i < 50; i++) checkLimit(rule, "a", 1100);
    expect(checkLimit(rule, "a", 2001).ok).toBe(true);
  });
});
