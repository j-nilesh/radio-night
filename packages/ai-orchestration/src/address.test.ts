import { describe, it, expect } from "vitest";
import { findMisaddress, type Addressable } from "./address";

const PEOPLE: Addressable[] = [
  { id: "ray", name: "Ray Kowalski", aliases: ["Mr. Kowalski"] },
  { id: "dwight", name: "Dwight Wentworth", aliases: ["Mr. Wentworth"] },
  { id: "carol", name: "Carol Wentworth", aliases: ["Mrs. Wentworth", "Ms. Wentworth", "Miss Wentworth"] },
  { id: "edna", name: "Edna Marsh", aliases: ["Mrs. Marsh", "Ms. Marsh", "Miss Marsh"] },
  { id: "dennis", name: "Dennis Pruett", aliases: ["Mr. Pruett"] },
];
const who = (text: string, listener: string) => findMisaddress(text, listener, PEOPLE)?.id ?? null;

describe("a direct address to someone else is noticed", () => {
  it.each([
    ["So, Carol, where were you earlier this evening?", "edna", "carol"],
    ["So, Ray, how long have you worked at this bar?", "edna", "ray"],
    ["Carol, where were you?", "edna", "carol"],
    ["Hey Carol, what happened?", "ray", "carol"],
    ["Excuse me, Mrs. Wentworth, did you see anyone?", "edna", "carol"],
    ["Mr. Wentworth, I have a few questions.", "ray", "dwight"],
    ["Where were you, Carol?", "edna", "carol"],
    ["Did you hear anything, Dennis?", "ray", "dennis"],
    ["You said, Ray, that you heard nothing.", "dennis", "ray"],
    ["Carol where were you at nine?", "edna", "carol"],
    ["Kowalski, a word.", "edna", "ray"],
    ["Ray Kowalski, where were you?", "edna", "ray"],
    ["ray, did you see him", "dennis", "ray"],
    ["Mrs Marsh, a question please", "dennis", "edna"],
  ])("%s (asked of %s)", (text, listener, expected) => {
    expect(who(text, listener)).toBe(expected);
  });

  it("names the person with a name from the case, not from the player's text", () => {
    const hit = findMisaddress("hey CAROL, hi", "edna", PEOPLE);
    expect(hit).toEqual({ id: "carol", alias: "Carol" });
  });
});

describe("a mention, or the right person, is left alone", () => {
  it.each([
    ["Edna, what did Carol say to you?", "edna"],
    ["What did Carol say?", "edna"],
    ["Was Carol here earlier?", "edna"],
    ["Carol was here earlier, wasn't she?", "edna"],
    ["Did you see Dwight come in?", "ray"],
    ["Tell Carol I said hello.", "edna"],
    ["I heard Ray was upstairs.", "dennis"],
    ["Who was sitting with Mrs. Wentworth?", "edna"],
    ["What does Wentworth do for a living?", "ray"],
    ["Ray, where were you tonight?", "ray"],
    ["Where were you, Ray?", "ray"],
    ["Ray, did Carol leave before you, Ray?", "ray"],
    ["So, Edna, did Carol or Ray leave first?", "edna"],
    ["Who told you that, Edna?", "edna"],
    ["Where were you at nine?", "edna"],
    ["", "edna"],
  ])("%s (asked of %s)", (text, listener) => {
    expect(who(text, listener)).toBeNull();
  });

  it("says nothing when there is no listener", () => {
    expect(findMisaddress("Carol, where were you?", undefined, PEOPLE)).toBeNull();
  });

  it("does not treat a surname shared by two people as an address", () => {
    expect(who("Wentworth, where were you?", "edna")).toBeNull();
  });

  it("does not take Christmas carols for Carol", () => {
    expect(who("Did anyone sing a carol tonight?", "edna")).toBeNull();
  });
});

describe("with everyone, for every pair", () => {
  it("noticed when speaking to someone else, never when speaking to the listener", () => {
    for (const listener of PEOPLE) {
      for (const other of PEOPLE) {
        const text = `${other.name.split(" ")[0]}, where were you tonight?`;
        const got = findMisaddress(text, listener.id, PEOPLE);
        if (other.id === listener.id) expect(got, text).toBeNull();
        else expect(got?.id, `${text} to ${listener.name}`).toBe(other.id);
      }
    }
  });
});
