"use client";

/**
 * Casebook.tsx
 * What the detective has learned. Physical finds and witness testimony are
 * labelled differently: a claim is never presented as an established fact.
 */

import type { PlayerView } from "@ai-orchestration/scene-view";
import type { ImageRef } from "@ai-orchestration/case-content";
import { Photo } from "./Photo";
import { EvidencePhoto } from "./EvidencePhoto";
import { initials } from "../lib/short-role";

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

      <People casebook={casebook} />

      {casebook.clues.length === 0 && (
        <p className="text-sm italic leading-relaxed" style={{ color: "var(--text-faint)" }}>
          Nothing yet. Question the people here, and look around.
        </p>
      )}

      <Section title="Found" items={found} tag="Found" />
      <Section title="Testimony" items={said} tag="Said" />

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
      <p className="label-type text-xs font-semibold tracking-wide" style={{ color: "var(--text-muted)" }}>
        {title}
      </p>
      <ul className="flex flex-col gap-3">
        {items.map((c) => (
          <li
            key={c.id}
            className="rounded-lg px-3 py-2.5 flex items-start gap-3"
            style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}
          >
            {/* The title and summary beside it describe the find, so the thumbnail is decorative */}
            {c.image && (
              <div className="w-14 shrink-0 rounded overflow-hidden" style={{ border: "1px solid var(--border-mid)" }}>
                <EvidencePhoto image={c.image} showText={false} decorative />
              </div>
            )}
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
                >
                  {c.title}
                </span>
                <span className="badge">{tag}</span>
              </div>
              <span className="typed-note text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {c.summary}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The victim first, then everyone the detective has spoken with. */
function People({ casebook }: { casebook: PlayerView["casebook"] }) {
  const { victim, interviewed } = casebook;
  if (!victim && interviewed.length === 0) return null;
  return (
    <section className="flex flex-col gap-3" aria-label="People">
      <p className="text-xs font-semibold tracking-wide" style={{ color: "var(--text-muted)" }}>
        People
      </p>
      <ul className="flex flex-col gap-3">
        {victim && <PersonRow name={victim.name} role={victim.role} image={victim.image} tag="The victim" />}
        {interviewed.map((p) => (
          <PersonRow key={p.id} name={p.name} role={p.role} image={p.portrait} />
        ))}
      </ul>
    </section>
  );
}

function PersonRow({ name, role, image, tag }: { name: string; role: string; image?: ImageRef; tag?: string }) {
  return (
    <li
      className="rounded-lg px-3 py-2.5 flex items-center gap-3"
      style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}
    >
      {/* The name is written beside the picture, so the picture is decorative */}
      <span className="w-11 shrink-0 relative block rounded overflow-hidden" style={{ aspectRatio: "4 / 5", background: "var(--bg)" }}>
        {image ? (
          <Photo image={image} sizing="fill" decorative fallbackLabel={initials(name)} />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold" style={{ color: "var(--text-muted)" }} aria-hidden="true">
            {initials(name)}
          </span>
        )}
      </span>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        {tag && <span className="badge self-start whitespace-nowrap">{tag}</span>}
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
          {name}
        </span>
        <span className="text-xs leading-snug" style={{ color: "var(--text-secondary)" }}>
          {role}
        </span>
      </div>
    </li>
  );
}
