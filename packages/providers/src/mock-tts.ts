/**
 * providers/mock-tts.ts
 * Mock TTS provider for development and testing.
 * Returns silent audio bytes with the response text encoded in the first bytes
 * so tests can assert on the content without needing real audio hardware.
 */

import type { TextToSpeechProvider, TTSRequest, TTSAudio, VoiceProfile } from "./types";

export class MockTextToSpeechProvider implements TextToSpeechProvider {
  readonly providerName = "mock";
  readonly supportedFormats: VoiceProfile["targetFormat"][] = ["wav", "mp3", "opus", "pcm16"];

  async synthesize(request: TTSRequest): Promise<TTSAudio> {
    // Simulate a small synthesis delay
    await new Promise((r) => setTimeout(r, 80));

    // Encode the text as UTF-8 bytes (usable in tests to verify content)
    const textBytes = new TextEncoder().encode(request.text);
    // Prepend a fake WAV header marker for integration tests
    const marker = new TextEncoder().encode("MOCK_TTS:");
    const combined = new Uint8Array(marker.length + textBytes.length);
    combined.set(marker, 0);
    combined.set(textBytes, marker.length);

    return {
      data: combined,
      mimeType: "audio/wav",
      sampleRate: 22050,
      durationMs: Math.floor(request.text.split(" ").length * 400), // rough estimate
    };
  }
}
