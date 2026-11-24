import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { modelBudgetLeft, spendModelReply, poolFor, resetModelBudget, modelBudgetStatus } from "./model-budget";

beforeEach(() => {
  resetModelBudget();
  process.env.MODEL_DAILY_REPLIES_PUBLIC = "3";
  process.env.MODEL_DAILY_REPLIES_CODE = "5";
});
afterEach(() => {
  delete process.env.MODEL_DAILY_REPLIES_PUBLIC;
  delete process.env.MODEL_DAILY_REPLIES_CODE;
  vi.useRealTimers();
});

describe("daily model-reply budget", () => {
  it("lets replies through until the cap and then stops", () => {
    for (let i = 0; i < 3; i += 1) {
      expect(modelBudgetLeft("public")).toBe(true);
      spendModelReply("public");
    }
    expect(modelBudgetLeft("public")).toBe(false);
  });

  it("keeps a separate pool for access-code holders, so a flood of anonymous sessions cannot starve them", () => {
    for (let i = 0; i < 3; i += 1) spendModelReply("public");
    expect(modelBudgetLeft("public")).toBe(false);
    expect(modelBudgetLeft("code")).toBe(true);
  });

  it("picks the pool from the session's access label", () => {
    expect(poolFor({ accessLabel: null })).toBe("public");
    expect(poolFor({ accessLabel: "judges" })).toBe("code");
  });

  it("starts again on a new day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-26T12:00:00Z"));
    for (let i = 0; i < 3; i += 1) spendModelReply("public");
    expect(modelBudgetLeft("public")).toBe(false);
    vi.setSystemTime(new Date("2026-11-27T00:05:00Z"));
    expect(modelBudgetLeft("public")).toBe(true);
  });

  it("a cap of 0 switches the model off for that pool", () => {
    process.env.MODEL_DAILY_REPLIES_PUBLIC = "0";
    expect(modelBudgetLeft("public")).toBe(false);
  });

  it("falls back to the defaults when the setting is missing or not a number", () => {
    delete process.env.MODEL_DAILY_REPLIES_PUBLIC;
    process.env.MODEL_DAILY_REPLIES_CODE = "lots";
    expect(modelBudgetStatus().public.cap).toBe(1500);
    expect(modelBudgetStatus().code.cap).toBe(3000);
  });
});
