/**
 * GET /api/speech?t=<signed token>
 * Returns the spoken audio for a line the game itself produced.
 *
 * Security:
 *   - The token is an HMAC-signed {voice, text} issued by the server. Without a
 *     valid signature nothing is synthesised, so this cannot be used to voice
 *     arbitrary text on your Deepgram account.
 *   - A voice pinned to a provider other than the live one is refused: voice
 *     identity never switches silently.
 *   - Daily character budget (TTS_DAILY_CHAR_BUDGET) caps spend; repeats are cached.
 *   - New lines are streamed: the first bytes reach the browser as soon as the
 *     provider produces them, rather than after the whole line is ready.
 *   - Failures return a status only. The client keeps showing captions.
 */

import { NextRequest, NextResponse } from "next/server";
import { getProviders } from "../../../lib/providers";
import {
  verifySpeech,
  openSpeech,
  SpeechBudgetExceeded,
} from "../../../lib/speech";

export async function GET(req: NextRequest) {
  try {
    if (process.env.DISABLE_AI_PROVIDERS === "true") {
      return NextResponse.json({ error: "Voice is switched off." }, { status: 503 });
    }

    const token = req.nextUrl.searchParams.get("t");
    const claim = token ? verifySpeech(token) : null;
    if (!claim) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const tts = getProviders().tts;
    if (tts.providerName === "mock" || claim.provider !== tts.providerName) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const audio = await openSpeech(claim);

    const headers: Record<string, string> = {
      "Content-Type": audio.mimeType,
      // The same line always sounds the same, so the browser may keep it.
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    };

    // A cached line has a known length; a live stream does not.
    if (audio.body instanceof Uint8Array) {
      headers["Content-Length"] = String(audio.body.byteLength);
      return new NextResponse(audio.body as unknown as BodyInit, { status: 200, headers });
    }
    return new NextResponse(audio.body, { status: 200, headers });
  } catch (err) {
    if (err instanceof SpeechBudgetExceeded) {
      return NextResponse.json({ error: "Voice budget reached for today." }, { status: 429 });
    }
    // Message only: it carries a status, never a key or the spoken text.
    console.error("[GET /api/speech]", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Voice unavailable." }, { status: 502 });
  }
}
