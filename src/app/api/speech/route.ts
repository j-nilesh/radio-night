/**
 * GET /api/speech?t=<signed token>
 * Returns the spoken audio for a line the game itself produced.
 *
 * Security:
 *   - The token is an HMAC-signed {voice, text, format} issued by the server.
 *     Without a valid signature nothing is synthesised, so this cannot be used
 *     to voice arbitrary text on your Deepgram account.
 *   - A voice pinned to a provider other than the live one is refused: voice
 *     identity never switches silently.
 *   - Daily character budget (TTS_DAILY_CHAR_BUDGET) caps spend. A line is
 *     synthesised once however many requests ask for it; repeats are cached.
 *   - Failures return a status only. The client keeps showing captions.
 *
 * Delivery: raw 16-bit PCM is streamed as it is produced, so the browser can
 * start playing within a fraction of a second. The browser reads it with fetch
 * and plays it through Web Audio, which behaves the same in every browser
 * (media elements need byte-range support that a live stream cannot give).
 */

import { NextRequest, NextResponse } from "next/server";
import { ttsServes } from "@providers";
import { getProviders } from "../../../lib/providers";
import {
  verifySpeech,
  openSpeech,
  speechBudgetStatus,
  SpeechBudgetExceeded,
  type SpeechClaim,
} from "../../../lib/speech";
import { browserFamily, logTelemetry } from "../../../lib/telemetry";
import { lineKeyFromUrl } from "../../../lib/line-key";
import { clientIp, enforce, RULES } from "../../../lib/rate-limit";
import { getStore } from "../../../lib/store";
import { recordUsage, ttsCost } from "../../../lib/usage";
import { applyGainPcm16, gainStream } from "../../../lib/pcm-gain";

type Outcome = "complete" | "cancelled" | "error";

/** Pass a stream through unchanged while measuring it, for development telemetry. */
function observeBody(
  stream: ReadableStream<Uint8Array>,
  startedAt: number,
  onEnd: (info: { firstByteMs?: number; bytes: number; outcome: Outcome; totalMs: number }) => void
): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  let firstByteMs: number | undefined;
  let bytes = 0;
  let ended = false;
  const end = (outcome: Outcome) => {
    if (ended) return;
    ended = true;
    onEnd({ firstByteMs, bytes, outcome, totalMs: Date.now() - startedAt });
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          end("complete");
          controller.close();
          return;
        }
        if (value) {
          firstByteMs ??= Date.now() - startedAt;
          bytes += value.byteLength;
          controller.enqueue(value);
        }
      } catch (err) {
        end("error");
        controller.error(err);
      }
    },
    cancel(reason) {
      end("cancelled");
      return reader.cancel(reason);
    },
  });
}

// A long line streams for a while; do not let a host's short default cut it off.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const lineKey = lineKeyFromUrl(req.nextUrl.search);
  const browser = browserFamily(req.headers.get("user-agent"));

  const note = (extra: Record<string, unknown>) =>
    logTelemetry("speech", {
      line: lineKey,
      browser,
      range: req.headers.get("range") ?? undefined,
      budget: speechBudgetStatus(),
      ...extra,
    });

  let claim: SpeechClaim | null = null;
  try {
    if (process.env.DISABLE_AI_PROVIDERS === "true") {
      note({ status: 503, outcome: "error", error: "voice switched off" });
      return NextResponse.json({ error: "Voice is switched off." }, { status: 503 });
    }

    const limited = enforce([[RULES.speech(), clientIp(req)]]);
    if (limited) {
      note({ status: 429, outcome: "error", error: "rate limited" });
      return limited;
    }

    const token = req.nextUrl.searchParams.get("t");
    claim = token ? verifySpeech(token) : null;
    if (!claim) {
      note({ status: 404, outcome: "error", error: "bad or missing token" });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const tts = getProviders().tts;
    if (!ttsServes(tts, claim.provider)) {
      note({ status: 404, outcome: "error", error: "provider mismatch", voice: claim.voiceId });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const audio = await openSpeech(claim);
    // A line made for the first time is what costs money: charge it to the visitor and record it.
    if (audio.source === "new") {
      const chars = claim.text.length;
      if (claim.sessionId) {
        void getStore()
          .addVoiceChars(claim.sessionId, chars)
          .catch(() => undefined);
      }
      void recordUsage({ provider: claim.provider, feature: "tts", units: chars, estimatedCostUsd: ttsCost(claim.provider, chars) });
    }

    const headers: Record<string, string> = {
      "Content-Type": audio.mimeType,
      "X-Speech-Source": audio.source,
      // The same line always sounds the same, so the browser may keep it.
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    };
    const rate = audio.mimeType.match(/rate=(\d+)/)?.[1];
    if (rate) headers["X-Audio-Sample-Rate"] = rate;

    const base = {
      voice: claim.voiceId,
      format: claim.format,
      chars: claim.text.length,
      source: audio.source,
      status: 200,
    };

    // A cached line has a known length and is already complete.
    // Bring this voice to the common level. The cached copy stays as the provider made it.
    const levelDb = claim.format === "pcm16" && /audio\/l16/i.test(audio.mimeType) ? (claim.levelDb ?? 0) : 0;
    if (audio.body instanceof Uint8Array) {
      const body = levelDb ? applyGainPcm16(audio.body, levelDb) : audio.body;
      headers["Content-Length"] = String(body.byteLength);
      note({ ...base, outcome: "complete", bytes: body.byteLength, ttfbMs: 0, totalMs: Date.now() - startedAt });
      return new NextResponse(body as unknown as BodyInit, { status: 200, headers });
    }

    const observed = observeBody(levelDb ? gainStream(audio.body, levelDb) : audio.body, startedAt, (info) =>
      note({ ...base, outcome: info.outcome, bytes: info.bytes, ttfbMs: info.firstByteMs, totalMs: info.totalMs })
    );
    return new NextResponse(observed, { status: 200, headers });
  } catch (err) {
    if (err instanceof SpeechBudgetExceeded) {
      note({ status: 429, outcome: "error", error: "daily voice budget reached", voice: claim?.voiceId });
      return NextResponse.json({ error: "Voice budget reached for today." }, { status: 429 });
    }
    // Message only: it carries a status, never a key or the spoken text.
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[GET /api/speech]", message);
    note({ status: 502, outcome: "error", error: message, voice: claim?.voiceId });
    return NextResponse.json({ error: "Voice unavailable." }, { status: 502 });
  }
}
