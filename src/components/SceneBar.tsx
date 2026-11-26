"use client";

/**
 * SceneBar.tsx
 * Who you can speak to, where you can go, and what you can look at.
 * Only things the player has earned are ever passed in.
 */

import type { PlayerView } from "@ai-orchestration/scene-view";
import { Photo } from "./Photo";
import { initials, shortRole } from "../lib/short-role";

type SceneBarProps = {
  view: PlayerView;
  selectedCharacterId: string | null;
  disabled?: boolean;
  /** Show the one-line hints under each row (for a player who has not asked anything yet) */
  showHints?: boolean;
  onSelectCharacter: (id: string) => void;
  /** A row to draw the eye to during the first-minute coach */
  highlight?: "people" | "exits";
  /** Open the "Who's who" sheet */
  onOpenCast: () => void;
  onTravel: (sceneId: string) => void;
  onExamine: (clueId: string) => void;
};

function Row({
  glow,
  label,
  hint,
  action,
  children,
}: {
  label: string;
  hint?: string;
  action?: React.ReactNode;
  glow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-1 min-w-0 w-full">
      <div className="flex items-center justify-between gap-3 w-full">
        <span
          className="text-xs font-semibold tracking-widest uppercase shrink-0"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </span>
        {action}
      </div>
      <div className="flex flex-col gap-1 w-full min-w-0">
        <div className={`scene-row flex flex-nowrap sm:flex-wrap gap-2 ${glow ? "coach-glow rounded-xl" : ""}`}>{children}</div>
        {hint && (
          <span className="hidden sm:block text-xs" style={{ color: "var(--text-faint)" }}>
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

export function SceneBar({
  view,
  selectedCharacterId,
  disabled,
  showHints = false,
  onSelectCharacter,
  highlight,
  onOpenCast,
  onTravel,
  onExamine,
}: SceneBarProps) {
  return (
    <nav
      aria-label="Scene"
      className="px-4 sm:px-5 py-2 sm:py-3 flex flex-col gap-2 shrink-0"
      style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-raised)" }}
    >
      <Row
        glow={highlight === "people"}
        label="Speak to"
        hint={showHints ? "Tap a person to see who they are, then choose them to ask" : undefined}
        action={
          view.characters.length > 0 ? (
            <button
              onClick={onOpenCast}
              className="tap-target text-xs underline underline-offset-2 ml-auto"
              style={{ color: "var(--amber-text)" }}
            >
              Who&apos;s who
            </button>
          ) : undefined
        }
      >
        {view.characters.length === 0 && (
          <span className="text-sm py-1.5 italic" style={{ color: "var(--text-faint)" }}>
            No one is here.
          </span>
        )}
        {view.characters.map((c) => {
          const active = c.id === selectedCharacterId;
          return (
            <button
              key={c.id}
              onClick={() => onSelectCharacter(c.id)}
              aria-pressed={active}
              title={c.role}
              className="person-card"
            >
              <span className="person-photo">
                {c.portrait ? (
                  <Photo image={c.portrait} sizing="fill" priority decorative fallbackLabel={initials(c.name)} />
                ) : (
                  <span className="person-initials" aria-hidden="true">
                    {initials(c.name)}
                  </span>
                )}
              </span>
              <span className="person-name">{c.name}</span>
              <span className="person-role">{shortRole(c.role)}</span>
            </button>
          );
        })}
      </Row>

      {view.exits.length > 0 && (
        <Row glow={highlight === "exits"} label="Go to" hint={showHints ? "Move to another room to find people and clues" : undefined}>
          {view.exits.map((e) => (
            <button
              key={e.id}
              onClick={() => onTravel(e.id)}
              disabled={disabled}
              className="btn btn-ghost btn-sm"
            >
              {e.name} →
            </button>
          ))}
        </Row>
      )}

      {view.examinables.length > 0 && (
        <Row label="Look at" hint={showHints ? "Examine something in this room" : undefined}>
          {view.examinables.map((x) => (
            <button
              key={x.id}
              onClick={() => onExamine(x.id)}
              disabled={disabled}
              className="btn btn-ghost btn-sm"
              style={x.examined ? { color: "#55534e" } : undefined}
            >
              {x.examined ? "✓ " : ""}
              {x.label}
            </button>
          ))}
        </Row>
      )}
    </nav>
  );
}
