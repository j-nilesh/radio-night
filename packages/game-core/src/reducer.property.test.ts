/**
 * Property-based tests for the game-core reducer (architecture rules, section 5:
 * "game-core invariants must have property-based tests").
 *
 * fast-check generates thousands of event sequences (including repeats, odd orders
 * and unknown event types) and shrinks any failure to the smallest sequence that
 * still breaks a property, so a failure message names the exact events.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { applyEvent, checkInvariants, createInitialRunState, replayEvents } from "./reducer";
import type { CaseId, GameEvent, GameEventType, RunId, RunState } from "./types";

const runId = "run-pbt" as RunId;
const START = "scene-start";

const fresh = (): RunState =>
  createInitialRunState({ runId, caseId: "case-pbt" as CaseId, caseVersion: "v1", initialSceneId: START, playMode: "solo" });

// ── Arbitraries ─────────────────────────────────────────────────────────────
const sceneId = fc.constantFrom(START, "scene-a", "scene-b", "scene-c");
const characterId = fc.constantFrom("char-1", "char-2", "char-3");
const id = (prefix: string) => fc.integer({ min: 1, max: 6 }).map((n) => `${prefix}-${n}`);

/** One event payload per type, built from small id pools so repeats are common. */
const eventBody: fc.Arbitrary<{ eventType: GameEventType | "SOMETHING_ELSE"; payload: Record<string, unknown> }> = fc.oneof(
  sceneId.map((s) => ({ eventType: "SCENE_ENTERED" as const, payload: { sceneId: s } })),
  characterId.map((c) => ({ eventType: "CHARACTER_INTERVIEWED" as const, payload: { characterId: c } })),
  fc.tuple(id("claim"), characterId, fc.option(fc.string({ maxLength: 20 }), { nil: undefined })).map(([claimId, c, recap]) => ({
    eventType: "CLAIM_HEARD" as const,
    payload: { claimId, characterId: c, ...(recap ? { shortRecap: recap } : {}) },
  })),
  id("clue").map((e) => ({ eventType: "EVIDENCE_DISCOVERED" as const, payload: { evidenceId: e } })),
  id("object").map((o) => ({ eventType: "OBJECT_EXAMINED" as const, payload: { objectId: o } })),
  id("claim").map((c) => ({ eventType: "CLAIM_BOOKMARKED" as const, payload: { claimId: c } })),
  id("beat").map((b) => ({ eventType: "BEAT_UNLOCKED" as const, payload: { beatId: b } })),
  fc.tuple(characterId, fc.array(id("clue"), { maxLength: 4 })).map(([s, ev]) => ({
    eventType: "ACCUSATION_MADE" as const,
    payload: { suspectId: s, evidenceIds: ev },
  })),
  id("ending").map((e) => ({ eventType: "ENDING_REACHED" as const, payload: { endingId: e } })),
  fc.constant({ eventType: "RUN_CREATED" as const, payload: {} }),
  fc.constant({ eventType: "SESSION_RESUMED" as const, payload: {} }),
  fc.constant({ eventType: "SOMETHING_ELSE" as const, payload: { anything: true } })
);

const events: fc.Arbitrary<GameEvent[]> = fc.array(eventBody, { maxLength: 40 }).map((bodies) =>
  bodies.map((b, i) => ({
    eventId: `e-${i}`,
    runId,
    sequence: i + 1,
    eventType: b.eventType as GameEventType,
    payload: b.payload,
    createdAt: new Date(0),
  }))
);

/** Freeze a state all the way down, so any mutation of the input throws. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

const LISTS = ["visitedSceneIds", "heardClaimIds", "discoveredEvidenceIds", "openedBeatIds", "bookmarkedClaimIds", "knownFactIds"] as const;

// Quiet the reducer's warning about the deliberately unknown event type.
const quiet = <T>(fn: () => T): T => {
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    return fn();
  } finally {
    console.warn = warn;
  }
};

// ── Properties ──────────────────────────────────────────────────────────────
describe("the reducer, for any sequence of events", () => {
  it("keeps every invariant after every step", () => {
    fc.assert(
      fc.property(events, (evs) =>
        quiet(() => {
          let s = fresh();
          for (const e of evs) {
            s = applyEvent(s, e);
            expect(checkInvariants(s)).toEqual([]);
          }
        })
      ),
      { numRuns: 500 }
    );
  });

  it("never forgets: what the detective has found, heard or visited only grows", () => {
    fc.assert(
      fc.property(events, (evs) =>
        quiet(() => {
          let s = fresh();
          for (const e of evs) {
            const next = applyEvent(s, e);
            for (const list of LISTS) {
              for (const item of s[list] as string[]) expect(next[list] as string[]).toContain(item);
            }
            for (const [flag, on] of Object.entries(s.investigationFlags)) if (on) expect(next.investigationFlags[flag]).toBe(true);
            s = next;
          }
        })
      ),
      { numRuns: 500 }
    );
  });

  it("never records the same thing twice", () => {
    fc.assert(
      fc.property(events, (evs) =>
        quiet(() => {
          const s = replayEvents(fresh(), evs);
          for (const list of LISTS) expect(new Set(s[list] as string[]).size).toBe((s[list] as string[]).length);
        })
      ),
      { numRuns: 500 }
    );
  });

  it("never changes the state it was given", () => {
    fc.assert(
      fc.property(events, (evs) =>
        quiet(() => {
          let s = deepFreeze(fresh());
          for (const e of evs) s = deepFreeze(applyEvent(s, e)); // throws in strict mode if anything was mutated
        })
      ),
      { numRuns: 300 }
    );
  });

  it("advances the revision by one for every recognised event, and ignores unknown ones", () => {
    fc.assert(
      fc.property(events, (evs) =>
        quiet(() => {
          let s = fresh();
          for (const e of evs) {
            const next = applyEvent(s, e);
            if (e.eventType === ("SOMETHING_ELSE" as GameEventType)) expect(next).toBe(s);
            else expect(next.revision === s.revision + 1 || next === s).toBe(true);
            s = next;
          }
        })
      ),
      { numRuns: 300 }
    );
  });

  it("rebuilds exactly the same state when the events are replayed", () => {
    fc.assert(
      fc.property(events, (evs) =>
        quiet(() => {
          let stepwise = fresh();
          for (const e of evs) stepwise = applyEvent(stepwise, e);
          expect(replayEvents(fresh(), evs)).toEqual(stepwise);
          expect(replayEvents(fresh(), evs)).toEqual(replayEvents(fresh(), evs));
        })
      ),
      { numRuns: 300 }
    );
  });

  it("closes the case once: after an ending, no later event changes the ending or the accusation", () => {
    fc.assert(
      fc.property(events, events, (before, after) =>
        quiet(() => {
          const ending: GameEvent = { eventId: "end", runId, sequence: 999, eventType: "ENDING_REACHED", payload: { endingId: "ending-first" }, createdAt: new Date(0) };
          const closed = replayEvents(fresh(), [...before.filter((e) => e.eventType !== "ENDING_REACHED"), ending]);
          const later = replayEvents(closed, after);
          expect(later.endingId).toBe("ending-first");
          expect(later.accusation).toEqual(closed.accusation);
        })
      ),
      { numRuns: 500 }
    );
  });
});
