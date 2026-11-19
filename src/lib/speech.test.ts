/**
 * Tests for signed speech links, the synthesis cache, and the spend cap.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { VoiceProfile } from "@providers";

// A controllable stand-in for the live voice provider.
const synth = vi.fn();
const synthStream = vi.fn();
let providerName = "deepgram";
let streaming = true;
vi.mock("./providers", () => ({
  getProviders: () => ({
    tts: {
      providerName,
      synthesize: synth,
      ...(streaming ? { synthesizeStream: synthStream } : {}),
    },
  }),
}));

/** A stream that delivers the given chunks. */
function audioStream(...chunks: number[][]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(new Uint8Array(chunks[i++]));
      else controller.close();
    },
  });
}

async function drain(body: Uint8Array | ReadableStream<Uint8Array>): Promise<number[]> {
  if (body instanceof Uint8Array) return Array.from(body);
  const reader = body.getReader();
  const out: number[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out.push(...value);
  }
  return out;
}

/** Let the background cache-filling branch finish. */
const settle = () => new Promise((r) => setTimeout(r, 10));

import {
  signSpeech,
  verifySpeech,
  speechUrl,
  makeSpeaker,
  voiceForTurn,
  voiceForOpening,
  openSpeech,
  spendSpeechBudget,
  resetSpeechBudget,
  clearSpeechCache,
  SpeechBudgetExceeded,
} from "./speech";

const SECRET = "unit-test-secret-at-least-16-chars";

const v = (id: string, name: string): VoiceProfile => ({
  characterId: id,
  provider: "deepgram",
  model: "aura-2",
  voiceId: `aura-2-${name}-en`,
  delivery: {},
  targetFormat: "mp3",
  fallbackPolicy: "captions_only",
});
const RAY = v("char-ray-kowalski", "apollo");
const NARRATOR = v("char-narrator", "pluto");

beforeEach(() => {
  process.env.GUEST_TOKEN_SECRET = SECRET;
  delete process.env.TTS_DAILY_CHAR_BUDGET;
  providerName = "deepgram";
  streaming = true;
  synth.mockReset();
  synth.mockImplementation(async () => ({ data: new Uint8Array([1, 2, 3]), mimeType: "audio/mpeg" }));
  synthStream.mockReset();
  synthStream.mockImplementation(async () => ({ stream: audioStream([1, 2], [3]), mimeType: "audio/mpeg" }));
  resetSpeechBudget();
  clearSpeechCache();
});

describe("signed links", () => {
  it("round-trips the voice and the text", () => {
    const claim = verifySpeech(signSpeech(RAY, "Behind this bar, same as every Saturday."));
    expect(claim).toEqual({
      provider: "deepgram",
      model: "aura-2",
      voiceId: "aura-2-apollo-en",
      text: "Behind this bar, same as every Saturday.",
      format: "mp3",
    });
  });

  it("carries the audio format, so the server cannot be tricked into another", () => {
    const pcm = { ...RAY, targetFormat: "pcm16" as const };
    expect(verifySpeech(signSpeech(pcm, "Hello."))?.format).toBe("pcm16");
    const token = signSpeech(pcm, "Hello.");
    const [payload, sig] = token.split(".");
    const asMp3 = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), f: "mp3" })
    ).toString("base64url");
    expect(verifySpeech(`${asMp3}.${sig}`)).toBeNull();
  });

  it("rejects a token with an unknown format", () => {
    const payload = Buffer.from(JSON.stringify({ p: "deepgram", v: RAY.voiceId, t: "x", f: "wav" })).toString("base64url");
    expect(verifySpeech(`${payload}.${signSpeech(RAY, "x").split(".")[1]}`)).toBeNull();
  });

  it("survives awkward text", () => {
    const text = "“Quotes”, an em dash — and émigré; plus 100% & <tags>\nnew line";
    expect(verifySpeech(signSpeech(RAY, text))?.text).toBe(text);
  });

  it("rejects a token whose text was changed", () => {
    const token = signSpeech(RAY, "Say this.");
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ p: "deepgram", v: RAY.voiceId, t: "Say something else." })).toString("base64url");
    expect(verifySpeech(`${forged}.${sig}`)).toBeNull();
  });

  it("carries the pinned model, so a model cannot be swapped without breaking the signature", () => {
    const eleven = { ...RAY, provider: "elevenlabs" as const, model: "eleven_flash_v2_5", voiceId: "aIu5oHglU5AHNc2x0AZu" };
    expect(verifySpeech(signSpeech(eleven, "Hello."))?.model).toBe("eleven_flash_v2_5");
    const [payload, sig] = signSpeech(eleven, "Hello.").split(".");
    const swapped = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), m: "eleven_multilingual_v2" })).toString("base64url");
    expect(verifySpeech(`${swapped}.${sig}`)).toBeNull();
  });
  it("rejects a token whose voice was changed", () => {
    const token = signSpeech(RAY, "Say this.");
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ p: "deepgram", v: "aura-2-pluto-en", t: "Say this." })).toString("base64url");
    expect(verifySpeech(`${forged}.${sig}`)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = signSpeech(RAY, "Say this.");
    process.env.GUEST_TOKEN_SECRET = "a-completely-different-secret-value";
    expect(verifySpeech(token)).toBeNull();
  });

  it("rejects garbage, missing signatures, and oversized tokens", () => {
    for (const bad of ["", "abc", "abc.def", ".", "a.b.c", "x".repeat(20_000)]) {
      expect(verifySpeech(bad)).toBeNull();
    }
  });

  it("rejects a correctly signed payload that is not a speech claim", () => {
    const payload = Buffer.from(JSON.stringify({ hello: "world" })).toString("base64url");
    // Sign it the way the server would, to prove the shape check is separate from the signature.
    const token = signSpeech(RAY, "x");
    expect(verifySpeech(`${payload}.${token.split(".")[1]}`)).toBeNull();
  });
});

