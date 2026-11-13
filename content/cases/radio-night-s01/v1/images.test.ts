import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CHARACTER_IMAGE,
  CLUE_IMAGE,
  HERO_IMAGE,
  IMAGE_ASSETS,
  IMAGE_BASE_URL,
  SCENE_IMAGE,
  VICTIM_IMAGE,
  imageAsset,
  type ImageAsset,
} from "./images";
import { theSittingCase } from "./case";

const publicDir = (a: { file: string }) => join(process.cwd(), "public", IMAGE_BASE_URL, a.file);
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("the image manifest", () => {
  it("has unique ids and unique files", () => {
    expect(new Set(IMAGE_ASSETS.map((a) => a.id)).size).toBe(IMAGE_ASSETS.length);
    expect(new Set(IMAGE_ASSETS.map((a) => a.file)).size).toBe(IMAGE_ASSETS.length);
  });

  it("covers the whole picture set: 6 rooms, 6 people, 3 evidence, 1 hero", () => {
    const count = (k: string) => IMAGE_ASSETS.filter((a) => a.kind === k).length;
    expect([count("scene"), count("portrait"), count("evidence"), count("hero")]).toEqual([6, 6, 3, 1]);
  });

  it("gives every room in the case a room picture", () => {
    for (const scene of theSittingCase.scenes ?? []) {
      const id = SCENE_IMAGE[scene.id];
      expect(id, scene.id).toBeDefined();
      expect(imageAsset(id)?.kind, scene.id).toBe("scene");
    }
  });

  it("gives every character a portrait, and the victim a card", () => {
    for (const c of theSittingCase.characters) {
      const id = CHARACTER_IMAGE[c.id];
      expect(id, c.id).toBeDefined();
      expect(imageAsset(id)?.kind, c.id).toBe("portrait");
    }
    expect(imageAsset(VICTIM_IMAGE)?.kind).toBe("portrait");
    expect(imageAsset(HERO_IMAGE)?.kind).toBe("hero");
  });

  it("names no room, person or clue that does not exist", () => {
    const scenes = new Set((theSittingCase.scenes ?? []).map((s) => s.id));
    const people = new Set(theSittingCase.characters.map((c) => c.id));
    const clues = new Set((theSittingCase.clues ?? []).map((c) => c.id));
    for (const k of Object.keys(SCENE_IMAGE)) expect(scenes.has(k), k).toBe(true);
    for (const k of Object.keys(CHARACTER_IMAGE)) expect(people.has(k), k).toBe(true);
    for (const k of Object.keys(CLUE_IMAGE)) expect(clues.has(k), k).toBe(true);
  });

  it("gives every physical find in Room 5 an evidence picture, and only those", () => {
    const room5 = (theSittingCase.clues ?? []).filter((c) => c.kind === "physical" && c.sceneId === "scene-room-5");
    expect(room5.length).toBeGreaterThan(0);
    for (const c of room5) {
      expect(imageAsset(CLUE_IMAGE[c.id])?.kind, c.id).toBe("evidence");
    }
    expect(Object.keys(CLUE_IMAGE).sort()).toEqual(room5.map((c) => c.id).sort());
  });

  it("uses the right shape for each kind (rooms and hero 16:9, portraits 4:5, evidence square)", () => {
    const ratio = { scene: 16 / 9, hero: 16 / 9, portrait: 4 / 5, evidence: 1 } as const;
    for (const a of IMAGE_ASSETS) expect(a.width / a.height, a.id).toBeCloseTo(ratio[a.kind], 2);
  });

  it("has a real, non-empty file for every picture and every variant", () => {
    for (const a of IMAGE_ASSETS) {
      expect(existsSync(publicDir(a)), a.id).toBe(true);
      expect(statSync(publicDir(a)).size, a.id).toBeGreaterThan(200);
      for (const v of a.variants ?? []) {
        expect(existsSync(publicDir({ file: v.file })), `${a.id} ${v.file}`).toBe(true);
      }
    }
  });

  it("writes meaningful alt text and a valid focal point", () => {
    for (const a of IMAGE_ASSETS) {
      expect(a.alt.length, a.id).toBeGreaterThanOrEqual(10);
      expect(a.alt.length, a.id).toBeLessThanOrEqual(200);
      expect(a.focus, a.id).toMatch(/^\d{1,3}% \d{1,3}%$/);
    }
  });
});

