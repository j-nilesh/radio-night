/**
 * Contract tests for the Deepgram voice adapter. A fake fetch stands in for the
 * network, so these run offline and need no API key.
 */

import { describe, it, expect } from "vitest";
import { DeepgramTextToSpeechProvider, splitForSpeech } from "./deepgram-tts";
import { SpeechProviderError } from "./deepgram-stt";
import type { VoiceProfile } from "./types";

const KEY = "test-key-do-not-leak-0123456789";

const voice = (over: Partial<VoiceProfile> = {}): VoiceProfile => ({
  characterId: "char-ray-kowalski",
  provider: "deepgram",
  model: "aura-2",
  voiceId: "aura-2-apollo-en",
  delivery: {},
  targetFormat: "mp3",
  fallbackPolicy: "captions_only",
  ...over,
});

type Call = { url: string; init: RequestInit };

function setup(respond: (call: Call, n: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    return respond(call, calls.length);
  }) as typeof fetch;
  return { p: new DeepgramTextToSpeechProvider({ apiKey: KEY, fetchImpl: impl }), calls };
}

const mp3 = (...bytes: number[]) =>
  new Response(new Uint8Array(bytes), { status: 200, headers: { "Content-Type": "audio/mpeg" } });

const speak = (p: DeepgramTextToSpeechProvider, text: string, v = voice()) =>
  p.synthesize({ text, voice: v, requestId: "r1" });

