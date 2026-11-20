import Link from "next/link";
import type { Metadata } from "next";
import { Photo } from "../../components/Photo";
import { HeroContinue } from "../../components/HeroContinue";
import { CHARACTERS } from "../../../content/cases/radio-night-s01/v1/characters";
import { CHARACTER_IMAGE, HERO_IMAGE, VICTIM_IMAGE, imageAsset, toImageRef } from "../../../content/cases/radio-night-s01/v1/images";
import { shortRole } from "../../lib/short-role";
import { CassetteRecorderIcon, PolaroidIcon, LineupIcon } from "../../components/PeriodIcons";

/** Public cast list for the home page: names, short roles and portraits only. */
function castCards() {
  const cards = CHARACTERS.map((c) => {
    const asset = imageAsset(CHARACTER_IMAGE[c.id] ?? "");
    return { id: c.id, name: c.name, role: shortRole(c.role), image: asset ? toImageRef(asset) : null };
  });
  const victim = imageAsset(VICTIM_IMAGE);
  if (victim) cards.push({ id: "victim", name: "Gerald Fenn", role: "The victim", image: toImageRef(victim) });
  return cards;
}

export const metadata: Metadata = {
  title: "Begin — Radio Night",
  description:
    "A voice-first interactive detective game. Listen, question the suspects, follow the evidence, solve the case.",
};

export default function StartPage() {
  const heroAsset = imageAsset(HERO_IMAGE);
  const hero = heroAsset ? toImageRef(heroAsset) : null;
  const cast = castCards();
  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-28 text-center relative overflow-hidden">
        {hero && (
          <div className="absolute inset-0" aria-hidden="true">
            <Photo image={hero} sizing="fill" priority decorative />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(12,10,9,0.72), rgba(12,10,9,0.88))" }} />
          </div>
        )}
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

          {/* A saved investigation, when this browser has one */}
          <HeroContinue />

          {/* CTA */}
          <Link href="/play" className="btn btn-primary text-base px-10 py-4 mt-2">
            Begin Investigation
          </Link>

          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
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
                Icon: CassetteRecorderIcon,
                title: "Question the suspects",
                body: "Speak or type in your own words. The characters hear you and answer back.",
              },
              {
                Icon: PolaroidIcon,
                title: "Follow the evidence",
                body: "Your casebook tracks every discovery, claim, and contradiction.",
              },
              {
                Icon: LineupIcon,
                title: "Name the killer",
                body: "One fixed truth. One fair mystery. Solve it by reasoning, not guessing.",
              },
            ].map(({ Icon, title, body }) => (
              <div key={title} className="flex flex-col items-center text-center gap-3" style={{ color: "var(--amber-bright)" }}>
                <Icon className="w-20 h-[3.75rem]" />
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

      {/* ── Meet the cast ────────────────────────────────────────────── */}
      <section aria-labelledby="cast-heading" style={{ background: "var(--bg)", borderTop: "1px solid var(--border)" }}>
        <div className="max-w-4xl mx-auto px-6 py-20">
          <h2
            id="cast-heading"
            className="text-xs font-semibold tracking-[0.3em] uppercase text-center mb-3"
            style={{ color: "var(--amber)", fontFamily: "var(--font-sans)" }}
          >
            Meet the cast
          </h2>
          <p className="text-center text-sm mb-12" style={{ color: "var(--text-muted)" }}>
            The Bridgewater Inn, Millhaven, New Hampshire. One guest will not be coming down.
          </p>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            {cast.map((p) => (
              <li key={p.id} className="flex flex-col items-center text-center gap-2">
                {p.image && (
                  <div className="relative w-full max-w-[160px] rounded-lg overflow-hidden" style={{ aspectRatio: "4 / 5", border: "1px solid var(--border-mid)" }}>
                    <Photo image={p.image} sizing="fill" decorative />
                  </div>
                )}
                <span className="font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                  {p.name}
                </span>
                <span className="text-xs tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
                  {p.role}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Play modes ───────────────────────────────────────────────── */}
      <section style={{ background: "var(--bg-raised)", borderTop: "1px solid var(--border)" }}>
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
      <footer className="walnut">
        <div
          className="max-w-3xl mx-auto px-6 py-7 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
          style={{ color: "#d8c3a2", textShadow: "0 1px 1px rgba(0,0,0,0.8)" }}
        >
          <span>Radio Night · Kiroween 2026 · Resurrection</span>
          <nav className="flex gap-6" aria-label="Footer">
            {["Credits", "Privacy"].map((label) => (
              <Link
                key={label}
                href={`/${label.toLowerCase()}`}
                style={{ color: "#f6e7cc" }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </main>
  );
}
