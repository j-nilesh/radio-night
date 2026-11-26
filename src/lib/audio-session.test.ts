import { describe, it, expect, afterEach, vi } from "vitest";
import { setAudioSession } from "./audio-session";

afterEach(() => vi.unstubAllGlobals());

describe("setAudioSession", () => {
  it("sets the session type where the browser supports it", () => {
    const audioSession = { type: "auto" };
    vi.stubGlobal("navigator", { audioSession });
    expect(setAudioSession("play-and-record")).toBe(true);
    expect(audioSession.type).toBe("play-and-record");
    expect(setAudioSession("playback")).toBe(true);
    expect(audioSession.type).toBe("playback");
  });

  it("does nothing, and does not fail, where there is no audio session", () => {
    vi.stubGlobal("navigator", {});
    expect(setAudioSession("playback")).toBe(false);
    vi.stubGlobal("navigator", undefined);
    expect(setAudioSession("playback")).toBe(false);
  });

  it("does not fail if the browser refuses the change", () => {
    vi.stubGlobal("navigator", {
      audioSession: {
        get type() {
          return "auto";
        },
        set type(_v: string) {
          throw new Error("refused");
        },
      },
    });
    expect(setAudioSession("playback")).toBe(false);
  });
});