describe("request", () => {
  it("posts the text as JSON, with token auth, asking for the pinned voice as MP3", async () => {
    const { p, calls } = setup(() => mp3(1, 2, 3));
    await speak(p, "Behind this bar, same as every Saturday.");

    const { url, init } = calls[0];
    expect(init.method).toBe("POST");
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://api.deepgram.com/v1/speak");
    expect(u.searchParams.get("model")).toBe("aura-2-apollo-en");
    expect(u.searchParams.get("encoding")).toBe("mp3");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Token ${KEY}`);
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ text: "Behind this bar, same as every Saturday." });
  });

  it("returns the audio bytes as audio/mpeg", async () => {
    const { p } = setup(() => mp3(9, 8, 7, 6));
    const r = await speak(p, "Hello.");
    expect(Array.from(r.data)).toEqual([9, 8, 7, 6]);
    expect(r.mimeType).toBe("audio/mpeg");
  });

  it("refuses a voice pinned to another provider rather than quietly using its own", async () => {
    const { p, calls } = setup(() => mp3(1));
    await expect(speak(p, "Hello.", voice({ provider: "elevenlabs" }))).rejects.toBeInstanceOf(
      SpeechProviderError
    );
    expect(calls).toHaveLength(0);
  });

  it("refuses a voice id that could inject query parameters", async () => {
    const { p, calls } = setup(() => mp3(1));
    for (const bad of ["aura-2-x-en&encoding=wav", "../v1/listen", "aura-2-apollo-en?x=1", ""]) {
      await expect(speak(p, "Hello.", voice({ voiceId: bad }))).rejects.toBeInstanceOf(SpeechProviderError);
    }
    expect(calls).toHaveLength(0);
  });

  it("refuses to speak nothing", async () => {
    const { p, calls } = setup(() => mp3(1));
    await expect(speak(p, "   ")).rejects.toBeInstanceOf(SpeechProviderError);
    expect(calls).toHaveLength(0);
  });

  it("refuses to be built without a key", () => {
    expect(() => new DeepgramTextToSpeechProvider({ apiKey: "" })).toThrow();
  });
});

describe("long text", () => {
  const sentence = "The innkeeper keeps a careful eye on the stairs. ";

  it("keeps every request under Deepgram's 2,000 character limit and preserves order", async () => {
    const text = sentence.repeat(120).trim(); // ~5,900 characters
    const { p, calls } = setup((_c, n) => mp3(n));
    const r = await speak(p, text);

    expect(calls.length).toBeGreaterThan(2);
    const sent = calls.map((c) => (JSON.parse(c.init.body as string) as { text: string }).text);
    for (const part of sent) expect(part.length).toBeLessThanOrEqual(1800);
    expect(sent.join(" ").replace(/\s+/g, " ")).toBe(text.replace(/\s+/g, " "));
    expect(Array.from(r.data)).toEqual(calls.map((_c, i) => i + 1)); // parts joined in order
  });

  it("splits on sentence ends where it can", () => {
    const parts = splitForSpeech(sentence.repeat(60), 500);
    for (const part of parts) expect(part.endsWith(".")).toBe(true);
  });

  it("breaks an over-long sentence on word boundaries", () => {
    const parts = splitForSpeech("word ".repeat(1000).trim(), 300);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(300);
      // No word was cut in half: every token in every part is a whole "word".
      expect(part.split(" ").every((w) => w === "word")).toBe(true);
    }
    expect(parts.join(" ").split(" ").length).toBe(1000);
  });

  it("returns a short line whole", () => {
    expect(splitForSpeech("Short.")).toEqual(["Short."]);
    expect(splitForSpeech("  ")).toEqual([]);
  });
});

describe("failure modes", () => {
  it("reports a rejected key by status only", async () => {
    const { p } = setup(() => new Response(`bad key ${KEY}`, { status: 401 }));
    const err = await speak(p, "Hello.").catch((e) => e);
    expect(err).toBeInstanceOf(SpeechProviderError);
    expect(err.status).toBe(401);
    expect(err.message).not.toContain(KEY);
    expect(err.message).not.toContain("bad key");
  });

  it("reports rate limiting distinctly", async () => {
    const { p } = setup(() => new Response("", { status: 429 }));
    const err = await speak(p, "Hello.").catch((e) => e);
    expect(err.status).toBe(429);
    expect(err.message).toMatch(/busy/);
  });

  it("does not leak the key or the text when the network fails", async () => {
    const { p } = setup(() => {
      throw new TypeError(`connect failed Token ${KEY} text=Secret line`);
    });
    const err = await speak(p, "Secret line").catch((e) => e);
    expect(err).toBeInstanceOf(SpeechProviderError);
    expect(err.message).not.toContain(KEY);
    expect(err.message).not.toContain("Secret line");
  });

  it("rejects an empty audio body", async () => {
    const { p } = setup(() => new Response(new Uint8Array(0), { status: 200 }));
    await expect(speak(p, "Hello.")).rejects.toBeInstanceOf(SpeechProviderError);
  });

  it("gives up after the timeout", async () => {
    const impl = ((_: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const e = new Error("aborted");
          e.name = "AbortError";
          reject(e);
        });
      })) as typeof fetch;
    const p = new DeepgramTextToSpeechProvider({ apiKey: KEY, fetchImpl: impl, timeoutMs: 25 });
    const err = await speak(p, "Hello.").catch((e) => e);
    expect(err).toBeInstanceOf(SpeechProviderError);
    expect(err.message).toMatch(/timed out/);
  });
});


// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------

/** A response whose body arrives in the given chunks. */
function streamed(chunks: number[][], status = 200): Response {
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(new Uint8Array(chunks[i++]));
      else controller.close();
    },
  });
  return new Response(body, { status, headers: { "Content-Type": "audio/mpeg" } });
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<number[]> {
  const reader = stream.getReader();
  const out: number[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out.push(...value);
  }
  return out;
}

describe("streaming", () => {
  it("passes the audio through in order, as audio/mpeg", async () => {
    const { p } = setup(() => streamed([[1, 2], [3], [4, 5, 6]]));
    const { stream, mimeType } = await p.synthesizeStream!({ text: "Hello.", voice: voice(), requestId: "r" });
    expect(mimeType).toBe("audio/mpeg");
    expect(await readAll(stream)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("sends the same request as the non-streaming path", async () => {
    const { p, calls } = setup(() => streamed([[1]]));
    await p.synthesizeStream!({ text: "Hello.", voice: voice(), requestId: "r" });
    const u = new URL(calls[0].url);
    expect(u.searchParams.get("model")).toBe("aura-2-apollo-en");
    expect(u.searchParams.get("encoding")).toBe("mp3");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(`Token ${KEY}`);
  });

  it("reports a bad key before returning any stream", async () => {
    const { p } = setup(() => new Response("nope", { status: 401 }));
    const err = await p.synthesizeStream!({ text: "Hello.", voice: voice(), requestId: "r" }).catch((e) => e);
    expect(err).toBeInstanceOf(SpeechProviderError);
    expect(err.status).toBe(401);
    expect(err.message).not.toContain(KEY);
  });

  it("applies the same voice checks as the non-streaming path", async () => {
    const { p, calls } = setup(() => streamed([[1]]));
    await expect(
      p.synthesizeStream!({ text: "Hello.", voice: voice({ provider: "cartesia" }), requestId: "r" })
    ).rejects.toBeInstanceOf(SpeechProviderError);
    await expect(
      p.synthesizeStream!({ text: "Hello.", voice: voice({ voiceId: "aura-2-x-en&encoding=wav" }), requestId: "r" })
    ).rejects.toBeInstanceOf(SpeechProviderError);
    expect(calls).toHaveLength(0);
  });

  it("requests the parts of a long line one at a time, in order", async () => {
    const text = "The innkeeper keeps a careful eye on the stairs. ".repeat(120).trim();
    const { p, calls } = setup((_c, n) => streamed([[n * 10], [n * 10 + 1]]));
    const { stream } = await p.synthesizeStream!({ text, voice: voice(), requestId: "r" });

    // Only the first part has been requested so far; later parts wait to be needed.
    expect(calls).toHaveLength(1);

    const bytes = await readAll(stream);
    expect(calls.length).toBeGreaterThan(2);
    const expected = calls.flatMap((_c, i) => [(i + 1) * 10, (i + 1) * 10 + 1]);
    expect(bytes).toEqual(expected);
  });

  it("errors the stream, rather than ending it quietly, when the upstream fails midway", async () => {
    const { p } = setup(() => {
      let sent = false;
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (!sent) {
            sent = true;
            controller.enqueue(new Uint8Array([1, 2, 3]));
          } else {
            controller.error(new Error(`socket died ${KEY}`));
          }
        },
      });
      return new Response(body, { status: 200 });
    });
    const { stream } = await p.synthesizeStream!({ text: "Hello.", voice: voice(), requestId: "r" });
    const err = await readAll(stream).catch((e) => e);
    expect(err).toBeInstanceOf(SpeechProviderError);
    expect(String(err.message)).not.toContain(KEY);
  });

  it("cuts off an upstream that stalls", async () => {
    const impl = (async (_u: unknown, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener("abort", () => controller.error(new Error("aborted")));
          controller.enqueue(new Uint8Array([1])); // one chunk, then silence
        },
      });
      return new Response(body, { status: 200 });
    }) as typeof fetch;
    const p = new DeepgramTextToSpeechProvider({ apiKey: KEY, fetchImpl: impl, streamDeadlineMs: 40 });
    const { stream } = await p.synthesizeStream!({ text: "Hello.", voice: voice(), requestId: "r" });
    const err = await readAll(stream).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
  });

  it("stops the upstream request when the listener walks away", async () => {
    let upstreamSignal: AbortSignal | undefined;
    const impl = (async (_u: unknown, init?: RequestInit) => {
      upstreamSignal = init?.signal ?? undefined;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener("abort", () => controller.error(new Error("aborted")));
          controller.enqueue(new Uint8Array([1]));
        },
      });
      return new Response(body, { status: 200 });
    }) as typeof fetch;
    const p = new DeepgramTextToSpeechProvider({ apiKey: KEY, fetchImpl: impl });
    const { stream } = await p.synthesizeStream!({ text: "Hello.", voice: voice(), requestId: "r" });
    await stream.cancel();
    expect(upstreamSignal?.aborted).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// Raw PCM output (what the game uses)
// ---------------------------------------------------------------------------

describe("PCM output", () => {
  const pcmVoice = voice({ targetFormat: "pcm16" });
  const speakPcm = (p: DeepgramTextToSpeechProvider, text = "Hello.") =>
    p.synthesize({ text, voice: pcmVoice, requestId: "r" });

  it("asks Deepgram for headerless 16-bit PCM at 24 kHz", async () => {
    const { p, calls } = setup(() => mp3(1, 2, 3, 4));
    await speakPcm(p);
    const u = new URL(calls[0].url);
    expect(u.searchParams.get("encoding")).toBe("linear16");
    expect(u.searchParams.get("container")).toBe("none");
    expect(u.searchParams.get("sample_rate")).toBe("24000");
    expect(u.searchParams.get("model")).toBe("aura-2-apollo-en");
  });

  it("labels the audio with its sample rate and works out its length", async () => {
    const { p } = setup(() => new Response(new Uint8Array(48_000), { status: 200 })); // one second
    const r = await speakPcm(p);
    expect(r.mimeType).toBe("audio/L16;rate=24000;channels=1");
    expect(r.sampleRate).toBe(24_000);
    expect(r.durationMs).toBe(1000);
  });

  it("streams PCM with the PCM media type", async () => {
    const { p } = setup(() => streamed([[1, 2], [3, 4]]));
    const { stream, mimeType } = await p.synthesizeStream!({ text: "Hello.", voice: pcmVoice, requestId: "r" });
    expect(mimeType).toBe("audio/L16;rate=24000;channels=1");
    expect(await readAll(stream)).toEqual([1, 2, 3, 4]);
  });

  it("refuses a format it cannot produce rather than silently using another", async () => {
    const { p, calls } = setup(() => mp3(1));
    for (const targetFormat of ["wav", "opus"] as const) {
      await expect(speak(p, "Hello.", voice({ targetFormat }))).rejects.toBeInstanceOf(SpeechProviderError);
    }
    expect(calls).toHaveLength(0);
  });
});
