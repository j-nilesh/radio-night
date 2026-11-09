"use client";

/**
 * AccusationPanel.tsx
 * Choose a suspect, choose the evidence that supports the accusation, confirm.
 * The server decides everything that follows; this only gathers the choices.
 */

import { useEffect, useRef, useState } from "react";
import type { PlayerView } from "@ai-orchestration/scene-view";

type Props = {
  accusation: NonNullable<PlayerView["accusation"]>;
  clues: PlayerView["casebook"]["clues"];
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (suspectId: string, evidenceIds: string[]) => void;
};

const MIN_EVIDENCE = 2;

export function AccusationPanel({ accusation, clues, submitting, error, onClose, onSubmit }: Props) {
  const [suspectId, setSuspectId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const suspect = accusation.suspects.find((s) => s.id === suspectId) ?? null;
  const canContinue = !!suspect && evidence.size >= MIN_EVIDENCE;

  useEffect(() => {
    headingRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const toggle = (id: string) =>
    setEvidence((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(8,6,4,0.8)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="accuse-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl p-6 flex flex-col gap-6"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-mid)" }}
      >
        <h2
          id="accuse-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-bold outline-none"
          style={{ color: "var(--text-primary)" }}
        >
          Make an accusation
        </h2>

        {/* ── Not ready yet ── */}
        {!accusation.ready && (
          <>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {accusation.hint}
            </p>
            <button onClick={onClose} className="btn btn-ghost self-end">
              Keep investigating
            </button>
          </>
        )}

        {/* ── Choose ── */}
        {accusation.ready && !confirming && (
          <>
            <fieldset className="flex flex-col gap-3">
              <legend
                className="text-xs font-semibold tracking-widest uppercase mb-1"
                style={{ color: "var(--text-muted)" }}
              >
                Who did it?
              </legend>
              <div role="radiogroup" aria-label="Suspect" className="flex flex-col gap-2">
                {accusation.suspects.map((s) => {
                  const active = s.id === suspectId;
                  return (
                    <button
                      key={s.id}
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSuspectId(s.id)}
                      className="text-left rounded-lg px-4 py-3 transition-colors"
                      style={{
                        background: active ? "rgba(120,50,8,0.3)" : "var(--bg-raised)",
                        border: `1.5px solid ${active ? "var(--amber)" : "var(--border-mid)"}`,
                      }}
                    >
                      <span
                        className="block text-sm font-semibold"
                        style={{ color: active ? "var(--amber-text)" : "var(--text-primary)" }}
                      >
                        {s.name}
                      </span>
                      <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                        {s.role}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-3">
              <legend
                className="text-xs font-semibold tracking-widest uppercase mb-1"
                style={{ color: "var(--text-muted)" }}
              >
                What proves it?
              </legend>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                Put forward the evidence that supports your accusation. Choose at least {MIN_EVIDENCE}.
              </p>
              <ul className="flex flex-col gap-2">
                {clues.map((c) => {
                  const checked = evidence.has(c.id);
                  return (
                    <li key={c.id}>
                      <label
                        className="flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer"
                        style={{
                          background: checked ? "rgba(120,50,8,0.2)" : "var(--bg-raised)",
                          border: `1px solid ${checked ? "var(--amber-dim)" : "var(--border)"}`,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(c.id)}
                          className="mt-1"
                          style={{ accentColor: "var(--amber)" }}
                        />
                        <span className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                              {c.title}
                            </span>
                            <span className="badge">{c.kind === "physical" ? "Found" : "Said"}</span>
                          </span>
                          <span className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                            {c.summary}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {evidence.size} selected
              </p>
            </fieldset>

            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="btn btn-ghost">
                Cancel
              </button>
              <button onClick={() => setConfirming(true)} disabled={!canContinue} className="btn btn-primary">
                Continue
              </button>
            </div>
          </>
        )}

        {/* ── Confirm ── */}
        {accusation.ready && confirming && suspect && (
          <>
            <p className="text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              You are about to accuse{" "}
              <strong style={{ color: "var(--amber-text)" }}>{suspect.name}</strong>, with {evidence.size}{" "}
              piece{evidence.size === 1 ? "" : "s"} of evidence. This closes the case. You can&rsquo;t take it
              back.
            </p>
            {error && (
              <p role="alert" className="text-sm" style={{ color: "#fca5a5" }}>
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirming(false)} disabled={submitting} className="btn btn-ghost">
                Back
              </button>
              <button
                onClick={() => onSubmit(suspect.id, Array.from(evidence))}
                disabled={submitting}
                className="btn btn-primary"
              >
                {submitting ? "Naming…" : `Name ${suspect.name.split(" ")[0]}`}
              </button>
            </div>
          </>
        )}

        {/* Errors from the choose step (e.g. a refusal) */}
        {accusation.ready && !confirming && error && (
          <p role="alert" className="text-sm" style={{ color: "#fca5a5" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
