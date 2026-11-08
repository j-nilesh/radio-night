/**
 * GET /api/runs/:runId
 * Returns the player-safe RunState for an existing run.
 *
 * Security:
 *   - Guest token from cookie must match the token hash on the session
 *     that owns this run. runId alone is not sufficient authorization.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, runs, guestSessions } from "../../../../../db";
import { eq, and } from "drizzle-orm";
import { getGuestTokenFromCookie, hashToken } from "../../../../lib/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;

    if (!runId || typeof runId !== "string") {
      return NextResponse.json({ error: "Missing runId" }, { status: 400 });
    }

    // Validate guest token
    const rawToken = await getGuestTokenFromCookie();
    if (!rawToken) {
      return NextResponse.json({ error: "Not authorized" }, { status: 401 });
    }
    const tokenHash = hashToken(rawToken);

    // Look up run and verify ownership via session
    const [run] = await db
      .select()
      .from(runs)
      .innerJoin(guestSessions, eq(runs.guestSessionId, guestSessions.id))
      .where(
        and(
          eq(runs.id, runId),
          eq(guestSessions.tokenHash, tokenHash),
          eq(guestSessions.revoked, false)
        )
      )
      .limit(1);

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    return NextResponse.json({
      runId: run.runs.id,
      caseId: run.runs.caseId,
      playMode: run.runs.playMode,
      state: run.runs.stateJson,
    });
  } catch (err) {
    console.error("[GET /api/runs/:runId]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
