/**
 * lib/pcm-gain.ts
 * Per-voice loudness correction for 16-bit little-endian PCM speech.
 *
 * The three voice providers deliver speech at different levels, so without a
 * correction one character can be 5 dB quieter than the next. A fixed gain per
 * voice (levelDb in voices.ts) brings them together. Boosting a quiet voice
 * would clip its loudest syllables, so anything past the knee is rounded off
 * smoothly toward full scale instead of being cut flat.
 *
 * Applied to the audio as it is served, never to the cached copy, so changing a
 * correction needs no cache purge. SERVER-ONLY (runs in the speech route).
 */

/** Below this level (about -6 dBFS) the signal is only scaled, never shaped. */
const KNEE = 0.5;

/** Largest correction accepted from a signed link, in dB. */
export const MAX_LEVEL_DB = 9;
export const MIN_LEVEL_DB = -12;

export function dbToLinear(db: number): number {
  return 10 ** (db / 20);
}

/** Scale one sample (-1..1 range after gain) and keep it inside full scale. */
export function softLimit(x: number): number {
  const a = Math.abs(x);
  if (a <= KNEE) return x;
  const shaped = KNEE + (1 - KNEE) * Math.tanh((a - KNEE) / (1 - KNEE));
  return x < 0 ? -shaped : shaped;
}

/** Apply a gain in dB to 16-bit little-endian PCM. A whole number of samples is expected. */
export function applyGainPcm16(pcm: Uint8Array, gainDb: number): Uint8Array {
  if (gainDb === 0) return pcm;
  const gain = dbToLinear(gainDb);
  const out = new Uint8Array(pcm.byteLength);
  const inView = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const outView = new DataView(out.buffer);
  const samples = Math.floor(pcm.byteLength / 2);
  for (let i = 0; i < samples; i += 1) {
    const x = (inView.getInt16(i * 2, true) / 32768) * gain;
    const y = Math.round(softLimit(x) * 32767);
    outView.setInt16(i * 2, Math.max(-32768, Math.min(32767, y)), true);
  }
  if (pcm.byteLength % 2 === 1) out[pcm.byteLength - 1] = pcm[pcm.byteLength - 1];
  return out;
}

/**
 * Apply a gain to a PCM stream. Network chunks can split a sample in half, so a
 * leftover odd byte is carried into the next chunk.
 */
export function gainStream(source: ReadableStream<Uint8Array>, gainDb: number): ReadableStream<Uint8Array> {
  if (gainDb === 0) return source;
  const reader = source.getReader();
  let carry: number | null = null;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        // Keep reading until there is something to hand on (a chunk can be a single leftover byte).
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            if (carry !== null) controller.enqueue(new Uint8Array([carry])); // a stray byte: pass it on untouched
            controller.close();
            return;
          }
          if (!value || value.byteLength === 0) continue;
          let bytes = value;
          if (carry !== null) {
            const joined = new Uint8Array(value.byteLength + 1);
            joined[0] = carry;
            joined.set(value, 1);
            bytes = joined;
            carry = null;
          }
          if (bytes.byteLength % 2 === 1) {
            carry = bytes[bytes.byteLength - 1];
            bytes = bytes.subarray(0, bytes.byteLength - 1);
          }
          if (bytes.byteLength > 0) {
            controller.enqueue(applyGainPcm16(bytes, gainDb));
            return;
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}
