"use client";

/**
 * ContinueCard.tsx
 * Offers to pick up the investigation saved for this browser. It asks the server
 * (GET /api/runs/current), which identifies the player by the guest cookie and
 * answers with a short spoiler-safe summary, so nothing about the case lives in
 * the browser. Shows nothing for a first-time visitor, or when the saved case is
 * already closed.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SaveSummary } from "@ai-orchestration/recap";
import { timeAgo } from "../lib/time-ago";

export type SavedRun = {
  runId: string;
  caseTitle: string;
  updatedAt: string | null;
  summary: SaveSummary;
};

/** Loads the saved run, or null when there is none to continue. */
export function useSavedRun(): { run: SavedRun | null; loaded: boolean } {
  const [state, setState] = useState<{ run: SavedRun | null; loaded: boolean }>({ run: null, loaded: false });
  useEffect(() => {
    let cancelled = false;
    fetch("/api/runs/current")
      .then((r) => (r.ok ? r.json() : { run: null }))
      .then((data: { run?: SavedRun | null }) => {
        if (!cancelled) setState({ run: data.run && !data.run.summary.finished ? data.run : null, loaded: true });
      })
      .catch(() => {
        if (!cancelled) setState({ run: null, loaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

export function ContinueCard({ run, className = "" }: { run: SavedRun; className?: string }) {
  const when = timeAgo(run.updatedAt);
  return (
    <section
      aria-label="Your saved investigation"
      className={`w-full rounded-lg px-5 py-4 flex flex-col gap-3 text-left ${className}`}
      style={{ background: "rgba(120,50,8,0.22)", border: "1.5px solid var(--amber)" }}
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: "var(--amber-text)" }}>
          Your investigation is saved{when ? ` · ${when}` : ""}
        </p>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {run.caseTitle}. {run.summary.headline}
        </p>
      </div>
      <Link href={`/case/${run.runId}`} className="btn btn-primary text-center py-3">
        Continue investigating
      </Link>
    </section>
  );
}