describe("links within a visitor's voice allowance", () => {
  const session = (used: number, allowance: number | null = 100) => ({ id: "sess-1", voiceCharsUsed: used, voiceCharsAllowance: allowance });
  it("signs the visitor's session into each link, so the line is charged to them", () => {
    const url = makeSpeaker(session(0)).url(RAY, "Hello there.")!;
    const claim = verifySpeech(decodeURIComponent(url.split("t=")[1]));
    expect(claim?.sessionId).toBe("sess-1");
  });
  it("stops handing out links once the allowance is spent, and says so", () => {
    const speaker = makeSpeaker(session(0, 30));
    expect(speaker.url(RAY, "x".repeat(20))).toBeDefined();
    expect(speaker.limitReached).toBe(false);
    expect(speaker.url(RAY, "y".repeat(20))).toBeUndefined(); // 20 more would pass 30
    expect(speaker.limitReached).toBe(true);
    expect(speaker.url(RAY, "z".repeat(5))).toBeDefined(); // a short line still fits
  });
  it("gives nothing to a visitor who has used it all", () => {
    const speaker = makeSpeaker(session(100, 100));
    expect(speaker.url(RAY, "Hello.")).toBeUndefined();
    expect(speaker.limitReached).toBe(true);
  });
  it("a session id cannot be swapped without breaking the signature", () => {
    const token = decodeURIComponent(makeSpeaker(session(0)).url(RAY, "Hello.")!.split("t=")[1]);
    const [payload, sig] = token.split(".");
    const swapped = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), s: "someone-else" })).toString("base64url");
    expect(verifySpeech(`${swapped}.${sig}`)).toBeNull();
  });
});

describe("handing out links", () => {
  it("returns a link only when a real voice is live and matches the pinned provider", () => {
    expect(speechUrl(RAY, "Hello.")).toMatch(/^\/api\/speech\?t=/);
  });

  it("returns nothing on the silent mock", () => {
    providerName = "mock";
    expect(speechUrl(RAY, "Hello.")).toBeUndefined();
  });

  it("returns nothing when the voice is pinned to a provider that is not live", () => {
    expect(speechUrl({ ...RAY, provider: "elevenlabs" }, "Hello.")).toBeUndefined();
  });

  it("returns nothing for no voice, empty text, or absurdly long text", () => {
    expect(speechUrl(undefined, "Hello.")).toBeUndefined();
    expect(speechUrl(RAY, "   ")).toBeUndefined();
    expect(speechUrl(RAY, "x".repeat(5000))).toBeUndefined();
  });
});

