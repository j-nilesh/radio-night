import Link from "next/link";
import type { Metadata } from "next";
import { Photo } from "../components/Photo";
import { HeroContinue } from "../components/HeroContinue";
import { HERO_IMAGE, SCENE_IMAGE, imageAsset, toImageRef } from "../../content/cases/radio-night-s01/v1/images";

/**
 * The front page: what Radio Night is, before anyone plays. It explains the format,
 * the setting, what the AI does and does not do, and how it is built, and every
 * "Play now" leads to /start (the game's own front door).
 *
 * It uses only what the opening already tells a player (the town, the date, the inn,
 * the victim) and the first room's picture, so it spoils nothing.
 */

export const metadata: Metadata = {
  title: "Radio Night — A radio mystery you can talk to",
  description:
    "An authored murder mystery told as a golden-age radio drama, set in a small New Hampshire inn in 1981. Question the suspects in your own voice, and they answer.",
};

const ref = (id: string) => {
  const a = imageAsset(id);
  return a ? toImageRef(a) : null;
};

const eyebrow = "text-xs font-semibold tracking-[0.35em] uppercase";
const display = { color: "var(--text-primary)", fontFamily: "var(--font-display)" } as const;
const body = { color: "var(--text-secondary)" } as const;

function PlayNow({ big = false }: { big?: boolean }) {
  return (
    <Link href="/start" className={`btn btn-primary ${big ? "text-lg px-12 py-5" : "text-base px-10 py-4"} tracking-wide`}>
      Play now
    </Link>
  );
}

/** A thin tuning-dial rule between sections: a period touch, purely decorative. */
function Dial({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 w-full max-w-3xl mx-auto px-6" aria-hidden="true">
      <div className="dial flex-1" />
      <span className="text-[10px] tracking-[0.4em] uppercase" style={{ color: "var(--amber-dim)" }}>
        {label}
      </span>
      <div className="dial flex-1" />
    </div>
  );
}

