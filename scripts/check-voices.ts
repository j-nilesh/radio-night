/**
 * scripts/check-voices.ts
 * DEVELOPMENT-ONLY live smoke test for the locked cast. Speaks one short line
 * with each character's pinned voice through the real adapters and reports the
 * time to first audio and the length. Writes a WAV per voice to
 * reports/voice-check/ (gitignored) so the cast can be listened to.
 *
 *   npm run check:voices
 *
 * Spends a few hundred characters on each provider. A voice whose provider has
 * no key in .env.local is skipped with a one-line reason; it is never swapped.
 * Keys and spoken text are not printed beyond the fixed test line.
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CartesiaTextToSpeechProvider,
  DeepgramTextToSpeechProvider,
  ElevenLabsTextToSpeechProvider,
  RoutingTextToSpeechProvider,
  type TextToSpeechProvider,
  type VoiceProfile,
} from "@providers";
import { NARRATOR_VOICE, VOICES } from "../content/cases/radio-night-s01/v1/voices";

config({ path: ".env.local", quiet: true });

const LINE = "Millhaven, New Hampshire. Just past eleven, and the rain isn't letting up.";

function wav(pcm: Uint8Array, sampleRate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, Buffer.from(pcm)]);
}

async function main() {
  const adapters: TextToSpeechProvider[] = [];
  const key = (name: string) => process.env[name]?.trim();
  if (key("DEEPGRAM_API_KEY")) adapters.push(new DeepgramTextToSpeechProvider({ apiKey: key("DEEPGRAM_API_KEY")! }));
  if (key("CARTESIA_API_KEY")) adapters.push(new CartesiaTextToSpeechProvider({ apiKey: key("CARTESIA_API_KEY")! }));
  if (key("ELEVENLABS_API_KEY")) adapters.push(new ElevenLabsTextToSpeechProvider({ apiKey: key("ELEVENLABS_API_KEY")! }));
  if (adapters.length === 0) throw new Error("No voice keys found in .env.local.");
  const tts = new RoutingTextToSpeechProvider(adapters);

  const cast: VoiceProfile[] = [...Object.values(VOICES), NARRATOR_VOICE];
  const outDir = join(process.cwd(), "reports", "voice-check");
  mkdirSync(outDir, { recursive: true });

  let failed = 0;
  for (const voice of cast) {
    const label = `${voice.characterId.padEnd(24)} ${voice.provider.padEnd(10)}`;
    if (!tts.servesProviders.includes(voice.provider)) {
      console.log(`${label} SKIPPED: no ${voice.provider} key in .env.local`);
      failed++;
      continue;
    }
    const started = performance.now();
    try {
      const { stream, mimeType } = await tts.synthesizeStream({ text: LINE, voice, requestId: "check" });
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      let firstMs = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.byteLength > 0) {
          if (chunks.length === 0) firstMs = performance.now() - started;
          chunks.push(value);
        }
      }
      const pcm = Buffer.concat(chunks);
      const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1] ?? 24000);
      const seconds = pcm.length / (rate * 2);
      writeFileSync(join(outDir, `${voice.characterId}.wav`), wav(pcm, rate));
      const note = seconds < 2 || seconds > 12 ? "  <-- unexpected length" : "";
      console.log(`${label} ok  first audio ${Math.round(firstMs)} ms, ${seconds.toFixed(1)} s of speech${note}`);
      if (note) failed++;
    } catch (err) {
      failed++;
      console.log(`${label} FAILED: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }
  console.log(failed === 0 ? `\nAll voices spoke. WAV files are in ${outDir}` : `\n${failed} problem(s).`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
