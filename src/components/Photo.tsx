"use client";

/**
 * Photo.tsx
 * Shows one picture with the game's shared photographic grade (warm tone, film
 * grain, vignette; see globals.css). Used for rooms, portraits and evidence.
 *
 * - A fixed box (aspect ratio from the image, or filling its parent), so the page
 *   does not jump when the picture arrives.
 * - Alt text from the image reference, a focal point for crops, and a shimmer
 *   while it loads.
 * - If the picture cannot load, a calm block with the alt text replaces it, so
 *   the page never shows a broken-image icon.
 *
 * It takes an ImageRef from the player view, never an id or the manifest, so the
 * browser only ever handles pictures it was given.
 */

import { useState } from "react";
import type { ImageRef } from "@ai-orchestration/case-content";

export type PhotoProps = {
  image: ImageRef;
  /** "ratio" sizes the box from the image; "fill" fills the parent, which sets the size */
  sizing?: "ratio" | "fill";
  /** Extra grade: dawn (lighter, cooler) or dim (darker, desaturated) */
  grade?: "dawn" | "dim";
  /** Load now (for a picture that is visible straight away) */
  priority?: boolean;
  /** The picture adds nothing a nearby label does not already say (for example a portrait beside a name), so it is hidden from screen readers */
  decorative?: boolean;
  className?: string;
  /** Text shown if the picture cannot load; defaults to the alt text */
  fallbackLabel?: string;
  onError?: (src: string) => void;
  children?: React.ReactNode;
};

export function Photo({ image, sizing = "ratio", grade, priority, decorative, className = "", fallbackLabel, onError, children }: PhotoProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`photo ${grade ? `photo--${grade}` : ""} ${className}`}
      style={sizing === "ratio" ? { aspectRatio: `${image.width} / ${image.height}` } : { position: "absolute", inset: 0 }}
    >
      {!failed && (
        <picture>
          {image.sources?.map((s) => (
            <source key={s.src} srcSet={s.src} type={s.type} />
          ))}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.src}
            alt={decorative ? "" : image.alt}
            width={image.width}
            height={image.height}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            style={{ objectPosition: image.focus }}
            onLoad={() => setLoaded(true)}
            onError={() => {
              setFailed(true);
              onError?.(image.src);
            }}
          />
        </picture>
      )}
      {!loaded && !failed && <div className="photo-shimmer" aria-hidden="true" />}
      {failed && (
        <div className="photo-fallback" {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": image.alt })}>
          <span aria-hidden="true">{fallbackLabel ?? image.alt}</span>
        </div>
      )}
      <span className="photo-grain" aria-hidden="true" />
      {children}
    </div>
  );
}
