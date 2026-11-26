/**
 * scripts/optimise-images.ts
 * Turns the chosen full-size Lovable originals (art/source/, gitignored) into the
 * small files that ship in public/images/, and marks each one "final" in the
 * images manifest with its provenance, read from the batch notes Lovable gave us.
 *
 *   npx tsx scripts/optimise-images.ts            (all picks below)
 *   npx tsx scripts/optimise-images.ts scene-kitchen char-edna-marsh
 *
 * Output per picture: <id>.avif and <id>.webp (variants, best first) and <id>.jpg
 * (the fallback and default file). Each is re-encoded at falling quality until it
 * fits the size budget the tests enforce. Rooms and the hero are 1600x900, portraits 1024x1280, evidence 1024x1024.
 *
 * To make a new pick: change its entry in PICKS, run this, run the tests.
 */
import { readFileSync, writeFileSync, existsSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

type Kind = "scene" | "portrait" | "hero" | "evidence";
/** `out` is the shipped file name when it differs from the id (evidence uses opaque names such as x-01). */
type Pick = { id: string; out?: string; pilotVariation?: string; source: string; notes: string; kind: Kind; focus?: string; alt?: string };

const SRC = join(process.cwd(), "art", "source", "pilot");
const B1 = "Lovable-batch-1";
const B2 = "Lovable-batch-2";
const B3 = "Lovable-batch-3";
const B4 = "Lovable-batch-4";

/** The chosen winners. `source` is relative to art/source/pilot/. */
export const PICKS: Pick[] = [
  { id: "scene-tap-room", source: "scene-tap-room-final.png", notes: "notes.txt", kind: "scene", pilotVariation: "tap-room-variation-a" },
  { id: "char-ray-kowalski", source: "char-ray-kowalski-final.png", notes: "notes.txt", kind: "portrait", focus: "58% 30%", pilotVariation: "ray-kowalski-variation-a" },
  { id: "scene-back-room", source: `${B3}/scene-back-room-v2-B.png`, notes: `${B3}/provenance-notes.txt`, kind: "scene" },
  {
    // The id stays "hero-radio" so nothing that refers to it changes; the picture is the early-80s receiver (ADR 0016)
    id: "hero-radio",
    source: `${B4}/hero-receiver-A.png`,
    notes: `${B4}/provenance-notes.txt`,
    kind: "hero",
    focus: "24% 50%",
    alt: "An early-1980s stereo receiver with a walnut case, a brushed-aluminium face and glowing amber VU meters, on the back shelf of an inn bar at night, with rain on the window beyond.",
  },
  { id: "ev-ashtray", out: "x-01", source: `${B3}/x-01-A.png`, notes: `${B3}/provenance-notes.txt`, kind: "evidence" },
  { id: "ev-whiskey-glass", out: "x-02", source: `${B3}/x-02-A.png`, notes: `${B3}/provenance-notes.txt`, kind: "evidence" },
  { id: "ev-note", out: "x-03", source: `${B3}/x-03-A.png`, notes: `${B3}/provenance-notes.txt`, kind: "evidence" },
  { id: "scene-kitchen", source: `${B1}/scene-kitchen-B.png`, notes: `${B2}/provenance-notes.txt`, kind: "scene" },
  {
    id: "scene-back-stairs",
    source: `${B1}/scene-back-stairs-B.png`,
    notes: `${B2}/provenance-notes.txt`,
    kind: "scene",
    alt: "The Back Stairs: a plain wooden staircase up the outside of the inn, lit by one bare bulb at the top, with the village beyond at dusk.",
  },
  { id: "scene-upstairs-hall", source: `${B1}/scene-upstairs-hall-A.png`, notes: `${B2}/provenance-notes.txt`, kind: "scene" },
  { id: "scene-room-5", source: `${B1}/scene-room-5-B.png`, notes: `${B2}/provenance-notes.txt`, kind: "scene" },
  { id: "char-carol-wentworth", source: `${B2}/char-carol-wentworth-B.png`, notes: `${B2}/provenance-notes.txt`, kind: "portrait", focus: "49% 33%" },
  { id: "char-dwight-wentworth", source: `${B2}/char-dwight-wentworth-B.png`, notes: `${B2}/provenance-notes.txt`, kind: "portrait", focus: "49% 28%" },
  { id: "char-dennis-pruett", source: `${B2}/char-dennis-pruett-D.png`, notes: `${B2}/provenance-notes.txt`, kind: "portrait", focus: "45% 30%" },
  { id: "char-edna-marsh", source: `${B2}/char-edna-marsh-D.png`, notes: `${B2}/provenance-notes.txt`, kind: "portrait", focus: "45% 27%" },
  { id: "victim-gerald-fenn", source: `${B2}/victim-gerald-fenn-D.png`, notes: `${B2}/provenance-notes.txt`, kind: "portrait", focus: "42% 30%" },
];

/**
 * The two pilot finals are premium "reference edits" of variation A. The pilot notes file
 * (a different format) records only the variation prompts, so provenance is built from
 * variation A's prompt and says so. The edit instruction itself was not recorded.
 */
function pilotProvenance(variation: string): Provenance {
  const line = readFileSync(join(SRC, "notes.txt"), "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${variation}.png |`));
  const prompt = line && /Prompt: (.+)$/.exec(line)?.[1]?.trim();
  if (!prompt) throw new Error(`No pilot prompt for ${variation}`);
  return {
    model: "FLUX, premium reference edit of fast-tier variation A (edit instruction not recorded)",
    references: [`${variation}.png`],
    prompt,
  };
}

const SIZE: Record<Kind, { width: number; height: number; budgetKb: number }> = {
  scene: { width: 1600, height: 900, budgetKb: 300 },
  hero: { width: 1600, height: 900, budgetKb: 300 },
  evidence: { width: 1024, height: 1024, budgetKb: 100 },
  portrait: { width: 1024, height: 1280, budgetKb: 150 },
};

const LICENCE =
  "Output owned by the project owner under Lovable's Terms of Service (see docs/art/provenance/lovable-terms.md). Included only so the game runs.";

type Provenance = { model: string; references: string[]; prompt: string };

/** Reads one "File:" block from Lovable's notes. The last block for a file wins. */
function provenanceFor(notesPath: string, fileName: string): Provenance {
  const text = readFileSync(notesPath, "utf8");
  const blocks = text.split(/^File: /m).slice(1).filter((b) => b.startsWith(fileName));
  const block = blocks[blocks.length - 1];
  if (!block) throw new Error(`No provenance block for ${fileName} in ${notesPath}`);
  const model = /Model and tier: (.+)/.exec(block)?.[1]?.trim() ?? "";
  const refsLine = /Reference images used: (.+)/.exec(block)?.[1]?.trim() ?? "none";
  const prompt = /Prompt \(exact[^\n]*\n([\s\S]*?)\nChanges from my prompt:/.exec(block)?.[1]?.trim() ?? "";
  if (!model || !prompt) throw new Error(`Incomplete provenance for ${fileName}`);
  return { model, references: /^none$/i.test(refsLine) ? [] : refsLine.split(/,\s*/), prompt };
}

async function encode(
  buf: Buffer,
  format: "avif" | "webp" | "jpeg",
  budgetKb: number,
): Promise<{ data: Buffer; quality: number }> {
  let quality = format === "avif" ? 60 : 82;
  for (;;) {
    const img = sharp(buf);
    const data =
      format === "avif"
        ? await img.avif({ quality, effort: 4 }).toBuffer()
        : format === "webp"
          ? await img.webp({ quality }).toBuffer()
          : await img.jpeg({ quality, mozjpeg: true }).toBuffer();
    if (data.length / 1024 <= budgetKb * 0.95 || quality <= 30) return { data, quality };
    quality -= 4;
  }
}

async function main() {
  const manifestPath = join(process.cwd(), "content", "cases", "radio-night-s01", "v1", "images-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { baseUrl: string; assets: Array<Record<string, unknown>> };
  const outDir = join(process.cwd(), "public", manifest.baseUrl);
  const only = process.argv.slice(2);

  for (const pick of PICKS) {
    if (only.length && !only.includes(pick.id)) continue;
    const sourcePath = join(SRC, pick.source);
    if (!existsSync(sourcePath)) throw new Error(`Missing original: ${sourcePath}`);
    const entry = manifest.assets.find((a) => a.id === pick.id);
    if (!entry) throw new Error(`Not in the manifest: ${pick.id}`);

    const { width, height, budgetKb } = SIZE[pick.kind];
    const resized = await sharp(sourcePath, { failOn: "error" }).resize(width, height, { fit: "cover", position: "centre" }).toBuffer();
    const prov = pick.pilotVariation ? pilotProvenance(pick.pilotVariation) : provenanceFor(join(SRC, pick.notes), pick.source.split("/").pop()!);

    const name = pick.out ?? pick.id;
    const files: Array<{ ext: string; type: string; data: Buffer }> = [];
    for (const [format, ext, type] of [
      ["avif", "avif", "image/avif"],
      ["webp", "webp", "image/webp"],
      ["jpeg", "jpg", "image/jpeg"],
    ] as const) {
      const { data } = await encode(resized, format, budgetKb);
      files.push({ ext, type, data });
      writeFileSync(join(outDir, `${name}.${ext}`), data);
    }

    const oldFile = String(entry.file);
    if (oldFile.endsWith(".svg") && existsSync(join(outDir, oldFile))) unlinkSync(join(outDir, oldFile));

    Object.assign(entry, {
      file: `${name}.jpg`,
      width,
      height,
      status: "final",
      variants: files.filter((f) => f.ext !== "jpg").map((f) => ({ file: `${name}.${f.ext}`, type: f.type })),
      tool: "Lovable",
      model: prov.model,
      prompt: prov.prompt,
      references: prov.references,
      generatedAt: statSync(sourcePath).mtime.toISOString().slice(0, 10),
      licence: LICENCE,
      ...(pick.focus ? { focus: pick.focus } : {}),
      ...(pick.alt ? { alt: pick.alt } : {}),
    });
    console.log(pick.id, files.map((f) => `${f.ext} ${(f.data.length / 1024).toFixed(0)}KB`).join("  "));
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