describe("who speaks", () => {
  const c = {
    narratorVoice: NARRATOR,
    characters: [
      { id: "char-ray-kowalski", name: "Ray Kowalski", voiceProfile: RAY },
      { id: "char-nobody", name: "Nobody" },
    ],
  } as never;

  const reply = (over = {}) => ({ responseText: "Hello.", classification: { category: "IN_SCOPE" }, ...over });

  it("a character's reply is spoken by that character", () => {
    expect(voiceForTurn(c, reply(), "char-ray-kowalski")).toBe(RAY);
  });

  it("a deflection is still in the character's voice", () => {
    expect(voiceForTurn(c, reply({ classification: { category: "INAPPROPRIATE" } }), "char-ray-kowalski")).toBe(RAY);
  });

  it("a recap is the narrator's", () => {
    expect(voiceForTurn(c, reply({ classification: { category: "CONTROL_COMMAND" } }), "char-ray-kowalski")).toBe(NARRATOR);
  });

  it("a game notice is not voiced", () => {
    expect(voiceForTurn(c, reply({ systemMessage: true }), "char-ray-kowalski")).toBeUndefined();
  });

  it("an empty reply, or a character with no cast voice, is not voiced", () => {
    expect(voiceForTurn(c, reply({ responseText: "" }), "char-ray-kowalski")).toBeUndefined();
    expect(voiceForTurn(c, reply(), "char-nobody")).toBeUndefined();
    expect(voiceForTurn(c, reply(), "char-unknown")).toBeUndefined();
  });

  it("opening lines use the narrator or the named character", () => {
    expect(voiceForOpening(c, { actor: "narrator" })).toBe(NARRATOR);
    expect(voiceForOpening(c, { actor: "character", speakerName: "Ray Kowalski" })).toBe(RAY);
    expect(voiceForOpening(c, { actor: "character", speakerName: "Someone Else" })).toBeUndefined();
  });
});

describe("streaming and cache", () => {
  const claim = { provider: "deepgram" as const, voiceId: "aura-2-apollo-en", format: "mp3" as const, text: "Same line." };

  it("streams a new line to the listener as it is produced", async () => {
    const opened = await openSpeech(claim);
    expect(opened.cached).toBe(false);
    expect(opened.body).toBeInstanceOf(ReadableStream);
    expect(opened.mimeType).toBe("audio/mpeg");
    expect(await drain(opened.body)).toEqual([1, 2, 3]);
  });

  it("serves a repeated line from the cache, without asking the provider again", async () => {
    await drain((await openSpeech(claim)).body);
    await settle();

    const again = await openSpeech(claim);
    expect(again.cached).toBe(true);
    expect(await drain(again.body)).toEqual([1, 2, 3]);
    expect(synthStream).toHaveBeenCalledTimes(1);
  });

  it("still caches the line when the listener walks away", async () => {
    const opened = await openSpeech(claim);
    await (opened.body as ReadableStream<Uint8Array>).cancel();
    await settle();

    expect((await openSpeech(claim)).cached).toBe(true);
    expect(synthStream).toHaveBeenCalledTimes(1);
  });

  it("never caches a line that was interrupted midway", async () => {
    synthStream.mockImplementationOnce(async () => ({
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([9]));
          controller.error(new Error("socket died"));
        },
      }),
      mimeType: "audio/mpeg",
    }));
    const opened = await openSpeech(claim);
    await drain(opened.body).catch(() => undefined);
    await settle();

    const retry = await openSpeech(claim);
    expect(retry.cached).toBe(false);
    expect(await drain(retry.body)).toEqual([1, 2, 3]);
  });

  it("treats a different voice or different text as a different line", async () => {
    await drain((await openSpeech(claim)).body);
    await drain((await openSpeech({ ...claim, voiceId: "aura-2-pluto-en" })).body);
    await drain((await openSpeech({ ...claim, text: "Other line." })).body);
    expect(synthStream).toHaveBeenCalledTimes(3);
  });

  it("falls back to whole-file synthesis for a provider that cannot stream", async () => {
    streaming = false;
    const opened = await openSpeech(claim);
    expect(await drain(opened.body)).toEqual([1, 2, 3]);
    expect(synth).toHaveBeenCalledTimes(1);
    expect((await openSpeech(claim)).cached).toBe(true);
  });

  it("does not cache or charge for a start that failed, so a retry can succeed", async () => {
    process.env.TTS_DAILY_CHAR_BUDGET = String(claim.text.length);
    synthStream.mockRejectedValueOnce(new Error("Voice synthesis failed (HTTP 503)."));
    await expect(openSpeech(claim)).rejects.toThrow();
    // The failed attempt was refunded, so the full budget is still available.
    await expect(openSpeech(claim)).resolves.toBeDefined();
  });
});

