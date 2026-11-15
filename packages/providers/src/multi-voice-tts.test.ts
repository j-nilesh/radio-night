/**
 * Contract tests for the Cartesia and ElevenLabs voice adapters and the router
 * that sends each line to the provider its voice is pinned to. A fake fetch
 * stands in for the network, so these run offline and need no API key.
 */
import { describe, it, expect } from "vitest";
import { CartesiaTextToSpeechProvider, CARTESIA_VERSION } from "./cartesia-tts";
import { ElevenLabsTextToSpeechProvider } from "./elevenlabs-tts";
import { RoutingTextToSpeechProvider, ttsServes } from "./routing-tts";
import { DeepgramTextToSpeechProvider, PCM_MIME } from "./deepgram-tts";
import { SpeechProviderError } from "./deepgram-stt";
import { MockTextToSpeechProvider } from "./mock-tts";
import type { VoiceProfile } from "./types";

const KEY = "test-key-do-not-leak-0123456789";
const SPOKEN = "Behind this bar, same as every Saturday.";

const cartesiaVoice = (over: Partial<VoiceProfile> = {}): VoiceProfile => ({
  characterId: "char-dwight-wentworth",
  provider: "cartesia",
  model: "sonic-3.6",
  voiceId: "533b2990-5b82-45a4-b9f2-367776972ca6",
  delivery: {},
  targetFormat: "pcm16",
  fallbackPolicy: "captions_only",
  ...over,
});
const elevenVoice = (over: Partial<VoiceProfile> = {}): VoiceProfile => ({
  characterId: "char-edna-marsh",
  provider: "elevenlabs",
  model: "eleven_flash_v2_5",
  voiceId: "aIu5oHglU5AHNc2x0AZu",
  delivery: {},
  targetFormat: "pcm16",
  fallbackPolicy: "captions_only",
  ...over,
});

type Call = { url: string; init: RequestInit };
function fakeFetch(respond: (call: Call, n: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    return respond(call, calls.length);
  }) as typeof fetch;
  return { impl, calls };
}
const pcm = (...bytes: number[]) => new Response(new Uint8Array(bytes), { status: 200 });
const bodyOf = (call: Call) => JSON.parse(String(call.init.body)) as Record<string, unknown>;
const headerOf = (call: Call, name: string) => (call.init.headers as Record<string, string>)[name];
/** The error a call fails with; the test fails if the call succeeds. */
async function failure(call: Promise<unknown>): Promise<SpeechProviderError> {
  try {
    await call;
  } catch (e) {
    return e as SpeechProviderError;
  }
  throw new Error("Expected the call to fail.");
}
async function drain(stream: ReadableStream<Uint8Array>): Promise<number[]> {
  const out: number[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.push(...value);
  }
  return out;
}

