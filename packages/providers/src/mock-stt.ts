/**
 * providers/mock-stt.ts
 * Mock STT provider for development and testing.
 * Returns the provided text verbatim (simulates perfect transcription).
 */

import type { SpeechToTextProvider, SpeechContext, TranscriptResult } from "./types";

/** Decodes audio bytes as UTF-8 text (used by test harnesses to inject text) */
function decodeTestText(audio: Uint8Array): string {
  try {
    return new TextDecoder().decode(audio);
  } catch {
    return "[mock audio input]";
  }
}

export class MockSpeechToTextProvider implements SpeechToTextProvider {
  readonly providerName = "mock";

  async transcribe(audio: Uint8Array, _context: SpeechContext): Promise<TranscriptResult> {
    // Simulate a small network delay
    await new Promise((r) => setTimeout(r, 50));

    const text = decodeTestText(audio);

    return {
      text,
      confidence: 0.99,
      durationMs: Math.floor(text.length * 60), // rough estimate
    };
  }
}
