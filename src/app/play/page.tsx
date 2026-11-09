"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PlayMode = "solo" | "together";

export default function PlayPage() {
  const router = useRouter();
  const [playMode, setPlayMode] = useState<PlayMode>("solo");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setIsStarting(true);
    setError(null);
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: "test-keeper", playMode }),
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
        <a
          href="/"
          className="text-xs self-start flex items-center gap-1 transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          ← Radio Night
        </a>

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

        {/* Mode picker */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
            How will you play?
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(["solo", "together"] as PlayMode[]).map((mode) => {
              const active = playMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setPlayMode(mode)}
                  aria-pressed={active}
                  className="text-left p-4 rounded-lg transition-all"
                  style={{
                    background: active ? "rgba(120,50,8,0.22)" : "var(--bg-card)",
                    border: `1.5px solid ${active ? "var(--amber)" : "var(--border-mid)"}`,
                    color: active ? "var(--amber-text)" : "var(--text-secondary)",
                    boxShadow: active ? "0 0 0 1px rgba(217,119,6,0.15)" : "none",
                  }}
                >
                  <div className="font-semibold text-sm mb-1">
                    {mode === "solo" ? "Play Solo" : "Play Together"}
                  </div>
                  <div className="text-xs opacity-70">
                    {mode === "solo" ? "Just you and the case" : "Shared speaker, take turns"}
                  </div>
                </button>
              );
            })}
          </div>

          {playMode === "together" && (
            <p
              className="text-xs leading-relaxed rounded-lg px-4 py-3"
              style={{
                color: "var(--text-secondary)",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              Connect to a Bluetooth or wired speaker first. Everyone hears the drama.
              Use push-to-talk to take turns asking questions.
            </p>
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
            "Start Investigation"
          )}
        </button>

        <p className="text-center text-xs" style={{ color: "var(--text-faint)" }}>
          Test character scene — the full mystery is coming soon.
        </p>
      </div>
    </main>
  );
}
