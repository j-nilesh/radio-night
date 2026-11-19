/**
 * GET /api/runs/:runId
 * Returns the player-safe view of an existing run.
 *
 * Security:
 *   - Guest token from cookie must match the owning session's token hash.
 *     runId alone is not sufficient authorization.
 *   - The view contains only what the player has earned: present characters,
 *     unlocked exits, and discovered clues. No truth, no locked locations.
 */

import { NextRequest, NextResponse } from "next/server";
import { getGuestTokenFromCookie, hashToken } from "../../../../lib/session";
import { getStore } from "../../../../lib/store";
import { getCase } from "../../../../lib/cases";
import { buildPlayerView, buildOpening } from "@ai-orchestration/scene-view";
import { buildWelcomeBack } from "@ai-orchestration/recap";
import { makeSpeaker, speechUrl, voiceForOpening } from "../../../../lib/speech";
import { voiceLeft } from "../../../../lib/allowance";
import { browserFamily, logTelemetry, shortId } from "../../../../lib/telemetry";
import { enforce, RULES } from "../../../../lib/rate-limit";
import type { RunState } from "@game-core";

export async function GET(
  req: NextRequest,
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

    const limited = enforce([[RULES.readRun(), tokenHash]]);
    if (limited) return limited;

    const store = getStore();
    const found = await store.findRunForToken(runId, tokenHash);

    if (!found) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const caseContent = getCase(found.run.caseId);
    if (!caseContent) {
      return NextResponse.json({ error: "Case not available" }, { status: 500 });
    }

    const state = found.run.stateJson as RunState;
    const view = buildPlayerView(caseContent, state);
    // A run that has begun and is not over is being picked up again: the narrator recaps it.
    const resumed = state.revision > 0 && !view.ending;
    const recap = resumed ? buildWelcomeBack(view) : undefined;

    logTelemetry("run.loaded", {
      run: shortId(runId),
      revision: state.revision,
      resumed: state.revision > 0,
      scene: state.currentSceneId,
      clues: state.discoveredEvidenceIds.length,
      ended: !!state.endingId,
      browser: browserFamily(req.headers.get("user-agent")),
    });

    return NextResponse.json({
      runId: found.run.id,
      caseId: found.run.caseId,
      caseTitle: caseContent.title,
      playMode: found.run.playMode,
      // Only a brand-new run gets the opening; a resumed run continues where it was.
      opening:
        state.revision === 0
          ? buildOpening(caseContent).map((line) => ({
              ...line,
              audioUrl: speechUrl(voiceForOpening(caseContent, line), line.text),
            }))
          : [],
      resumed,
      recap,
      // The recap is made for this player, so it counts against their voice allowance
      recapAudioUrl: recap ? makeSpeaker(found.session).url(caseContent.narratorVoice, recap) : undefined,
      voiceLeft: voiceLeft(found.session),
      hasAccessCode: !!found.session.accessLabel,
      // Whether this server can speak at all, so a resumed run can still ask for the click that unlocks sound
      voiceAvailable: !!speechUrl(caseContent.narratorVoice, "Ready."),
      view,
      endingAudioUrl: view.ending ? speechUrl(caseContent.narratorVoice, view.ending.narration) : undefined,
    });
  } catch (err) {
    console.error("[GET /api/runs/:runId]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
