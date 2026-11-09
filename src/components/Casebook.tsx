"use client";

/**
 * Casebook.tsx
 * What the detective has learned. Physical finds and witness testimony are
 * labelled differently: a claim is never presented as an established fact.
 */

import type { PlayerView } from "@ai-orchestration/scene-view";

export function Casebook({ casebook }: { casebook: PlayerView["casebook"] }) {
  const found = casebook.clues.filter((c) => c.kind === "physical");
  const said = casebook.clues.filter((c) => c.kind === "testimony");

  return (
    <div className="flex flex-col gap-6">
      <p
        className="text-xs font-semibold tracking-widest uppercase"
        style={{ color: "var(--text-muted)" }}
      >
        Casebook
      </p>

      {casebook.clues.length === 0 && (
        <p className="text-sm italic leading-relaxed" style={{ color: "var(--text-faint)" }}>
          Nothing yet. Question the people here, and look around.
        </p>
      )}

      <Section title="Found" items={found} tag="Found" />
      <Section title="Testimony" items={said} tag="Said" />

      {casebook.interviewed.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-wide" style={{ color: "var(--text-muted)" }}>
            Spoken with
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {casebook.interviewed.map((p) => p.name).join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  items,
  tag,
}: {
  title: string;
  items: PlayerView["casebook"]["clues"];
  tag: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <p className="text-xs font-semibold tracking-wide" style={{ color: "var(--text-muted)" }}>
        {title}
      </p>
      <ul className="flex flex-col gap-3">
        {items.map((c) => (
          <li
            key={c.id}
            className="rounded-lg px-3 py-2.5 flex flex-col gap-1"
            style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
              >
                {c.title}
              </span>
              <span className="badge">{tag}</span>
            </div>
            <span className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {c.summary}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
