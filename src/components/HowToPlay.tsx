"use client";

/**
 * HowToPlay.tsx
 * Three short lines: meet and ask, walk between rooms, casebook and accusation.
 * Opened from the header; a first-time player gets the same ideas on the start
 * screen and from the first-minute coach.
 */

import { useEffect, useRef } from "react";

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: "Meet and ask",
    body: "Tap a face under \"Speak to\" to see who they are, then ask them anything. Tap the big button, speak, and tap again to send. Or type.",
  },
  {
    title: "Walk between rooms",
    body: "Use \"Go to\" to move. Different people and clues are in different rooms, and \"Look at\" examines things.",
  },
  {
    title: "Casebook and accusation",
    body: "Everything you find is kept in the Casebook. When you are sure who did it, press Accuse and choose the evidence.",
  },
];

export function HowToPlay({ onClose }: { onClose: () => void }) {
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    button.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(8,6,4,0.88)" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="howto-title"
        className="w-full max-w-lg rounded-xl p-8 flex flex-col gap-6"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-mid)" }}
      >
        <h2
          id="howto-title"
          className="text-2xl font-bold"
          style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
        >
          How to play
        </h2>
        <ol className="flex flex-col gap-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span
                aria-hidden="true"
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold"
                style={{ background: "rgba(120,50,8,0.35)", color: "var(--amber-text)", border: "1px solid var(--amber)" }}
              >
                {i + 1}
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <button ref={button} onClick={onClose} className="btn btn-primary py-3">
          Got it
        </button>
      </div>
    </div>
  );
}
