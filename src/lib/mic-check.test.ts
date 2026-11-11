import { describe, it, expect } from "vitest";
import { assessRecording, SILENCE_PEAK_RMS, MIN_RECORDING_MS } from "./mic-check";

const rec = (over = {}) => ({ durationMs: 2000, peakRms: 0.08, trackMuted: false, levelsMeasured: true, ...over });

describe("assessRecording", () => {
  it("accepts a normal spoken recording", () => {
    expect(assessRecording(rec())).toEqual({ ok: true });
  });

  it("accepts quiet but real speech", () => {
    expect(assessRecording(rec({ peakRms: SILENCE_PEAK_RMS * 1.5 })).ok).toBe(true);
  });

  it("catches a muted microphone (silence), with advice that mentions muting", () => {
    const v = assessRecording(rec({ peakRms: 0 }));
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.reason).toBe("silent");
      expect(v.message).toMatch(/muted/i);
    }
  });

  it("treats a system-muted track as muted even if some noise got through", () => {
    const v = assessRecording(rec({ trackMuted: true, peakRms: 0.05 }));
    expect(v.ok === false && v.reason).toBe("muted");
  });

  it("catches an accidental double tap before it blames the microphone", () => {
    const v = assessRecording(rec({ durationMs: MIN_RECORDING_MS - 1, peakRms: 0 }));
    expect(v.ok === false && v.reason).toBe("too-short");
  });

  it("is distinct from the server's 'didn't catch that' message", () => {
    const v = assessRecording(rec({ peakRms: 0 }));
    expect(v.ok === false && v.message).not.toMatch(/didn't quite catch/);
  });

  it("does not blame the microphone when the level meter never ran", () => {
    // e.g. Safari left the analysis context suspended: silence here proves nothing
    expect(assessRecording(rec({ peakRms: 0, levelsMeasured: false }))).toEqual({ ok: true });
  });

  it("still catches a system-muted track when levels were not measured", () => {
    const v = assessRecording(rec({ peakRms: 0, levelsMeasured: false, trackMuted: true }));
    expect(v.ok === false && v.reason).toBe("muted");
  });
});
