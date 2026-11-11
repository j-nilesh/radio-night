import { describe, expect, it } from "vitest";
import { buildRecap, HELP_TEXT } from "./recap";
import type { PlayerView } from "./scene-view";

const base: PlayerView = {
  scene: { id: "s1", name: "Tap Room" },
  characters: [
    { id: "a", name: "Ray", role: "bartender" },
    { id: "b", name: "Dennis", role: "regular" },
  ],
  exits: [{ id: "e1", name: "Dining Room" }],
  examinables: [],
  casebook: { clues: [], interviewed: [] },
  accusation: null,
  ending: null,
};

describe("buildRecap", () => {
  it("says where you are and who is present, and that you have nothing yet", () => {
    const text = buildRecap(base);
    expect(text).toContain("Tap Room");
    expect(buildRecap({ ...base, scene: { id: "s", name: "The Tap Room" } })).toContain("You are in the Tap Room.");
    expect(text).toContain("Ray and Dennis");
    expect(text).toContain("nothing solid yet");
    expect(text).toContain("Dining Room");
  });

  it("separates physical finds from testimony", () => {
    const text = buildRecap({
      ...base,
      casebook: {
        interviewed: [{ id: "a", name: "Ray" }],
        clues: [
          { id: "c1", title: "A glass ashtray", summary: "", kind: "physical" },
          { id: "c2", title: "Ray heard the stairs", summary: "", kind: "testimony" },
        ],
      },
    });
    expect(text).toContain("What you have found: A glass ashtray.");
    expect(text).toContain("What you have been told: Ray heard the stairs.");
    expect(text).toContain("questioned Ray");
  });

  it("contains only words from the player's own view (cannot spoil)", () => {
    const secret = "SECRET-KILLER-NAME";
    const view = { ...base, casebook: { clues: [], interviewed: [] } };
    // Any field not on PlayerView cannot reach the text.
    const text = buildRecap({ ...view, ...({ truth: secret } as object) } as PlayerView);
    expect(text).not.toContain(secret);
  });

  it("keeps a long list short enough to listen to", () => {
    const clues = Array.from({ length: 12 }, (_, i) => ({
      id: `c${i}`,
      title: `Clue ${i}`,
      summary: "",
      kind: "physical" as const,
    }));
    const text = buildRecap({ ...base, casebook: { clues, interviewed: [] } });
    expect(text).toContain("and 4 more");
    expect(text).not.toContain("Clue 11");
  });

  it("offers the accusation only when it is ready, else the existing hint", () => {
    const suspects = [{ id: "a", name: "Ray", role: "bartender" }];
    expect(buildRecap({ ...base, accusation: { ready: true, hint: "", suspects } })).toContain("accusation");
    expect(buildRecap({ ...base, accusation: { ready: false, hint: "Not yet.", suspects } })).toContain("Not yet.");
  });
});

describe("HELP_TEXT", () => {
  it("names the commands the classifier understands", () => {
    for (const word of ["recap", "repeat", "casebook", "pause", "resume", "Accuse"]) {
      expect(HELP_TEXT).toContain(word);
    }
  });
});
