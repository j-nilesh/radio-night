import { describe, it, expect } from "vitest";
import { coachStep, type CoachFacts } from "./coach";

const base: CoachFacts = { over: false, personMet: false, recording: false, asked: 0, waiting: false };

describe("coachStep", () => {
  it("walks a new player through meeting someone, asking, sending, then rooms", () => {
    expect(coachStep(base)).toBe("person");
    expect(coachStep({ ...base, personMet: true })).toBe("talk");
    expect(coachStep({ ...base, personMet: true, recording: true })).toBe("send");
    expect(coachStep({ ...base, personMet: true, asked: 1, waiting: true })).toBeNull();
    expect(coachStep({ ...base, personMet: true, asked: 1 })).toBe("rooms");
  });

  it("says send while recording even before anyone was met", () => {
    expect(coachStep({ ...base, recording: true })).toBe("send");
  });

  it("shows nothing once over", () => {
    expect(coachStep({ ...base, over: true })).toBeNull();
    expect(coachStep({ ...base, personMet: true, asked: 2, over: true })).toBeNull();
  });

  it("does not return to an earlier step after the player has asked", () => {
    expect(coachStep({ ...base, asked: 1 })).toBe("rooms");
  });
});
