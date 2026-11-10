/**
 * providers/mock-stt.ts
 * Mock STT provider for development and testing.
 *
 * It cannot recognise speech. Test harnesses feed it plain UTF-8 text as "audio",
 * and it hands that text back. Anything that is not clean text, such as a real
 * microphone recording, is reported as untranscribable with zero confidence.
 * It must never turn binary audio into characters: that produces garbage which
 * the game would then treat as the player's question.
 */

import type { SpeechToTextProvider, SpeechContext, TranscriptResult } from "./types";

const MAX_TEST_TEXT_LENGTH = 1000;
// Letters, numbers, punctuation, symbols, spaces. No control characters.
const CLEAN_TEXT = /^[\p{L}\p{N}\p{P}\p{S}\p{Zs}]+$/u;

/** Returns the bytes as text only if they are valid, clean UTF-8; otherwise null. */
function decodeTestText(audio: Uint8Array): string | null {
  if (audio.length === 0 || audio.length > MAX_TEST_TEXT_LENGTH * 4) return null;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(audio).trim();
    return text.length > 0 && text.length <= MAX_TEST_TEXT_LENGTH && CLEAN_TEXT.test(text)
      ? text
      : null;
  } catch {
    return null;
  }
}

export class MockSpeechToTextProvider implements SpeechToTextProvider {
  readonly providerName = "mock";

  async transcribe(audio: Uint8Array, _context: SpeechContext): Promise<TranscriptResult> {
    // Simulate a small network delay
    await new Promise((r) => setTimeout(r, 50));

    const text = decodeTestText(audio);
    if (text === null) {
      return { text: "", confidence: 0, durationMs: 0 };
    }

    return {
      text,
      confidence: 0.99,
      durationMs: Math.floor(text.length * 60), // rough estimate
    };
  }
}
