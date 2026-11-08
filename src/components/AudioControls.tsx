"use client";

/**
 * AudioControls.tsx
 * Volume sliders for the three audio buses: Dialogue, Music, FX.
 * Settings are persisted to localStorage via the AudioMixer, NOT to run state.
 */

import { useState, useEffect, useCallback } from "react";

type BusName = "dialogue" | "music" | "fx";

type AudioControlsProps = {
  /** Mixer getter — passed as prop so this component stays testable without real audio */
  getMixer?: () => {
    getSettings: () => { dialogue: number; music: number; fx: number; dialogueFocusEnabled: boolean };
    setGain: (bus: BusName, value: number) => void;
    setDialogueFocus: (enabled: boolean) => void;
  };
};

const LABELS: Record<BusName, string> = {
  dialogue: "Dialogue",
  music: "Music",
  fx: "Effects",
};

export function AudioControls({ getMixer }: AudioControlsProps) {
  const [gains, setGains] = useState({ dialogue: 1, music: 0.35, fx: 0.55 });
  const [focusMode, setFocusMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!getMixer) return;
    const settings = getMixer().getSettings();
    setGains({ dialogue: settings.dialogue, music: settings.music, fx: settings.fx });
    setFocusMode(settings.dialogueFocusEnabled);
  }, [getMixer]);

  const handleGainChange = useCallback(
    (bus: BusName, value: number) => {
      setGains((prev) => ({ ...prev, [bus]: value }));
      getMixer?.().setGain(bus, value);
    },
    [getMixer]
  );

  const handleFocusToggle = useCallback(() => {
    const next = !focusMode;
    setFocusMode(next);
    getMixer?.().setDialogueFocus(next);
  }, [focusMode, getMixer]);

  if (!mounted) return null;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-sm p-4 space-y-4">
      <h3 className="text-xs tracking-widest uppercase text-neutral-500">Audio</h3>

      {(["dialogue", "music", "fx"] as BusName[]).map((bus) => (
        <div key={bus} className="flex items-center gap-3">
          <label
            className="text-xs text-neutral-400 w-16 shrink-0"
            htmlFor={`gain-${bus}`}
          >
            {LABELS[bus]}
          </label>
          <input
            id={`gain-${bus}`}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={gains[bus]}
            onChange={(e) => handleGainChange(bus, parseFloat(e.target.value))}
            className="flex-1 accent-amber-600 h-1"
            aria-label={`${LABELS[bus]} volume`}
          />
          <span className="text-xs text-neutral-600 w-8 text-right tabular-nums">
            {Math.round(gains[bus] * 100)}
          </span>
        </div>
      ))}

      {/* Dialogue Focus preset */}
      <button
        onClick={handleFocusToggle}
        aria-pressed={focusMode}
        className={`w-full text-xs py-1.5 px-3 rounded-sm border transition-colors ${
          focusMode
            ? "bg-amber-700 border-amber-600 text-white"
            : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600"
        }`}
      >
        {focusMode ? "✓ Dialogue Focus" : "Dialogue Focus"}
      </button>
    </div>
  );
}
