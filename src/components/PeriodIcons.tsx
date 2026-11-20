/**
 * PeriodIcons.tsx
 * Line drawings of things a detective had to hand in 1981: the "How it works" steps and the spoken-question mark.
 * Drawn objects, not interface symbols. Decorative: each has words beside it.
 */

type IconProps = { className?: string };

const common = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

/** A portable cassette recorder, set on the table for an interview. */
export function CassetteRecorderIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 48" className={className} {...common}>
      <path d="M20 10V6.5h24V10" />
      <rect x="4" y="10" width="56" height="32" rx="4" />
      {/* piano keys */}
      <path d="M9 10v5h6v-5M17 10v5h6v-5M25 10v5h6v-5M33 10v5h6v-5" />
      {/* speaker grille */}
      <circle cx="17" cy="29" r="8" />
      <path d="M11 26h12M10 29h14M11 32h12" strokeWidth={1.25} />
      {/* cassette window */}
      <rect x="31" y="21" width="24" height="15" rx="2" />
      <circle cx="38" cy="28" r="3" />
      <circle cx="48" cy="28" r="3" />
      <path d="M38 31h10" />
      <circle cx="54" cy="15" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** A Polaroid photograph, the evidence picture of the day. */
export function PolaroidIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 48" className={className} {...common}>
      <g transform="rotate(-7 32 24)">
        <rect x="16" y="3" width="32" height="40" rx="1" />
        <rect x="19.5" y="6.5" width="25" height="25" />
        {/* the picture: a lamp-lit window */}
        <path d="M24 31.5V15h16v16.5M32 15v16.5M24 23h16" strokeWidth={1.25} />
        <path d="M22 36.5h11" strokeWidth={1.25} />
      </g>
    </svg>
  );
}

/** A police lineup: a figure against the height chart. */
export function LineupIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 48" className={className} {...common}>
      <path d="M8 8h48M8 16h48M8 24h48M8 32h48M8 40h48" strokeWidth={1.25} />
      <path d="M8 12h4M8 20h4M8 28h4M8 36h4M52 12h4M52 20h4M52 28h4M52 36h4" strokeWidth={1} />
      {/* the figure, filled with the page colour so the lines pass behind it */}
      <g style={{ fill: "var(--bg-raised)" }}>
        <path d="M19 47c0-10 6-14 13-14s13 4 13 14z" />
        <circle cx="32" cy="21" r="7.5" />
        {/* the number board held at the chest */}
        <rect x="23" y="37" width="18" height="8" rx="0.5" />
      </g>
      <path d="M26.5 41h11" strokeWidth={1.25} />
      <path d="M27 33.5l5 3.5 5-3.5" strokeWidth={1} />
    </svg>
  );
}

/** A cassette tape: marks a question the detective spoke rather than typed. */
export function CassetteIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 40 26" className={className} {...common} strokeWidth={2}>
      <rect x="2" y="2" width="36" height="22" rx="2.5" />
      <rect x="9" y="7" width="22" height="8" rx="1.5" strokeWidth={1.5} />
      <circle cx="14" cy="11" r="1.6" strokeWidth={1.5} />
      <circle cx="26" cy="11" r="1.6" strokeWidth={1.5} />
      <path d="M11 24l2.5-4.5h13L29 24" strokeWidth={1.5} />
    </svg>
  );
}
