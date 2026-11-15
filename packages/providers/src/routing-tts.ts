/**
 * providers/routing-tts.ts
 * One text-to-speech provider that hands each line to the adapter its voice is
 * pinned to. The cast uses voices from several providers (ADR 0011), so the
 * game needs a single provider object that serves them all.
 *
 * It never substitutes: a voice pinned to a provider that has no adapter here
 * (for example because its API key is not set) is refused, and the caller falls
 * back to captions for that line.
 * SERVER-ONLY.
 */
import type { TextToSpeechProvider, TTSRequest, TTSAudio, TTSStream, VoiceProfile } from "./types";
import { SpeechProviderError } from "./deepgram-stt";

/** Can this text-to-speech provider voice a line pinned to `provider`? */
export function ttsServes(tts: TextToSpeechProvider, provider: VoiceProfile["provider"]): boolean {
  if (tts.providerName === "mock") return false;
  return tts.servesProviders ? tts.servesProviders.includes(provider) : tts.providerName === provider;
}

export class RoutingTextToSpeechProvider implements TextToSpeechProvider {
  readonly providerName = "routed";
  readonly servesProviders: VoiceProfile["provider"][];
  readonly supportedFormats: VoiceProfile["targetFormat"][];
  private readonly byProvider: Map<string, TextToSpeechProvider>;

  constructor(adapters: TextToSpeechProvider[]) {
    if (adapters.length === 0) throw new Error("RoutingTextToSpeechProvider needs at least one adapter.");
    this.byProvider = new Map(adapters.map((a) => [a.providerName, a]));
    this.servesProviders = [...this.byProvider.keys()] as VoiceProfile["provider"][];
    this.supportedFormats = [...new Set(adapters.flatMap((a) => a.supportedFormats))];
  }

  private adapterFor(request: TTSRequest): TextToSpeechProvider {
    const adapter = this.byProvider.get(request.voice.provider);
    if (!adapter) throw new SpeechProviderError("No voice provider is available for this voice.");
    return adapter;
  }

  async synthesize(request: TTSRequest): Promise<TTSAudio> {
    return this.adapterFor(request).synthesize(request);
  }

  async synthesizeStream(request: TTSRequest): Promise<TTSStream> {
    const adapter = this.adapterFor(request);
    if (adapter.synthesizeStream) return adapter.synthesizeStream(request);
    // An adapter without streaming still works; it just cannot start early.
    const audio = await adapter.synthesize(request);
    return {
      mimeType: audio.mimeType,
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(audio.data);
          controller.close();
        },
      }),
    };
  }
}
