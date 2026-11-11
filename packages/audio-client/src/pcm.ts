/**
 * audio-client/pcm.ts
 * Pure helpers for streaming raw 16-bit PCM into Web Audio. No browser APIs,
 * so they are tested directly.
 *
 * The server streams little-endian, signed 16-bit, mono PCM. Network chunks
 * arrive at arbitrary sizes and can split a 2-byte sample in half, so a
 * converted chunk may leave one byte "carried" for the next.
 */

/** Convert PCM bytes to floats in [-1, 1). Merges any carried byte first. */
export function pcm16ToFloat32(
  bytes: Uint8Array,
  carry: Uint8Array | null
): { samples: Float32Array; carry: Uint8Array | null } {
  let data = bytes;
  if (carry && carry.byteLength > 0) {
    data = new Uint8Array(carry.byteLength + bytes.byteLength);
    data.set(carry, 0);
    data.set(bytes, carry.byteLength);
  }

  const usable = data.byteLength - (data.byteLength % 2);
  const nextCarry = usable < data.byteLength ? data.slice(usable) : null;

  const samples = new Float32Array(usable / 2);
  const view = new DataView(data.buffer, data.byteOffset, usable);
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
  return { samples, carry: nextCarry };
}

/** The sample rate from a content type like "audio/L16;rate=24000;channels=1". */
export function sampleRateFromContentType(contentType: string | null | undefined): number | undefined {
  const m = contentType?.match(/rate=(\d{4,6})/i);
  return m ? Number(m[1]) : undefined;
}

/**
 * Gathers small network chunks into larger blocks before they become audio
 * buffers. The first block is small so playback can begin quickly; later ones
 * are larger to keep the number of audio nodes down.
 */
export class PcmCoalescer {
  private parts: Uint8Array[] = [];
  private bytes = 0;
  private flushedOnce = false;

  /** 100 ms and 200 ms of 24 kHz 16-bit mono by default. */
  constructor(
    private readonly firstBlockBytes = 4800,
    private readonly blockBytes = 9600
  ) {}

  /** Add a chunk. Returns a block when enough has gathered, otherwise null. */
  push(chunk: Uint8Array): Uint8Array | null {
    if (chunk.byteLength === 0) return null;
    this.parts.push(chunk);
    this.bytes += chunk.byteLength;
    return this.bytes >= (this.flushedOnce ? this.blockBytes : this.firstBlockBytes) ? this.take() : null;
  }

  /** Whatever is left at the end of the stream. */
  flush(): Uint8Array | null {
    return this.bytes > 0 ? this.take() : null;
  }

  private take(): Uint8Array {
    const out = new Uint8Array(this.bytes);
    let offset = 0;
    for (const p of this.parts) {
      out.set(p, offset);
      offset += p.byteLength;
    }
    this.parts = [];
    this.bytes = 0;
    this.flushedOnce = true;
    return out;
  }
}
