import { describe, expect, it } from "vitest";
import { needleAngle } from "./VuMeter";

describe("VU meter needle", () => {
  it("rests in silence", () => {
    expect(needleAngle(0)).toBe(-40);
    expect(needleAngle(0.001)).toBe(-40);
  });

  it("rises with level and stops at the red mark", () => {
    const quiet = needleAngle(0.02);
    const speech = needleAngle(0.1);
    expect(quiet).toBeGreaterThan(-40);
    expect(speech).toBeGreaterThan(quiet);
    expect(needleAngle(1)).toBe(40);
  });
});
