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
import { SceneImage } from "../../../components/SceneImage";
import { Casebook } from "../../../components/Casebook";
import { AccusationPanel } from "../../../components/AccusationPanel";
import { EndingScreen } from "../../../components/EndingScreen";
import { HowToPlay } from "../../../components/HowToPlay";
import { getMixer, type Clip, type ClipObserver } from "../../../lib/mixer-client";
import { lineKeyFromUrl } from "../../../lib/line-key";
import { getCuePlayer, ambienceFor, CLUE_STING, TRAVEL_SFX, ENDING_STING, MUSIC, THEME_SECONDS } from "../../../lib/sound-client";

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
  /** Set when a saved investigation is picked up again: the recap shown (and spoken) on the welcome-back screen */
  const [welcomeBack, setWelcomeBack] = useState<string | null>(null);
  const [endingAudioUrl, setEndingAudioUrl] = useState<string | undefined>(undefined);
  const [accuseOpen, setAccuseOpen] = useState(false);
  const [accuseBusy, setAccuseBusy] = useState(false);
  const [accuseError, setAccuseError] = useState<string | null>(null);
  // True once the player has chosen sound and the first click has unlocked audio
  const [soundReady, setSoundReady] = useState(false);
  // "How to play" shows once on a first visit, and whenever the player asks for it
  const [howToSeen, setHowToSeen] = useState(() => {
    try {
      return typeof localStorage !== "undefined" && localStorage.getItem("rn-howto-seen") === "1";
    } catch {
      return false;
    }
  });
  const [howToAsked, setHowToAsked] = useState(false);
  // On a phone the less-used header buttons sit behind a Menu button
  const [menuOpen, setMenuOpen] = useState(false);

  const viewRef = useRef<PlayerView | null>(null);
  const voiceOnRef = useRef(true);
  const playbackEpoch = useRef(0); // bumped to cancel everything queued
  const speakQueue = useRef<Promise<void>>(Promise.resolve());
  // Development telemetry: when each question was asked and answered, by turn key
  const turnTimes = useRef<Map<string, { askAt: number; responseAt?: number }>>(new Map());
  // The last spoken line, so "repeat" can play it again
  const lastSpoken = useRef<{ url?: string; turn: DialogueTurn } | null>(null);
  const soundReadyRef = useRef(false);
  const hushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Whoever was chosen, if they are still here; otherwise the first person present.
  const selectedCharacter =
    view?.characters.find((c) => c.id === selectedCharacterId) ?? view?.characters[0] ?? null;

  const showHowTo = howToAsked || (!howToSeen && !intro && !!view);
  const closeHowTo = useCallback(() => {
    setHowToSeen(true);
    setHowToAsked(false);
    try {
      localStorage.setItem("rn-howto-seen", "1");
    } catch {
      /* the card simply shows again next visit */
    }
    track("howto.closed", {});
  }, []);

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
        const recap: string | undefined = data.resumed ? data.recap : undefined;
        const openingAudio = [...opening.map((l) => l.audioUrl), ...(recap ? [data.recapAudioUrl] : [])].filter((u): u is string => !!u);
        if (recap) setWelcomeBack(recap);
        if (openingAudio.length > 0 || (data.voiceAvailable && !v.ending)) {
          setVoiceAvailable(true);
          // Browsers only allow sound after a click, so ask before the story begins,
          // and again when a run is resumed (a refresh loses the click).
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
            : [narrator(recap ?? `You pick up where you left off, in ${v.scene.name}.`)]
        );
      })
      .catch(() => setInitError("Could not load investigation. Please try again."));
  }, [runId]);


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

  // Coming back to the page (after a screen lock, an app switch or a call) leaves the browser's
  // audio stopped; start it again without waiting for the next tap.
  useEffect(() => {
    const comeBack = () => {
      if (document.visibilityState === "visible" && soundReadyRef.current) void unlockAudio();
    };
    document.addEventListener("visibilitychange", comeBack);
    window.addEventListener("pageshow", comeBack);
    return () => {
      document.removeEventListener("visibilitychange", comeBack);
      window.removeEventListener("pageshow", comeBack);
    };
  }, [unlockAudio]);

  // ── Ambience and sound effects ────────────────────────────────────────────
  const sceneId = view?.scene.id;
  const caseClosed = !!view?.ending;

  // The ambience follows the scene, and is silent when the voices are off or the case is closed.
  useEffect(() => {
    if (!soundReady || !sceneId) return;
    void getCuePlayer().setBed("ambience", voiceOn && !caseClosed ? ambienceFor(sceneId) : null);
    // Fetch the rooms the player can walk to next, so a move starts without a pause. The rest wait until needed.
    const next = (viewRef.current?.exits ?? []).map((e) => ambienceFor(e.id)).filter((id): id is string => !!id);
    getCuePlayer().preload(next);
  }, [soundReady, voiceOn, caseClosed, sceneId]);

  // The music: the theme once at the start, then the quiet investigation bed; the tense bed
  // while an accusation is being made; the closing music under the ending. Silent with the voices off.
  const [themeOver, setThemeOver] = useState(false);
  useEffect(() => {
    if (!soundReady) return;
    const timer = setTimeout(() => setThemeOver(true), THEME_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [soundReady]);
  useEffect(() => {
    if (!soundReady) return;
    let cue: string | null = null;
    if (voiceOn) {
      if (caseClosed) cue = MUSIC.closing;
      else if (accuseOpen) cue = MUSIC.tension;
      else cue = themeOver ? MUSIC.investigation : MUSIC.theme;
    }
    void getCuePlayer().setBed("music", cue);
  }, [soundReady, voiceOn, caseClosed, accuseOpen, themeOver]);

  // Fade the sound out when leaving the page
  useEffect(
    () => () => {
      if (soundReadyRef.current) getCuePlayer().stopAll(0.3);
      if (hushTimer.current) clearTimeout(hushTimer.current);
      if (liftTimer.current) clearTimeout(liftTimer.current);
    },
    []
  );

  /** Play a sting or effect, if the player has chosen sound. */
  const sting = useCallback((cueId: string) => {
    if (soundReadyRef.current && voiceOnRef.current) void getCuePlayer().play(cueId);
  }, []);

  /** Quieten the room while the player speaks, so the microphone hears the person. */
  const hushForMic = useCallback(() => {
    if (!soundReadyRef.current) return;
    getCuePlayer().hush();
    if (hushTimer.current) clearTimeout(hushTimer.current);
    // Never leave the room silent if a recording is abandoned
    hushTimer.current = setTimeout(() => getCuePlayer().restore(), 90_000);
  }, []);

  /** Swell the room while the characters think; settleRoom() brings it back when they speak. */
  const liftRoom = useCallback(() => {
    if (!soundReadyRef.current || !voiceOnRef.current) return;
    getCuePlayer().lift();
    if (liftTimer.current) clearTimeout(liftTimer.current);
    liftTimer.current = setTimeout(() => getCuePlayer().settle(), 10_000); // never leave it swelled
  }, []);

  const settleRoom = useCallback(() => {
    if (liftTimer.current) {
      clearTimeout(liftTimer.current);
      liftTimer.current = null;
    }
    if (soundReadyRef.current) getCuePlayer().settle();
  }, []);

  const endHush = useCallback(() => {
    if (hushTimer.current) {
      clearTimeout(hushTimer.current);
      hushTimer.current = null;
    }
    if (soundReadyRef.current) getCuePlayer().restore();
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
      // The character has started to speak: let the room settle back
      if (event === "first_sound" && (meta.kind === "reply" || meta.kind === "control")) settleRoom();
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
  }, [settleRoom]);

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
    soundReadyRef.current = true;
    setSoundReady(true);
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
    if (out.length > 0) sting(CLUE_STING);
    for (const n of data.notices ?? []) {
      out.push(narrator(n.text));
      speak(n.audioUrl, { kind: "notice" });
    }
    return out;
  },
    [speak, sting]
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
      endHush(); // the microphone is closed now, so the room can come back...
      liftRoom(); // ...and swell a little while the characters think
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
        if (!data.audioUrl || data.error) settleRoom(); // nothing is going to speak
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

        // A command ("repeat", "recap", "casebook"...) rather than a question
        if (data.control) {
          track("turn.control", { turn: turnKey, control: data.control });
          switch (data.control as string) {
            case "REPEAT_LAST": {
              const last = lastSpoken.current;
              if (!last) {
                push(narrator("There is nothing to repeat yet."));
              } else {
                push({ ...last.turn, id: nextId("again"), timestamp: new Date() });
                speak(last.url, { kind: "repeat", turnKey });
              }
              break;
            }
            case "OPEN_CASEBOOK":
              setPanel("casebook");
              break;
            case "MUTE":
              chooseVoice(false);
              push(narrator("The voices are off. Use the Voice button to turn them back on."));
              break;
            case "PAUSE":
              push(narrator("Paused. Ask whenever you are ready."));
              break;
            case "RESUME":
              push(narrator("Carry on, Detective."));
              break;
            default: {
              // Recap and help are answered in words, and read aloud by the narrator
              if (data.responseText) push(narrator(data.responseText));
              speak(data.audioUrl, { kind: "control", turnKey });
            }
          }
          push(...absorb(data));
          return;
        }

        let spoken: DialogueTurn | null = null;
        if (data.responseText && data.systemMessage) {
          push(narrator(data.responseText));
        } else if (data.responseText) {
          spoken = {
            id: nextId("char"),
            actor: "character",
            text: data.responseText,
            speakerName: speaker.name,
            timestamp: new Date(),
          };
          push(spoken);
        }
        if (spoken) lastSpoken.current = { url: data.audioUrl, turn: spoken };
        speak(data.audioUrl, { kind: "reply", turnKey });
        push(...absorb(data));
      } catch (err) {
        settleRoom();
        track("turn.failed", { turn: turnKey, message: err instanceof Error ? err.message : String(err) });
        push(narrator("The connection was interrupted. Your progress is saved. Please try again."));
      } finally {
        endHush();
        setIsLoading(false);
      }
    },
    [isLoading, runId, selectedCharacter, unlockAudio, stopSpeaking, speak, push, absorb, chooseVoice, endHush, liftRoom, settleRoom]
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
        if (action.type === "travel") sting(TRAVEL_SFX);
        const scene = narrator(data.narration);
        if (action.type === "examine") {
          // The find is in the casebook now, so the view carries its picture
          const found = (data.view as PlayerView | undefined)?.casebook.clues.find((c) => c.id === action.clueId);
          if (found?.image) {
            scene.image = found.image;
            if (found.imageText) scene.imageText = found.imageText;
          }
        }
        lastSpoken.current = { url: data.narrationAudioUrl, turn: scene };
        speak(data.narrationAudioUrl, { kind: action.type });
        push(scene, ...absorb(data));
      } catch {
        push(narrator("The connection was interrupted. Please try again."));
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, runId, stopSpeaking, unlockAudio, speak, push, absorb, sting]
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
        sting(data.view?.ending?.solved ? ENDING_STING.solved : ENDING_STING.closed);
        speak(data.endingAudioUrl, { kind: "ending" });
      } catch {
        setAccuseError("The connection was interrupted. Nothing was submitted. Please try again.");
      } finally {
        setAccuseBusy(false);
      }
    },
    [accuseBusy, runId, stopSpeaking, unlockAudio, speak, sting]
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
    <div className="h-dvh flex flex-col" style={{ background: "var(--bg)" }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-3 shrink-0"
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

        {/* On a phone only the two main buttons show; the rest sit behind Menu. Wrappers hide the
            buttons because the .btn class sets its own display, which would override a hidden class. */}
        <div className={`flex ${menuOpen ? "flex-wrap" : "flex-nowrap"} sm:flex-wrap items-center justify-end gap-2 min-w-0 flex-1 sm:flex-none`}>
          <div className={menuOpen ? "contents" : "hidden sm:contents"}>
            {voiceAvailable && (
              <button
                onClick={() => chooseVoice(!voiceOn)}
                aria-pressed={voiceOn}
                title={voiceOn ? "Turn the voices off" : "Turn the voices on"}
                className="btn btn-ghost btn-sm"
              >
                Voice: {voiceOn ? "on" : "off"}
              </button>
            )}
            <button onClick={() => setHowToAsked(true)} className="btn btn-ghost btn-sm">
              How to play
            </button>
          </div>
          <button
            onClick={() => setPanel((p) => (p === "casebook" ? null : "casebook"))}
            aria-expanded={panel === "casebook"}
            className="btn btn-ghost btn-sm"
          >
            Casebook{clueCount > 0 ? ` (${clueCount})` : ""}
          </button>
          <div className={menuOpen ? "contents" : "hidden sm:contents"}>
            <button
              onClick={() => setPanel((p) => (p === "audio" ? null : "audio"))}
              aria-expanded={panel === "audio"}
              aria-label="Audio settings"
              className="btn btn-ghost btn-sm"
            >
              Audio
            </button>
          </div>
          {view.accusation && (
            <button
              onClick={() => {
                setAccuseError(null);
                setAccuseOpen(true);
              }}
              className="btn btn-primary btn-sm"
            >
              Accuse
            </button>
          )}
          <div className={menuOpen ? "contents" : "hidden sm:contents"}>
            <a href="/play" className="btn btn-ghost btn-sm">
              Exit
            </a>
          </div>
          <div className="sm:hidden">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              className="btn btn-ghost btn-sm"
            >
              {menuOpen ? "Less" : "Menu"}
            </button>
          </div>
        </div>
      </header>

      {/* Phones and tablets: picture, people, then the conversation, stacked.
          Wide screens: the picture and people on the left, the conversation beside them. */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div
          className="shrink-0 lg:w-[40%] lg:max-w-[620px] lg:overflow-y-auto lg:border-r"
          style={{ borderColor: "var(--border)" }}
        >
          <SceneImage
            image={view.scene.image}
            title={view.scene.name}
            onImageError={(src) => track("image.error", { src })}
          />

          <SceneBar
            view={view}
            selectedCharacterId={selectedCharacter?.id ?? null}
            disabled={isLoading}
            showHints={view.casebook.interviewed.length === 0 && !turns.some((t) => t.actor === "player")}
            onSelectCharacter={setSelectedCharacterId}
            onTravel={(sceneId) => sceneAction({ type: "travel", sceneId })}
            onExamine={(clueId) => sceneAction({ type: "examine", clueId })}
          />
        </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
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
                className="input flex-1 resize-none leading-snug"
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
                  endHush();
                  track("mic.rejected", { message: message.slice(0, 60) });
                  push(narrator(message));
                }}
                onTelemetry={(name, data) => {
                  if (name === "mic.error") endHush(); // the recording never happened
                  track(name, data);
                }}
                onRecordingStart={() => {
                  stopSpeaking("mic");
                  hushForMic();
                }}
                disabled={isLoading || !canSpeak}
              />
              <div className="flex-1 divider" />
            </div>

            <p className="text-center text-xs" style={{ color: "var(--text-faint)" }}>
              {selectedCharacter
                ? `Asking ${selectedCharacter.name}. Tap the microphone, speak, and tap again to send, or type above.`
                : "Tap the microphone to speak and tap again to send, or type above"}
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

      {showHowTo && <HowToPlay onClose={closeHowTo} />}

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
              {welcomeBack ? "Where you left off" : intro.length === 0 ? "Welcome back" : "Best heard, not read"}
            </h2>
            {welcomeBack && (
              <p className="text-sm leading-relaxed text-left" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                {welcomeBack}
              </p>
            )}
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              The characters speak aloud. Turn your sound up, or connect a speaker for the room.
              You can answer by voice or by typing, and every word is also written out.
            </p>
            <div className="flex flex-col gap-3">
              <button autoFocus onClick={beginWithSound} className="btn btn-primary py-4">
                {welcomeBack || intro.length === 0 ? "Continue with sound" : "Begin with sound"}
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
