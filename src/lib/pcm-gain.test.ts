import { describe, it, expect } from "vitest";
import { applyGainPcm16, dbToLinear, gainStream, softLimit } from "./pcm-gain";

function pcm(samples: number[]): Uint8Array {
  const out = new Uint8Array(samples.length * 2);
  const v = new DataView(out.buffer);
  samples.forEach((s, i) => v.setInt16(i * 2, s, true));
  return out;
}
function read(bytes: Uint8Array): number[] {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from({ length: Math.floor(bytes.byteLength / 2) }, (_, i) => v.getInt16(i * 2, true));
}
async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) parts.push(value);
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.byteLength;
  }
  return out;
}

describe("softLimit", () => {
  it("leaves quiet samples alone and never exceeds full scale", () => {
    expect(softLimit(0.3)).toBe(0.3);
    expect(softLimit(-0.4)).toBe(-0.4);
    for (const x of [0.6, 1, 2, 10, -3]) expect(Math.abs(softLimit(x))).toBeLessThanOrEqual(1);
  });
  it("is smooth and keeps the sign and order of loud samples", () => {
    expect(softLimit(0.8)).toBeGreaterThan(0.5);
    expect(softLimit(1.2)).toBeGreaterThan(softLimit(0.8));
    expect(softLimit(-1.2)).toBeLessThan(0);
  });
});

describe("applyGainPcm16", () => {
  it("returns the same audio for 0 dB", () => {
    const a = pcm([100, -200, 300]);
    expect(read(applyGainPcm16(a, 0))).toEqual([100, -200, 300]);
  });
  it("scales quiet audio by the gain: +6 dB is about double", () => {
    const out = read(applyGainPcm16(pcm([1000, -1000]), 6.0206));
    expect(out[0]).toBeGreaterThan(1990);
    expect(out[0]).toBeLessThan(2010);
    expect(out[1]).toBeLessThan(-1990);
  });
  it("lowers audio with a negative gain", () => {
    expect(Math.abs(read(applyGainPcm16(pcm([10000]), -6.0206))[0])).toBeLessThan(5100);
  });
  it("keeps a boosted loud peak inside the 16-bit range", () => {
    const out = read(applyGainPcm16(pcm([32767, -32768, 30000]), 9));
    for (const s of out) {
      expect(s).toBeLessThanOrEqual(32767);
      expect(s).toBeGreaterThanOrEqual(-32768);
    }
  });
  it("does not change the length", () => {
    expect(applyGainPcm16(pcm([1, 2, 3, 4]), 3).byteLength).toBe(8);
  });
  it("matches dbToLinear", () => {
    expect(dbToLinear(20)).toBeCloseTo(10);
  });
});

describe("gainStream", () => {
  it("gives the same result as processing the whole clip, even when chunks split a sample", async () => {
    const whole = pcm([500, -800, 1200, -3000, 4000, 25000, -25000, 7]);
    const expected = applyGainPcm16(whole, 3);
    const cuts = [3, 8, 9, 15]; // odd cuts split samples
    const chunks: Uint8Array[] = [];
    let last = 0;
    for (const c of [...cuts, whole.byteLength]) {
      chunks.push(whole.slice(last, c));
      last = c;
    }
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        chunks.forEach((c) => controller.enqueue(c));
        controller.close();
      },
    });
    expect(Array.from(await collect(gainStream(source, 3)))).toEqual(Array.from(expected));
  });
  it("passes the stream through untouched at 0 dB", async () => {
    const source = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(pcm([1, 2]));
        c.close();
      },
    });
    expect(read(await collect(gainStream(source, 0)))).toEqual([1, 2]);
  });
});
