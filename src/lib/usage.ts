/**
 * lib/usage.ts
 * Recording what each provider call costs, for the owner's usage page (ADR 0014).
 * SERVER-ONLY. Records carry a provider, a feature, units and an estimated cost:
 * never any player text.
 *
 * Costs are estimates from list prices and the plans in use (November 2026). They
 * are there to show trends and catch a runaway, not to reconcile a bill: the
 * provider dashboards are the source of truth.
 */
import { getStore, type UsageEntry } from "./store";

/** US dollars per 1,000 characters of speech. ElevenLabs is the $5 plan's credits per character. */
const TTS_PER_1K: Record<string, number> = { deepgram: 0.03, cartesia: 0.05, elevenlabs: 0.17 };
/** Deepgram Nova-3, pre-recorded, per minute of audio. */
const STT_PER_MINUTE = 0.0043;
/** Anthropic Haiku-class model, per million tokens (input, output). */
const LLM_PER_MILLION = { input: 1, output: 5 };

export function ttsCost(provider: string, chars: number): number {
  return ((TTS_PER_1K[provider] ?? 0.1) * chars) / 1000;
}
export function sttCost(seconds: number): number {
  return (STT_PER_MINUTE * seconds) / 60;
}
export function llmCost(inputTokens: number, outputTokens: number): number {
  return (LLM_PER_MILLION.input * inputTokens + LLM_PER_MILLION.output * outputTokens) / 1_000_000;
}

/** Record one call. Never throws: losing a usage row must not break the game. */
export async function recordUsage(entry: UsageEntry): Promise<void> {
  try {
    await getStore().recordUsage(entry);
  } catch (err) {
    console.warn("[usage] not recorded:", err instanceof Error ? err.message : "unknown error");
  }
}
