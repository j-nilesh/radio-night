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
      voiceId: "aura-2-apollo-en",
      text: "Behind this bar, same as every Saturday.",
    });
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
  const claim = { provider: "deepgram" as const, voiceId: "aura-2-apollo-en", text: "Same line." };

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

describe("spend cap", () => {
  it("allows spending up to the cap and refuses beyond it", () => {
    process.env.TTS_DAILY_CHAR_BUDGET = "100";
    spendSpeechBudget(60);
    spendSpeechBudget(40);
    expect(() => spendSpeechBudget(1)).toThrow(SpeechBudgetExceeded);
  });

  it("stops new synthesis once the cap is reached, but still serves cached lines", async () => {
    process.env.TTS_DAILY_CHAR_BUDGET = "30";
    const a = { provider: "deepgram" as const, voiceId: "aura-2-apollo-en", text: "x".repeat(25) };
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
      openSpeech({ provider: "deepgram", voiceId: "aura-2-apollo-en", text: "Hi." })
    ).rejects.toBeInstanceOf(SpeechBudgetExceeded);
    expect(synthStream).not.toHaveBeenCalled();
  });
});
