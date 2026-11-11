"use client";

import { useState, useCallback } from "react";

type BusName = "dialogue" | "music" | "fx";

type AudioControlsProps = {
  getMixer?: () => {
    getSettings: () => { dialogue: number; music: number; fx: number; dialogueFocusEnabled: boolean };
    setGain: (bus: BusName, value: number) => void;
    setDialogueFocus: (enabled: boolean) => void;
  };
};

const BUSES: { id: BusName; label: string; icon: string }[] = [
  { id: "dialogue", label: "Dialogue", icon: "🗣" },
  { id: "music",    label: "Music",    icon: "🎵" },
  { id: "fx",       label: "Effects",  icon: "✨" },
];

export function AudioControls({ getMixer }: AudioControlsProps) {
  // This panel is only shown after the case page has loaded in the browser, so
  // the saved settings can be read when it first renders.
  const [initial] = useState(() => {
    const s = getMixer?.().getSettings();
    return {
      gains: s ? { dialogue: s.dialogue, music: s.music, fx: s.fx } : { dialogue: 1, music: 0.35, fx: 0.55 },
      focus: s?.dialogueFocusEnabled ?? false,
    };
  });
  const [gains, setGains] = useState(initial.gains);
  const [focusMode, setFocusMode] = useState(initial.focus);

  const handleGain = useCallback((bus: BusName, v: number) => {
    setGains((p) => ({ ...p, [bus]: v }));
    getMixer?.().setGain(bus, v);
  }, [getMixer]);

  const handleFocus = useCallback(() => {
    const next = !focusMode;
    setFocusMode(next);
    getMixer?.().setDialogueFocus(next);
  }, [focusMode, getMixer]);

  return (
    <div className="flex flex-col gap-5">
      <p
        className="text-xs font-semibold tracking-widest uppercase"
        style={{ color: "var(--text-muted)" }}
      >
        Audio Levels
      </p>

      {BUSES.map(({ id, label, icon }) => (
        <div key={id} className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <label
              htmlFor={`gain-${id}`}
              className="text-xs flex items-center gap-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              <span aria-hidden="true">{icon}</span> {label}
            </label>
            <span
              className="text-xs tabular-nums font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              {Math.round(gains[id] * 100)}%
            </span>
          </div>
          <input
            id={`gain-${id}`}
            type="range"
            min={0} max={1} step={0.01}
            value={gains[id]}
            onChange={(e) => handleGain(id, parseFloat(e.target.value))}
            aria-label={`${label} volume`}
            className="w-full h-1.5 rounded-full cursor-pointer appearance-none"
            style={{
              accentColor: "var(--amber)",
              background: `linear-gradient(to right, var(--amber) ${gains[id] * 100}%, var(--border-mid) ${gains[id] * 100}%)`,
            }}
          />
        </div>
      ))}

      {/* Dialogue Focus */}
      <button
        onClick={handleFocus}
        aria-pressed={focusMode}
        className="text-xs py-2 px-3 rounded-lg font-medium transition-all"
        style={
          focusMode
            ? { background: "rgba(120,50,8,0.35)", border: "1.5px solid var(--amber)", color: "var(--amber-text)" }
            : { background: "var(--bg-raised)", border: "1px solid var(--border-mid)", color: "var(--text-muted)" }
        }
      >
        {focusMode ? "✓ Dialogue Focus on" : "Dialogue Focus"}
      </button>

      <p className="text-xs leading-snug" style={{ color: "var(--text-faint)" }}>
        Dialogue Focus ducks music during speech — useful with a shared speaker.
      </p>
    </div>
  );
}
