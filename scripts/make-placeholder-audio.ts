/**
 * scripts/make-placeholder-audio.ts
 * Writes simple synthesised stand-ins for the story's ambience and stings to
 * public/audio/radio-night-s01/. They exist so the whole sound system can be
 * built and tested before real recordings are chosen and licensed. They are
 * original (generated here), so they carry no third-party rights.
 *
 *   npm run audio:placeholders
 *
 * Replace a file with a final asset of the same name, or point the manifest
 * (content/cases/radio-night-s01/v1/audio-manifest.json) at a new one, and
 * change its "status" from "placeholder" to "final" with its real source and
 * licence.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "public", "audio", "radio-night-s01");
const FS = 11025; // plenty for hums, murmur and bells; keeps the files small

// ── tools ───────────────────────────────────────────────────────────────────
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const white = (n: number, r: () => number) => Float32Array.from({ length: n }, () => r() * 2 - 1);

function lowpass(x: Float32Array, fc: number): Float32Array {
  const a = 1 - Math.exp((-2 * Math.PI * fc) / FS);
  const y = new Float32Array(x.length);
  let s = 0;
  for (let i = 0; i < x.length; i++) y[i] = s += a * (x[i] - s);
  return y;
}
function highpass(x: Float32Array, fc: number): Float32Array {
  const lp = lowpass(x, fc);
  return x.map((v, i) => v - lp[i]);
}
const bandpass = (x: Float32Array, lo: number, hi: number) => lowpass(highpass(x, lo), hi);
const brown = (n: number, r: () => number) => {
  const w = white(n, r);
  const y = new Float32Array(n);
  let s = 0;
  for (let i = 0; i < n; i++) y[i] = s = s * 0.998 + w[i] * 0.05;
  return normalise(y, 1);
};
function normalise(x: Float32Array, peak: number): Float32Array {
  let m = 1e-9;
  for (const v of x) m = Math.max(m, Math.abs(v));
  return x.map((v) => (v / m) * peak);
}
function mix(n: number, ...layers: Array<[Float32Array, number]>): Float32Array {
  const y = new Float32Array(n);
  for (const [x, g] of layers) for (let i = 0; i < n && i < x.length; i++) y[i] += x[i] * g;
  return y;
}
const sine = (n: number, hz: number, phase = 0) =>
  Float32Array.from({ length: n }, (_, i) => Math.sin(2 * Math.PI * hz * (i / FS) + phase));

/** Smooth random loudness that wanders a few times a second, like a murmur of talk. */
function wander(n: number, r: () => number, lowHz: number, highHz: number): Float32Array {
  const y = new Float32Array(n);
  for (let k = 0; k < 5; k++) {
    const hz = lowHz + r() * (highHz - lowHz);
    const ph = r() * Math.PI * 2;
    for (let i = 0; i < n; i++) y[i] += Math.sin(2 * Math.PI * hz * (i / FS) + ph) / 5;
  }
  return y.map((v) => 0.55 + 0.45 * v);
}

/** Make the end flow into the start, so the file loops without a click. */
function loopable(x: Float32Array, crossfadeSec = 1): Float32Array {
  const xf = Math.floor(crossfadeSec * FS);
  const n = x.length - xf;
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = x[i];
  for (let i = 0; i < xf; i++) {
    const w = i / xf;
    y[i] = x[i] * Math.sin((w * Math.PI) / 2) + x[n + i] * Math.cos((w * Math.PI) / 2);
  }
  return y;
}
const envelope = (n: number, attackSec: number, releaseSec: number) =>
  Float32Array.from({ length: n }, (_, i) => {
    const t = i / FS;
    const total = n / FS;
    return Math.min(1, t / Math.max(attackSec, 1e-3)) * Math.min(1, (total - t) / Math.max(releaseSec, 1e-3));
  });
const decay = (n: number, tauSec: number) => Float32Array.from({ length: n }, (_, i) => Math.exp(-(i / FS) / tauSec));

