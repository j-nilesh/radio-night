"use client";

/**
 * HeroContinue.tsx
 * The home page's slot for the "continue" card. A client island, so the home page
 * itself stays a server component and a first-time visitor sees no change.
 */

import { ContinueCard, useSavedRun } from "./ContinueCard";

export function HeroContinue() {
  const { run } = useSavedRun();
  if (!run) return null;
  return <ContinueCard run={run} className="max-w-md" />;
}
