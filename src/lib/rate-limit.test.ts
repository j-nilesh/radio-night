import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { checkLimit, clientIp, normaliseAddress, resetLimits, type LimitRule } from "./rate-limit";

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


const req = (headers: Record<string, string>) => new NextRequest("http://localhost/api/x", { headers });

describe("clientIp", () => {
  it("uses the address Fly sets", () => {
    expect(clientIp(req({ "fly-client-ip": "203.0.113.7" }))).toBe("203.0.113.7");
  });
  it("ignores X-Forwarded-For, which the caller controls", () => {
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4", "fly-client-ip": "203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("local");
  });
  it("ignores X-Real-IP too", () => {
    expect(clientIp(req({ "x-real-ip": "9.9.9.9" }))).toBe("local");
  });
  it("cannot be dodged by changing X-Forwarded-For on each request", () => {
    const seen = new Set(
      Array.from({ length: 50 }, (_, i) => clientIp(req({ "fly-client-ip": "203.0.113.7", "x-forwarded-for": `10.0.0.${i}` })))
    );
    expect(seen.size).toBe(1);
  });
  it("shares one bucket when no proxy header is present (local development)", () => {
    expect(clientIp(req({}))).toBe("local");
  });
});

describe("normaliseAddress", () => {
  it("keeps IPv4 as is and unwraps IPv4-mapped IPv6", () => {
    expect(normaliseAddress("198.51.100.4")).toBe("198.51.100.4");
    expect(normaliseAddress("::ffff:198.51.100.4")).toBe("198.51.100.4");
  });
  it("reduces IPv6 to its /64, so rotating inside a block does not help", () => {
    const a = normaliseAddress("2001:db8:abcd:12::1");
    const b = normaliseAddress("2001:0db8:abcd:0012:ffff:ffff:ffff:ffff");
    expect(a).toBe("2001:db8:abcd:12::/64");
    expect(b).toBe(a);
    expect(normaliseAddress("2001:db8:abcd:13::1")).not.toBe(a);
  });
  it("handles compressed forms", () => {
    expect(normaliseAddress("::1")).toBe("0:0:0:0::/64");
    expect(normaliseAddress("fe80::")).toBe("fe80:0:0:0::/64");
  });
  it("puts anything malformed into one shared bucket rather than trusting it", () => {
    for (const bad of ["not an address", "1.2.3.4, 5.6.7.8", "1:2:3", "zzzz::1", "<script>"]) {
      expect(normaliseAddress(bad), bad).toBe("unknown");
    }
  });
});
