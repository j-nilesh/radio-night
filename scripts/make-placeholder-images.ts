/**
 * scripts/make-placeholder-images.ts
 * Writes simple generated stand-ins for every picture in the images manifest to
 * public/images/radio-night-s01/. They share the final ids and aspect ratios, so
 * layout, tests and the secrecy rules work today and the real photographs drop
 * in later with no code change. They are original (drawn here) and are marked
 * "placeholder" so nobody mistakes them for the final art.
 *
 *   npm run art:placeholders
 *
 * To replace one with a real image, put the optimised files in the same folder,
 * and change the manifest entry's status to "final" with its provenance.
 * Only entries whose status is "placeholder" are (re)written here.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Asset = { id: string; file: string; kind: "scene" | "portrait" | "evidence" | "hero"; width: number; height: number; status: string };
const manifestPath = join(process.cwd(), "content", "cases", "radio-night-s01", "v1", "images-manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { baseUrl: string; assets: Asset[] };

const OUT = join(process.cwd(), "public", manifest.baseUrl);

// Warm-noir palette (same as the site tokens)
const C = { bg: "#0f0d0b", raised: "#1a1714", card: "#221f1b", mid: "#3d3830", amber: "#d97706", amberText: "#fcd34d", cream: "#f5f0e8", blue: "#2a3a4a" };

/** A small deterministic hash so each id gets its own tint without randomness. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}
const tint = (id: string, base: number) => {
  const h = hash(id);
  const r = base + (h % 14);
  const g = Math.round(base * 0.82) + ((h >> 4) % 10);
  const b = Math.round(base * 0.62) + ((h >> 8) % 8);
  return `rgb(${r},${g},${b})`;
};

const defs = (a: Asset) => `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${tint(a.id, 38)}"/>
      <stop offset="1" stop-color="${C.bg}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${C.amber}" stop-opacity="0.75"/>
      <stop offset="1" stop-color="${C.amber}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="tv" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#5b86b0" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#5b86b0" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.bg}" stop-opacity="0"/>
      <stop offset="1" stop-color="${C.bg}" stop-opacity="0.85"/>
    </linearGradient>
  </defs>`;

const mark = (a: Asset) =>
  `<text x="${a.width - 24}" y="${a.height - 22}" text-anchor="end" font-family="system-ui,sans-serif" font-size="${Math.round(a.width / 60)}" fill="${C.cream}" fill-opacity="0.35" letter-spacing="3">PLACEHOLDER</text>`;

function rain(a: Asset, x: number, y: number, w: number, h: number): string {
  let lines = "";
  const n = Math.round(w / 26);
  for (let i = 0; i < n; i++) {
    const lx = x + ((hash(a.id + i) % 1000) / 1000) * w;
    const ly = y + ((hash(a.id + "y" + i) % 600) / 1000) * h;
    lines += `<line x1="${lx.toFixed(0)}" y1="${ly.toFixed(0)}" x2="${(lx - 6).toFixed(0)}" y2="${(ly + h * 0.35).toFixed(0)}"/>`;
  }
  return `<g stroke="${C.cream}" stroke-opacity="0.14" stroke-width="2">${lines}</g>`;
}

const windowBox = (a: Asset, x: number, y: number, w: number, h: number) => `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.blue}" fill-opacity="0.55" stroke="${C.mid}" stroke-width="6"/>
  <line x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y + h}" stroke="${C.mid}" stroke-width="5"/>
  ${rain(a, x, y, w, h)}`;

const lamp = (cx: number, cy: number, r: number) => `
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#glow)"/>
  <rect x="${cx - r * 0.12}" y="${cy}" width="${r * 0.24}" height="${r * 0.7}" fill="${C.mid}"/>
  <path d="M ${cx - r * 0.3} ${cy} L ${cx + r * 0.3} ${cy} L ${cx + r * 0.18} ${cy - r * 0.32} L ${cx - r * 0.18} ${cy - r * 0.32} Z" fill="${C.amberText}" fill-opacity="0.8"/>`;

function room(a: Asset): string {
  const W = a.width;
  const H = a.height;
  const floor = `<rect x="0" y="${H * 0.72}" width="${W}" height="${H * 0.28}" fill="${C.bg}" fill-opacity="0.7"/>`;
  let body = "";
  switch (a.id) {
    case "scene-tap-room":
      body =
        windowBox(a, W * 0.06, H * 0.14, W * 0.26, H * 0.4) +
        `<circle cx="${W * 0.62}" cy="${H * 0.26}" r="${H * 0.22}" fill="url(#tv)"/>
         <rect x="${W * 0.57}" y="${H * 0.2}" width="${W * 0.1}" height="${H * 0.12}" rx="6" fill="${C.raised}" stroke="${C.mid}" stroke-width="4"/>
         <rect x="${W * 0.42}" y="${H * 0.36}" width="${W * 0.5}" height="${H * 0.05}" fill="${C.mid}" fill-opacity="0.7"/>
         <rect x="${W * 0.35}" y="${H * 0.55}" width="${W * 0.65}" height="${H * 0.14}" fill="${C.card}" stroke="${C.mid}" stroke-width="4"/>` +
        [0.42, 0.55, 0.68, 0.81].map((x) => `<circle cx="${W * x}" cy="${H * 0.77}" r="${H * 0.035}" fill="${C.mid}"/><rect x="${W * x - 4}" y="${H * 0.8}" width="8" height="${H * 0.1}" fill="${C.mid}"/>`).join("") +
        lamp(W * 0.45, H * 0.42, H * 0.2) +
        lamp(W * 0.84, H * 0.42, H * 0.16);
      break;
    case "scene-back-room":
      body =
        windowBox(a, W * 0.62, H * 0.14, W * 0.22, H * 0.38) +
        `<ellipse cx="${W * 0.38}" cy="${H * 0.68}" rx="${W * 0.14}" ry="${H * 0.06}" fill="${C.card}" stroke="${C.mid}" stroke-width="4"/>` +
        [0.26, 0.5, 0.33, 0.43].map((x, i) => `<rect x="${W * x - 18}" y="${H * (i < 2 ? 0.6 : 0.76)}" width="36" height="${H * 0.1}" rx="6" fill="${C.mid}"/>`).join("") +
        lamp(W * 0.38, H * 0.5, H * 0.2);
      break;
    case "scene-kitchen":
      body =
        windowBox(a, W * 0.66, H * 0.16, W * 0.2, H * 0.34) +
        `<rect x="${W * 0.1}" y="${H * 0.52}" width="${W * 0.6}" height="${H * 0.2}" fill="${C.card}" stroke="${C.mid}" stroke-width="4"/>
         <rect x="${W * 0.28}" y="${H * 0.56}" width="${W * 0.2}" height="${H * 0.08}" rx="6" fill="${C.mid}" fill-opacity="0.8"/>` +
        lamp(W * 0.22, H * 0.34, H * 0.2);
      break;
    case "scene-back-stairs": {
      let steps = "";
      for (let i = 0; i < 8; i++) {
        steps += `<polygon points="${W * (0.22 + i * 0.07)},${H * (0.86 - i * 0.075)} ${W * (0.78 - i * 0.0)},${H * (0.86 - i * 0.075)} ${W * 0.78},${H * (0.86 - (i + 1) * 0.075)} ${W * (0.29 + i * 0.07)},${H * (0.86 - (i + 1) * 0.075)}" fill="${C.card}" fill-opacity="${0.35 + i * 0.05}" stroke="${C.mid}" stroke-width="3"/>`;
      }
      body = steps + lamp(W * 0.84, H * 0.3, H * 0.15);
      break;
    }
    case "scene-upstairs-hall": {
      let doors = "";
      for (let i = 0; i < 6; i++) {
        const x = W * (0.08 + i * 0.075);
        const h = H * (0.5 - i * 0.04);
        doors += `<rect x="${x}" y="${H * 0.7 - h}" width="${W * 0.05}" height="${h}" fill="${C.card}" stroke="${C.mid}" stroke-width="3"/>`;
      }
      body = `<polygon points="0,${H} ${W * 0.62},${H * 0.64} ${W * 0.62},${H * 0.3} 0,0" fill="${C.raised}" fill-opacity="0.7"/>` + doors + windowBox(a, W * 0.64, H * 0.3, W * 0.14, H * 0.34) + lamp(W * 0.3, H * 0.18, H * 0.16);
      break;
    }
    case "scene-room-5":
      body =
        windowBox(a, W * 0.68, H * 0.14, W * 0.2, H * 0.42) +
        `<rect x="${W * 0.1}" y="${H * 0.58}" width="${W * 0.38}" height="${H * 0.14}" rx="8" fill="${C.card}" stroke="${C.mid}" stroke-width="4"/>
         <rect x="${W * 0.1}" y="${H * 0.5}" width="${W * 0.08}" height="${H * 0.22}" fill="${C.mid}"/>
         <rect x="${W * 0.54}" y="${H * 0.62}" width="${W * 0.1}" height="${H * 0.08}" rx="4" fill="${C.mid}" fill-opacity="0.9"/>
         <rect x="${W * 0.7}" y="${H * 0.62}" width="${W * 0.08}" height="${H * 0.1}" fill="${C.card}" stroke="${C.mid}" stroke-width="3"/>` +
        lamp(W * 0.74, H * 0.52, H * 0.16);
      break;
  }
  return floor + body + `<rect x="0" y="${H * 0.75}" width="${W}" height="${H * 0.25}" fill="url(#fade)"/>`;
}

function portrait(a: Asset): string {
  const W = a.width;
  const H = a.height;
  const skin = tint(a.id + "skin", 96);
  return `
    <ellipse cx="${W / 2}" cy="${H * 0.36}" rx="${W * 0.19}" ry="${H * 0.15}" fill="${skin}" fill-opacity="0.55"/>
    <path d="M ${W * 0.12} ${H} C ${W * 0.12} ${H * 0.66} ${W * 0.3} ${H * 0.58} ${W / 2} ${H * 0.58} C ${W * 0.7} ${H * 0.58} ${W * 0.88} ${H * 0.66} ${W * 0.88} ${H} Z" fill="${C.card}" stroke="${C.mid}" stroke-width="5"/>
    <circle cx="${W * 0.5}" cy="${H * 0.3}" r="${H * 0.34}" fill="url(#glow)" fill-opacity="0.25"/>`;
}

function evidence(a: Asset): string {
  const W = a.width;
  const H = a.height;
  let obj = "";
  if (a.id === "ev-ashtray") {
    obj = `<ellipse cx="${W / 2}" cy="${H * 0.58}" rx="${W * 0.24}" ry="${H * 0.1}" fill="none" stroke="${C.cream}" stroke-opacity="0.45" stroke-width="6" stroke-dasharray="14 10"/>
           <ellipse cx="${W / 2}" cy="${H * 0.55}" rx="${W * 0.2}" ry="${H * 0.08}" fill="${C.mid}" fill-opacity="0.8" stroke="${C.cream}" stroke-opacity="0.5" stroke-width="4"/>`;
  } else if (a.id === "ev-whiskey-glass") {
    obj = `<polygon points="${W * 0.4},${H * 0.36} ${W * 0.6},${H * 0.36} ${W * 0.57},${H * 0.68} ${W * 0.43},${H * 0.68}" fill="${C.mid}" fill-opacity="0.55" stroke="${C.cream}" stroke-opacity="0.5" stroke-width="5"/>
           <rect x="${W * 0.435}" y="${H * 0.62}" width="${W * 0.13}" height="${H * 0.05}" fill="${C.amber}" fill-opacity="0.5"/>`;
  } else {
    obj = `<g transform="rotate(-9 ${W / 2} ${H / 2})"><rect x="${W * 0.28}" y="${H * 0.34}" width="${W * 0.44}" height="${H * 0.34}" fill="${C.cream}" fill-opacity="0.55" stroke="${C.cream}" stroke-opacity="0.6" stroke-width="4"/>
           <line x1="${W * 0.28}" y1="${H * 0.51}" x2="${W * 0.72}" y2="${H * 0.51}" stroke="${C.mid}" stroke-width="4"/></g>`;
  }
  return `<circle cx="${W / 2}" cy="${H * 0.4}" r="${W * 0.45}" fill="url(#glow)" fill-opacity="0.35"/>` + obj;
}

function hero(a: Asset): string {
  const W = a.width;
  const H = a.height;
  return `
    ${windowBox(a, W * 0.55, H * 0.1, W * 0.36, H * 0.46)}
    <rect x="0" y="${H * 0.68}" width="${W}" height="${H * 0.32}" fill="${C.card}" fill-opacity="0.9"/>
    <circle cx="${W * 0.26}" cy="${H * 0.5}" r="${H * 0.34}" fill="url(#glow)" fill-opacity="0.6"/>
    <rect x="${W * 0.14}" y="${H * 0.4}" width="${W * 0.24}" height="${H * 0.28}" rx="14" fill="${C.raised}" stroke="${C.mid}" stroke-width="6"/>
    <circle cx="${W * 0.22}" cy="${H * 0.52}" r="${H * 0.075}" fill="${C.amberText}" fill-opacity="0.85" stroke="${C.mid}" stroke-width="5"/>
    <rect x="${W * 0.29}" y="${H * 0.46}" width="${W * 0.07}" height="${H * 0.12}" rx="6" fill="${C.mid}"/>
    <rect x="${W * 0.45}" y="${H * 0.74}" width="${W * 0.03}" height="${H * 0.12}" fill="${C.mid}"/>
    <rect x="${W * 0.5}" y="${H * 0.7}" width="${W * 0.03}" height="${H * 0.16}" fill="${C.mid}"/>`;
}

function svgFor(a: Asset): string {
  const inner = a.kind === "scene" ? room(a) : a.kind === "portrait" ? portrait(a) : a.kind === "evidence" ? evidence(a) : hero(a);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${a.width} ${a.height}" width="${a.width}" height="${a.height}" preserveAspectRatio="xMidYMid slice">${defs(a)}
  <rect width="${a.width}" height="${a.height}" fill="url(#bg)"/>${inner}
  ${mark(a)}
</svg>
`;
}

mkdirSync(OUT, { recursive: true });
let written = 0;
for (const a of manifest.assets) {
  if (a.status !== "placeholder") continue;
  if (!a.file.endsWith(".svg")) continue;
  writeFileSync(join(OUT, a.file), svgFor(a));
  written += 1;
}
console.log(`Wrote ${written} placeholder images to ${OUT}`);