describe("simultaneous requests for one line", () => {
  const claim = { provider: "deepgram" as const, voiceId: "aura-2-apollo-en", format: "pcm16" as const, text: "One line." };

  /** A stream the test releases chunk by chunk, so requests can overlap. */
  function gatedStream() {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        await gate;
        controller.enqueue(new Uint8Array([3, 4]));
        controller.close();
      },
    });
    return { stream, release };
  }

  it("synthesises once, and every request hears the whole line (the double-fetch bug)", async () => {
    const g = gatedStream();
    synthStream.mockReset();
    synthStream.mockImplementation(async () => ({ stream: g.stream, mimeType: "audio/L16;rate=24000" }));

    const first = await openSpeech(claim);
    const second = await openSpeech(claim); // arrives while the first is still streaming
    const late = await openSpeech(claim);

    expect([first.source, second.source, late.source]).toEqual(["new", "shared", "shared"]);
    g.release();
    const all = await Promise.all([drain(first.body), drain(second.body), drain(late.body)]);
    expect(all).toEqual([[1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4]]);
    expect(synthStream).toHaveBeenCalledTimes(1);
  });

  it("charges the spend cap once for the shared line", async () => {
    process.env.TTS_DAILY_CHAR_BUDGET = String(claim.text.length); // room for exactly one synthesis
    const a = await openSpeech(claim);
    const b = await openSpeech(claim);
    await Promise.all([drain(a.body), drain(b.body)]);
    expect(synthStream).toHaveBeenCalledTimes(1);
  });

  it("a listener who joins late still gets the beginning", async () => {
    const g = gatedStream();
    synthStream.mockReset();
    synthStream.mockImplementation(async () => ({ stream: g.stream, mimeType: "audio/L16;rate=24000" }));
    const first = await openSpeech(claim);
    await new Promise((r) => setTimeout(r, 20)); // first chunk already delivered upstream
    const late = await openSpeech(claim);
    g.release();
    expect(await drain(late.body)).toEqual([1, 2, 3, 4]);
    await drain(first.body);
  });

  it("an interrupted shared line fails every listener and is not cached", async () => {
    synthStream.mockReset();
    synthStream.mockImplementation(async () => ({
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([9]));
          setTimeout(() => controller.error(new Error("socket died")), 10);
        },
      }),
      mimeType: "audio/L16;rate=24000",
    }));
    const a = await openSpeech(claim);
    const b = await openSpeech(claim);
    await expect(drain(a.body)).rejects.toThrow();
    await expect(drain(b.body)).rejects.toThrow();
    await settle();
    expect((await openSpeech(claim)).source).toBe("new");
  });
});

describe("spend cap", () => {
  it("allows spending up to the cap and refuses beyond it", () => {
    process.env.TTS_DAILY_CHAR_BUDGET = "100";
    spendSpeechBudget(60);
    spendSpeechBudget(40);
    expect(() => spendSpeechBudget(1)).toThrow(SpeechBudgetExceeded);
  });

  it("stops new synthesis once the cap is reached, but still serves cached lines", async () => {
    process.env.TTS_DAILY_CHAR_BUDGET = "30";
    const a = { provider: "deepgram" as const, voiceId: "aura-2-apollo-en", format: "mp3" as const, text: "x".repeat(25) };
    const b = { ...a, text: "y".repeat(25) };

    await drain((await openSpeech(a)).body);
    await settle();
    await expect(openSpeech(b)).rejects.toBeInstanceOf(SpeechBudgetExceeded);
    await expect(openSpeech(a)).resolves.toMatchObject({ cached: true }); // free
    expect(synthStream).toHaveBeenCalledTimes(1);
  });

  it("a cap of zero switches voice off", async () => {
    process.env.TTS_DAILY_CHAR_BUDGET = "0";
    await expect(
      openSpeech({ provider: "deepgram", voiceId: "aura-2-apollo-en", format: "mp3", text: "Hi." })
    ).rejects.toBeInstanceOf(SpeechBudgetExceeded);
    expect(synthStream).not.toHaveBeenCalled();
  });
});
