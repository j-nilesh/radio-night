"use client";

/**
 * /play — Guest entry and case selection.
 * No account required. Creates a new run and redirects to /case/[runId].
 */

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
        body: JSON.stringify({
          caseId: "test-keeper", // test character; will be replaced by real case
          playMode,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Could not start investigation");
      }

      router.push(`/case/${data.runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setIsStarting(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <a href="/" className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors">
            ← Radio Night
          </a>
          <h1 className="text-3xl font-bold text-amber-100">Begin Investigation</h1>
          <p className="text-sm text-neutral-400">
            No account required. Your progress is saved automatically.
          </p>
        </div>

        {/* Play mode selection */}
        <div className="space-y-3">
          <p className="text-sm text-neutral-400 text-center">How will you play?</p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPlayMode("solo")}
              aria-pressed={playMode === "solo"}
              className={`p-4 rounded-sm border text-left transition-colors ${
                playMode === "solo"
                  ? "border-amber-600 bg-amber-950/30 text-amber-100"
                  : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
              }`}
            >
              <div className="font-semibold text-sm mb-1">Play Solo</div>
              <div className="text-xs opacity-70">
                Just you and the investigation
              </div>
            </button>

            <button
              onClick={() => setPlayMode("together")}
              aria-pressed={playMode === "together"}
              className={`p-4 rounded-sm border text-left transition-colors ${
                playMode === "together"
                  ? "border-amber-600 bg-amber-950/30 text-amber-100"
                  : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
              }`}
            >
              <div className="font-semibold text-sm mb-1">Play Together</div>
              <div className="text-xs opacity-70">
                Route audio to a shared speaker
              </div>
            </button>
          </div>

          {playMode === "together" && (
            <p className="text-xs text-neutral-500 text-center bg-neutral-900 rounded-sm p-3">
              Connect your device to a Bluetooth or wired speaker before starting.
              Everyone will hear the investigation. Take turns asking questions with push-to-talk.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <p role="alert" className="text-sm text-red-400 text-center bg-red-950/20 rounded-sm p-3 border border-red-900/30">
            {error}
          </p>
        )}

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={isStarting}
          className="w-full py-4 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-sm text-white font-semibold text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-neutral-950"
        >
          {isStarting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Starting…
            </span>
          ) : (
            "Start Investigation"
          )}
        </button>

        <p className="text-center text-xs text-neutral-600">
          Test character scene — the full Radio Night mystery is coming soon.
        </p>
      </div>
    </main>
  );
}
