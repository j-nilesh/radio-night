import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Radio Night — An Interactive Radio Mystery",
  description:
    "A voice-first interactive detective game. Listen, question the suspects, follow the evidence, solve the case.",
};

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-28 text-center relative overflow-hidden">
        {/* Warm amber glow behind the title */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% 60%, rgba(180,83,9,0.18) 0%, rgba(120,50,8,0.08) 50%, transparent 80%)",
          }}
        />

        <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center gap-7">

          {/* Eyebrow */}
          <p
            className="text-xs font-semibold tracking-[0.35em] uppercase"
            style={{ color: "var(--amber)" }}
          >
            A Radio Mystery
          </p>

          {/* Title */}
          <h1
            className="text-6xl sm:text-7xl font-bold"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
          >
            Radio Night
          </h1>

          {/* Tagline */}
          <p
            className="text-lg italic"
            style={{ color: "var(--text-muted)" }}
          >
            The story is listening.
          </p>

          {/* Rule */}
          <div className="w-12 border-t" style={{ borderColor: "var(--amber-dim)" }} />

          {/* Description */}
          <p
            className="text-lg leading-relaxed max-w-md"
            style={{ color: "var(--text-secondary)" }}
          >
            An atmospheric detective mystery. Listen to the drama, question the suspects
            in your own words, follow the evidence, name the killer.
          </p>

          {/* CTA */}
          <Link href="/play" className="btn btn-primary text-base px-10 py-4 mt-2">
            Begin Investigation
          </Link>

          <p className="text-sm" style={{ color: "var(--text-faint)" }}>
            No account required · Play solo or with a room full of detectives
          </p>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section style={{ background: "var(--bg-raised)", borderTop: "1px solid var(--border)" }}>
        <div className="max-w-3xl mx-auto px-6 py-20">
          <p
            className="text-xs font-semibold tracking-[0.3em] uppercase text-center mb-12"
            style={{ color: "var(--amber)" }}
          >
            How it works
          </p>
          <div className="grid sm:grid-cols-3 gap-10">
            {[
              {
                icon: "🎙️",
                title: "Question the suspects",
                body: "Speak or type in your own words. The characters hear you and answer back.",
              },
              {
                icon: "🗂️",
                title: "Follow the evidence",
                body: "Your casebook tracks every discovery, claim, and contradiction.",
              },
              {
                icon: "🔍",
                title: "Name the killer",
                body: "One fixed truth. One fair mystery. Solve it by reasoning, not guessing.",
              },
            ].map(({ icon, title, body }) => (
              <div key={title} className="flex flex-col items-center text-center gap-3">
                <span className="text-3xl" aria-hidden="true">{icon}</span>
                <h3
                  className="font-semibold text-base"
                  style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
                >
                  {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Play modes ───────────────────────────────────────────────── */}
      <section style={{ background: "var(--bg)" }}>
        <div className="max-w-3xl mx-auto px-6 py-20">
          <p
            className="text-xs font-semibold tracking-[0.3em] uppercase text-center mb-12"
            style={{ color: "var(--amber)" }}
          >
            Play solo or together
          </p>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="card space-y-2">
              <h3
                className="font-semibold text-base"
                style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
              >
                Solo Investigation
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Phone, tablet, or laptop. Speak or type. Work through the casebook at your own pace.
              </p>
            </div>
            <div
              className="card space-y-2"
              style={{ borderColor: "var(--amber-dim)", background: "rgba(120,50,8,0.12)" }}
            >
              <h3
                className="font-semibold text-base"
                style={{ color: "var(--amber-text)", fontFamily: "var(--font-display)" }}
              >
                Radio Night with Friends
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Route audio to any speaker. Everyone hears the drama. Take turns
                asking questions. Discuss between turns.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid var(--border)" }}>
        <div
          className="max-w-3xl mx-auto px-6 py-7 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
          style={{ color: "var(--text-faint)" }}
        >
          <span>Radio Night · Kiroween 2026 · Resurrection</span>
          <nav className="flex gap-6" aria-label="Footer">
            {["About", "Credits", "Privacy"].map((label) => (
              <a
                key={label}
                href={`/${label.toLowerCase()}`}
                style={{ color: "var(--text-faint)" }}
                className="hover:text-stone-400 transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </main>
  );
}
