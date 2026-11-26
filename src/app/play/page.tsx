"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ContinueCard, useSavedRun } from "../../components/ContinueCard";


export default function PlayPage() {
  // The page reads its link (?code=), which Next.js asks to happen inside a Suspense boundary
  return (
    <Suspense>
      <Play />
    </Suspense>
  );
}

function Play() {
  const params = useSearchParams();
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { run: saved } = useSavedRun();
  const [confirmReplace, setConfirmReplace] = useState(false);
  // An access code (for judges and friends) gives a larger voice allowance. It can arrive in the link: /play?code=...
  const fromLink = (params.get("code") ?? "").slice(0, 64);
  const [code, setCode] = useState(fromLink);
  const [codeOpen, setCodeOpen] = useState(!!fromLink);
  const [codeNote, setCodeNote] = useState<string | null>(null);

  /** Add the code to the saved investigation, without starting over. */
  const applyCode = async () => {
    setCodeNote(null);
    setError(null);
    try {
      const res = await fetch("/api/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That code could not be added.");
      setCodeNote("Code added. Your saved investigation now has the full voice allowance.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code could not be added.");
    }
  };

  const handleStart = async () => {
    // A new investigation replaces the saved one in this browser, so ask first
    if (saved && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    setIsStarting(true);
    setError(null);
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: "radio-night-s01",
          ...(code.trim() ? { accessCode: code.trim() } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error ?? "Could not start investigation");
      router.push(`/case/${data.runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setIsStarting(false);
    }
  };

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full max-w-sm flex flex-col gap-7">

        {/* Back link */}
        <Link
          href="/start"
          className="text-xs self-start flex items-center gap-1 transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          ← Radio Night
        </Link>

        {/* Heading */}
        <div className="flex flex-col gap-1">
          <h1
            className="text-3xl font-bold"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
          >
            Begin Investigation
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No account required. Progress saves automatically.
          </p>
        </div>

        {/* A saved investigation, when this browser has one */}
        {saved && <ContinueCard run={saved} />}

        {/* Access code */}
        <div className="flex flex-col gap-2">
          {!codeOpen ? (
            <button onClick={() => setCodeOpen(true)} className="text-xs self-start underline underline-offset-2 tap-target" style={{ color: "var(--text-muted)" }}>
              Have an access code?
            </button>
          ) : (
            <>
              <label htmlFor="access-code" className="text-xs font-semibold tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
                Access code
              </label>
              <div className="flex gap-2">
                <input
                  id="access-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={64}
                  className="input flex-1"
                  placeholder="For judges and friends"
                />
                {saved && (
                  <button onClick={applyCode} disabled={!code.trim()} className="btn btn-ghost btn-sm shrink-0">
                    Add to saved case
                  </button>
                )}
              </div>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                Everyone hears the narration and a taste of the characters&rsquo; voices. A code gives the full voice
                for a whole investigation.
              </p>
              {codeNote && (
                <p role="status" className="text-xs" style={{ color: "var(--amber-text)" }}>
                  {codeNote}
                </p>
              )}
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <p
            role="alert"
            className="text-sm rounded-lg px-4 py-3"
            style={{
              color: "#fca5a5",
              background: "rgba(127,29,29,0.25)",
              border: "1px solid rgba(185,28,28,0.35)",
            }}
          >
            {error}
          </p>
        )}

        {/* Start */}
        <button
          onClick={handleStart}
          disabled={isStarting}
          className="btn btn-primary w-full py-4 text-base"
        >
          {isStarting ? (
            <>
              <span
                className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block"
                aria-hidden="true"
              />
              Starting…
            </>
          ) : (
            saved ? (confirmReplace ? "Yes, replace it and start over" : "Start a new investigation") : "Start Investigation"
          )}
        </button>
        {confirmReplace && !isStarting && (
          <p className="text-xs text-center -mt-4" style={{ color: "var(--text-muted)" }} role="status">
            This replaces your saved investigation in this browser. Press the button again to confirm, or continue where you left off above.
          </p>
        )}

        <p className="text-center text-xs" style={{ color: "var(--text-faint)" }}>
          Millhaven, New Hampshire. October 1981.
        </p>
      </div>
    </main>
  );
}
