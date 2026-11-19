import { describe, expect, it } from "vitest";
import { buildRecap, buildSaveSummary, buildWelcomeBack, HELP_TEXT } from "./recap";
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
        interviewed: [{ id: "a", name: "Ray", role: "bartender" }],
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

describe("buildSaveSummary", () => {
  it("counts people and finds and says where the detective is", () => {
    const summary = buildSaveSummary(
      {
        ...base,
        scene: { id: "k", name: "The Kitchen" },
        casebook: {
          interviewed: [
            { id: "a", name: "Ray", role: "bartender" },
            { id: "b", name: "Edna", role: "innkeeper" },
          ],
          clues: [{ id: "c1", title: "A glass ashtray", summary: "", kind: "physical" }],
        },
      },
      4
    );
    expect(summary).toMatchObject({ sceneName: "The Kitchen", peopleQuestioned: 2, finds: 1, roomsVisited: 4, finished: false, endingTitle: null });
    expect(summary.headline).toBe("In the Kitchen. 2 people questioned, 1 find in the casebook.");
  });

  it("reads naturally for a fresh start and for one person", () => {
    expect(buildSaveSummary(base, 1).headline).toBe("In Tap Room. 0 people questioned, 0 finds in the casebook.");
    const one = buildSaveSummary({ ...base, casebook: { clues: [], interviewed: [{ id: "a", name: "Ray", role: "x" }] } }, 1);
    expect(one.headline).toContain("1 person questioned");
  });

  it("names the ending once the case is closed, and nothing else about the solution", () => {
    const summary = buildSaveSummary(
      {
        ...base,
        ending: { id: "e", title: "The wrong man", narration: "SECRET-NARRATION", solved: false, assessment: "SECRET-ASSESSMENT", accusedName: "Dwight", debrief: null },
      },
      5
    );
    expect(summary.finished).toBe(true);
    expect(summary.endingTitle).toBe("The wrong man");
    expect(JSON.stringify(summary)).not.toMatch(/SECRET|Dwight/);
  });

  it("carries only what the view already holds", () => {
    const text = JSON.stringify(buildSaveSummary(base, 2));
    expect(text).not.toMatch(/killer|culprit|truth|ray kowalski/i);
  });
});

describe("buildWelcomeBack", () => {
  it("greets the detective and then gives the recap", () => {
    const text = buildWelcomeBack(base);
    expect(text.startsWith("Welcome back, detective. ")).toBe(true);
    expect(text).toContain(buildRecap(base));
  });
});
