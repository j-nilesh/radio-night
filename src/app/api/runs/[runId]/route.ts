/**
 * GET /api/runs/:runId
 * Returns the player-safe RunState for an existing run.
 *
 * Security:
 *   - Guest token from cookie must match the owning session's token hash.
 *     runId alone is not sufficient authorization.
 */

import { NextRequest, NextResponse } from "next/server";
import { getGuestTokenFromCookie, hashToken } from "../../../../lib/session";
import { getStore } from "../../../../lib/store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;

    if (!runId || typeof runId !== "string") {
      return NextResponse.json({ error: "Missing runId" }, { status: 400 });
    }

    const rawToken = await getGuestTokenFromCookie();
    if (!rawToken) {
      return NextResponse.json({ error: "Not authorized" }, { status: 401 });
    }
    const tokenHash = hashToken(rawToken);

    const store = getStore();
    const found = await store.findRunForToken(runId, tokenHash);

    if (!found) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    return NextResponse.json({
      runId: found.run.id,
      caseId: found.run.caseId,
      playMode: found.run.playMode,
      state: found.run.stateJson,
    });
  } catch (err) {
    console.error("[GET /api/runs/:runId]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
