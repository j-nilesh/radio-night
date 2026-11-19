/**
 * GET /api/runs/current
 * The investigation saved for this browser, if any, with a short spoiler-safe
 * summary, so the home page can offer "Continue".
 *
 * Security:
 *   - Identified only by the guest token cookie. No cookie, an unknown token or
 *     an expired session all answer { run: null } (not an error: a first-time
 *     visitor has nothing saved).
 *   - The summary is built from the player view, so it cannot reveal anything the
 *     player has not already earned. No state, flags or truth leave the server.
 *   - Rate limited per guest token like the other reads.
 */
import { NextResponse } from "next/server";
import { getGuestTokenFromCookie, hashToken } from "../../../../lib/session";
import { getStore } from "../../../../lib/store";
import { getCase } from "../../../../lib/cases";
import { buildPlayerView } from "@ai-orchestration/scene-view";
import { buildSaveSummary } from "@ai-orchestration/recap";
import { enforce, RULES } from "../../../../lib/rate-limit";
import type { RunState } from "@game-core";

export async function GET() {
  try {
    const rawToken = await getGuestTokenFromCookie();
    if (!rawToken) return NextResponse.json({ run: null });

    const tokenHash = hashToken(rawToken);
    const limited = enforce([[RULES.readRun(), tokenHash]]);
    if (limited) return limited;

    const found = await getStore().findLatestRunForToken(tokenHash);
    if (!found) return NextResponse.json({ run: null });

    const caseContent = getCase(found.run.caseId);
    if (!caseContent) return NextResponse.json({ run: null });

    const state = found.run.stateJson as RunState;
    const summary = buildSaveSummary(buildPlayerView(caseContent, state), state.visitedSceneIds.length);
    return NextResponse.json({
      run: {
        runId: found.run.id,
        caseId: found.run.caseId,
        caseTitle: caseContent.title,
        updatedAt: found.run.updatedAt?.toISOString() ?? null,
        summary,
      },
    });
  } catch (err) {
    console.error("[GET /api/runs/current]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
