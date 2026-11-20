"use client";

import { useEffect, useRef } from "react";
import type { ImageRef } from "@ai-orchestration/case-content";
import { EvidencePhoto } from "./EvidencePhoto";
import { CassetteIcon } from "./PeriodIcons";

export type DialogueTurn = {
  id: string;
  /** note = a casebook entry added as a result of the previous line */
  actor: "player" | "character" | "narrator" | "note";
  text: string;
  /** Who is speaking, for character turns */
  speakerName?: string;
  /** A picture shown beside a narrator line (an examined find) */
  image?: ImageRef;
  /** Writing set over that picture (a note) */
  imageText?: string;
  /** A player question that was spoken, not typed (the text is what was heard) */
  spoken?: boolean;
  timestamp: Date;
};

type DialogueDisplayProps = {
  turns: DialogueTurn[];
  isLoading?: boolean;
  /** Name shown on the typing indicator */
  waitingOn?: string;
};

export function DialogueDisplay({ turns, isLoading, waitingOn }: DialogueDisplayProps) {
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
        /* ── Casebook note ── */
        if (turn.actor === "note") {
          return (
            <div key={turn.id} className="flex justify-center">
              <span
                className="text-xs px-3 py-1 rounded-full"
                style={{
                  color: "var(--amber-text)",
                  background: "rgba(120,50,8,0.18)",
                  border: "1px solid rgba(180,83,9,0.3)",
                }}
              >
                {turn.text}
              </span>
            </div>
          );
        }

        /* ── Narrator line ── */
        if (turn.actor === "narrator" && turn.image) {
          /* An examined find: the picture sits beside the words */
          return (
            <div key={turn.id} className="flex justify-center">
              <div className="flex items-start gap-4 max-w-xl px-4">
                <div className="w-32 sm:w-48 shrink-0 rounded overflow-hidden" style={{ border: "1px solid var(--border-mid)" }}>
                  <EvidencePhoto image={turn.image} imageText={turn.imageText} />
                </div>
                <p className="text-sm italic leading-relaxed" style={{ color: "var(--text-muted)", fontFamily: "var(--font-display)" }}>
                  {turn.text}
                </p>
              </div>
            </div>
          );
        }

        if (turn.actor === "narrator") {
          return (
            <div key={turn.id} className="flex justify-center">
              <p
                className="text-base italic text-center max-w-xl leading-relaxed px-4" data-narration
                style={{ color: "var(--text-muted)" }}
              >
                {turn.text}
              </p>
            </div>
          );
        }

        /* ── Player bubble ── */
        if (turn.actor === "player") {
          return (
            <div key={turn.id} className="flex justify-end">
              <div className="flex flex-col items-end gap-1 max-w-[80%]">
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide"
                  style={{ color: "var(--amber)" }}
                >
                  {turn.spoken && <CassetteIcon className="w-5 h-3.5" />}
                  Detective
                  {turn.spoken && <span className="sr-only"> (spoken)</span>}
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
              <span
                className="text-xs font-semibold tracking-wide"
                style={{ color: "var(--text-secondary)" }}
              >
                {turn.speakerName ?? "Character"}
              </span>
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
        <div
          className="flex justify-start"
          role="status"
          aria-label={waitingOn ? `Waiting for ${waitingOn}` : "Waiting for response"}
        >
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
