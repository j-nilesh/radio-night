"use client";
/**
 * CastSheet.tsx
 * "Who's who": the people in the room, with portrait, role and a plain line
 * about each, and a button to ask them something. Opens as a bottom sheet on a
 * phone and a centred panel on a wide screen.
 *
 * It only shows what the player view contains: names, roles and the short
 * public line, never the full dossier.
 */
import { useEffect, useRef } from "react";
import type { PlayerView } from "@ai-orchestration/scene-view";
import { Photo } from "./Photo";
import { initials } from "../lib/short-role";

type Person = PlayerView["characters"][number];

type CastSheetProps = {
  people: Person[];
  /** The person the player tapped; shown first and marked */
  focusId: string | null;
  sceneName: string;
  onAsk: (id: string) => void;
  onClose: () => void;
};

export function CastSheet({ people, focusId, sceneName, onAsk, onClose }: CastSheetProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ordered = [...people].sort((a, b) => (a.id === focusId ? -1 : b.id === focusId ? 1 : 0));

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: "rgba(8,6,4,0.8)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cast-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[85dvh] overflow-y-auto rounded-t-2xl sm:rounded-xl p-5 flex flex-col gap-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-mid)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="cast-title"
              className="text-xl font-bold"
              style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
            >
              Who&apos;s who
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              In {sceneName} right now
            </p>
          </div>
          <button ref={closeButton} onClick={onClose} className="btn btn-ghost btn-sm tap-target">
            Close
          </button>
        </div>
        {ordered.length === 0 && (
          <p className="text-sm italic" style={{ color: "var(--text-faint)" }}>
            No one is here. Try another room.
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {ordered.map((p) => (
            <li
              key={p.id}
              className="flex gap-3 rounded-lg p-3"
              style={{
                background: "var(--bg-raised)",
                border: `1px solid ${p.id === focusId ? "var(--amber)" : "var(--border)"}`,
              }}
            >
              <span
                className="relative block shrink-0 overflow-hidden rounded-md"
                style={{ width: "4.5rem", height: "5.625rem", background: "var(--bg)" }}
              >
                {p.portrait ? (
                  <Photo image={p.portrait} sizing="fill" decorative fallbackLabel={initials(p.name)} />
                ) : (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 flex items-center justify-center text-lg font-semibold"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {initials(p.name)}
                  </span>
                )}
              </span>
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <h3 className="font-semibold leading-tight" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                  {p.name}
                </h3>
                <p className="text-xs uppercase tracking-wider" style={{ color: "var(--amber-text)" }}>
                  {p.role}
                </p>
                {p.about && (
                  <p className="text-sm leading-snug" style={{ color: "var(--text-secondary)" }}>
                    {p.about}
                  </p>
                )}
                <button onClick={() => onAsk(p.id)} className="btn btn-primary btn-sm tap-target self-start mt-1">
                  Ask {p.name.split(" ")[0]}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
