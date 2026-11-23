/**
 * The narrator's handoff at the end of the opening: it orients a first-time
 * player and adds no case facts.
 */
import { describe, it, expect } from "vitest";
import { buildOpening } from "@ai-orchestration/scene-view";
import { theSittingCase } from "./case";
import { CHARACTERS } from "./characters";

describe("opening handoff", () => {
  const lines = buildOpening(theSittingCase);
  const last = lines[lines.length - 1];

  it("comes last, after the opening and the first room, spoken by the narrator", () => {
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(last.actor).toBe("narrator");
    expect(last.text).toMatch(/tap a face/i);
    expect(last.text).toMatch(/walk next door/i);
  });

  it("names no one and mentions no clue, weapon or victim", () => {
    for (const c of CHARACTERS) {
      expect(last.text).not.toContain(c.name);
      expect(last.text).not.toContain(c.name.split(" ")[0]);
    }
    expect(last.text).not.toMatch(/ashtray|weapon|note|fenn|motive|killer|room 5/i);
  });
});
