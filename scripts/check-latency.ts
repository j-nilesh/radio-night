/**
 * scripts/check-latency.ts
 * DEVELOPMENT-ONLY. Measures time to first audio for one character's pinned
 * voice over several different short lines (so no provider cache helps), to tell
 * a one-off slow start from a pattern.
 *
 *   npx tsx scripts/check-latency.ts char-edna-marsh 8
 *
 * Spends roughly 80 characters per line on that voice's provider.
 */
import { config } from "dotenv";
import {
  CartesiaTextToSpeechProvider,
  DeepgramTextToSpeechProvider,
  ElevenLabsTextToSpeechProvider,
  RoutingTextToSpeechProvider,
  type TextToSpeechProvider,
} from "@providers";
import { NARRATOR_VOICE, VOICES } from "../content/cases/radio-night-s01/v1/voices";

config({ path: ".env.local", quiet: true });

const LINES = [
  "The back stairs? Staff use them, mostly. Ray carries ice up that way.",
  "I locked the front door at eleven, same as every Saturday.",
  "Mr. Fenn paid for the week in advance. Cash, which is not his habit.",
  "The kitchen was empty when I came through. The sink was wet.",
  "I have run this inn for twenty years, Detective. I notice things.",
  "Room five is at the far end. The carpet there is new this spring.",
  "Dennis has had three beers tonight. He usually stops at two.",
  "Mrs. Wentworth left by the side door. I saw her coat go past the window.",
  "I heard a door upstairs a little before ten. I thought nothing of it.",
  "You will want to speak with Ray. He was away from the bar a while.",
];

async function main() {
  const who = process.argv[2] ?? "char-edna-marsh";
  const n = Math.min(Number(process.argv[3] ?? 8), LINES.length);
  const voice = who === "char-narrator" ? NARRATOR_VOICE : VOICES[who];
  if (!voice) throw new Error(`No voice for ${who}`);
  const key = (k: string) => process.env[k]?.trim();
  const adapters: TextToSpeechProvider[] = [];
  if (key("DEEPGRAM_API_KEY")) adapters.push(new DeepgramTextToSpeechProvider({ apiKey: key("DEEPGRAM_API_KEY")! }));
  if (key("CARTESIA_API_KEY")) adapters.push(new CartesiaTextToSpeechProvider({ apiKey: key("CARTESIA_API_KEY")! }));
  if (key("ELEVENLABS_API_KEY")) adapters.push(new ElevenLabsTextToSpeechProvider({ apiKey: key("ELEVENLABS_API_KEY")! }));
  const tts = new RoutingTextToSpeechProvider(adapters);

  const times: number[] = [];
  for (const text of LINES.slice(0, n)) {
    const started = performance.now();
    try {
      const { stream } = await tts.synthesizeStream({ text, voice, requestId: "latency" });
      const reader = stream.getReader();
      let first = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!first && value?.byteLength) first = performance.now() - started;
      }
      times.push(Math.round(first));
      console.log(`${String(Math.round(first)).padStart(6)} ms  ${text.slice(0, 50)}`);
    } catch (err) {
      console.log(`  FAILED  ${err instanceof Error ? err.message : "unknown error"}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  const sorted = [...times].sort((a, b) => a - b);
  const pick = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  console.log(`\n${who} (${voice.provider}): ${times.length} lines, median ${pick(0.5)} ms, slowest ${sorted.at(-1)} ms, over 2 s: ${times.filter((t) => t > 2000).length}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
