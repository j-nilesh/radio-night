/**
 * lib/coach.ts
 * Which hint the first-minute coach should show, worked out from what the
 * player has done so far. Nothing is stored except whether the coach is over,
 * so the hint can never get out of step with the screen.
 */
export type CoachStep = "person" | "talk" | "send" | "rooms";

export type CoachFacts = {
  /** Skipped, finished (the player walked to another room), or not a first run: show nothing. */
  over: boolean;
  /** The player has looked at someone's card and closed it. */
  personMet: boolean;
  /** The microphone is recording right now. */
  recording: boolean;
  /** Questions the player has asked so far. */
  asked: number;
  /** A reply is on its way. */
  waiting: boolean;
};

export function coachStep(f: CoachFacts): CoachStep | null {
  if (f.over) return null;
  if (f.recording) return "send";
  if (f.asked > 0) return f.waiting ? null : "rooms";
  return f.personMet ? "talk" : "person";
}

/** Seconds of no progress after which the hint becomes a firmer nudge. */
export const COACH_NUDGE_AFTER_MS = 20_000;
