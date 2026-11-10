/**
 * Contract tests for the Anthropic dialogue adapter. A fake fetch stands in for
 * the network, so these run offline and need no API key.
 */
import { describe, it, expect } from "vitest";
import { AnthropicDialogueProvider, DialogueProviderError } from "./anthropic-dialogue";
import type { AuthorizedDialogueContext } from "./types";

const KEY = "sk-test-do-not-leak-0123456789";

const ctx = (over: Partial<AuthorizedDialogueContext> = {}): AuthorizedDialogueContext => ({
  requestId: "r1",
  characterId: "char-ray-kowalski",
  characterName: "Ray Kowalski",
  speechStyle: "",
  publicBackstory: "",
  permittedFacts: [],
  playerQuestion: "Where were you?",
  previousClaims: [],
  periodConstraints: [],
  prompt: { system: "You are Ray.", messages: [{ role: "user", content: "Where were you?" }] },
  ...over,
});

type Call = { url: string; init: RequestInit };
function setup(respond: () => Response | Promise<Response>, model?: string) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return respond();
  }) as typeof fetch;
  return { p: new AnthropicDialogueProvider({ apiKey: KEY, fetchImpl: impl, model }), calls };
}
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const reply = (text: string) =>
  ok({ content: [{ type: "text", text }], usage: { input_tokens: 812, output_tokens: 24 } });

describe("request", () => {
  it("posts to the Messages API with the key, version, system prompt and messages", async () => {
    const { p, calls } = setup(() => reply("Behind the bar."));
    await p.respond(ctx());
    const { url, init } = calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const h = init.headers as Record<string, string>;
    expect(h["x-api-key"]).toBe(KEY);
    expect(h["anthropic-version"]).toBeTruthy();
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("claude-haiku-5-5");
    expect(body.system).toBe("You are Ray.");
    expect(body.messages).toEqual([{ role: "user", content: "Where were you?" }]);
    expect(body.max_tokens).toBeLessThanOrEqual(400);
  });

  it("switches thinking off on Haiku 5.5, for speed", () => {
    const { p } = setup(() => reply("x"));
    expect(p.buildBody(ctx()).thinking).toEqual({ type: "disabled" });
  });

  it("does not send thinking:disabled to a model that rejects it", () => {
    const { p } = setup(() => reply("x"), "claude-sonnet-5-5");
    expect(p.buildBody(ctx()).thinking).toBeUndefined();
  });

  it("refuses to call without a built prompt, or when the last message is not the question", async () => {
    const { p, calls } = setup(() => reply("x"));
    await expect(p.respond(ctx({ prompt: undefined }))).rejects.toBeInstanceOf(DialogueProviderError);
    await expect(
      p.respond(ctx({ prompt: { system: "s", messages: [{ role: "assistant", content: "hi" }] } }))
    ).rejects.toBeInstanceOf(DialogueProviderError);
    expect(calls).toHaveLength(0);
  });

  it("refuses to be built without a key", () => {
    expect(() => new AnthropicDialogueProvider({ apiKey: "" })).toThrow();
  });
});

describe("response", () => {
  it("returns the spoken text and token use", async () => {
    const { p } = setup(() => reply("Behind this bar, same as every Saturday."));
    const r = await p.respond(ctx());
    expect(r.text).toBe("Behind this bar, same as every Saturday.");
    expect(r.usage).toEqual({ inputTokens: 812, outputTokens: 24 });
  });

  it("ignores thinking blocks; only text is the character speaking", async () => {
    const { p } = setup(() =>
      ok({ content: [{ type: "thinking", thinking: "I killed him, must hide it" }, { type: "text", text: "The cellar." }] })
    );
    expect((await p.respond(ctx())).text).toBe("The cellar.");
  });

  it("treats an empty answer as a failure", async () => {
    const { p } = setup(() => ok({ content: [] }));
    await expect(p.respond(ctx())).rejects.toBeInstanceOf(DialogueProviderError);
  });
});

describe("failure modes", () => {
  it("reports a rejected key by status only", async () => {
    const { p } = setup(() => new Response(`invalid x-api-key ${KEY}`, { status: 401 }));
    const err = await p.respond(ctx()).catch((e) => e);
    expect(err).toBeInstanceOf(DialogueProviderError);
    expect(err.status).toBe(401);
    expect(err.message).not.toContain(KEY);
  });

  it("reports rate limiting distinctly", async () => {
    const { p } = setup(() => new Response("", { status: 429 }));
    expect((await p.respond(ctx()).catch((e) => e)).message).toMatch(/busy/);
  });

  it("does not leak the key or the prompt when the network fails", async () => {
    const { p } = setup(() => {
      throw new TypeError(`connect failed ${KEY} You are Ray.`);
    });
    const err = await p.respond(ctx()).catch((e) => e);
    expect(err.message).not.toContain(KEY);
    expect(err.message).not.toContain("You are Ray");
  });

  it("gives up after the timeout", async () => {
    const impl = ((_: unknown, init?: RequestInit) =>
      new Promise((_r, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const e = new Error("aborted");
          e.name = "AbortError";
          reject(e);
        });
      })) as typeof fetch;
    const p = new AnthropicDialogueProvider({ apiKey: KEY, fetchImpl: impl, timeoutMs: 25 });
    expect((await p.respond(ctx()).catch((e) => e)).message).toMatch(/too long/);
  });
});
