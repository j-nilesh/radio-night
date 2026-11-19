import { describe, it, expect } from "vitest";
import { timeAgo } from "./time-ago";

const NOW = new Date("2026-11-19T12:00:00Z").getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("timeAgo", () => {
  it("says how long ago, in plain words", () => {
    expect(timeAgo(ago(20_000), NOW)).toBe("just now");
    expect(timeAgo(ago(60_000), NOW)).toBe("1 minute ago");
    expect(timeAgo(ago(12 * 60_000), NOW)).toBe("12 minutes ago");
    expect(timeAgo(ago(3 * 3_600_000), NOW)).toBe("3 hours ago");
    expect(timeAgo(ago(26 * 3_600_000), NOW)).toBe("yesterday");
    expect(timeAgo(ago(5 * 86_400_000), NOW)).toBe("5 days ago");
  });
  it("shows nothing for a missing or unreadable time, and never a negative one", () => {
    expect(timeAgo(null, NOW)).toBe("");
    expect(timeAgo("not a date", NOW)).toBe("");
    expect(timeAgo(ago(-5 * 60_000), NOW)).toBe("just now");
  });
});
