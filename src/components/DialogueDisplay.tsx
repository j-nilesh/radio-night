"use client";

/**
 * DialogueDisplay.tsx
 * Shows the conversation history between the player and character.
 * Caption-first: text always visible regardless of audio state.
 */

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

const ACTOR_LABELS: Record<DialogueTurn["actor"], string> = {
  player: "Detective",
  character: "",
  narrator: "Narrator",
};

const CLASSIFICATION_BADGE: Partial<Record<string, string>> = {
  OUT_OF_SCOPE: "Off topic",
  OUT_OF_PERIOD: "Out of period",
  INAPPROPRIATE: "Not permitted",
  UNCLEAR: "Unclear",
  CONTROL_COMMAND: "",
  IN_SCOPE: "",
};

export function DialogueDisplay({
  turns,
  characterName = "Character",
  isLoading,
}: DialogueDisplayProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to latest turn
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, isLoading]);

  if (turns.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm italic p-8">
        The investigation begins. Ask your first question.
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto space-y-4 p-4"
      role="log"
      aria-label="Dialogue transcript"
      aria-live="polite"
    >
      {turns.map((turn) => {
        const isPlayer = turn.actor === "player";
        const label =
          turn.actor === "character"
            ? characterName
            : ACTOR_LABELS[turn.actor];
        const badge =
          turn.classification &&
          CLASSIFICATION_BADGE[turn.classification] !== undefined
            ? CLASSIFICATION_BADGE[turn.classification]
            : null;

        return (
          <div
            key={turn.id}
            className={`flex flex-col gap-1 ${isPlayer ? "items-end" : "items-start"}`}
          >
            <div className="flex items-center gap-2">
              {label && (
                <span
                  className={`text-xs font-semibold tracking-wide ${
                    isPlayer ? "text-amber-600" : "text-neutral-400"
                  }`}
                >
                  {label}
                </span>
              )}
              {badge && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500">
                  {badge}
                </span>
              )}
            </div>
            <div
              className={`max-w-prose rounded-sm px-4 py-2.5 text-sm leading-relaxed ${
                isPlayer
                  ? "bg-neutral-800 text-neutral-200 rounded-tr-none"
                  : "bg-amber-950/40 border border-amber-900/30 text-amber-100 rounded-tl-none"
              }`}
            >
              {turn.text}
            </div>
          </div>
        );
      })}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-start gap-2" aria-live="polite" aria-label="Waiting for response">
          <div className="bg-amber-950/40 border border-amber-900/30 rounded-sm px-4 py-2.5 text-sm">
            <div className="flex gap-1" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
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
