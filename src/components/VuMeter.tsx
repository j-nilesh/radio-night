"use client";

/**
 * VuMeter.tsx
 * A small amber VU meter for the case header. The needle follows the level of
 * the dialogue bus, so it moves with whoever is speaking and rests in silence.
 * Decorative: everything said is also written in the conversation.
 */

import { useEffect, useRef } from "react";
import { getMixer } from "../lib/mixer-client";

const REST_DEG = -40;
const SWING_DEG = 80;
const FLOOR_DB = -42; // needle at rest
const PEAK_DB = -8; // needle at the red mark

/** Map a level (RMS, 0 to 1) to a needle angle, on a decibel scale like a real meter. */
export function needleAngle(rms: number): number {
  if (rms <= 0) return REST_DEG;
  const db = 20 * Math.log10(rms);
  const t = Math.min(1, Math.max(0, (db - FLOOR_DB) / (PEAK_DB - FLOOR_DB)));
  return REST_DEG + t * SWING_DEG;
}

export function VuMeter({ className = "" }: { className?: string }) {
  const needle = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const mixer = getMixer();
    let angle = REST_DEG;
    let frame = 0;
    const tick = () => {
      const target = needleAngle(mixer.dialogueLevel());
      // VU ballistics: quick to rise, slower to fall
      angle += (target - angle) * (target > angle ? 0.3 : 0.08);
      if (needle.current) needle.current.style.transform = `rotate(${angle.toFixed(1)}deg)`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <span className={`vu ${className}`} aria-hidden="true">
      <span className="vu-red" />
      <span ref={needle} className="vu-needle" />
    </span>
  );
}