/** Files the manifest marks "final" are never overwritten with a placeholder. */
const FINAL_FILES = new Set(
  (JSON.parse(readFileSync(join(process.cwd(), "content", "cases", "radio-night-s01", "v1", "audio-manifest.json"), "utf8")) as {
    assets: Array<{ file: string; status: string }>;
  }).assets
    .filter((a) => a.status === "final")
    .map((a) => a.file)
);
function write(name: string, x: Float32Array, peak = 0.8): void {
  if (FINAL_FILES.has(name)) {
    console.log(`  skipped ${name} (final)`);
    return;
  }
  const data = normalise(x, peak);
  const buf = Buffer.alloc(44 + data.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + data.length * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(FS, 24);
  buf.writeUInt32LE(FS * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(data.length * 2, 40);
  data.forEach((v, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  writeFileSync(join(OUT, name), buf);
  console.log(`  ${name.padEnd(28)} ${(data.length / FS).toFixed(1)} s  ${(buf.length / 1024).toFixed(0)} KB`);
}

const LOOP = 9 * FS; // 8 s once the loop join is made

// ── ambience ────────────────────────────────────────────────────────────────
function tapRoom(): Float32Array {
  const r = rng(11);
  const talk = bandpass(white(LOOP, r), 250, 1800);
  const shaped = new Float32Array(LOOP);
  const w1 = wander(LOOP, r, 1.5, 4.5);
  const w2 = wander(LOOP, r, 2, 5);
  for (let i = 0; i < LOOP; i++) shaped[i] = talk[i] * w1[i] * w2[i];
  const clinks = new Float32Array(LOOP);
  for (const t of [1.7, 4.9, 6.6]) {
    const at = Math.floor(t * FS);
    const len = Math.floor(0.18 * FS);
    const d = decay(len, 0.04);
    for (let i = 0; i < len && at + i < LOOP; i++) {
      clinks[at + i] += (Math.sin(2 * Math.PI * 2600 * (i / FS)) + 0.6 * Math.sin(2 * Math.PI * 3900 * (i / FS))) * d[i];
    }
  }
  return loopable(
    mix(LOOP, [normalise(shaped, 1), 0.55], [brown(LOOP, r), 0.35], [sine(LOOP, 60), 0.04], [clinks, 0.07]),
    1
  );
}
const backRoom = () => {
  const r = rng(21);
  return loopable(mix(LOOP, [lowpass(brown(LOOP, r), 400), 0.8], [sine(LOOP, 60), 0.05], [bandpass(white(LOOP, r), 300, 900), 0.02]), 1);
};
const kitchen = () => {
  const r = rng(31);
  return loopable(mix(LOOP, [sine(LOOP, 60), 0.12], [sine(LOOP, 120), 0.06], [lowpass(white(LOOP, r), 1800), 0.05], [brown(LOOP, r), 0.2]), 1);
};
const backStairs = () => {
  const r = rng(41);
  return loopable(mix(LOOP, [lowpass(brown(LOOP, r), 220), 0.9], [highpass(lowpass(white(LOOP, r), 1200), 600), 0.015]), 1);
};
function upstairsHall(): Float32Array {
  const r = rng(51);
  const bed = mix(LOOP, [lowpass(brown(LOOP, r), 300), 0.5], [sine(LOOP, 50), 0.03]);
  // A clock ticks once a second; 8 whole seconds of loop make the ticks line up
  const ticks = new Float32Array(LOOP);
  for (let s = 0; s < 9; s++) {
    const at = s * FS;
    const len = Math.floor(0.03 * FS);
    for (let i = 0; i < len && at + i < LOOP; i++) {
      ticks[at + i] = (r() * 2 - 1) * Math.exp(-i / (0.006 * FS)) * (s % 2 ? 0.8 : 1);
    }
  }
  return loopable(mix(LOOP, [bed, 1], [bandpass(ticks, 800, 3500), 0.35]), 1);
}
const room5 = () => {
  const r = rng(61);
  const wind = lowpass(highpass(white(LOOP, r), 200), 700);
  const gust = wander(LOOP, r, 0.1, 0.4);
  return loopable(mix(LOOP, [lowpass(brown(LOOP, r), 150), 0.5], [wind.map((v, i) => v * gust[i]), 0.1]), 1);
};

// ── stings and effects ──────────────────────────────────────────────────────
function bell(hz: number[], seconds: number, tau: number): Float32Array {
  const n = Math.floor(seconds * FS);
  const d = decay(n, tau);
  const out = new Float32Array(n);
  hz.forEach((f, k) => {
    const s = sine(n, f);
    for (let i = 0; i < n; i++) out[i] += s[i] * d[i] * (k === 0 ? 1 : 0.5 / k);
  });
  return out;
}
function chord(hz: number[], seconds: number, attack: number, release: number): Float32Array {
  const n = Math.floor(seconds * FS);
  const env = envelope(n, attack, release);
  const out = new Float32Array(n);
  for (const f of hz) {
    const a = sine(n, f);
    const b = sine(n, f * 1.004); // a slight detune so it breathes
    for (let i = 0; i < n; i++) out[i] += (a[i] + b[i]) * 0.5 * env[i];
  }
  return out;
}
function door(): Float32Array {
  const r = rng(71);
  const n = Math.floor(1.2 * FS);
  const out = new Float32Array(n);
  for (const [t, g] of [[0.0, 1], [0.38, 0.6]] as const) {
    const at = Math.floor(t * FS);
    const len = Math.floor(0.25 * FS);
    const noise = lowpass(white(len, r), 500);
    const d = decay(len, 0.05);
    const low = sine(len, 70);
    for (let i = 0; i < len && at + i < n; i++) out[at + i] += (noise[i] * 2 + low[i] * 0.8) * d[i] * g;
  }
  return out;
}

// ── go ──────────────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });
console.log(`Writing placeholder audio to ${OUT}`);
write("amb-tap-room.wav", tapRoom());
write("amb-back-room.wav", backRoom());
write("amb-kitchen.wav", kitchen());
write("amb-back-stairs.wav", backStairs());
write("amb-upstairs-hall.wav", upstairsHall());
write("amb-room-5.wav", room5());
write("sting-clue.wav", bell([784, 1175, 1568], 1.6, 0.35), 0.7);
write("sfx-door.wav", door(), 0.8);
write("sting-accuse.wav", chord([110, 164.8, 220], 3.2, 1.2, 1.6), 0.7);
write("sting-ending-solved.wav", chord([220, 277.2, 329.6, 440], 4.5, 1.0, 2.5), 0.7);
write("sting-ending-closed.wav", chord([220, 261.6, 329.6], 4.5, 1.4, 2.5), 0.7);
