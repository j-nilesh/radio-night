import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — Radio Night",
  description: "What Radio Night collects, where it goes, and how long it is kept.",
};

const h2 = { color: "var(--text-primary)", fontFamily: "var(--font-display)" } as const;
const body = { color: "var(--text-secondary)" } as const;

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-6 py-16" style={{ background: "var(--bg)" }}>
      <article className="max-w-2xl mx-auto flex flex-col gap-8">
        <Link href="/" className="text-xs self-start" style={{ color: "var(--text-muted)" }}>
          ← Radio Night
        </Link>

        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold" style={h2}>
            Privacy
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            This page describes what the game does today. It is a game, not a service, and it asks for nothing
            about you.
          </p>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold" style={h2}>
            No account, no personal details
          </h2>
          <p className="leading-relaxed" style={body}>
            You do not sign up, and the game does not ask for a name, an email address or a device identifier. When
            you begin an investigation it stores one random code in a cookie on your device so it can find your
            case again. The cookie is not readable by scripts on the page and expires after 30 days.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold" style={h2}>
            What is saved
          </h2>
          <p className="leading-relaxed" style={body}>
            Your progress: where you are, the clues you have found, who you have questioned, and your ending. For
            each character, the last six things you asked and how they answered are kept so they stay consistent.
            Each is limited to 1,000 characters. All of it is deleted with the investigation. Your volume settings
            stay on your device only.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold" style={h2}>
            When you speak
          </h2>
          <p className="leading-relaxed" style={body}>
            Your recording is sent to our server, which passes it to Deepgram to turn into text. The game does not
            keep the audio. Deepgram handles it under its own terms. The game checks your microphone level in your
            browser before sending, and does not send a recording that is silent.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold" style={h2}>
            Where your questions go
          </h2>
          <p className="leading-relaxed" style={body}>
            What you ask, typed or spoken, and the recent exchanges with that character, are sent to Anthropic so a
            language model can write the character&apos;s reply. The characters&apos; replies are sent to Deepgram
            to be turned into voices. Please do not type anything you would not want a service provider to process.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold" style={h2}>
            What the game does not do
          </h2>
          <ul className="list-disc pl-5 flex flex-col gap-1 leading-relaxed" style={body}>
            <li>It does not listen unless you tap the microphone.</li>
            <li>It does not show advertising or sell or share your data for marketing.</li>
            <li>It does not use analytics or tracking scripts.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold" style={h2}>
            Questions
          </h2>
          <p className="leading-relaxed" style={body}>
            The source code is public. You can read exactly what is sent and stored at{" "}
            <a href="https://github.com/j-nilesh/radio-night" style={{ color: "var(--amber)" }}>
              github.com/j-nilesh/radio-night
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