describe("fair play and secrecy", () => {
  const portraits = IMAGE_ASSETS.filter((a) => a.kind === "portrait");

  it("names each person in their portrait's alt text, and never hints at guilt", () => {
    const names: Record<string, string> = {
      "char-ray-kowalski": "Ray Kowalski",
      "char-dwight-wentworth": "Dwight Wentworth",
      "char-carol-wentworth": "Carol Wentworth",
      "char-edna-marsh": "Edna Marsh",
      "char-dennis-pruett": "Dennis Pruett",
      "victim-gerald-fenn": "Gerald Fenn",
    };
    for (const a of portraits) {
      expect(a.alt, a.id).toContain(names[a.id]);
      expect(`${a.alt} ${a.prompt ?? ""}`, a.id).not.toMatch(/sinister|guilty|menacing|shifty|suspicious|evil|killer/i);
    }
  });

  it("keeps every clue out of the Room 5 picture", () => {
    const room5 = imageAsset("scene-room-5")!;
    expect(`${room5.alt} ${room5.prompt ?? ""}`).not.toMatch(/ashtray|glass|note|paper|body|blood|corpse|dead/i);
  });

  it("keeps the hall free of a hidden door, which the player finds by examining", () => {
    const hall = imageAsset("scene-upstairs-hall")!;
    expect(hall.alt).not.toMatch(/staircase|\bstairs\b|hidden|secret|narrow door/i);
  });

  it("gives evidence files opaque names that do not reveal the clue", () => {
    for (const a of IMAGE_ASSETS.filter((x) => x.kind === "evidence")) {
      expect(a.file, a.id).toMatch(/^x-\d{2}\./);
      expect(a.file, a.id).not.toMatch(/ashtray|glass|whiskey|note|paper|bed/i);
    }
  });

  it("describes each find the way its examine text does", () => {
    const clue = (id: string) => (theSittingCase.clues ?? []).find((c) => c.id === id)!;
    expect(clue("clue-whiskey-glass").examineText).toMatch(/Only the one glass/);
    expect(imageAsset("ev-whiskey-glass")!.alt).toMatch(/one empty tumbler/i);
    expect(imageAsset("ev-ashtray")!.alt).toMatch(/ring/i);
    expect(imageAsset("ev-ashtray")!.alt).toMatch(/no ash/i);
    expect(imageAsset("ev-note")!.alt).not.toMatch(/[A-Z]{4,}/); // the words are set in code, never in the picture
  });

  it("never lets browser code import the picture list", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(f) && !/\.test\./.test(f)) {
          const text = readFileSync(p, "utf8");
          const isClient = /^\s*["']use client["']/m.test(text.slice(0, 400));
          if (isClient && /(images-manifest|\/images["'])/.test(text)) offenders.push(p);
        }
      }
    };
    walk(join(process.cwd(), "src"));
    expect(offenders).toEqual([]);
  });

  it("stays free of any import from truth.ts", () => {
    const source = readFileSync(join(__dirname, "images.ts"), "utf8");
    const imports = source.split("\n").filter((l) => /^\s*import\b/.test(l));
    expect(imports.some((l) => /truth/.test(l))).toBe(false);
  });
});

describe("final art carries its provenance and respects its size budget", () => {
  const finals = IMAGE_ASSETS.filter((a) => a.status === "final");
  const budgetKb: Record<ImageAsset["kind"], number> = { scene: 300, hero: 300, portrait: 150, evidence: 100 };

  it("requires tool, model, prompt, date and licence on every final image", () => {
    for (const a of finals) {
      for (const field of ["tool", "model", "prompt", "generatedAt", "licence"] as const) {
        expect(String(a[field] ?? "").trim().length, `${a.id}.${field}`).toBeGreaterThan(0);
      }
      expect(Array.isArray(a.references), `${a.id}.references`).toBe(true);
    }
  });

  it("keeps each optimised file within its budget", () => {
    for (const a of finals) {
      for (const f of [a.file, ...(a.variants ?? []).map((v) => v.file)]) {
        const kb = statSync(publicDir({ file: f })).size / 1024;
        expect(kb, `${a.id} ${f}`).toBeLessThanOrEqual(budgetKb[a.kind]);
      }
    }
  });

  it("ships no placeholder as final, and no final as a placeholder drawing", () => {
    for (const a of IMAGE_ASSETS) {
      if (a.status === "final") expect(a.file, a.id).not.toMatch(/\.svg$/);
    }
  });
});

describe("the art documents", () => {
  const section = (doc: string, id: string): string => {
    const start = doc.indexOf(`### ${id}`);
    expect(start, id).toBeGreaterThan(-1);
    const rest = doc.slice(start + id.length + 4);
    const end = rest.search(/\n##/);
    return (end === -1 ? rest : rest.slice(0, end)).trim();
  };
  const firstParagraphAfterHeading = (text: string) => text.split("\n").find((l) => l.startsWith("Photograph, 1981"))!;

  it("sends Lovable exactly the pilot prompts that are in the prompt pack", () => {
    const prompts = read("docs/art/prompts.md");
    const brief = read("docs/art/lovable-brief.md").replace(/^> /gm, "");
    for (const id of ["scene-tap-room", "char-ray-kowalski"]) {
      const p = firstParagraphAfterHeading(section(prompts, id));
      expect(p.length, id).toBeGreaterThan(100);
      expect(brief, id).toContain(p);
    }
  });

  it("has a prompt for every one of the 16 images", () => {
    const prompts = read("docs/art/prompts.md");
    for (const a of IMAGE_ASSETS) expect(prompts, a.id).toContain(`### ${a.id}`);
  });

  it("gives Lovable the specs, the style lock and the pilot, and no spoilers", () => {
    const brief = read("docs/art/lovable-brief.md");
    for (const must of ["1920 x 1080", "1536 x 1920", "PNG", "sRGB", "scene-tap-room.png", "char-ray-kowalski.png", "Style lock", "4 variations", "#0f0d0b", "No text, no logos, no watermark, nothing modern."]) {
      expect(brief, must).toContain(must);
    }
    expect(brief).not.toMatch(/killer|guilty|culprit|murderer|ashtray|whiskey|threatening|confess|the solution/i);
  });

  it("sets every prompt's negative rules so no text or modern object appears", () => {
    const prompts = read("docs/art/prompts.md");
    const photoLines = prompts.split("\n").filter((l) => l.startsWith("Photograph, 1981"));
    expect(photoLines.length).toBe(16);
    for (const l of photoLines) expect(l).toMatch(/No text, no logos/);
  });
});
