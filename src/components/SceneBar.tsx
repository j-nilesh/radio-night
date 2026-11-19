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
  onTravel: (sceneId: string) => void;
  onExamine: (clueId: string) => void;
};

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1 min-w-0">
      <span
        className="text-xs font-semibold tracking-widest uppercase shrink-0"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <div className="flex flex-col gap-1 w-full min-w-0">
        <div className="scene-row flex flex-nowrap sm:flex-wrap gap-2">{children}</div>
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
  onTravel,
  onExamine,
}: SceneBarProps) {
  return (
    <nav
      aria-label="Scene"
      className="px-4 sm:px-5 py-2 sm:py-3 flex flex-col gap-2 shrink-0"
      style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-raised)" }}
    >
      <Row label="Speak to" hint={showHints ? "Tap a person to choose who to ask" : undefined}>
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
                  <Photo image={c.portrait} sizing="fill" decorative fallbackLabel={initials(c.name)} />
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
        <Row label="Go to" hint={showHints ? "Move to another room to find people and clues" : undefined}>
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
              style={x.examined ? { color: "var(--text-muted)" } : undefined}
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
