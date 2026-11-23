import { describe, it, expect } from "vitest";
import { splitSentences, revealPlan, sentencesShown, estimateSeconds } from "./reveal";

describe("splitSentences", () => {
  it("splits on sentence ends and keeps the opening narration intact", () => {
    const s = splitSentences(
      "Millhaven, New Hampshire. October 17th, 1981. Just past eleven at night, and the rain isn't letting up. Is that so? It is.",
    );
    expect(s).toEqual([
      "Millhaven, New Hampshire.",
      "October 17th, 1981.",
      "Just past eleven at night, and the rain isn't letting up.",
      "Is that so?",
      "It is.",
    ]);
  });

  it("does not split inside a sentence that continues with a dash or lower-case word", () => {
    expect(splitSentences("A woman's voice, steady but not calm. Gerald Fenn — painter — died.")).toHaveLength(2);
  });

  it("returns one piece for a single sentence and none for empty text", () => {
    expect(splitSentences("Just one.")).toEqual(["Just one."]);
    expect(splitSentences("   ")).toEqual([]);
  });

  it("joins back to the same words", () => {
    const text = "One two. Three four five. Six.";
    expect(splitSentences(text).join(" ")).toBe(text);
  });
});

describe("revealPlan and sentencesShown", () => {
  const sentences = ["One two.", "Three four five six.", "Seven eight."];
  const plan = revealPlan(sentences);

  it("starts each sentence by its share of the words", () => {
    expect(plan[0]).toBe(0);
    expect(plan[1]).toBeCloseTo(0.25);
    expect(plan[2]).toBeCloseTo(0.75);
  });

  it("shows the first sentence immediately and the rest as time passes", () => {
    expect(sentencesShown(plan, 0, 10)).toBe(1);
    expect(sentencesShown(plan, 2.3, 10)).toBe(2);
    expect(sentencesShown(plan, 7.4, 10)).toBe(3);
    expect(sentencesShown(plan, 100, 10)).toBe(3);
  });

  it("never shows fewer sentences as time goes on", () => {
    let last = 0;
    for (let t = 0; t <= 12; t += 0.1) {
      const n = sentencesShown(plan, t, 10);
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
  });

  it("estimates a longer line as taking longer", () => {
    expect(estimateSeconds("a b c d e f g h i j")).toBeGreaterThan(estimateSeconds("a b c"));
  });
});
