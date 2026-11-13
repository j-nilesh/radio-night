import { describe, expect, it } from "vitest";
import { initials, shortRole } from "./short-role";

describe("shortRole", () => {
  it("keeps what the card needs from the roles in the case", () => {
    expect(shortRole("Bartender at the Bridgewater Inn")).toBe("Bartender");
    expect(shortRole("Local businessman, owner of Millhaven Lumber Supply")).toBe("Local businessman");
    expect(shortRole("Owner and innkeeper, Bridgewater Inn")).toBe("Owner and innkeeper");
    expect(shortRole("Local regular, retired mill foreman")).toBe("Local regular");
  });

  it("leaves a role with neither a comma nor an 'at' alone", () => {
    expect(shortRole("Dwight Wentworth's wife")).toBe("Dwight Wentworth's wife");
    expect(shortRole("Portrait painter")).toBe("Portrait painter");
  });

  it("does not cut inside a word that merely contains 'at'", () => {
    expect(shortRole("Chat host")).toBe("Chat host");
    expect(shortRole("Attorney")).toBe("Attorney");
  });

  it("falls back to the whole role when the first clause is empty", () => {
    expect(shortRole(", odd")).toBe(", odd");
  });
});

describe("initials", () => {
  it("takes the first and last name", () => {
    expect(initials("Ray Kowalski")).toBe("RK");
    expect(initials("Gerald Fenn")).toBe("GF");
  });
  it("copes with one name, extra spaces and nothing", () => {
    expect(initials("Narrator")).toBe("N");
    expect(initials("  Edna   Marsh ")).toBe("EM");
    expect(initials("")).toBe("");
  });
});
