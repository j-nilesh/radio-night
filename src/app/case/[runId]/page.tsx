"use client";

/**
 * /case/[runId] — Primary investigation screen.
 * The main playable room for Radio Night.
 *
 * Dynamic route — must not be statically prerendered.
 * Session state is loaded client-side after mount.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { DialogueDisplay, type DialogueTurn } from "../../../components/DialogueDisplay";
import { PushToTalk } from "../../../components/PushToTalk";
import { AudioControls } from "../../../components/AudioControls";

type RunInfo = {
  runId: string;
  caseId: string;
  playMode: string;
};

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

  // Target character for this test scene — in real mysteries, this comes from scene content
  const targetCharacterId = "char-keeper";
  const characterName = "The Keeper";

  // ── Load run info on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (!runId) return;
    fetch(`/api/runs/${runId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setInitError(data.error);
        } else {
          setRunInfo({ runId: data.runId, caseId: data.caseId, playMode: data.playMode });
          // Add opening line
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
        }
      })
      .catch(() => setInitError("Could not load investigation. Please try again."));
  }, [runId]);

  // ── Unlock audio on first interaction ────────────────────────────────────
  const unlockAudio = useCallback(async () => {
    if (audioUnlocked) return;
    try {
      const { getMixer } = await import("../../../lib/mixer-client");
      getMixer().initialize();
      setAudioUnlocked(true);
    } catch {
      // Audio unlock failed — continue with captions only
    }
  }, [audioUnlocked]);

  // ── Play audio response ───────────────────────────────────────────────────
  const playAudioResponse = useCallback(async (audioAssetRef: string) => {
    if (!audioAssetRef) return;
    try {
      if (audioQueueRef.current) {
        audioQueueRef.current.pause();
      }
      const audio = new Audio(audioAssetRef);
      audioQueueRef.current = audio;
      await audio.play();
    } catch {
      // Audio playback failed — captions are already shown
    }
  }, []);

  // ── Submit a turn ─────────────────────────────────────────────────────────
  const submitTurn = useCallback(
    async (text?: string, audioBase64?: string) => {
      if (isLoading || (!text && !audioBase64)) return;
      if (!runId) return;

      await unlockAudio();

      // Generate idempotency key
      idempotencyRef.current = crypto.randomUUID();

      // Optimistically add player turn to display
      if (text) {
        setTurns((prev) => [
          ...prev,
          {
            id: idempotencyRef.current + "-player",
            actor: "player",
            text,
            timestamp: new Date(),
          },
        ]);
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

        const response = await fetch(`/api/runs/${runId}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await response.json();

        if (data.error) {
          setTurns((prev) => [
            ...prev,
            {
              id: idempotencyRef.current + "-error",
              actor: "narrator",
              text: `Error: ${data.error}`,
              timestamp: new Date(),
            },
          ]);
        } else {
          // If audio input, show transcribed text first
          if (audioBase64 && data.transcribedText) {
            setTurns((prev) => [
              ...prev,
              {
                id: idempotencyRef.current + "-player-voice",
                actor: "player",
                text: `🎙️ "${data.transcribedText}"`,
                timestamp: new Date(),
              },
            ]);
          }

          // Add character response
          setTurns((prev) => [
            ...prev,
            {
              id: idempotencyRef.current + "-char",
              actor: "character",
              text: data.responseText,
              classification: data.classification?.category,
              timestamp: new Date(),
            },
          ]);

          // Play audio if available (mock TTS won't produce playable audio)
          if (data.audioAssetRef && audioUnlocked) {
            await playAudioResponse(data.audioAssetRef);
          }
        }
      } catch (err) {
        setTurns((prev) => [
          ...prev,
          {
            id: idempotencyRef.current + "-network-error",
            actor: "narrator",
            text: "The connection was interrupted. Your progress is saved. Please try again.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, runId, unlockAudio, playAudioResponse, audioUnlocked, targetCharacterId]
  );

  const handleTextSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (inputText.trim()) {
        submitTurn(inputText.trim());
      }
    },
    [inputText, submitTurn]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (inputText.trim()) {
          submitTurn(inputText.trim());
        }
      }
    },
    [inputText, submitTurn]
  );

  // ── Error state ───────────────────────────────────────────────────────────
  if (initError) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <p className="text-red-400">{initError}</p>
          <a href="/play" className="text-amber-600 hover:underline text-sm">
            Start a new investigation
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-amber-100">
            Radio Night
          </h1>
          <p className="text-xs text-neutral-500">
            {runInfo?.playMode === "together" ? "🔊 Play Together" : "Solo Investigation"}
            {" · "}
            <span className="font-medium text-neutral-400">{characterName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAudioControls((s) => !s)}
            aria-label="Toggle audio settings"
            aria-expanded={showAudioControls}
            className="text-xs px-2 py-1 rounded border border-neutral-700 text-neutral-400 hover:border-neutral-500 transition-colors"
          >
            🔊 Audio
          </button>
          <a
            href="/play"
            className="text-xs px-2 py-1 rounded border border-neutral-700 text-neutral-400 hover:border-neutral-500 transition-colors"
          >
            ← Exit
          </a>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main content */}
        <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
          {/* Dialogue transcript */}
          <DialogueDisplay
            turns={turns}
            characterName={characterName}
            isLoading={isLoading}
          />

          {/* Input area */}
          <div className="border-t border-neutral-800 p-4 space-y-4">
            {/* Text input */}
            <form onSubmit={handleTextSubmit} className="flex gap-2">
              <label htmlFor="question-input" className="sr-only">
                Ask a question
              </label>
              <textarea
                id="question-input"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question… (Enter to submit, Shift+Enter for new line)"
                disabled={isLoading}
                rows={2}
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded-sm px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 resize-none focus:outline-none focus:ring-1 focus:ring-amber-600 focus:border-amber-600 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !inputText.trim()}
                className="px-4 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-sm text-sm font-medium text-white transition-colors self-end"
              >
                Ask
              </button>
            </form>

            {/* Voice input */}
            <div className="flex items-center gap-4">
              <div className="flex-1 border-t border-neutral-800" />
              <PushToTalk
                onAudio={(base64) => submitTurn(undefined, base64)}
                disabled={isLoading}
              />
              <div className="flex-1 border-t border-neutral-800" />
            </div>

            <p className="text-center text-xs text-neutral-600">
              Hold the button to speak, or type your question above
            </p>
          </div>
        </div>

        {/* Audio controls sidebar (desktop) */}
        {showAudioControls && (
          <aside className="hidden sm:block w-52 border-l border-neutral-800 p-4">
            <AudioControls />
          </aside>
        )}
      </div>

      {/* Mobile audio controls sheet */}
      {showAudioControls && (
        <div className="sm:hidden border-t border-neutral-800 p-4">
          <AudioControls />
        </div>
      )}
    </div>
  );
}
