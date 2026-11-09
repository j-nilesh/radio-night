"use client";

/**
 * /case/[runId] — Primary investigation screen.
 * Dynamic route — the run's view is loaded client-side after mount.
 *
 * The server decides who is present, which exits are open, and what can be
 * examined; this page only renders that view and sends the player's choices.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import type { PlayerView } from "@ai-orchestration/scene-view";
import { DialogueDisplay, type DialogueTurn } from "../../../components/DialogueDisplay";
import { PushToTalk } from "../../../components/PushToTalk";
import { AudioControls } from "../../../components/AudioControls";
import { SceneBar } from "../../../components/SceneBar";
import { Casebook } from "../../../components/Casebook";

type RunInfo = { runId: string; caseTitle: string; playMode: string };
type Panel = "casebook" | "audio" | null;

let turnCounter = 0;
const nextId = (prefix: string) => `${prefix}-${++turnCounter}`;

export default function CasePage() {
  const params = useParams();
  const runId = params.runId as string;

  const [turns, setTurns] = useState<DialogueTurn[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [runInfo, setRunInfo] = useState<RunInfo | null>(null);
  const [view, setView] = useState<PlayerView | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const viewRef = useRef<PlayerView | null>(null);
  const audioQueueRef = useRef<HTMLAudioElement | null>(null);

  const selectedCharacter = view?.characters.find((c) => c.id === selectedCharacterId) ?? null;

  const push = useCallback((...next: DialogueTurn[]) => {
    setTurns((prev) => [...prev, ...next]);
  }, []);

  const narrator = (text: string): DialogueTurn => ({
    id: nextId("narrator"),
    actor: "narrator",
    text,
    timestamp: new Date(),
  });

  // ── Load the run ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!runId) return;
    fetch(`/api/runs/${runId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setInitError(data.error);
          return;
        }
        const v: PlayerView = data.view;
        viewRef.current = v;
        setView(v);
        setRunInfo({ runId: data.runId, caseTitle: data.caseTitle, playMode: data.playMode });

        const opening: Array<{ actor: "narrator" | "character"; text: string; speakerName?: string }> =
          data.opening ?? [];
        setTurns(
          opening.length > 0
            ? opening.map((l) => ({
                id: nextId("open"),
                actor: l.actor,
                text: l.text,
                speakerName: l.speakerName,
                timestamp: new Date(),
              }))
            : [narrator(`You pick up where you left off, in ${v.scene.name}.`)]
        );
      })
      .catch(() => setInitError("Could not load investigation. Please try again."));
  }, [runId]);

  // Keep a valid person selected as the scene changes
  useEffect(() => {
    if (!view) return;
    if (!view.characters.some((c) => c.id === selectedCharacterId)) {
      setSelectedCharacterId(view.characters[0]?.id ?? null);
    }
  }, [view, selectedCharacterId]);

  // ── Audio ─────────────────────────────────────────────────────────────────
  const unlockAudio = useCallback(async () => {
    if (audioUnlocked) return;
    try {
      const { getMixer } = await import("../../../lib/mixer-client");
      getMixer().initialize();
      setAudioUnlocked(true);
    } catch {
      /* captions only */
    }
  }, [audioUnlocked]);

  const playAudioResponse = useCallback(async (ref: string) => {
    if (!ref) return;
    try {
      audioQueueRef.current?.pause();
      const audio = new Audio(ref);
      audioQueueRef.current = audio;
      await audio.play();
    } catch {
      /* captions are already on screen */
    }
  }, []);

  // ── Absorb a server response: new view, casebook notes, arrivals ──────────
  const absorb = useCallback((data: { view?: PlayerView; notices?: string[] }): DialogueTurn[] => {
    const out: DialogueTurn[] = [];
    const next = data.view;
    if (next) {
      const prev = viewRef.current;
      for (const clue of next.casebook.clues) {
        if (!prev?.casebook.clues.some((p) => p.id === clue.id)) {
          out.push({
            id: nextId("note"),
            actor: "note",
            text: `Added to casebook: ${clue.title}`,
            timestamp: new Date(),
          });
        }
      }
      viewRef.current = next;
      setView(next);
    }
    for (const n of data.notices ?? []) out.push(narrator(n));
    return out;
  }, []);

  // ── Ask a question (typed or spoken) ──────────────────────────────────────
  const submitTurn = useCallback(
    async (text?: string, audioBase64?: string) => {
      if (isLoading || (!text && !audioBase64) || !runId || !selectedCharacter) return;
      await unlockAudio();

      const speaker = selectedCharacter;
      const key = crypto.randomUUID();

      if (text) {
        push({ id: nextId("player"), actor: "player", text, timestamp: new Date() });
        setInputText("");
      }

      setIsLoading(true);
      try {
        const body: Record<string, string> = { idempotencyKey: key, targetCharacterId: speaker.id };
        if (text) body.text = text;
        if (audioBase64) body.audioBase64 = audioBase64;

        const res = await fetch(`/api/runs/${runId}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();

        if (data.error) {
          push(narrator(data.error));
          return;
        }

        if (audioBase64 && data.transcribedText) {
          push({
            id: nextId("player"),
            actor: "player",
            text: `🎙️ “${data.transcribedText}”`,
            timestamp: new Date(),
          });
        }

        if (data.responseText) {
          push({
            id: nextId("char"),
            actor: "character",
            text: data.responseText,
            speakerName: speaker.name,
            timestamp: new Date(),
          });
        }
        push(...absorb(data));

        if (data.audioAssetRef && audioUnlocked) await playAudioResponse(data.audioAssetRef);
      } catch {
        push(narrator("The connection was interrupted. Your progress is saved. Please try again."));
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, runId, selectedCharacter, unlockAudio, push, absorb, audioUnlocked, playAudioResponse]
  );

  // ── Travel / examine ──────────────────────────────────────────────────────
  const sceneAction = useCallback(
    async (action: { type: "travel"; sceneId: string } | { type: "examine"; clueId: string }) => {
      if (isLoading || !runId) return;
      setIsLoading(true);
      try {
        const res = await fetch(`/api/runs/${runId}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), sceneAction: action }),
        });
        const data = await res.json();
        if (data.error) {
          push(narrator(data.error));
          return;
        }
        push(narrator(data.narration), ...absorb(data));
      } catch {
        push(narrator("The connection was interrupted. Please try again."));
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, runId, push, absorb]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (inputText.trim()) submitTurn(inputText.trim());
    },
    [inputText, submitTurn]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (inputText.trim()) submitTurn(inputText.trim());
      }
    },
    [inputText, submitTurn]
  );

  // ── Error state ───────────────────────────────────────────────────────────
  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "var(--bg)" }}>
        <div className="text-center space-y-4">
          <p style={{ color: "#fca5a5" }}>{initError}</p>
          <a href="/play" style={{ color: "var(--amber)" }}>
            ← Start a new investigation
          </a>
        </div>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          Loading the case…
        </p>
      </div>
    );
  }

  const clueCount = view.casebook.clues.length;
  const canSpeak = !!selectedCharacter;

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-raised)" }}
      >
        <div className="flex flex-col">
          <span
            className="text-sm font-bold leading-tight"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
          >
            {runInfo?.caseTitle ?? "Radio Night"}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {view.scene.name} · {runInfo?.playMode === "together" ? "Play Together" : "Solo"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPanel((p) => (p === "casebook" ? null : "casebook"))}
            aria-expanded={panel === "casebook"}
            className="btn btn-ghost text-xs px-3 py-1.5"
          >
            Casebook{clueCount > 0 ? ` (${clueCount})` : ""}
          </button>
          <button
            onClick={() => setPanel((p) => (p === "audio" ? null : "audio"))}
            aria-expanded={panel === "audio"}
            aria-label="Audio settings"
            className="btn btn-ghost text-xs px-3 py-1.5"
          >
            Audio
          </button>
          <a href="/play" className="btn btn-ghost text-xs px-3 py-1.5">
            Exit
          </a>
        </div>
      </header>

      <SceneBar
        view={view}
        selectedCharacterId={selectedCharacterId}
        disabled={isLoading}
        onSelectCharacter={setSelectedCharacterId}
        onTravel={(sceneId) => sceneAction({ type: "travel", sceneId })}
        onExamine={(clueId) => sceneAction({ type: "examine", clueId })}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* ── Dialogue + input ─────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 max-w-2xl mx-auto w-full">
          <DialogueDisplay turns={turns} isLoading={isLoading} waitingOn={selectedCharacter?.name} />

          <div
            className="shrink-0 p-4 flex flex-col gap-4"
            style={{ borderTop: "1px solid var(--border)", background: "var(--bg-raised)" }}
          >
            <form onSubmit={handleSubmit} className="flex gap-2 items-end">
              <label htmlFor="q" className="sr-only">
                Ask a question
              </label>
              <textarea
                id="q"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  canSpeak
                    ? `Ask ${selectedCharacter!.name} a question… (Enter to send)`
                    : "No one here to speak to. Go somewhere else."
                }
                disabled={isLoading || !canSpeak}
                rows={2}
                className="input flex-1 resize-none text-sm leading-snug"
                style={{ minHeight: "3.5rem" }}
              />
              <button
                type="submit"
                disabled={isLoading || !canSpeak || !inputText.trim()}
                className="btn btn-primary text-sm px-5 py-3 self-end"
              >
                Ask
              </button>
            </form>

            <div className="flex items-center gap-4">
              <div className="flex-1 divider" />
              <PushToTalk onAudio={(b64) => submitTurn(undefined, b64)} disabled={isLoading || !canSpeak} />
              <div className="flex-1 divider" />
            </div>

            <p className="text-center text-xs" style={{ color: "var(--text-faint)" }}>
              Hold the button to speak, or type above
            </p>
          </div>
        </div>

        {/* ── Side panel (desktop) ─────────────────────────────────────── */}
        {panel && (
          <aside
            className="hidden sm:block w-72 shrink-0 p-4 overflow-y-auto"
            style={{ borderLeft: "1px solid var(--border)", background: "var(--bg-card)" }}
          >
            {panel === "casebook" ? <Casebook casebook={view.casebook} /> : <AudioControls />}
          </aside>
        )}
      </div>

      {/* ── Side panel (mobile) ─────────────────────────────────────────── */}
      {panel && (
        <div
          className="sm:hidden p-4 shrink-0 max-h-[45vh] overflow-y-auto"
          style={{ borderTop: "1px solid var(--border)", background: "var(--bg-card)" }}
        >
          {panel === "casebook" ? <Casebook casebook={view.casebook} /> : <AudioControls />}
        </div>
      )}
    </div>
  );
}
