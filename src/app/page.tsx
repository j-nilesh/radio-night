/**
 * Landing page — Radio Night
 * Atmospheric noir-inspired introduction with Begin Investigation CTA.
 */

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Radio Night — An Interactive Radio Mystery",
  description:
    "A voice-first interactive detective game. Listen, question the suspects, follow the evidence, solve the case. Play solo or gather the whole room.",
  openGraph: {
    title: "Radio Night",
    description: "An atmospheric radio detective mystery. The story is listening.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center relative overflow-hidden">
        {/* Atmospheric gradient */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background:
              "radial-gradient(ellipse at 50% 60%, #7c3014 0%, #1a0a02 60%, transparent 100%)",
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-2xl mx-auto space-y-8">
          {/* Logotype */}
          <div className="space-y-2">
            <p className="text-xs tracking-[0.4em] uppercase text-amber-600 font-medium">
              A Radio Mystery
            </p>
            <h1 className="text-6xl sm:text-7xl font-bold tracking-tight text-amber-100">
              Radio Night
            </h1>
            <p className="text-lg text-neutral-400 italic">
              The story is listening.
            </p>
          </div>

          {/* Hook */}
          <p className="text-xl text-neutral-300 leading-relaxed max-w-xl mx-auto">
            An atmospheric detective mystery for one detective — or a room full of them.
            Listen to the drama. Question the suspects. Follow the evidence. Solve the case.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/play"
              className="inline-flex items-center justify-center px-8 py-4 rounded-sm bg-amber-700 hover:bg-amber-600 text-white font-semibold text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-neutral-950"
            >
              Begin Investigation
            </Link>
          </div>

          {/* Mode explanation */}
          <p className="text-sm text-neutral-500">
            Play solo at your device, or route audio to a shared speaker and investigate together.
            No account required.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-neutral-900 px-6 py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-sm tracking-[0.3em] uppercase text-amber-600 mb-10 text-center">
            How it works
          </h2>
          <div className="grid sm:grid-cols-3 gap-10">
            <div className="space-y-3 text-center">
              <div className="text-4xl" aria-hidden="true">🎙️</div>
              <h3 className="font-semibold text-neutral-100">You question the suspects</h3>
              <p className="text-sm text-neutral-400">
                Speak your questions aloud or type them. The characters hear you and respond in kind.
              </p>
            </div>
            <div className="space-y-3 text-center">
              <div className="text-4xl" aria-hidden="true">🗂️</div>
              <h3 className="font-semibold text-neutral-100">You follow the evidence</h3>
              <p className="text-sm text-neutral-400">
                A visual casebook tracks your notes, suspects, discoveries, and the unfolding timeline.
              </p>
            </div>
            <div className="space-y-3 text-center">
              <div className="text-4xl" aria-hidden="true">🔍</div>
              <h3 className="font-semibold text-neutral-100">You name the killer</h3>
              <p className="text-sm text-neutral-400">
                One culprit. One fixed truth. The mystery is fair — you can solve it by reasoning, not luck.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solo / Together */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-sm tracking-[0.3em] uppercase text-amber-600 mb-10 text-center">
            Play solo or together
          </h2>
          <div className="grid sm:grid-cols-2 gap-8">
            <div className="border border-neutral-800 rounded-sm p-6 space-y-3">
              <h3 className="font-semibold text-neutral-100">Solo Investigation</h3>
              <p className="text-sm text-neutral-400">
                Browser on your phone, tablet, or computer. Speak or type. Inspect the casebook
                at your own pace.
              </p>
            </div>
            <div className="border border-amber-800/40 rounded-sm p-6 space-y-3 bg-amber-950/20">
              <h3 className="font-semibold text-amber-100">Radio Night with Friends</h3>
              <p className="text-sm text-neutral-400">
                Route audio to a Bluetooth or wired speaker. Everyone hears the drama. Take turns
                asking questions. Discuss between turns.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-800 px-6 py-8">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-neutral-600">
          <p>Radio Night · Kiroween 2026 · Resurrection</p>
          <nav className="flex gap-6" aria-label="Footer links">
            <a href="/about" className="hover:text-neutral-400 transition-colors">
              About
            </a>
            <a href="/credits" className="hover:text-neutral-400 transition-colors">
              Credits
            </a>
            <a href="/privacy" className="hover:text-neutral-400 transition-colors">
              Privacy
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
