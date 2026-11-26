"use client";

/**
 * PushToTalk.tsx
 * Microphone capture button for Radio Night.
 *
 * - Hold/tap to record, release/tap again to submit
 * - Shows live waveform amplitude indicator during recording
 * - Returns base64-encoded audio on submit
 * - Offers "Type instead" fallback at all times
 * - Requests mic permission on first use only (not on page load)
 *
 * Security: audio bytes are sent to /api/stt — raw audio is never stored
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { assessRecording } from "../lib/mic-check";
import { createQuietDetector } from "../lib/quiet-after-speech";
import { setAudioSession } from "../lib/audio-session";

/**
 * Encode bytes as base64 in chunks. Spreading a whole recording into
 * String.fromCharCode overflows the call stack after a few seconds of audio.
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

type RecordingState = "idle" | "requesting" | "recording" | "processing" | "error";

/** What the page learns about a recording that was sent. */
export type RecordingMeta = {
  /** performance.now() at the moment the player tapped to finish */
  stopTapAt: number;
  durationMs: number;
  peakRms: number;
  uploadBytes: number;
};

type PushToTalkProps = {
  onAudio: (base64Audio: string, mimeType: string, meta: RecordingMeta) => void;
  /** A recording that was not worth sending (muted, silent, too short), with a message for the player. */
  onRejected?: (message: string) => void;
  /** Called the moment the player asks to record, so playback can stop first. */
  onRecordingStart?: () => void;
  /** Development telemetry hook. */
  onTelemetry?: (name: string, data: Record<string, unknown>) => void;
  /** Called when recording starts or stops, so the page can guide the player. */
  onRecordingChange?: (recording: boolean) => void;
  /** Who the question goes to; shown in the button label. */
  personName?: string | null;
  disabled?: boolean;
  className?: string;
};

const round = (n: number, places = 4) => Math.round(n * 10 ** places) / 10 ** places;

