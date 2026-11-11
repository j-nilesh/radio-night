import { describe, it, expect } from "vitest";
import { pcm16ToFloat32, sampleRateFromContentType, PcmCoalescer } from "./pcm";

const le = (...samples: number[]) => {
  const out = new Uint8Array(samples.length * 2);
  const v = new DataView(out.buffer);
  samples.forEach((s, i) => v.setInt16(i * 2, s, true));
  return out;
};

describe("pcm16ToFloat32", () => {
  it("converts signed little-endian samples to floats", () => {
    const { samples, carry } = pcm16ToFloat32(le(0, 16384, -16384, 32767, -32768), null);
    expect(Array.from(samples)).toEqual([0, 0.5, -0.5, 32767 / 32768, -1]);
    expect(carry).toBeNull();
  });

  it("carries an odd trailing byte and uses it in the next chunk", () => {
    const whole = le(1000, -2000, 3000);
    const a = pcm16ToFloat32(whole.slice(0, 3), null); // 1.5 samples
    expect(a.samples).toHaveLength(1);
    expect(a.carry).toHaveLength(1);
    const b = pcm16ToFloat32(whole.slice(3), a.carry);
    expect(b.carry).toBeNull();
    expect(Array.from(a.samples).concat(Array.from(b.samples))).toEqual(
      Array.from(pcm16ToFloat32(whole, null).samples)
    );
  });

  it("gives the same audio however the stream is cut up", () => {
    const whole = le(...Array.from({ length: 200 }, (_, i) => (i * 331) % 30000 - 15000));
    const reference = Array.from(pcm16ToFloat32(whole, null).samples);
    for (const size of [1, 2, 3, 5, 7, 64, 199]) {
      let carry: Uint8Array | null = null;
      const out: number[] = [];
      for (let i = 0; i < whole.length; i += size) {
        const r = pcm16ToFloat32(whole.slice(i, i + size), carry);
        carry = r.carry;
        out.push(...r.samples);
      }
      expect(out).toEqual(reference);
    }
  });

  it("handles an empty chunk, and a chunk that is a view into a larger buffer", () => {
    expect(pcm16ToFloat32(new Uint8Array(0), null).samples).toHaveLength(0);
    const big = le(111, 222, 333, 444);
    const view = big.subarray(2, 6); // 222, 333
    expect(Array.from(pcm16ToFloat32(view, null).samples)).toEqual([222 / 32768, 333 / 32768]);
  });
});

describe("sampleRateFromContentType", () => {
  it("reads the rate", () => {
    expect(sampleRateFromContentType("audio/L16;rate=24000;channels=1")).toBe(24000);
    expect(sampleRateFromContentType("audio/l16; rate=48000")).toBe(48000);
  });
  it("returns undefined when there is none", () => {
    expect(sampleRateFromContentType("audio/mpeg")).toBeUndefined();
    expect(sampleRateFromContentType(null)).toBeUndefined();
  });
});

describe("PcmCoalescer", () => {
  const chunk = (n: number, fill = 1) => new Uint8Array(n).fill(fill);

  it("releases a small first block quickly, then larger ones", () => {
    const c = new PcmCoalescer(100, 400);
    expect(c.push(chunk(60))).toBeNull();
    expect(c.push(chunk(60))?.byteLength).toBe(120); // first block at >= 100
    expect(c.push(chunk(300))).toBeNull();
    expect(c.push(chunk(150))?.byteLength).toBe(450); // later blocks at >= 400
  });

  it("flushes the remainder at the end, and nothing when empty", () => {
    const c = new PcmCoalescer(100, 400);
    c.push(chunk(30));
    expect(c.flush()?.byteLength).toBe(30);
    expect(c.flush()).toBeNull();
  });

  it("preserves every byte in order", () => {
    const c = new PcmCoalescer(4, 8);
    const out: number[] = [];
    for (let i = 0; i < 25; i++) {
      const block = c.push(new Uint8Array([i]));
      if (block) out.push(...block);
    }
    const rest = c.flush();
    if (rest) out.push(...rest);
    expect(out).toEqual(Array.from({ length: 25 }, (_, i) => i));
  });

  it("ignores empty chunks", () => {
    const c = new PcmCoalescer(4, 8);
    expect(c.push(new Uint8Array(0))).toBeNull();
    expect(c.flush()).toBeNull();
  });
});
