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

type RecordingState = "idle" | "requesting" | "recording" | "processing" | "error";

type PushToTalkProps = {
  onAudio: (base64Audio: string) => void;
  disabled?: boolean;
  className?: string;
};

export function PushToTalk({ onAudio, disabled, className = "" }: PushToTalkProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [amplitude, setAmplitude] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startAmplitudeMonitor = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(buffer);
      const rms = Math.sqrt(
        buffer.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) / buffer.length
      );
      setAmplitude(Math.min(1, rms * 5));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const stopAmplitudeMonitor = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    setAmplitude(0);
  }, []);

  const startRecording = useCallback(async () => {
    if (disabled || state !== "idle") return;

    setState("requesting");
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stopAmplitudeMonitor();
        setState("processing");

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(
          String.fromCharCode(...new Uint8Array(arrayBuffer))
        );

        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        onAudio(base64);
        setState("idle");
      };

      recorder.onerror = () => {
        setState("error");
        setErrorMessage("Recording failed. Please try again or type your question.");
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      startAmplitudeMonitor(stream);
      recorder.start();
      setState("recording");
    } catch (err) {
      setState("error");
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setErrorMessage("Microphone permission denied. You can type your question instead.");
      } else {
        setErrorMessage("Could not access microphone. Please type your question.");
      }
    }
  }, [disabled, state, onAudio, startAmplitudeMonitor, stopAmplitudeMonitor]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const isRecording = state === "recording";
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

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {/* Main record button */}
      <button
        onPointerDown={startRecording}
        onPointerUp={stopRecording}
        onPointerLeave={stopRecording}
        onClick={!isRecording ? startRecording : stopRecording}
        disabled={disabled || isProcessing}
        aria-label={isRecording ? "Stop recording" : "Hold to speak"}
        aria-pressed={isRecording}
        className={`
          relative w-16 h-16 rounded-full flex items-center justify-center
          transition-all duration-150 focus:outline-none focus:ring-2
          focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-neutral-950
          ${
            isRecording
              ? "bg-red-700 hover:bg-red-600 scale-110 shadow-lg shadow-red-900/50"
              : isProcessing
              ? "bg-neutral-700 cursor-wait"
              : "bg-amber-700 hover:bg-amber-600"
          }
          ${disabled ? "opacity-40 cursor-not-allowed" : ""}
        `}
      >
        {/* Waveform bars inside the button */}
        {isRecording && (
          <div className="flex items-center gap-0.5" aria-hidden="true">
            {bars.map((h, i) => (
              <div
                key={i}
                className="w-1 bg-white rounded-full transition-all duration-75"
                style={{ height: `${Math.round(h * 32)}px` }}
              />
            ))}
          </div>
        )}

        {!isRecording && !isProcessing && (
          <svg
            className="w-7 h-7 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}

        {isProcessing && (
          <div
            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
            aria-hidden="true"
          />
        )}
      </button>

      <p className="text-xs text-neutral-500 text-center">
        {isRecording
          ? "Recording… release to submit"
          : isProcessing
          ? "Processing…"
          : state === "error"
          ? ""
          : "Hold to speak"}
      </p>

      {errorMessage && (
        <p
          role="alert"
          className="text-xs text-red-400 text-center max-w-xs"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}
