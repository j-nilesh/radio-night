/**
 * Voice and model allowances per visitor, and access codes (ADR 0014).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { accessCodeHash, checkAccessCode, modelRepliesLeft, voiceAllowance, voiceLeft } from "./allowance";
import { getStore } from "./store";

const saved = { ...process.env };
beforeEach(() => {
  process.env.PUBLIC_VOICE_CHARS = "4000";
  process.env.CODE_VOICE_CHARS = "60000";
  process.env.PUBLIC_MODEL_REPLIES = "120";
  process.env.CODE_MODEL_REPLIES = "400";
});
afterEach(() => {
  process.env = { ...saved };
});

describe("voice allowance", () => {
  it("gives a visitor without a code the public taste, and a coded visitor their own allowance", () => {
    expect(voiceAllowance({ voiceCharsAllowance: null })).toBe(4000);
    expect(voiceAllowance({ voiceCharsAllowance: 60000 })).toBe(60000);
  });
  it("counts down what is left and never goes below zero", () => {
    expect(voiceLeft({ voiceCharsAllowance: null, voiceCharsUsed: 1500 })).toBe(2500);
    expect(voiceLeft({ voiceCharsAllowance: null, voiceCharsUsed: 9000 })).toBe(0);
  });
  it("reads the public allowance from the environment, falling back on nonsense", () => {
    process.env.PUBLIC_VOICE_CHARS = "250";
    expect(voiceAllowance({ voiceCharsAllowance: null })).toBe(250);
    process.env.PUBLIC_VOICE_CHARS = "lots";
    expect(voiceAllowance({ voiceCharsAllowance: null })).toBe(4000);
  });
});

describe("model replies", () => {
  it("caps a visitor without a code lower than one with a code", () => {
    expect(modelRepliesLeft({ accessLabel: null, modelRepliesUsed: 100 })).toBe(20);
    expect(modelRepliesLeft({ accessLabel: "judges", modelRepliesUsed: 100 })).toBe(300);
    expect(modelRepliesLeft({ accessLabel: null, modelRepliesUsed: 500 })).toBe(0);
  });
});

describe("access codes", () => {
  const configured = `judges:${accessCodeHash("NIGHT-OWL-1981")},friends:${accessCodeHash("bridgewater")}`;

  it("returns the label of a matching code, ignoring case and spaces", () => {
    expect(checkAccessCode("NIGHT-OWL-1981", configured)).toBe("judges");
    expect(checkAccessCode("  night-owl-1981 ", configured)).toBe("judges");
    expect(checkAccessCode("BRIDGEWATER", configured)).toBe("friends");
  });
  it("ignores spaces and dashes too, so a copied code works however it was pasted", () => {
    expect(checkAccessCode("NIGHTOWL1981", configured)).toBe("judges");
    expect(checkAccessCode("night owl 1981", configured)).toBe("judges");
    expect(checkAccessCode("NIGHT–OWL–1981\n", configured)).toBe("judges"); // en dashes, trailing newline
    expect(checkAccessCode("N-I-G-H-T-O-W-L-1-9-8-1", configured)).toBe("judges");
  });
  it("still tells different codes apart, and does not let punctuation alone count as a code", () => {
    expect(checkAccessCode("NIGHT-OWL-1982", configured)).toBeNull();
    expect(checkAccessCode("----", configured)).toBeNull();
    expect(checkAccessCode(" - - - - - ", configured)).toBeNull();
  });
  it("refuses a wrong, short, very long or empty code", () => {
    expect(checkAccessCode("NIGHT-OWL-1982", configured)).toBeNull();
    expect(checkAccessCode("abc", configured)).toBeNull();
    expect(checkAccessCode("x".repeat(65), configured)).toBeNull();
    expect(checkAccessCode("", configured)).toBeNull();
  });
  it("refuses everything when no codes are configured, and skips malformed entries", () => {
    expect(checkAccessCode("NIGHT-OWL-1981", "")).toBeNull();
    expect(checkAccessCode("NIGHT-OWL-1981", "judges:not-a-hash,:abc")).toBeNull();
  });
  it("stores a hash, not the code", () => {
    expect(accessCodeHash("NIGHT-OWL-1981")).toMatch(/^[0-9a-f]{64}$/);
    expect(accessCodeHash("NIGHT-OWL-1981")).not.toContain("NIGHT");
  });
});

describe("the store keeps the counts", () => {
  it("adds voice characters and model replies, records a code, and keeps a session alive", async () => {
    const store = getStore();
    const tag = `allow-${Date.now()}`;
    const session = await store.createSession(tag, new Date(Date.now() + 60_000));
    await store.addVoiceChars(session.id, 120);
    await store.addVoiceChars(session.id, 80);
    await store.addModelReply(session.id);
    await store.setAccess(session.id, "judges", 60000);
    const later = new Date(Date.now() + 30 * 86_400_000);
    await store.incrementSessionRequests(session.id, later);
    const s = await store.findSessionByToken(tag);
    expect(s).toMatchObject({ voiceCharsUsed: 200, modelRepliesUsed: 1, accessLabel: "judges", voiceCharsAllowance: 60000 });
    expect(s?.expiresAt.getTime()).toBe(later.getTime());
  });

  it("treats an expired session as gone", async () => {
    const store = getStore();
    const tag = `expired-${Date.now()}`;
    await store.createSession(tag, new Date(Date.now() - 1000));
    expect(await store.findSessionByToken(tag)).toBeNull();
  });

  it("sums usage per day and provider", async () => {
    const store = getStore();
    await store.recordUsage({ provider: "elevenlabs-test", feature: "tts", units: 300, estimatedCostUsd: 0.05 });
    await store.recordUsage({ provider: "elevenlabs-test", feature: "tts", units: 200, estimatedCostUsd: 0.03 });
    const rows = (await store.usageByDay(1)).filter((r) => r.provider === "elevenlabs-test");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ calls: 2, units: 500 });
    expect(rows[0].costUsd).toBeCloseTo(0.08);
  });
});
