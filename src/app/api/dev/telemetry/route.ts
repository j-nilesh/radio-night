/**
 * POST /api/dev/telemetry
 * Receives development telemetry events from the browser (mic levels, audio
 * playback timings, interruptions, errors) and appends them to the playtest log.
 *
 * DEVELOPMENT ONLY: answers 404 when telemetry is off, which is always the case in
 * production builds, so nothing is recorded there.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { browserFamily, logTelemetry, shortId, telemetryEnabled } from "../../../../lib/telemetry";

const MAX_BODY_BYTES = 64 * 1024;

const Body = z.object({
  runId: z.string().max(64).optional(),
  events: z
    .array(
      z.object({
        name: z.string().min(1).max(60).regex(/^[a-z0-9_.-]+$/i),
        at: z.number().optional(),
        data: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .max(100),
});

export async function POST(req: NextRequest) {
  if (!telemetryEnabled()) return new NextResponse(null, { status: 404 });

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const browser = browserFamily(req.headers.get("user-agent"));
  for (const ev of parsed.data.events) {
    logTelemetry(`client.${ev.name}`, {
      run: shortId(parsed.data.runId),
      browser,
      clientAt: ev.at,
      ...(ev.data ?? {}),
    });
  }
  return new NextResponse(null, { status: 204 });
}
