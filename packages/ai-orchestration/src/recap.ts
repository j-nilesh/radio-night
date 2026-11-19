/**
 * recap.ts
 * Spoken answers to the player's own commands ("recap", "help"), built only
 * from the player's view of the case. Nothing here can mention a fact the
 * player has not already earned, so a recap cannot spoil the mystery.
 */

import type { PlayerView } from "./scene-view";

/** Most items read aloud in one list; a longer recap would be tiresome to hear. */
const MAX_LISTED = 8;

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function limited(items: string[]): string {
  if (items.length <= MAX_LISTED) return list(items);
  const shown = items.slice(0, MAX_LISTED);
  const more = items.length - MAX_LISTED;
  return `${shown.join(", ")}, and ${more} more`;
}

/** Where the investigation stands, in a few spoken sentences. */
export function buildRecap(view: PlayerView): string {
  const parts: string[] = [];

  // Scene names often begin with "The"; avoid "in the The Tap Room".
  parts.push(`You are in ${view.scene.name.replace(/^The /, "the ")}.`);

  if (view.characters.length > 0) {
    parts.push(`With you: ${list(view.characters.map((c) => c.name))}.`);
  }

  const { clues, interviewed } = view.casebook;
  if (interviewed.length > 0) {
    parts.push(`You have questioned ${limited(interviewed.map((c) => c.name))}.`);
  }

  const physical = clues.filter((c) => c.kind === "physical").map((c) => c.title);
  const testimony = clues.filter((c) => c.kind === "testimony").map((c) => c.title);
  if (clues.length === 0) {
    parts.push("You have nothing solid yet. Ask questions and look around.");
  } else {
    if (physical.length > 0) parts.push(`What you have found: ${limited(physical)}.`);
    if (testimony.length > 0) parts.push(`What you have been told: ${limited(testimony)}.`);
  }

  if (view.exits.length > 0) {
    parts.push(`From here you can go to ${list(view.exits.map((e) => e.name))}.`);
  }

  if (view.accusation) {
    parts.push(
      view.accusation.ready
        ? "You may make your accusation whenever you are ready."
        : view.accusation.hint
    );
  }

  return parts.join(" ");
}

/**
 * A short, spoiler-safe summary of a saved investigation, for the "continue" card
 * and the welcome-back screen. Built only from the player's view, like the recap.
 */
export type SaveSummary = {
  /** One line: where the detective is and how far along */
  headline: string;
  sceneName: string;
  peopleQuestioned: number;
  finds: number;
  roomsVisited: number;
  finished: boolean;
  /** The ending's title once the case is closed */
  endingTitle: string | null;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function buildSaveSummary(view: PlayerView, roomsVisited: number): SaveSummary {
  const peopleQuestioned = view.casebook.interviewed.length;
  const finds = view.casebook.clues.length;
  const finished = !!view.ending;
  const place = view.scene.name.replace(/^The /, "the ");
  const headline = finished
    ? `Case closed: ${view.ending?.title ?? "an ending reached"}.`
    : `In ${place}. ${plural(peopleQuestioned, "person", "people")} questioned, ${plural(finds, "find", "finds")} in the casebook.`;
  return { headline, sceneName: view.scene.name, peopleQuestioned, finds, roomsVisited, finished, endingTitle: view.ending?.title ?? null };
}

/** What the narrator says when a saved investigation is picked up again. */
export function buildWelcomeBack(view: PlayerView): string {
  return `Welcome back, detective. ${buildRecap(view)}`;
}

/** What the player can say or do. */
export const HELP_TEXT =
  "Ask anyone here a question, by voice or by typing. " +
  "Say recap to hear where things stand, repeat to hear the last answer again, " +
  "or casebook to open your notes. You can also say pause and resume. " +
  "When you are ready to name someone, press Accuse.";