function Section({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="w-full max-w-3xl mx-auto px-6 py-16 sm:py-20 flex flex-col gap-6">
      <p className={eyebrow} style={{ color: "var(--amber)" }}>
        {kicker}
      </p>
      <h2 id={id} className="text-3xl sm:text-4xl font-bold leading-tight" style={display}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function FrontPage() {
  const hero = ref(HERO_IMAGE);
  const tapRoom = ref(SCENE_IMAGE["scene-tap-room"]);

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {hero && (
          <div className="absolute inset-0" aria-hidden="true">
            <Photo image={hero} sizing="fill" priority decorative />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(12,10,9,0.55), rgba(12,10,9,0.92) 75%, var(--bg))" }} />
          </div>
        )}
        <div className="relative z-10 max-w-3xl mx-auto px-6 pt-28 pb-24 sm:pt-36 sm:pb-32 flex flex-col items-center text-center gap-7">
          <span className="on-air" aria-label="On air">
            On air
          </span>
          <h1 className="text-6xl sm:text-8xl font-bold leading-none" style={display}>
            Radio Night
          </h1>
          <p className="text-xl sm:text-2xl italic" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-display)" }}>
            A radio mystery you can talk to.
          </p>
          <p className="text-base sm:text-lg leading-relaxed max-w-xl" style={body}>
            A murder in a small New Hampshire inn, told the way mysteries were told for half a century: out loud, in
            the dark, to people listening together. The difference is that this time, the people in the story can
            hear you.
          </p>
          <PlayNow big />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Free in your browser · no account · about 30 to 45 minutes · solo or with a room full of detectives
          </p>
          <HeroContinue />
        </div>
      </section>

      {/* ── The format ────────────────────────────────────────────────── */}
      <Dial label="The broadcast" />
      <Section id="format" kicker="A resurrection" title="The golden age of radio drama, with one new trick">
        <p className="text-lg leading-relaxed" style={body}>
          From the 1930s into the 1950s, families pulled their chairs round the set to hear a detective work a case.
          Nobody watched anything. The story lived in voices, footsteps, a door, the rain, and in the arguments in
          the room about who did it. Television ended that, and with it a whole way of spending an evening together.
        </p>
        <p className="text-lg leading-relaxed" style={body}>
          Radio Night brings it back with the one thing radio never had. You are the detective, and when you ask a
          question, out loud or by typing, the person you asked answers in their own voice. They tell you what they
          saw, dodge what they would rather not say, and remember what you asked before.
        </p>
      </Section>

      {/* ── The setting ───────────────────────────────────────────────── */}
      <Dial label="The setting" />
      <section aria-labelledby="setting" className="w-full max-w-5xl mx-auto px-6 py-16 sm:py-20 grid gap-10 lg:grid-cols-2 lg:items-center">
        {tapRoom && (
          <figure className="flex flex-col gap-2">
            <div className="relative w-full rounded-lg overflow-hidden" style={{ aspectRatio: "16 / 10", border: "1px solid var(--border-mid)" }}>
              <Photo image={tapRoom} sizing="fill" />
            </div>
            <figcaption className="text-xs" style={{ color: "var(--text-muted)" }}>
              The Tap Room of the Bridgewater Inn, just past eleven.
            </figcaption>
          </figure>
        )}
        <div className="flex flex-col gap-6">
          <p className={eyebrow} style={{ color: "var(--amber)" }}>
            Millhaven, New Hampshire · October 1981
          </p>
          <h2 id="setting" className="text-3xl sm:text-4xl font-bold leading-tight" style={display}>
            A rainy Saturday night, and the bar is still open
          </h2>
          <p className="text-lg leading-relaxed" style={body}>
            Someone calls the station from a payphone on Main Street. Gerald Fenn, a portrait painter, has been found
            dead in Room 5 of the Bridgewater Inn, while the regulars were still downstairs. That means someone in
            the building knows something.
          </p>
          <p className="text-lg leading-relaxed" style={body}>
            1981 is a world without mobile phones or doorbell cameras. What happened is held in people&rsquo;s
            memories, and in what they are willing to tell you: the bartender, the innkeeper, the man on the third
            stool from the left. Every picture is a warm, grainy colour photograph in the style of the time, and every
            room has its own sound: rain on the windows, a television over the bar, an old house settling.
          </p>
        </div>
      </section>

      {/* ── How it plays ──────────────────────────────────────────────── */}
      <Dial label="How it plays" />
      <Section id="plays" kicker="Your part" title="Listen, ask, look, decide">
        <ol className="grid sm:grid-cols-2 gap-5">
          {[
            ["Listen", "A narrator sets each scene. Turn the sound up, or connect a speaker for the room."],
            ["Ask", "Choose who to question and ask anything, in your own words. Tap the microphone, or type."],
            ["Look", "Walk the inn room by room. Examine what is there. Your casebook keeps what you found apart from what you were told."],
            ["Decide", "When you are sure, name the person and put forward the evidence that proves it. There are four endings."],
          ].map(([title, text], i) => (
            <li key={title} className="card flex flex-col gap-2">
              <span className="text-xs tracking-[0.3em]" style={{ color: "var(--amber)" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-lg font-semibold" style={display}>
                {title}
              </h3>
              <p className="text-sm leading-relaxed" style={body}>
                {text}
              </p>
            </li>
          ))}
        </ol>
        <p className="text-lg leading-relaxed" style={body}>
          <strong style={{ color: "var(--text-primary)" }}>Best with company.</strong> Put the sound through a speaker,
          pass the phone round, and take turns asking. The game waits while you argue. It is a fair mystery: everything
          you need to name the killer can be found, heard or worked out. And your case is saved, so you can stop and
          come back to it.
        </p>
      </Section>

      {/* ── The AI ────────────────────────────────────────────────────── */}
      <Dial label="Behind the voices" />
      <Section id="ai" kicker="Where the AI comes in" title="The story is written. The conversation is not.">
        <p className="text-lg leading-relaxed" style={body}>
          The mystery is authored by a person: one victim, one killer, one timeline, fixed before you arrive and
          impossible to change. What a language model adds is the performance. Each character is played by an AI that
          knows only what that person would know, speaks the way they speak, keeps their secrets, and can answer
          questions nobody scripted.
        </p>
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="card flex flex-col gap-2">
            <h3 className="text-base font-semibold" style={display}>
              What the AI does
            </h3>
            <ul className="list-disc pl-5 text-sm leading-relaxed flex flex-col gap-1" style={body}>
              <li>Plays each character in conversation, in period and in character</li>
              <li>Remembers what you asked them a moment ago</li>
              <li>Turns your spoken question into text, and their answers into speech</li>
            </ul>
          </div>
          <div className="card flex flex-col gap-2">
            <h3 className="text-base font-semibold" style={display}>
              What it never does
            </h3>
            <ul className="list-disc pl-5 text-sm leading-relaxed flex flex-col gap-1" style={body}>
              <li>Decide what happened, or who did it</li>
              <li>Hand you a clue you have not earned: those answers are written lines</li>
              <li>Confess, break character, or talk about being an AI, however you ask</li>
            </ul>
          </div>
        </div>
        <p className="text-base leading-relaxed" style={body}>
          Every reply is checked before it is spoken. If a character would say something they should not, the game
          uses the line the writer gave them instead. Ask them to ignore their instructions and they will look at you
          as a 1981 innkeeper would.
        </p>
      </Section>

      {/* ── Under the hood ────────────────────────────────────────────── */}
      <Dial label="Under the hood" />
      <Section id="tech" kicker="How it is made" title="An old format, built in a new way">
        <ul className="grid sm:grid-cols-2 gap-5">
          {[
            ["Six voices, cast blind", "Every character and the narrator has one voice for good, chosen in a blind listening test across three voice providers. Nobody knew which company made which voice."],
            ["Speech that streams", "A reply is spoken as it is made, so a character starts talking before their whole line is ready. Your question is checked for a muted microphone before it is sent."],
            ["Rules the AI cannot bend", "The game keeps its own record of what you have found and earned. Only that record decides what you can see, and the solution never reaches your browser."],
            ["Tested by trying to break it", "Thousands of generated playthroughs check that no order of play strands a clue, and attack suites try to talk every character into confessing. Both found real problems, which are fixed."],
            ["Built with Kiro", "Specs, steering rules, hooks and property-based tests, with every major decision written down. The whole build is in the repository."],
            ["Made to be shared", "It runs in any modern browser, on a laptop or a phone, with no account. Sound, pictures and music were made for this game, with their sources recorded."],
          ].map(([title, text]) => (
            <li key={title} className="flex flex-col gap-1">
              <h3 className="text-base font-semibold" style={{ color: "var(--amber-text)" }}>
                {title}
              </h3>
              <p className="text-sm leading-relaxed" style={body}>
                {text}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── Last call ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ borderTop: "1px solid var(--border)" }}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 60% 70% at 50% 100%, rgba(180,83,9,0.22) 0%, transparent 75%)" }}
        />
        <div className="relative max-w-3xl mx-auto px-6 py-20 sm:py-24 flex flex-col items-center text-center gap-6">
          <p className="text-2xl sm:text-3xl italic leading-snug" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
            &ldquo;The bar was still open when it happened. That means someone knows something.&rdquo;
          </p>
          <PlayNow big />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Best heard with the lights down.
          </p>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid var(--border)" }}>
        <div className="max-w-3xl mx-auto px-6 py-7 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ color: "var(--text-faint)" }}>
          <span>Radio Night · Made by Nilesh Jahagirdar for Kiroween 2026 · Resurrection</span>
          <nav className="flex gap-6" aria-label="Footer">
            <Link href="/start" style={{ color: "var(--text-muted)" }}>
              Play
            </Link>
            <Link href="/credits" style={{ color: "var(--text-muted)" }}>
              Credits
            </Link>
            <Link href="/privacy" style={{ color: "var(--text-muted)" }}>
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
