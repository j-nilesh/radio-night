/**
 * Contract tests for the Deepgram adapter. A fake fetch stands in for the
 * network, so these run offline and need no API key.
 */

import { describe, it, expect } from "vitest";
import {
  DeepgramSpeechToTextProvider,
  SpeechProviderError,
  cleanMediaType,
} from "./deepgram-stt";

const KEY = "test-key-do-not-leak-0123456789";
const audio = new Uint8Array([1, 2, 3, 4, 5]);

type Call = { url: string; init: RequestInit };

function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return respond();
  }) as typeof fetch;
  return { impl, calls };
}

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

const goodBody = {
  metadata: { duration: 2.5 },
  results: {
    channels: [
      {
        alternatives: [
          {
            transcript: "Was Ray behind the bar all night?",
            confidence: 0.97,
            words: [
              { word: "was", start: 0.1, end: 0.3 },
              { word: "ray", start: 0.3, end: 0.5 },
            ],
          },
        ],
      },
    ],
  },
};

function provider(respond: () => Response | Promise<Response>, extra: { timeoutMs?: number } = {}) {
  const { impl, calls } = fakeFetch(respond);
  return { p: new DeepgramSpeechToTextProvider({ apiKey: KEY, fetchImpl: impl, ...extra }), calls };
}

describe("request", () => {
  it("posts the raw bytes with token auth and the recording's media type", async () => {
    const { p, calls } = provider(() => ok(goodBody));
    await p.transcribe(audio, { mimeType: "audio/webm;codecs=opus" });

    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    expect(url.startsWith("https://api.deepgram.com/v1/listen?")).toBe(true);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Token ${KEY}`);
    expect(headers["Content-Type"]).toBe("audio/webm");
    expect(init.body).toBe(audio);
  });

  it("asks for nova-3, English, smart formatting", () => {
    const { p } = provider(() => ok(goodBody));
    const params = new URL(p.buildUrl({})).searchParams;
    expect(params.get("model")).toBe("nova-3");
    expect(params.get("language")).toBe("en");
    expect(params.get("smart_format")).toBe("true");
  });

  it("repeats the keyterm parameter for each term and encodes multi-word phrases", () => {
    const { p } = provider(() => ok(goodBody));
    const url = new URL(p.buildUrl({ keyterms: ["Kowalski", "Bridgewater Inn", "  ", "Fenn"] }));
    expect(url.searchParams.getAll("keyterm")).toEqual(["Kowalski", "Bridgewater Inn", "Fenn"]);
  });

  it("sends at most 100 keyterms", () => {
    const { p } = provider(() => ok(goodBody));
    const many = Array.from({ length: 150 }, (_, i) => `term${i}`);
    expect(new URL(p.buildUrl({ keyterms: many })).searchParams.getAll("keyterm")).toHaveLength(100);
  });

  it("omits Content-Type rather than guessing when the format is unknown", async () => {
    const { p, calls } = provider(() => ok(goodBody));
    await p.transcribe(audio, {});
    expect((calls[0].init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("refuses to be built without a key", () => {
    expect(() => new DeepgramSpeechToTextProvider({ apiKey: "" })).toThrow();
  });
});

describe("response", () => {
  it("returns the transcript, confidence, duration and word timings", async () => {
    const { p } = provider(() => ok(goodBody));
    const r = await p.transcribe(audio, {});
    expect(r.text).toBe("Was Ray behind the bar all night?");
    expect(r.confidence).toBeCloseTo(0.97);
    expect(r.durationMs).toBe(2500);
    expect(r.words?.[1]).toEqual({ word: "ray", startMs: 300, endMs: 500 });
  });

  it("treats silence as an empty transcript with zero confidence, not an error", async () => {
    const { p } = provider(() =>
      ok({ metadata: { duration: 1 }, results: { channels: [{ alternatives: [{ transcript: "", confidence: 0 }] }] } })
    );
    const r = await p.transcribe(audio, {});
    expect(r.text).toBe("");
    expect(r.confidence).toBe(0);
  });

  it("copes with a response that has no results at all", async () => {
    const { p } = provider(() => ok({}));
    const r = await p.transcribe(audio, {});
    expect(r).toMatchObject({ text: "", confidence: 0 });
  });

  it("clamps an out-of-range confidence", async () => {
    const { p } = provider(() =>
      ok({ results: { channels: [{ alternatives: [{ transcript: "hello", confidence: 7 }] }] } })
    );
    expect((await p.transcribe(audio, {})).confidence).toBe(1);
  });
});

describe("failure modes", () => {
  it("surfaces a rejected key as a provider error, without leaking the key", async () => {
    const { p } = provider(() => new Response(`{"err":"bad key ${KEY}"}`, { status: 401 }));
    const err = await p.transcribe(audio, {}).catch((e) => e);
    expect(err).toBeInstanceOf(SpeechProviderError);
    expect(err.status).toBe(401);
    expect(String(err.message)).not.toContain(KEY);
    expect(String(err.message)).not.toContain("bad key");
  });

  it("surfaces a network failure without leaking the key", async () => {
    const { p } = provider(() => {
      throw new TypeError(`connect failed for Token ${KEY}`);
    });
    const err = await p.transcribe(audio, {}).catch((e) => e);
    expect(err).toBeInstanceOf(SpeechProviderError);
    expect(String(err.message)).not.toContain(KEY);
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
    const p = new DeepgramSpeechToTextProvider({ apiKey: KEY, fetchImpl: impl, timeoutMs: 25 });
    const err = await p.transcribe(audio, {}).catch((e) => e);
    expect(err).toBeInstanceOf(SpeechProviderError);
    expect(err.message).toMatch(/timed out/);
  });

  it("rejects an unreadable answer", async () => {
    const { p } = provider(() => new Response("<html>oops</html>", { status: 200 }));
    await expect(p.transcribe(audio, {})).rejects.toBeInstanceOf(SpeechProviderError);
  });
});

describe("cleanMediaType", () => {
  it("drops codec parameters", () => {
    expect(cleanMediaType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(cleanMediaType("audio/mp4")).toBe("audio/mp4");
  });
  it("rejects anything that is not a plain audio or video type", () => {
    expect(cleanMediaType("text/html")).toBeUndefined();
    expect(cleanMediaType("audio/webm\r\nX-Injected: 1")).toBeUndefined();
    expect(cleanMediaType("")).toBeUndefined();
    expect(cleanMediaType(undefined)).toBeUndefined();
  });
});
