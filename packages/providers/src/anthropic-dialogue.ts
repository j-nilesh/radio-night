/**
 * providers/anthropic-dialogue.ts
 * Character dialogue through the Anthropic Messages API (POST /v1/messages).
 * SERVER-ONLY: it holds the API key.
 *
 * The provider is deliberately thin. The game builds the character's prompt
 * (ai-orchestration/persona-prompt.ts) and checks the reply afterwards
 * (ai-orchestration/reply-guard.ts); this only sends one and returns the other.
 * It never decides what is true and never commits anything.
 *
 * Latency: thinking is switched off on models that allow it (a spoken reply
 * needs to start in about a second). On models that refuse thinking:disabled
 * with a 400, the field is simply not sent.
 *
 * Neither the key, the prompt, nor the reply is logged; errors carry the HTTP
 * status only.
 */

import type { DialogueProvider, AuthorizedDialogueContext, ProposedResponse } from "./types";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2026-10-21";
export const DEFAULT_DIALOGUE_MODEL = "claude-haiku-5-5";
const DEFAULT_TIMEOUT_MS = 20_000;
/** A spoken reply is one to three sentences. This is a ceiling, not a target. */
const DEFAULT_MAX_TOKENS = 300;

/** Models that accept thinking:{type:"disabled"} (see the thinking docs' model table). */
const THINKING_CAN_BE_DISABLED = new Set(["claude-haiku-5-5", "claude-sonnet-5", "claude-opus-5", "claude-haiku-4-5-20251001"]);

export class DialogueProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "DialogueProviderError";
  }
}

export type AnthropicDialogueOptions = {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
  /** Injected in tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
};

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number };
};

export class AnthropicDialogueProvider implements DialogueProvider {
  readonly providerName = "anthropic";
  readonly modelId: string;

  private readonly apiKey: string;
  private readonly maxTokens: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: AnthropicDialogueOptions) {
    if (!opts.apiKey) throw new Error("AnthropicDialogueProvider requires an API key.");
    this.apiKey = opts.apiKey;
    this.modelId = opts.model ?? DEFAULT_DIALOGUE_MODEL;
    this.maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  /** The request body for a context. Exposed for tests. */
  buildBody(context: AuthorizedDialogueContext): Record<string, unknown> {
    const prompt = context.prompt;
    if (!prompt || prompt.messages.length === 0) {
      throw new DialogueProviderError("No prompt was built for this character.");
    }
    const last = prompt.messages[prompt.messages.length - 1];
    if (last.role !== "user") {
      throw new DialogueProviderError("The conversation must end with the detective's question.");
    }

    const body: Record<string, unknown> = {
      model: this.modelId,
      max_tokens: this.maxTokens,
      system: prompt.system,
      messages: prompt.messages,
    };
    if (THINKING_CAN_BE_DISABLED.has(this.modelId)) {
      body.thinking = { type: "disabled" };
    }
    return body;
  }

  async respond(context: AuthorizedDialogueContext): Promise<ProposedResponse> {
    const body = this.buildBody(context);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(ENDPOINT, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": API_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "AbortError";
      throw new DialogueProviderError(
        timedOut ? "The character took too long to answer." : "Could not reach the dialogue service."
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new DialogueProviderError(
        response.status === 429
          ? "The dialogue service is busy (HTTP 429)."
          : `The dialogue service failed (HTTP ${response.status}).`,
        response.status
      );
    }

    let data: AnthropicResponse;
    try {
      data = (await response.json()) as AnthropicResponse;
    } catch {
      throw new DialogueProviderError("The dialogue service returned an unreadable answer.");
    }

    // Thinking blocks (if any) are not the character speaking; only text is.
    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join(" ")
      .trim();

    if (!text) throw new DialogueProviderError("The character said nothing.");

    return {
      text,
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
        ...(data.usage?.cache_read_input_tokens ? { cachedInputTokens: data.usage.cache_read_input_tokens } : {}),
      },
    };
  }
}
