"use client";

/**
 * SceneBar.tsx
 * Who you can speak to, where you can go, and what you can look at.
 * Only things the player has earned are ever passed in.
 */

import type { PlayerView } from "@ai-orchestration/scene-view";

type SceneBarProps = {
  view: PlayerView;
  selectedCharacterId: string | null;
  disabled?: boolean;
  onSelectCharacter: (id: string) => void;
  onTravel: (sceneId: string) => void;
  onExamine: (clueId: string) => void;
};

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="text-xs font-semibold tracking-widest uppercase pt-2 w-24 shrink-0"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap gap-2">{children}</div>
        {hint && (
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>
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
  onSelectCharacter,
  onTravel,
  onExamine,
}: SceneBarProps) {
  return (
    <nav
      aria-label="Scene"
      className="px-5 py-3 flex flex-col gap-2 shrink-0"
      style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-raised)" }}
    >
      <Row label="Speak to" hint="Tap a name to choose who you are talking to">
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
              className="text-sm px-3 py-1.5 rounded-full transition-colors"
              style={{
                background: active ? "rgba(120,50,8,0.35)" : "var(--bg-card)",
                border: `1.5px solid ${active ? "var(--amber)" : "var(--border-mid)"}`,
                color: active ? "var(--amber-text)" : "var(--text-secondary)",
              }}
            >
              {c.name}
            </button>
          );
        })}
      </Row>

      {view.exits.length > 0 && (
        <Row label="Go to" hint="Walk to another room to find other people and clues">
          {view.exits.map((e) => (
            <button
              key={e.id}
              onClick={() => onTravel(e.id)}
              disabled={disabled}
              className="btn btn-ghost text-sm px-3 py-1.5"
            >
              {e.name} →
            </button>
          ))}
        </Row>
      )}

      {view.examinables.length > 0 && (
        <Row label="Look at" hint="Examine something in this room">
          {view.examinables.map((x) => (
            <button
              key={x.id}
              onClick={() => onExamine(x.id)}
              disabled={disabled}
              className="btn btn-ghost text-sm px-3 py-1.5"
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
