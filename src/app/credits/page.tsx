import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Credits — Radio Night",
  description: "Who and what made Radio Night.",
};

const h2 = { color: "var(--text-primary)", fontFamily: "var(--font-display)" } as const;
const body = { color: "var(--text-secondary)" } as const;

export default function CreditsPage() {
  return (
    <main className="min-h-screen px-6 py-16" style={{ background: "var(--bg)" }}>
      <article className="max-w-2xl mx-auto flex flex-col gap-8">
        <Link href="/" className="text-xs self-start" style={{ color: "var(--text-muted)" }}>
          ← Radio Night
        </Link>

        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold" style={h2}>
            Credits
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Made for Kiroween 2026, Resurrection category.
          </p>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold" style={h2}>
            The game
          </h2>
          <p className="leading-relaxed" style={body}>
            Radio Night revives the radio drama and the habit of listening together. &ldquo;The Sitting&rdquo; is an
            original mystery set in Millhaven, New Hampshire, in October 1981. Built with Kiro. The source code is
            MIT licensed.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold" style={h2}>
            Voices and words
          </h2>
          <ul className="list-disc pl-5 flex flex-col gap-1 leading-relaxed" style={body}>
            <li>Character and narrator voices: Deepgram Aura-2 text-to-speech.</li>
            <li>Speech recognition: Deepgram Nova-3.</li>
            <li>Characters&apos; improvised replies: Anthropic Claude, within limits set by the game.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold" style={h2}>
            Sound
          </h2>
          <p className="leading-relaxed" style={body}>
            The room sounds and stings are original placeholders generated for this project. Final sound credits
            will be listed here, with the licence for every file.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold" style={h2}>
            Typefaces
          </h2>
          <p className="leading-relaxed" style={body}>
            Playfair Display and Inter, loaded through Next.js from Google Fonts under the SIL Open Font License.
          </p>
        </section>
      </article>
    </main>
  );
}
