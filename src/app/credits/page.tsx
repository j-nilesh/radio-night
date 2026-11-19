import Link from "next/link";
import type { Metadata } from "next";
import { IMAGE_ASSETS, SCENE_IMAGE, CHARACTER_IMAGE, VICTIM_IMAGE, type ImageAsset } from "../../../content/cases/radio-night-s01/v1/images";
import { SCENES } from "../../../content/cases/radio-night-s01/v1/scenes";
import { CHARACTERS } from "../../../content/cases/radio-night-s01/v1/characters";

export const metadata: Metadata = {
  title: "Credits — Radio Night",
  description: "Who and what made Radio Night.",
};

const h2 = { color: "var(--text-primary)", fontFamily: "var(--font-display)" } as const;
const body = { color: "var(--text-secondary)" } as const;

/** Pictures by name for rooms and people. Evidence is only counted, so this page cannot spoil what was found. */
function pictureCredits() {
  const byId = new Map(IMAGE_ASSETS.map((a) => [a.id, a]));
  const rows: Array<{ label: string; asset: ImageAsset }> = [];
  for (const scene of SCENES) {
    const asset = byId.get(SCENE_IMAGE[scene.id] ?? "");
    // Room 5 is where the body is found, so it is counted with the evidence rather than named.
    if (asset && scene.id !== "scene-room-5") rows.push({ label: scene.name, asset });
  }
  for (const c of CHARACTERS) {
    const asset = byId.get(CHARACTER_IMAGE[c.id] ?? "");
    if (asset) rows.push({ label: c.name, asset });
  }
  const victim = byId.get(VICTIM_IMAGE);
  if (victim) rows.push({ label: "Gerald Fenn", asset: victim });
  const named = new Set(rows.map((r) => r.asset.id));
  const others = IMAGE_ASSETS.filter((a) => !named.has(a.id));
  const placeholders = IMAGE_ASSETS.filter((a) => a.status === "placeholder").length;
  return { rows, others: others.length, total: IMAGE_ASSETS.length, placeholders };
}

function describe(asset: ImageAsset): string {
  if (asset.status === "placeholder") return "Placeholder, generated for this project. To be replaced.";
  return [asset.tool, asset.model, asset.licence].filter(Boolean).join(" · ");
}

export default function CreditsPage() {
  const pictures = pictureCredits();
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

        <section className="flex flex-col gap-2" aria-labelledby="pictures-heading">
          <h2 id="pictures-heading" className="text-xl font-semibold" style={h2}>
            Pictures
          </h2>
          <p className="leading-relaxed" style={body}>
            The final pictures are made by the project owner with Lovable, which allows the owner to use and publish
            the output. {pictures.placeholders === pictures.total
              ? `All ${pictures.total} pictures are still generated placeholders.`
              : pictures.placeholders > 0
              ? `${pictures.placeholders} of the ${pictures.total} pictures are still generated placeholders.`
              : `All ${pictures.total} pictures are final.`}
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1 leading-relaxed" style={body}>
            {pictures.rows.map(({ label, asset }) => (
              <li key={asset.id}>
                {label}: {describe(asset)}
              </li>
            ))}
            {pictures.others > 0 && (
              <li>
                {pictures.others} more pictures of objects and places in the story, listed here by number only so
                nothing is given away.
              </li>
            )}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold" style={h2}>
            Sound
          </h2>
          <p className="leading-relaxed" style={body}>
            The room sounds, door, accusation and ending stings, and the music (an opening theme, an investigation
            underscore, a tense underscore and a closing piece) were generated with ElevenLabs on a paid plan that
            licenses commercial use. The clue chime is an original sound synthesised for this project.
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
