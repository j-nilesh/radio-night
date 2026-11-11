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
import { PushToTalk, type RecordingMeta } from "../../../components/PushToTalk";
import { track, setTelemetryRun } from "../../../lib/telemetry-client";
import { AudioControls } from "../../../components/AudioControls";
import { SceneBar } from "../../../components/SceneBar";
import { Casebook } from "../../../components/Casebook";
import { AccusationPanel } from "../../../components/AccusationPanel";
import { EndingScreen } from "../../../components/EndingScreen";
import { getMixer, type Clip, type ClipObserver } from "../../../lib/mixer-client";
import { lineKeyFromUrl } from "../../../lib/line-key";

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
  const [voiceOn, setVoiceOn] = useState(true);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [intro, setIntro] = useState<string[] | null>(null);
  const [endingAudioUrl, setEndingAudioUrl] = useState<string | undefined>(undefined);
  const [accuseOpen, setAccuseOpen] = useState(false);
  const [accuseBusy, setAccuseBusy] = useState(false);
  const [accuseError, setAccuseError] = useState<string | null>(null);

  const viewRef = useRef<PlayerView | null>(null);
  const voiceOnRef = useRef(true);
  const playbackEpoch = useRef(0); // bumped to cancel everything queued
  const speakQueue = useRef<Promise<void>>(Promise.resolve());
  // Development telemetry: when each question was asked and answered, by turn key
  const turnTimes = useRef<Map<string, { askAt: number; responseAt?: number }>>(new Map());

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

  // ── Development telemetry: who is playing on what, and anything that breaks ─
  useEffect(() => {
    setTelemetryRun(runId);
    const nav = navigator as Navigator & { connection?: { effectiveType?: string } };
    track("session", {
      ua: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      dpr: window.devicePixelRatio,
      touch: navigator.maxTouchPoints > 0,
      connection: nav.connection?.effectiveType,
      mediaRecorder: typeof MediaRecorder !== "undefined",
      audioContext: typeof AudioContext !== "undefined" || "webkitAudioContext" in window,
    });
    const onError = (e: ErrorEvent) =>
      track("page.error", { message: e.message, source: e.filename, line: e.lineno });
    const onRejection = (e: PromiseRejectionEvent) =>
      track("page.unhandled_rejection", {
        message: e.reason instanceof Error ? e.reason.message : String(e.reason),
      });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [runId]);

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

        setEndingAudioUrl(data.endingAudioUrl);
        if (data.endingAudioUrl) setVoiceAvailable(true);

        const opening: Array<{
          actor: "narrator" | "character";
          text: string;
          speakerName?: string;
          audioUrl?: string;
        }> = data.opening ?? [];
        const openingAudio = opening.map((l) => l.audioUrl).filter((u): u is string => !!u);
        if (openingAudio.length > 0) {
          setVoiceAvailable(true);
          // Browsers only allow sound after a click, so ask before the story begins.
          setIntro(openingAudio);
        }
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
  // The browser only lets a page make sound after a click, so this is called from
  // click handlers (asking, travelling, the intro screen).
  const unlockAudio = useCallback(async () => {
    try {
      const mixer = getMixer();
      mixer.initialize();
      await mixer.resume();
    } catch {
      /* captions only */
    }
  }, []);

  const stopSpeaking = useCallback((reason = "interrupt") => {
    playbackEpoch.current++; // anything still queued is now out of date
    try {
      const mixer = getMixer();
      const active = mixer.playingCount("dialogue");
      if (active > 0) track("audio.interrupt", { reason, active });
      mixer.stopAll("dialogue", reason);
    } catch {
      /* nothing was playing */
    }
  }, []);

  /**
   * Queue a line of speech. The browser starts downloading it immediately, so a
   * line is usually ready the moment the previous one ends, and it can begin
   * playing before it has finished downloading.
   */
  const speak = useCallback((url?: string, meta: { kind: string; turnKey?: string } = { kind: "other" }) => {
    if (!url) return;
    setVoiceAvailable(true);
    if (!voiceOnRef.current) {
      track("audio.skipped", { lineKind: meta.kind, reason: "voice_off" });
      return;
    }

    const epoch = playbackEpoch.current;
    const lineKey = lineKeyFromUrl(url);
    const observer: ClipObserver = (event, data) => {
      const extra: Record<string, unknown> = { ...data, lineKind: meta.kind, line: lineKey, turn: meta.turnKey };
      if (event === "first_sound" && meta.turnKey) {
        const t = turnTimes.current.get(meta.turnKey);
        if (t) {
          const now = performance.now();
          extra.askToHearMs = Math.round(now - t.askAt);
          if (t.responseAt !== undefined) extra.responseToHearMs = Math.round(now - t.responseAt);
        }
      }
      track(`audio.${event}`, extra);
    };

    let clip: Clip;
    try {
      clip = getMixer().prepare("dialogue", url, observer);
    } catch (err) {
      track("audio.error", {
        stage: "prepare",
        message: err instanceof Error ? err.message : String(err),
        lineKind: meta.kind,
      });
      return; // no audio support: the captions carry the story
    }

    speakQueue.current = speakQueue.current.then(async () => {
      if (epoch !== playbackEpoch.current) {
        clip.stop("superseded");
        return;
      }
      try {
        await clip.play();
      } catch (err) {
        if (clip.stopped || epoch !== playbackEpoch.current) return;
        // Captions are already on screen; record why the sound did not play.
        track("audio.error", {
          stage: "play",
          message: err instanceof Error ? err.message : String(err),
          lineKind: meta.kind,
          line: lineKey,
        });
      }
    });
  }, []);

  const chooseVoice = useCallback(
    (on: boolean) => {
      voiceOnRef.current = on;
      setVoiceOn(on);
      track("voice.toggle", { on });
      if (!on) stopSpeaking();
    },
    [stopSpeaking]
  );

  const beginWithSound = useCallback(async () => {
    const lines = intro ?? [];
    setIntro(null);
    chooseVoice(true);
    await unlockAudio();
    track("intro.choice", { sound: true, lines: lines.length });
    lines.forEach((url) => speak(url, { kind: "intro" }));
  }, [intro, chooseVoice, unlockAudio, speak]);

  const beginCaptionsOnly = useCallback(() => {
    track("intro.choice", { sound: false });
    setIntro(null);
    chooseVoice(false);
  }, [chooseVoice]);

  // ── Absorb a server response: new view, casebook notes, arrivals ──────────
  const absorb = useCallback(
    (data: { view?: PlayerView; notices?: Array<{ text: string; audioUrl?: string }> }): DialogueTurn[] => {
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
    for (const n of data.notices ?? []) {
      out.push(narrator(n.text));
      speak(n.audioUrl, { kind: "notice" });
    }
    return out;
  },
    [speak]
  );

  // ── Ask a question (typed or spoken) ──────────────────────────────────────
  const submitTurn = useCallback(
    async (text?: string, audioBase64?: string, audioMimeType?: string, meta?: RecordingMeta) => {
      if (isLoading || (!text && !audioBase64) || !runId || !selectedCharacter) return;
      // For a spoken question the clock starts when the player tapped to finish.
      const askAt = meta?.stopTapAt ?? performance.now();
      stopSpeaking("new_question"); // a new question interrupts whoever is talking
      await unlockAudio();

      const speaker = selectedCharacter;
      const key = crypto.randomUUID();
      const turnKey = key.slice(0, 8); // matches the server's turn event
      turnTimes.current.set(turnKey, { askAt });
      track("turn.ask", {
        turn: turnKey,
        via: audioBase64 ? "voice" : "text",
        character: speaker.id,
        chars: text?.length,
        recordingMs: meta?.durationMs,
        peakRms: meta?.peakRms,
        uploadBytes: meta?.uploadBytes,
      });

      if (text) {
        push({ id: nextId("player"), actor: "player", text, timestamp: new Date() });
        setInputText("");
      }

      setIsLoading(true);
      try {
        const body: Record<string, string> = { idempotencyKey: key, targetCharacterId: speaker.id };
        if (text) body.text = text;
        if (audioBase64) body.audioBase64 = audioBase64;
        if (audioBase64 && audioMimeType) body.audioMimeType = audioMimeType;

        const res = await fetch(`/api/runs/${runId}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        const times = turnTimes.current.get(turnKey);
        if (times) times.responseAt = performance.now();
        track("turn.response", {
          turn: turnKey,
          status: res.status,
          roundTripMs: Math.round(performance.now() - askAt),
          hasAudio: !!data.audioUrl,
          system: !!data.systemMessage,
          error: data.error ? String(data.error).slice(0, 80) : undefined,
        });

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

        if (data.responseText && data.systemMessage) {
          push(narrator(data.responseText));
        } else if (data.responseText) {
          push({
            id: nextId("char"),
            actor: "character",
            text: data.responseText,
            speakerName: speaker.name,
            timestamp: new Date(),
          });
        }
        speak(data.audioUrl, { kind: "reply", turnKey });
        push(...absorb(data));
      } catch (err) {
        track("turn.failed", { turn: turnKey, message: err instanceof Error ? err.message : String(err) });
        push(narrator("The connection was interrupted. Your progress is saved. Please try again."));
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, runId, selectedCharacter, unlockAudio, stopSpeaking, speak, push, absorb]
  );

  // ── Travel / examine ──────────────────────────────────────────────────────
  const sceneAction = useCallback(
    async (action: { type: "travel"; sceneId: string } | { type: "examine"; clueId: string }) => {
      if (isLoading || !runId) return;
      track("scene.action", { type: action.type, target: action.type === "travel" ? action.sceneId : action.clueId });
      stopSpeaking("scene_action");
      await unlockAudio();
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
        speak(data.narrationAudioUrl, { kind: action.type });
        push(narrator(data.narration), ...absorb(data));
      } catch {
        push(narrator("The connection was interrupted. Please try again."));
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, runId, stopSpeaking, unlockAudio, speak, push, absorb]
  );

  // ── Accuse ────────────────────────────────────────────────────────────────
  const submitAccusation = useCallback(
    async (suspectId: string, evidenceIds: string[]) => {
      if (accuseBusy || !runId) return;
      track("accuse.submit", { suspectId, evidence: evidenceIds.length });
      stopSpeaking("accuse");
      await unlockAudio();
      setAccuseBusy(true);
      setAccuseError(null);
      try {
        const res = await fetch(`/api/runs/${runId}/accuse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), suspectId, evidenceIds }),
        });
        const data = await res.json();
        if (data.error) {
          setAccuseError(data.error);
          return;
        }
        viewRef.current = data.view;
        setView(data.view);
        setEndingAudioUrl(data.endingAudioUrl);
        setAccuseOpen(false);
        speak(data.endingAudioUrl, { kind: "ending" });
      } catch {
        setAccuseError("The connection was interrupted. Nothing was submitted. Please try again.");
      } finally {
        setAccuseBusy(false);
      }
    },
    [accuseBusy, runId, stopSpeaking, unlockAudio, speak]
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

  // The case is closed: the ending replaces the investigation, including after a refresh.
  if (view.ending) {
    return (
      <EndingScreen
        ending={view.ending}
        onListen={
          endingAudioUrl && voiceOn
            ? () => {
                stopSpeaking();
                void unlockAudio().then(() => speak(endingAudioUrl, { kind: "ending" }));
              }
            : undefined
        }
      />
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
          {voiceAvailable && (
            <button
              onClick={() => chooseVoice(!voiceOn)}
              aria-pressed={voiceOn}
              title={voiceOn ? "Turn the voices off" : "Turn the voices on"}
              className="btn btn-ghost text-xs px-3 py-1.5"
            >
              Voice: {voiceOn ? "on" : "off"}
            </button>
          )}
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
          {view.accusation && (
            <button
              onClick={() => {
                setAccuseError(null);
                setAccuseOpen(true);
              }}
              className="btn btn-primary text-xs px-3 py-1.5"
            >
              Accuse
            </button>
          )}
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
              <PushToTalk
                onAudio={(b64, mime, meta) => submitTurn(undefined, b64, mime, meta)}
                onRejected={(message) => {
                  track("mic.rejected", { message: message.slice(0, 60) });
                  push(narrator(message));
                }}
                onTelemetry={track}
                onRecordingStart={() => stopSpeaking("mic")}
                disabled={isLoading || !canSpeak}
              />
              <div className="flex-1 divider" />
            </div>

            <p className="text-center text-xs" style={{ color: "var(--text-faint)" }}>
              Tap the microphone to speak and tap again to send, or type above
            </p>
          </div>
        </div>

        {/* ── Side panel (desktop) ─────────────────────────────────────── */}
        {panel && (
          <aside
            className="hidden sm:block w-72 shrink-0 p-4 overflow-y-auto"
            style={{ borderLeft: "1px solid var(--border)", background: "var(--bg-card)" }}
          >
            {panel === "casebook" ? <Casebook casebook={view.casebook} /> : <AudioControls getMixer={getMixer} />}
          </aside>
        )}
      </div>

      {/* ── Side panel (mobile) ─────────────────────────────────────────── */}
      {panel && (
        <div
          className="sm:hidden p-4 shrink-0 max-h-[45vh] overflow-y-auto"
          style={{ borderTop: "1px solid var(--border)", background: "var(--bg-card)" }}
        >
          {panel === "casebook" ? <Casebook casebook={view.casebook} /> : <AudioControls getMixer={getMixer} />}
        </div>
      )}

      {intro && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(8,6,4,0.88)" }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="intro-title"
            className="w-full max-w-md rounded-xl p-8 flex flex-col gap-6 text-center"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-mid)" }}
          >
            <p
              className="text-xs font-semibold tracking-[0.35em] uppercase"
              style={{ color: "var(--amber)" }}
            >
              {runInfo?.caseTitle ?? "Radio Night"}
            </p>
            <h2 id="intro-title" className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
              Best heard, not read
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              The characters speak aloud. Turn your sound up, or connect a speaker for the room.
              You can answer by voice or by typing, and every word is also written out.
            </p>
            <div className="flex flex-col gap-3">
              <button autoFocus onClick={beginWithSound} className="btn btn-primary py-4">
                Begin with sound
              </button>
              <button onClick={beginCaptionsOnly} className="btn btn-ghost">
                Captions only
              </button>
            </div>
          </div>
        </div>
      )}

      {accuseOpen && view.accusation && (
        <AccusationPanel
          accusation={view.accusation}
          clues={view.casebook.clues}
          submitting={accuseBusy}
          error={accuseError}
          onClose={() => setAccuseOpen(false)}
          onSubmit={submitAccusation}
        />
      )}
    </div>
  );
}
