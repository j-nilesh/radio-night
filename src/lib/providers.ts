/**
 * lib/providers.ts
 * Provider factory — real or mock, per capability, from environment config.
 * SERVER-ONLY: this is the only place API keys are read.
 *
 * Rules:
 *   - DISABLE_AI_PROVIDERS=true forces every provider to its mock (cost kill switch).
 *   - USE_REAL_PROVIDERS must be "true" for any real provider to be considered.
 *   - Each capability goes live independently, when its own key is present.
 *     Speech-to-text and text-to-speech use Deepgram (DEEPGRAM_API_KEY).
 *     Character dialogue uses Anthropic when LLM_PROVIDER=anthropic and
 *     ANTHROPIC_API_KEY is set (model: ANTHROPIC_MODEL, default claude-haiku-5-5).
 */

import type { ProviderConfig } from "@providers";
import {
  MockSpeechToTextProvider,
  MockTextToSpeechProvider,
  MockDialogueProvider,
  DeepgramSpeechToTextProvider,
  DeepgramTextToSpeechProvider,
  AnthropicDialogueProvider,
} from "@providers";

let _providers: ProviderConfig | null = null;

export function getProviders(): ProviderConfig {
  if (_providers) return _providers;

  const killSwitch = process.env.DISABLE_AI_PROVIDERS === "true";
  const wantsReal = process.env.USE_REAL_PROVIDERS === "true" && !killSwitch;
  const deepgramKey = process.env.DEEPGRAM_API_KEY?.trim();

  let stt: ProviderConfig["stt"] = new MockSpeechToTextProvider();
  let tts: ProviderConfig["tts"] = new MockTextToSpeechProvider();
  if (wantsReal) {
    if (deepgramKey) {
      stt = new DeepgramSpeechToTextProvider({ apiKey: deepgramKey });
      tts = new DeepgramTextToSpeechProvider({ apiKey: deepgramKey });
    } else {
      console.warn("[providers] USE_REAL_PROVIDERS=true but DEEPGRAM_API_KEY is not set. Speech input and voice stay on the mock.");
    }
  }

  let dialogue: ProviderConfig["dialogue"] = new MockDialogueProvider();
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (wantsReal && process.env.LLM_PROVIDER === "anthropic") {
    if (anthropicKey) {
      dialogue = new AnthropicDialogueProvider({
        apiKey: anthropicKey,
        model: process.env.ANTHROPIC_MODEL?.trim() || undefined,
      });
    } else {
      console.warn("[providers] LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set. Dialogue stays on the mock.");
    }
  }

  _providers = { stt, tts, dialogue };

  // Names only, never keys.
  console.info(
    `[providers] stt=${_providers.stt.providerName} tts=${_providers.tts.providerName} dialogue=${_providers.dialogue.providerName} (${_providers.dialogue.modelId})`
  );
  return _providers;
}
