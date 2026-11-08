/**
 * lib/providers.ts
 * Provider factory — returns mock or real providers based on env config.
 * SERVER-ONLY.
 */

import type { ProviderConfig } from "@providers";
import {
  MockSpeechToTextProvider,
  MockTextToSpeechProvider,
  MockDialogueProvider,
} from "@providers";

let _providers: ProviderConfig | null = null;

export function getProviders(): ProviderConfig {
  if (_providers) return _providers;

  const useReal = process.env.USE_REAL_PROVIDERS === "true";
  const disabled = process.env.DISABLE_AI_PROVIDERS === "true";

  if (disabled || !useReal) {
    // Always use mocks in development / test / kill-switch mode
    _providers = {
      stt: new MockSpeechToTextProvider(),
      tts: new MockTextToSpeechProvider(),
      dialogue: new MockDialogueProvider(),
    };
    return _providers;
  }

  // Real providers — loaded lazily to avoid importing keys in test/build
  // TODO: swap in real providers here as they're wired up in Step 2 auditions
  console.warn(
    "[providers] USE_REAL_PROVIDERS=true but real providers not yet implemented. Falling back to mocks."
  );
  _providers = {
    stt: new MockSpeechToTextProvider(),
    tts: new MockTextToSpeechProvider(),
    dialogue: new MockDialogueProvider(),
  };
  return _providers;
}
