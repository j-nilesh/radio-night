"use client";

/**
 * EndingScreen.tsx
 * The authored finale. Shown whenever the run's view carries an ending, so a
 * page refresh returns here rather than back into a closed case.
 */

import type { PlayerView } from "@ai-orchestration/scene-view";

export function EndingScreen({ ending }: { ending: NonNullable<PlayerView["ending"]> }) {
  return (
    <main
      className="min-h-screen flex flex-col items-center px-6 py-16 relative overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: ending.solved
            ? "radial-gradient(ellipse 70% 50% at 50% 30%, rgba(180,83,9,0.16) 0%, transparent 70%)"
            : "radial-gradient(ellipse 70% 50% at 50% 30%, rgba(80,70,60,0.2) 0%, transparent 70%)",
        }}
      />

      <article className="relative z-10 w-full max-w-xl flex flex-col gap-8">
        <header className="flex flex-col gap-3 text-center items-center">
          <p
            className="text-xs font-semibold tracking-[0.35em] uppercase"
            style={{ color: ending.solved ? "var(--amber)" : "var(--text-muted)" }}
          >
            The Sitting
          </p>
          <h1 className="text-5xl font-bold" style={{ color: "var(--text-primary)" }}>
            {ending.title}
          </h1>
          <div className="w-12 border-t" style={{ borderColor: "var(--amber-dim)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            You accused {ending.accusedName}.
          </p>
        </header>

        <p
          className="text-lg leading-loose"
          style={{ color: "var(--text-secondary)", fontFamily: "var(--font-display)" }}
        >
          {ending.narration}
        </p>

        <blockquote
          className="rounded-lg px-5 py-4 text-sm leading-relaxed italic"
          style={{
            color: "var(--text-secondary)",
            background: "var(--bg-card)",
            borderLeft: "3px solid var(--amber-dim)",
          }}
        >
          <span
            className="block not-italic text-xs font-semibold tracking-widest uppercase mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            The detective&rsquo;s assessment
          </span>
          {ending.assessment}
        </blockquote>

        {ending.debrief && (
          <section aria-label="Your case" className="flex flex-col gap-3">
            <h2
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}
            >
              Your case
            </h2>
            <ul className="flex flex-col gap-2">
              {ending.debrief.map((d) => (
                <li
                  key={d.label}
                  className="flex items-start gap-3 text-sm leading-relaxed"
                  style={{ color: d.established ? "var(--text-primary)" : "var(--text-faint)" }}
                >
                  <span
                    aria-hidden="true"
                    style={{ color: d.established ? "var(--amber)" : "var(--text-faint)" }}
                  >
                    {d.established ? "✓" : "○"}
                  </span>
                  <span>
                    {d.label}
                    <span className="sr-only">{d.established ? " (established)" : " (not put forward)"}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <a href="/play" className="btn btn-primary px-8 py-4">
            Investigate again
          </a>
          <a href="/" className="btn btn-ghost px-8 py-4">
            Back to the start
          </a>
        </div>
      </article>
    </main>
  );
}
