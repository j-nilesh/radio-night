/**
 * lib/providers.ts
 * Provider factory — real or mock, per capability, from environment config.
 * SERVER-ONLY: this is the only place API keys are read.
 *
 * Rules:
 *   - DISABLE_AI_PROVIDERS=true forces every provider to its mock (cost kill switch).
 *   - USE_REAL_PROVIDERS must be "true" for any real provider to be considered.
 *   - Each capability goes live independently, when its own key is present.
 *     Today only speech-to-text (Deepgram) has a real implementation; text-to-speech
 *     and dialogue stay on mocks until the voice auditions pick providers.
 */

import type { ProviderConfig } from "@providers";
import {
  MockSpeechToTextProvider,
  MockTextToSpeechProvider,
  MockDialogueProvider,
  DeepgramSpeechToTextProvider,
} from "@providers";

let _providers: ProviderConfig | null = null;

export function getProviders(): ProviderConfig {
  if (_providers) return _providers;

  const killSwitch = process.env.DISABLE_AI_PROVIDERS === "true";
  const wantsReal = process.env.USE_REAL_PROVIDERS === "true" && !killSwitch;
  const deepgramKey = process.env.DEEPGRAM_API_KEY?.trim();

  let stt: ProviderConfig["stt"] = new MockSpeechToTextProvider();
  if (wantsReal) {
    if (deepgramKey) {
      stt = new DeepgramSpeechToTextProvider({ apiKey: deepgramKey });
    } else {
      console.warn("[providers] USE_REAL_PROVIDERS=true but DEEPGRAM_API_KEY is not set. Speech input stays on the mock.");
    }
  }

  _providers = {
    stt,
    tts: new MockTextToSpeechProvider(),
    dialogue: new MockDialogueProvider(),
  };

  // Names only, never keys.
  console.info(
    `[providers] stt=${_providers.stt.providerName} tts=${_providers.tts.providerName} dialogue=${_providers.dialogue.providerName}`
  );
  return _providers;
}