describe("Cartesia adapter", () => {
  const make = (respond: Parameters<typeof fakeFetch>[0]) => {
    const f = fakeFetch(respond);
    return { p: new CartesiaTextToSpeechProvider({ apiKey: KEY, fetchImpl: f.impl }), calls: f.calls };
  };

  it("posts to /tts/bytes with the key and version headers, the pinned voice and model, asking for 24 kHz PCM", async () => {
    const { p, calls } = make(() => pcm(1, 2, 3, 4));
    const audio = await p.synthesize({ text: SPOKEN, voice: cartesiaVoice(), requestId: "r1" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.cartesia.ai/tts/bytes");
    expect(calls[0].init.method).toBe("POST");
    expect(headerOf(calls[0], "X-API-Key")).toBe(KEY);
    expect(headerOf(calls[0], "Cartesia-Version")).toBe(CARTESIA_VERSION);
    const body = bodyOf(calls[0]);
    expect(body.model_id).toBe("sonic-3.6");
    expect(body.transcript).toBe(SPOKEN);
    expect(body.voice).toEqual({ mode: "id", id: "533b2990-5b82-45a4-b9f2-367776972ca6" });
    expect(body.output_format).toEqual({ container: "raw", encoding: "pcm_s16le", sample_rate: 24000 });
    expect(audio.mimeType).toBe(PCM_MIME);
    expect(Array.from(audio.data)).toEqual([1, 2, 3, 4]);
  });

  it("falls back to the default model when a signed link carries none", async () => {
    const { p, calls } = make(() => pcm(1, 2));
    await p.synthesize({ text: SPOKEN, voice: cartesiaVoice({ model: "" }), requestId: "r1" });
    expect(bodyOf(calls[0]).model_id).toBe("sonic-3.6");
  });

  it("refuses a voice pinned to another provider, a malformed voice id, an unsupported format and empty text without calling out", async () => {
    const { p, calls } = make(() => pcm(1));
    const ask = (voice: VoiceProfile, text = SPOKEN) => p.synthesize({ text, voice, requestId: "r" });
    await expect(ask(cartesiaVoice({ provider: "elevenlabs" }))).rejects.toThrow(/different provider/);
    await expect(ask(cartesiaVoice({ voiceId: "../../admin" }))).rejects.toThrow(/Unrecognised Cartesia voice/);
    await expect(ask(cartesiaVoice({ model: "x; drop" }))).rejects.toThrow(/Unrecognised Cartesia model/);
    await expect(ask(cartesiaVoice({ targetFormat: "mp3" }))).rejects.toThrow(/not supported/);
    await expect(ask(cartesiaVoice(), "   ")).rejects.toThrow(/nothing to say/);
    expect(calls).toHaveLength(0);
  });

  it("reports failures by status only, never the key or the spoken text", async () => {
    for (const status of [401, 402, 404, 429, 500]) {
      const { p } = make(() => new Response(`echo ${KEY} ${SPOKEN}`, { status }));
      const err = await failure(p.synthesize({ text: SPOKEN, voice: cartesiaVoice(), requestId: "r" }));
      expect(err).toBeInstanceOf(SpeechProviderError);
      expect(err.status).toBe(status);
      expect(err.message).toContain(String(status));
      expect(err.message).not.toContain(KEY);
      expect(err.message).not.toContain("Saturday");
    }
  });

  it("turns a network failure and an empty answer into plain errors", async () => {
    const down = make(() => {
      throw new TypeError("fetch failed: " + KEY);
    });
    const e1 = await failure(down.p.synthesize({ text: SPOKEN, voice: cartesiaVoice(), requestId: "r" }));
    expect(e1.message).toMatch(/Could not reach/);
    expect(e1.message).not.toContain(KEY);
    const empty = make(() => new Response(new Uint8Array(0), { status: 200 }));
    await expect(empty.p.synthesize({ text: SPOKEN, voice: cartesiaVoice(), requestId: "r" })).rejects.toThrow(/no audio/);
  });

  it("times out a connection that never answers", async () => {
    const f = fakeFetch((call) => new Promise<Response>((_, reject) => (call.init.signal as AbortSignal).addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))));
    const p = new CartesiaTextToSpeechProvider({ apiKey: KEY, fetchImpl: f.impl, timeoutMs: 20 });
    await expect(p.synthesize({ text: SPOKEN, voice: cartesiaVoice(), requestId: "r" })).rejects.toThrow(/timed out/);
  });

  it("streams, throws a bad key or voice before returning, and requests later pieces of a long line one at a time", async () => {
    const bad = make(() => new Response("no", { status: 401 }));
    await expect(bad.p.synthesizeStream({ text: SPOKEN, voice: cartesiaVoice(), requestId: "r" })).rejects.toMatchObject({ status: 401 });

    const sentence = "This is a sentence of a fair length, written to be split. ";
    const long = sentence.repeat(60); // about 3,500 characters: three pieces
    const { p, calls } = make((_, n) => pcm(n));
    const { stream, mimeType } = await p.synthesizeStream({ text: long, voice: cartesiaVoice(), requestId: "r" });
    expect(mimeType).toBe(PCM_MIME);
    expect(calls).toHaveLength(1); // only the first piece before reading
    const bytes = await drain(stream);
    expect(calls.length).toBeGreaterThan(1);
    expect(bytes).toEqual(calls.map((_, i) => i + 1));
  });
});

