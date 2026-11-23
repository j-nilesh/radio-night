"use client";
/**
 * CoachStrip.tsx
 * A single line of guidance above the talk button, for a player's first
 * minutes. It points at what to do next and can be skipped.
 */
import type { CoachStep } from "../lib/coach";

const TEXT: Record<CoachStep, { hint: string; nudge: string }> = {
  person: {
    hint: "Start by tapping a face above to meet someone.",
    nudge: "Stuck? Tap any name under \"Speak to\" to see who they are.",
  },
  talk: {
    hint: "Now ask them something. Tap the big button and speak, or type below.",
    nudge: "Not sure what to ask? Try who they are, where they were tonight, or what they saw.",
  },
  send: {
    hint: "Tap the button again when you are done, to send your question.",
    nudge: "Tap the button again to send.",
  },
  rooms: {
    hint: "Nothing more here? Use \"Go to\" above to walk to another room. New people and clues wait there.",
    nudge: "Use \"Go to\" above to try another room.",
  },
};

export function CoachStrip({ step, nudge, onSkip }: { step: CoachStep; nudge: boolean; onSkip: () => void }) {
  const t = TEXT[step];
  return (
    <div
      role="status"
      className="coach-strip flex items-start gap-3 rounded-lg px-3 py-2"
      style={{ background: "rgba(120,50,8,0.28)", border: "1px solid var(--amber)" }}
    >
      <p className="flex-1 text-sm leading-snug" style={{ color: "var(--amber-text)" }}>
        {nudge ? t.nudge : t.hint}
      </p>
      <button
        onClick={onSkip}
        className="tap-target text-xs underline underline-offset-2 shrink-0"
        style={{ color: "var(--text-muted)" }}
      >
        Skip tips
      </button>
    </div>
  );
}
