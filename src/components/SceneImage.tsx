"use client";

/**
 * SceneImage.tsx
 * The room picture across the top of the case screen: the room's name over a
 * dark gradient at the bottom, a crossfade when the player changes room, and a
 * "Hide picture" switch (kept on this device) for people who want the screen
 * quiet or to save data.
 *
 * It is a quiet companion to the sound. It stays small enough that the
 * dialogue and the microphone are never pushed off a phone screen.
 */

import { useEffect, useState } from "react";
import type { ImageRef } from "@ai-orchestration/case-content";
import { Photo } from "./Photo";
import { advance, settle, startFade, type Fade } from "../lib/crossfade";

const HIDE_KEY = "rn-hide-picture";
const FADE_MS = 600;

type SceneImageProps = {
  image?: ImageRef;
  /** The room's name, shown over the picture */
  title: string;
  onImageError?: (src: string) => void;
};

export function SceneImage({ image, title, onImageError }: SceneImageProps) {
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof localStorage !== "undefined" && localStorage.getItem(HIDE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [fade, setFade] = useState<Fade<ImageRef>>(() => startFade(image ?? null));

  // When the room changes: wait until the new picture is ready, then fade to it.
  const wanted = image?.src ?? null;
  useEffect(() => {
    if (wanted === (fade.current?.src ?? null)) return;
    let cancelled = false;
    const finish = () => {
      if (cancelled) return;
      setFade((prev) => advance(prev, image ?? null));
      window.setTimeout(() => !cancelled && setFade((prev) => settle(prev)), FADE_MS + 50);
    };
    // Whether the new picture loads or fails, change over: Photo shows its own fallback on failure.
    // Always asynchronous, so no state is set while the effect runs.
    let ready: Promise<unknown> = Promise.resolve();
    if (image) {
      const probe = new window.Image();
      probe.src = image.src;
      if (probe.decode) ready = probe.decode().catch(() => undefined);
    }
    void ready.then(finish);
    return () => {
      cancelled = true;
    };
    // Only the wanted picture decides whether to change over
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);

  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    try {
      localStorage.setItem(HIDE_KEY, next ? "1" : "0");
    } catch {
      /* the choice simply is not remembered */
    }
  };

  if (!image && !fade.current && !fade.previous) return null;

  const switchLabel = hidden ? "Show picture" : "Hide picture";

  return (
    <section aria-label="The room" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg)" }}>
      {hidden ? (
        <div className="flex items-center justify-between px-5 py-1.5">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {title}
          </span>
          <button onClick={toggle} className="tap-target text-xs underline-offset-2 hover:underline" style={{ color: "var(--text-muted)" }}>
            {switchLabel}
          </button>
        </div>
      ) : (
        <div className="relative w-full scene-banner">
          {/* Keyed by picture, so the outgoing image keeps its element while the new one fades in on top */}
          {[fade.previous, fade.current]
            .filter((img): img is ImageRef => !!img)
            .map((img) => {
              const incoming = img === fade.current && !!fade.previous;
              return (
                <div key={img.src} className={`photo-layer ${incoming ? "photo-layer--in" : ""}`} aria-hidden={img === fade.previous}>
                  <Photo image={img} sizing="fill" priority={img === fade.current} onError={onImageError} />
                </div>
              );
            })}
          <div
            className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 px-5 pb-2.5 pt-10"
            style={{ background: "linear-gradient(180deg, transparent, rgba(15,13,11,0.88))" }}
          >
            <p
              className="text-xl sm:text-2xl font-bold leading-tight"
              style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}
            >
              {title}
            </p>
            <button
              onClick={toggle}
              className="tap-target text-xs rounded px-2 py-1 shrink-0"
              style={{ color: "var(--text-secondary)", background: "rgba(15,13,11,0.6)", border: "1px solid var(--border-mid)" }}
            >
              {switchLabel}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