describe("ElevenLabs adapter", () => {
  const make = (respond: Parameters<typeof fakeFetch>[0]) => {
    const f = fakeFetch(respond);
    return { p: new ElevenLabsTextToSpeechProvider({ apiKey: KEY, fetchImpl: f.impl }), calls: f.calls };
  };

  it("posts to the streaming endpoint for the pinned voice with the xi-api-key header, asking for 24 kHz PCM", async () => {
    const { p, calls } = make(() => pcm(9, 8, 7));
    const audio = await p.synthesize({ text: SPOKEN, voice: elevenVoice(), requestId: "r1" });
    const u = new URL(calls[0].url);
    expect(u.origin + u.pathname).toBe("https://api.elevenlabs.io/v1/text-to-speech/aIu5oHglU5AHNc2x0AZu/stream");
    expect(u.searchParams.get("output_format")).toBe("pcm_24000");
    expect(headerOf(calls[0], "xi-api-key")).toBe(KEY);
    expect(bodyOf(calls[0])).toEqual({ text: SPOKEN, model_id: "eleven_flash_v2_5" });
    expect(audio.mimeType).toBe(PCM_MIME);
    expect(Array.from(audio.data)).toEqual([9, 8, 7]);
  });

  it("sends stability only when the voice sets it", async () => {
    const { p, calls } = make(() => pcm(1));
    await p.synthesize({ text: SPOKEN, voice: elevenVoice({ delivery: { stability: 0.7 } }), requestId: "r" });
    expect(bodyOf(calls[0]).voice_settings).toEqual({ stability: 0.7 });
  });

  it("refuses another provider's voice, a malformed voice id, an unsupported format and empty text without calling out", async () => {
    const { p, calls } = make(() => pcm(1));
    const ask = (voice: VoiceProfile, text = SPOKEN) => p.synthesize({ text, voice, requestId: "r" });
    await expect(ask(elevenVoice({ provider: "cartesia" }))).rejects.toThrow(/different provider/);
    await expect(ask(elevenVoice({ voiceId: "abc/../def" }))).rejects.toThrow(/Unrecognised ElevenLabs voice/);
    await expect(ask(elevenVoice({ targetFormat: "wav" }))).rejects.toThrow(/not supported/);
    await expect(ask(elevenVoice(), "")).rejects.toThrow(/nothing to say/);
    expect(calls).toHaveLength(0);
  });

  it("calls 409 and 429 busy, and reports every failure by status only", async () => {
    for (const status of [401, 402, 404, 409, 422, 429, 500]) {
      const { p } = make(() => new Response(JSON.stringify({ detail: { message: `${KEY} ${SPOKEN}` } }), { status }));
      const err = await failure(p.synthesize({ text: SPOKEN, voice: elevenVoice(), requestId: "r" }));
      expect(err.status).toBe(status);
      expect(err.message).toContain(String(status));
      expect(err.message).not.toContain(KEY);
      expect(err.message).not.toContain("Saturday");
      if (status === 409 || status === 429) expect(err.message).toMatch(/busy/);
    }
  });

  it("streams and surfaces a rejected key before any audio is returned", async () => {
    const bad = make(() => new Response("no", { status: 401 }));
    await expect(bad.p.synthesizeStream({ text: SPOKEN, voice: elevenVoice(), requestId: "r" })).rejects.toMatchObject({ status: 401 });
    const ok = make(() => pcm(5, 6));
    const { stream } = await ok.p.synthesizeStream({ text: SPOKEN, voice: elevenVoice(), requestId: "r" });
    expect(await drain(stream)).toEqual([5, 6]);
  });

  it("errors a stream that breaks midway instead of ending it quietly", async () => {
    const broken = new Response(
      new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new Uint8Array([1, 2]));
        },
        pull() {
          throw new Error("socket closed");
        },
      }),
      { status: 200 }
    );
    const { p } = make(() => broken);
    const { stream } = await p.synthesizeStream({ text: SPOKEN, voice: elevenVoice(), requestId: "r" });
    await expect(drain(stream)).rejects.toThrow(/interrupted/);
  });
});

