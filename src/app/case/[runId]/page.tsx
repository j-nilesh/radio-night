"use client";

/**
 * /case/[runId] — Primary investigation screen.
 * Dynamic route — session state loaded client-side after mount.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { DialogueDisplay, type DialogueTurn } from "../../../components/DialogueDisplay";
import { PushToTalk } from "../../../components/PushToTalk";
import { AudioControls } from "../../../components/AudioControls";

type RunInfo = { runId: string; caseId: string; playMode: string };

export default function CasePage() {
  const params = useParams();
  const runId = params.runId as string;

  const [turns, setTurns] = useState<DialogueTurn[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [runInfo, setRunInfo] = useState<RunInfo | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [showAudioControls, setShowAudioControls] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const idempotencyRef = useRef<string>("");
  const audioQueueRef = useRef<HTMLAudioElement | null>(null);

  const targetCharacterId = "char-keeper";
  const characterName = "The Keeper";

  useEffect(() => {
    if (!runId) return;
    fetch(`/api/runs/${runId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setInitError(data.error); return; }
        setRunInfo({ runId: data.runId, caseId: data.caseId, playMode: data.playMode });
        setTurns([
          {
            id: "narrator-open",
            actor: "narrator",
            text: "The archive room is quiet. Shelves of ledgers stretch to the ceiling. The Keeper stands behind a broad oak desk, watching you with careful eyes.",
            timestamp: new Date(),
          },
          {
            id: "char-open",
            actor: "character",
            text: "Detective. I've been expecting someone. I've told the constable everything I know, but I suppose you'll want to hear it for yourself.",
            timestamp: new Date(),
          },
        ]);
      })
      .catch(() => setInitError("Could not load investigation. Please try again."));
  }, [runId]);

  const unlockAudio = useCallback(async () => {
    if (audioUnlocked) return;
    try {
      const { getMixer } = await import("../../../lib/mixer-client");
      getMixer().initialize();
      setAudioUnlocked(true);
    } catch { /* captions only */ }
  }, [audioUnlocked]);

  const playAudioResponse = useCallback(async (ref: string) => {
    if (!ref) return;
    try {
      audioQueueRef.current?.pause();
      const audio = new Audio(ref);
      audioQueueRef.current = audio;
      await audio.play();
    } catch { /* caption fallback */ }
  }, []);

  const submitTurn = useCallback(
    async (text?: string, audioBase64?: string) => {
      if (isLoading || (!text && !audioBase64) || !runId) return;
      await unlockAudio();
      idempotencyRef.current = crypto.randomUUID();

      if (text) {
        setTurns((prev) => [...prev, {
          id: idempotencyRef.current + "-player",
          actor: "player", text, timestamp: new Date(),
        }]);
        setInputText("");
      }

      setIsLoading(true);
      try {
        const body: Record<string, string> = {
          idempotencyKey: idempotencyRef.current,
          targetCharacterId,
        };
        if (text) body.text = text;
        if (audioBase64) body.audioBase64 = audioBase64;

        const res = await fetch(`/api/runs/${runId}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();

        if (data.error) {
          setTurns((prev) => [...prev, {
            id: idempotencyRef.current + "-err",
            actor: "narrator", text: `Error: ${data.error}`, timestamp: new Date(),
          }]);
        } else {
          if (audioBase64 && data.transcribedText) {
            setTurns((prev) => [...prev, {
              id: idempotencyRef.current + "-voice",
              actor: "player", text: `🎙️ "${data.transcribedText}"`, timestamp: new Date(),
            }]);
          }
          setTurns((prev) => [...prev, {
            id: idempotencyRef.current + "-char",
            actor: "character",
            text: data.responseText,
            classification: data.classification?.category,
            timestamp: new Date(),
          }]);
          if (data.audioAssetRef && audioUnlocked) await playAudioResponse(data.audioAssetRef);
        }
      } catch {
        setTurns((prev) => [...prev, {
          id: idempotencyRef.current + "-net",
          actor: "narrator",
          text: "The connection was interrupted. Your progress is saved. Please try again.",
          timestamp: new Date(),
        }]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, runId, unlockAudio, playAudioResponse, audioUnlocked, targetCharacterId]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => { e.preventDefault(); if (inputText.trim()) submitTurn(inputText.trim()); },
    [inputText, submitTurn]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (inputText.trim()) submitTurn(inputText.trim()); }
    },
    [inputText, submitTurn]
  );

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "var(--bg)" }}>
        <div className="text-center space-y-4">
          <p style={{ color: "#fca5a5" }}>{initError}</p>
          <a href="/play" style={{ color: "var(--amber)" }}>← Start a new investigation</a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--bg)" }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-raised)" }}
      >
        <div className="flex flex-col">
          <span
            className="text-sm font-bold leading-tight"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
          >
            Radio Night
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {runInfo?.playMode === "together" ? "🔊 Play Together" : "Solo"} · {characterName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAudioControls((s) => !s)}
            aria-expanded={showAudioControls}
            aria-label="Audio settings"
            className="btn btn-ghost text-xs px-3 py-1.5"
          >
            🔊 Audio
          </button>
          <a href="/play" className="btn btn-ghost text-xs px-3 py-1.5">
            ← Exit
          </a>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Dialogue area ──────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 max-w-2xl mx-auto w-full">
          <DialogueDisplay
            turns={turns}
            characterName={characterName}
            isLoading={isLoading}
          />

          {/* ── Input area ──────────────────────────────────────────── */}
          <div
            className="shrink-0 p-4 flex flex-col gap-4"
            style={{ borderTop: "1px solid var(--border)", background: "var(--bg-raised)" }}
          >
            {/* Text input row */}
            <form onSubmit={handleSubmit} className="flex gap-2 items-end">
              <label htmlFor="q" className="sr-only">Ask a question</label>
              <textarea
                id="q"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question… (Enter to submit)"
                disabled={isLoading}
                rows={2}
                className="input flex-1 resize-none text-sm leading-snug"
                style={{ minHeight: "3.5rem" }}
              />
              <button
                type="submit"
                disabled={isLoading || !inputText.trim()}
                className="btn btn-primary text-sm px-5 py-3 self-end"
              >
                Ask
              </button>
            </form>

            {/* Voice divider + push-to-talk */}
            <div className="flex items-center gap-4">
              <div className="flex-1 divider" />
              <PushToTalk
                onAudio={(b64) => submitTurn(undefined, b64)}
                disabled={isLoading}
              />
              <div className="flex-1 divider" />
            </div>

            <p className="text-center text-xs" style={{ color: "var(--text-faint)" }}>
              Hold the button to speak, or type above
            </p>
          </div>
        </div>

        {/* ── Audio sidebar (desktop) ────────────────────────────────── */}
        {showAudioControls && (
          <aside
            className="hidden sm:block w-56 shrink-0 p-4 overflow-y-auto"
            style={{ borderLeft: "1px solid var(--border)", background: "var(--bg-card)" }}
          >
            <AudioControls />
          </aside>
        )}
      </div>

      {/* ── Audio sheet (mobile) ────────────────────────────────────── */}
      {showAudioControls && (
        <div
          className="sm:hidden p-4 shrink-0"
          style={{ borderTop: "1px solid var(--border)", background: "var(--bg-card)" }}
        >
          <AudioControls />
        </div>
      )}
    </div>
  );
}