export function PushToTalk({ onAudio, onRejected, onRecordingStart, onTelemetry, onRecordingChange, personName, disabled, className = "" }: PushToTalkProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [amplitude, setAmplitude] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // True when the player seems to have finished talking. Only changes the label; never sends.
  const [quiet, setQuiet] = useState(false);
  const quietDetectorRef = useRef(createQuietDetector());

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelsRef = useRef({ peak: 0, sum: 0, frames: 0, voiced: 0 });
  const trackMutedRef = useRef(false);
  const startedAtRef = useRef(0);
  const stopTapAtRef = useRef(0);

  const closeAudioContext = useCallback(() => {
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    // Browsers cap how many audio contexts may exist (Safari is strict), so never leak one.
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => undefined);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      closeAudioContext();
      setAudioSession("playback");
    };
  }, [closeAudioContext]);

  /** Measure the level of the incoming audio on every frame while recording. */
  const startLevelMeter = useCallback((ctx: AudioContext, stream: MediaStream) => {
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(buffer);
      const rms = Math.sqrt(buffer.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) / buffer.length);
      const lv = levelsRef.current;
      lv.frames += 1;
      lv.sum += rms;
      if (rms > lv.peak) lv.peak = rms;
      if (rms > 0.02) lv.voiced += 1;
      setAmplitude(Math.min(1, rms * 5));
      setQuiet(quietDetectorRef.current.push(rms, performance.now()));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const stopLevelMeter = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    setAmplitude(0);
    quietDetectorRef.current.reset();
    setQuiet(false);
  }, []);

  const startRecording = useCallback(async () => {
    // Allowed from "error" too: a failed attempt must not leave the button dead.
    if (disabled || (state !== "idle" && state !== "error")) return;

    // The microphone must not hear the game: stop any speech before listening.
    onRecordingStart?.();

    setState("requesting");
    setErrorMessage(null);

    // Created inside the click, before any await, so Safari allows it to run.
    closeAudioContext();
    try {
      const ctx = new AudioContext();
      void ctx.resume();
      audioCtxRef.current = ctx;
    } catch {
      audioCtxRef.current = null;
    }

    const askedAt = performance.now();
    try {
      setAudioSession("play-and-record");
      // The game stops its own sound before listening, so echo cancellation is not needed. Leaving it
      // on puts iPhone into a voice-call mode that makes everything played afterwards much quieter.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false } });
      const permMs = Math.round(performance.now() - askedAt);
      streamRef.current = stream;

      const track = stream.getAudioTracks()[0];
      trackMutedRef.current = !!track?.muted;
      track?.addEventListener("mute", () => {
        trackMutedRef.current = true;
        onTelemetry?.("mic.track_mute", {});
      });
      track?.addEventListener("unmute", () => {
        trackMutedRef.current = false;
        onTelemetry?.("mic.track_unmute", {});
      });
      track?.addEventListener("ended", () => onTelemetry?.("mic.track_ended", {}));

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      levelsRef.current = { peak: 0, sum: 0, frames: 0, voiced: 0 };

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const durationMs = Math.round(performance.now() - startedAtRef.current);
        const ctx = audioCtxRef.current;
        const lv = levelsRef.current;
        const levelsMeasured = !!ctx && ctx.state === "running" && lv.frames >= 5;
        stopLevelMeter();
        closeAudioContext();

        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const verdict = assessRecording({
          durationMs,
          peakRms: lv.peak,
          trackMuted: trackMutedRef.current,
          levelsMeasured,
        });

        const settings = track?.getSettings?.() ?? {};
        onTelemetry?.("mic.recording", {
          durationMs,
          tapToStopMs: Math.round(performance.now() - stopTapAtRef.current),
          peakRms: round(lv.peak),
          meanRms: round(lv.frames ? lv.sum / lv.frames : 0),
          voicedFraction: round(lv.frames ? lv.voiced / lv.frames : 0, 3),
          frames: lv.frames,
          levelsMeasured,
          trackMuted: trackMutedRef.current,
          verdict: verdict.ok ? "ok" : verdict.reason,
          uploaded: verdict.ok,
          mimeType,
          bytes: blob.size,
          permMs,
          trackLabel: track?.label,
          sampleRate: settings.sampleRate,
          channelCount: settings.channelCount,
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          autoGainControl: settings.autoGainControl,
        });

        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setAudioSession("playback"); // the microphone is let go: back to full playback volume

        if (!verdict.ok) {
          setState("idle");
          onRejected?.(verdict.message);
          return;
        }

        setState("processing");
        const base64 = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
        onAudio(base64, mimeType, {
          stopTapAt: stopTapAtRef.current,
          durationMs,
          peakRms: lv.peak,
          uploadBytes: blob.size,
        });
        setState("idle");
      };

      recorder.onerror = () => {
        onTelemetry?.("mic.error", { stage: "recorder" });
        setState("error");
        setErrorMessage("Recording failed. Please try again or type your question.");
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setAudioSession("playback"); // the microphone is let go: back to full playback volume
        stopLevelMeter();
        closeAudioContext();
      };

      if (audioCtxRef.current) startLevelMeter(audioCtxRef.current, stream);
      recorder.start();
      startedAtRef.current = performance.now();
      setState("recording");
    } catch (err) {
      closeAudioContext();
      setAudioSession("playback");
      const name = err instanceof DOMException ? err.name : "Error";
      onTelemetry?.("mic.error", {
        stage: "start",
        name,
        message: err instanceof Error ? err.message : String(err),
        permMs: Math.round(performance.now() - askedAt),
      });
      setState("error");
      if (name === "NotAllowedError") {
        setErrorMessage("Microphone permission denied. You can type your question instead.");
      } else if (name === "NotFoundError") {
        setErrorMessage("No microphone was found. You can type your question instead.");
      } else {
        setErrorMessage("Could not access the microphone. You can type your question instead.");
      }
    }
  }, [
    disabled,
    state,
    onAudio,
    onRejected,
    onRecordingStart,
    onTelemetry,
    closeAudioContext,
    startLevelMeter,
    stopLevelMeter,
  ]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      stopTapAtRef.current = performance.now();
      mediaRecorderRef.current.stop();
    }
  }, []);

  const isRecording = state === "recording";
  useEffect(() => {
    onRecordingChange?.(isRecording);
  }, [isRecording, onRecordingChange]);
  const isProcessing = state === "processing" || state === "requesting";

  const barCount = 5;
  const bars = Array.from({ length: barCount }, (_, i) => {
    const center = barCount / 2;
    const distance = Math.abs(i - center) / center;
    const height = isRecording
      ? Math.max(0.2, amplitude * (1 - distance * 0.6))
      : 0.15;
    return height;
  });

  const target = personName ? ` ${personName}` : "";
  const label = isRecording
    ? quiet
      ? "Done? Tap to send"
      : "Listening… tap to send"
    : isProcessing
    ? state === "requesting"
      ? "Starting the microphone…"
      : "Sending…"
    : personName === null
    ? "No one here to ask"
    : `Tap to ask${target}`;
  return (
    <div className={`flex flex-col items-stretch gap-2 w-full ${className}`}>
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || isProcessing}
        aria-pressed={isRecording}
        data-state={isRecording ? (quiet ? "done" : "recording") : isProcessing ? "busy" : "ready"}
        className={`talk-button relative w-full min-h-14 rounded-xl px-4 py-3 flex items-center justify-center gap-3 font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
          disabled ? "opacity-40 cursor-not-allowed" : ""
        } ${isRecording ? (quiet ? "talk-pulse-fast" : "talk-pulse") : ""}`}
        style={{
          // A lamp key: amber when ready, red while listening, dark while busy
          background: isRecording
            ? "linear-gradient(#ef4444, #b91c1c 60%, #7f1d1d)"
            : isProcessing
            ? "linear-gradient(#3a2d1d, #231a10)"
            : "linear-gradient(#ffcf70, #d97706 55%, #92400e)",
          color: isRecording ? "#fff" : isProcessing ? "var(--text-muted)" : "#2a1400",
          border: "2px solid #8f8d87",
          boxShadow: isRecording
            ? "0 0 20px rgba(220,38,38,0.55), inset 0 2px 0 rgba(255,255,255,0.3)"
            : isProcessing
            ? "inset 0 2px 6px rgba(0,0,0,0.6)"
            : "0 0 14px rgba(245,158,11,0.4), inset 0 2px 0 rgba(255,255,255,0.4)",
        }}
      >
        {isRecording ? (
          <span className="flex items-center gap-0.5 h-6" aria-hidden="true">
            {bars.map((h, i) => (
              <span
                key={i}
                className="w-1 bg-white rounded-full transition-all duration-75"
                style={{ height: `${Math.max(4, Math.round(h * 24))}px` }}
              />
            ))}
          </span>
        ) : isProcessing ? (
          <span
            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
            aria-hidden="true"
          />
        ) : (
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
        <span role="status" aria-live="polite">{label}</span>
      </button>
      {errorMessage && (
        <p role="alert" className="text-xs text-center" style={{ color: "#fca5a5" }}>
          {errorMessage}
        </p>
      )}
    </div>
  );
}