describe("the router", () => {
  const deepgramVoice: VoiceProfile = {
    characterId: "char-ray-kowalski",
    provider: "deepgram",
    model: "aura-2",
    voiceId: "aura-2-aries-en",
    delivery: {},
    targetFormat: "pcm16",
    fallbackPolicy: "captions_only",
  };

  function routed() {
    const f = fakeFetch((call) => pcm(call.url.includes("deepgram") ? 1 : call.url.includes("cartesia") ? 2 : 3));
    const adapters = [
      new DeepgramTextToSpeechProvider({ apiKey: KEY, fetchImpl: f.impl }),
      new CartesiaTextToSpeechProvider({ apiKey: KEY, fetchImpl: f.impl }),
      new ElevenLabsTextToSpeechProvider({ apiKey: KEY, fetchImpl: f.impl }),
    ];
    return { router: new RoutingTextToSpeechProvider(adapters), calls: f.calls };
  }

  it("sends each line to the adapter its voice is pinned to", async () => {
    const { router, calls } = routed();
    const a = await router.synthesize({ text: SPOKEN, voice: deepgramVoice, requestId: "1" });
    const b = await router.synthesize({ text: SPOKEN, voice: cartesiaVoice(), requestId: "2" });
    const c = await router.synthesize({ text: SPOKEN, voice: elevenVoice(), requestId: "3" });
    expect([a, b, c].map((x) => x.data[0])).toEqual([1, 2, 3]);
    expect(calls.map((x) => new URL(x.url).hostname)).toEqual(["api.deepgram.com", "api.cartesia.ai", "api.elevenlabs.io"]);
  });

  it("streams through the matching adapter", async () => {
    const { router } = routed();
    const { stream } = await router.synthesizeStream({ text: SPOKEN, voice: cartesiaVoice(), requestId: "1" });
    expect(await drain(stream)).toEqual([2]);
  });

  it("refuses a voice whose provider has no adapter, and never substitutes another voice", async () => {
    const f = fakeFetch(() => pcm(1));
    const router = new RoutingTextToSpeechProvider([new DeepgramTextToSpeechProvider({ apiKey: KEY, fetchImpl: f.impl })]);
    await expect(router.synthesize({ text: SPOKEN, voice: elevenVoice(), requestId: "1" })).rejects.toThrow(/No voice provider/);
    await expect(router.synthesizeStream({ text: SPOKEN, voice: cartesiaVoice(), requestId: "1" })).rejects.toThrow(/No voice provider/);
    expect(f.calls).toHaveLength(0);
  });

  it("says which providers it serves, so a voice without a key is captions-only", () => {
    const f = fakeFetch(() => pcm(1));
    const router = new RoutingTextToSpeechProvider([
      new DeepgramTextToSpeechProvider({ apiKey: KEY, fetchImpl: f.impl }),
      new CartesiaTextToSpeechProvider({ apiKey: KEY, fetchImpl: f.impl }),
    ]);
    expect(ttsServes(router, "deepgram")).toBe(true);
    expect(ttsServes(router, "cartesia")).toBe(true);
    expect(ttsServes(router, "elevenlabs")).toBe(false);
    expect(ttsServes(new MockTextToSpeechProvider(), "deepgram")).toBe(false);
    // A single adapter serves only itself
    expect(ttsServes(new DeepgramTextToSpeechProvider({ apiKey: KEY }), "deepgram")).toBe(true);
    expect(ttsServes(new DeepgramTextToSpeechProvider({ apiKey: KEY }), "cartesia")).toBe(false);
  });
});
