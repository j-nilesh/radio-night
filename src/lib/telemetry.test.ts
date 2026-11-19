import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { telemetryEnabled, logTelemetry, browserFamily, shortId } from "./telemetry";
import { lineKeyFromUrl } from "./line-key";

let dir: string;
const saved = { ...process.env };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "rn-telemetry-"));
  process.env.PLAYTEST_DIR = dir;
});
afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...saved };
  rmSync(dir, { recursive: true, force: true });
});

const settle = () => new Promise((r) => setTimeout(r, 60));

describe("when telemetry is on", () => {
  it("is on in development unless switched off, and never on in production", () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.PLAYTEST_TELEMETRY;
    expect(telemetryEnabled()).toBe(true);
    process.env.PLAYTEST_TELEMETRY = "off";
    expect(telemetryEnabled()).toBe(false);
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.PLAYTEST_TELEMETRY;
    expect(telemetryEnabled()).toBe(false);
    process.env.PLAYTEST_TELEMETRY = "on";
    expect(telemetryEnabled()).toBe(false);
  });

  it("records no words unless asked to", async () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.PLAYTEST_TELEMETRY;
    delete process.env.PLAYTEST_TEXT;
    logTelemetry("turn", { question: "Where were you at ten?", reply: "Behind the bar.", stt: { transcript: "where were you", ms: 900 }, path: "model" });
    await settle();
    const line = readFileSync(join(dir, readdirSync(dir)[0]), "utf8");
    expect(line).not.toMatch(/Where were you|Behind the bar|where were you/);
    const ev = JSON.parse(line.trim().split("\n").pop()!);
    expect(ev).toMatchObject({ questionChars: 22, replyChars: 15, path: "model", stt: { transcriptChars: 14, ms: 900 } });
  });
});

describe("writing events", () => {
  it("appends one JSON object per line, with a timestamp and kind", async () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.PLAYTEST_TELEMETRY;
    logTelemetry("turn", { who: "ray", ms: 12 });
    logTelemetry("speech", { chars: 40 });
    await settle();
    const files = readdirSync(dir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^\d{4}-\d{2}-\d{2}\.jsonl$/);
    const lines = readFileSync(join(dir, files[0]), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.map((l) => l.kind)).toEqual(["turn", "speech"]);
    expect(lines[0]).toMatchObject({ who: "ray", ms: expect.any(Number) });
    expect(typeof lines[0].t).toBe("string");
  });

  it("writes nothing when off", async () => {
    process.env.PLAYTEST_TELEMETRY = "off";
    logTelemetry("turn", { x: 1 });
    await settle();
    expect(readdirSync(dir)).toHaveLength(0);
  });

  it("truncates an oversized field instead of bloating the log", async () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.PLAYTEST_TELEMETRY;
    logTelemetry("turn", { big: "x".repeat(50_000) });
    await settle();
    const line = readFileSync(join(dir, readdirSync(dir)[0]), "utf8");
    expect(line.length).toBeLessThan(6000);
    expect(line).toContain("chars]");
  });

  it("never throws, even when it cannot write", () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.PLAYTEST_TELEMETRY;
    process.env.PLAYTEST_DIR = "/proc/definitely/not/writable";
    expect(() => logTelemetry("turn", { a: 1 })).not.toThrow();
  });
});

describe("helpers", () => {
  it("names browsers from user agents", () => {
    expect(browserFamily("Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15")).toBe("Safari 18");
    expect(browserFamily("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/156.0.0.0 Safari/537.36")).toBe("Chrome 156");
    expect(browserFamily("Mozilla/5.0 Firefox/130.0")).toBe("Firefox 130");
    expect(browserFamily(null)).toBe("unknown");
  });
  it("shortens ids", () => {
    expect(shortId("0123456789abcdef")).toBe("01234567");
    expect(shortId(undefined)).toBeUndefined();
  });
  it("gives the same key to the same audio link and different keys to different ones", () => {
    expect(lineKeyFromUrl("/api/speech?t=abc.def")).toBe(lineKeyFromUrl("/api/speech?t=abc.def"));
    expect(lineKeyFromUrl("/api/speech?t=abc.def")).not.toBe(lineKeyFromUrl("/api/speech?t=abc.xyz"));
  });
});
