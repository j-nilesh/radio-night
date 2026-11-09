"use client";

import { useEffect, useRef } from "react";

export type DialogueTurn = {
  id: string;
  actor: "player" | "character" | "narrator";
  text: string;
  classification?: string;
  timestamp: Date;
};

type DialogueDisplayProps = {
  turns: DialogueTurn[];
  characterName?: string;
  isLoading?: boolean;
};

const CLASSIFICATION_LABEL: Partial<Record<string, string>> = {
  OUT_OF_SCOPE: "Off topic",
  OUT_OF_PERIOD: "Out of period",
  INAPPROPRIATE: "Not permitted",
  UNCLEAR: "Unclear",
};

export function DialogueDisplay({ turns, characterName = "Character", isLoading }: DialogueDisplayProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, isLoading]);

  if (turns.length === 0 && !isLoading) {
    return (
      <div
        className="flex-1 flex items-center justify-center text-sm italic p-10"
        style={{ color: "var(--text-faint)" }}
      >
        The investigation begins. Ask your first question.
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-5"
      role="log"
      aria-label="Dialogue transcript"
      aria-live="polite"
    >
      {turns.map((turn) => {
        const isPlayer = turn.actor === "player";
        const isNarrator = turn.actor === "narrator";
        const badge = turn.classification ? CLASSIFICATION_LABEL[turn.classification] : null;

        /* ── Narrator line ── */
        if (isNarrator) {
          return (
            <div key={turn.id} className="flex justify-center">
              <p
                className="text-sm italic text-center max-w-lg leading-relaxed px-4"
                style={{ color: "var(--text-muted)" }}
              >
                {turn.text}
              </p>
            </div>
          );
        }

        /* ── Player bubble ── */
        if (isPlayer) {
          return (
            <div key={turn.id} className="flex justify-end">
              <div className="flex flex-col items-end gap-1 max-w-[80%]">
                <span
                  className="text-xs font-semibold tracking-wide"
                  style={{ color: "var(--amber)" }}
                >
                  Detective
                </span>
                <div
                  className="px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-mid)",
                    color: "var(--text-primary)",
                  }}
                >
                  {turn.text}
                </div>
              </div>
            </div>
          );
        }

        /* ── Character bubble ── */
        return (
          <div key={turn.id} className="flex justify-start">
            <div className="flex flex-col items-start gap-1 max-w-[80%]">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-semibold tracking-wide"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {characterName}
                </span>
                {badge && (
                  <span className="badge">{badge}</span>
                )}
              </div>
              <div
                className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
                style={{
                  background: "rgba(120,50,8,0.15)",
                  border: "1px solid rgba(180,83,9,0.25)",
                  color: "var(--text-primary)",
                }}
              >
                {turn.text}
              </div>
            </div>
          </div>
        );
      })}

      {/* Typing indicator */}
      {isLoading && (
        <div className="flex justify-start" aria-label="Waiting for response" aria-live="polite">
          <div
            className="px-4 py-3 rounded-2xl rounded-tl-sm"
            style={{
              background: "rgba(120,50,8,0.15)",
              border: "1px solid rgba(180,83,9,0.25)",
            }}
          >
            <div className="flex gap-1.5 items-center h-4" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{
                    background: "var(--amber)",
                    animationDelay: `${i * 160}ms`,
                    opacity: 0.7,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}
