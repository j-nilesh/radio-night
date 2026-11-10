/**
 * POST /api/runs/:runId/accuse
 * Name a suspect and put evidence forward. Closes the case.
 *
 * Request body: { idempotencyKey, suspectId, evidenceIds: string[] }
 * Response: { kind: "ending", view } — the view carries the ending.
 *
 * Security:
 *   - Token ownership verified on every request
 *   - The server decides whether the detective is ready, whether the evidence
 *     is real, and which ending follows; the client only supplies choices
 *   - Refusals are identical for every suspect, so they never hint at the answer
 *   - Repeating the request after the case is closed returns the same ending
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getGuestTokenFromCookie, hashToken } from "../../../../../lib/session";
import { getCase } from "../../../../../lib/cases";
import { getStore } from "../../../../../lib/store";
import { accuse } from "@ai-orchestration/accusation";
import { buildPlayerView } from "@ai-orchestration/scene-view";
import { speechUrl } from "../../../../../lib/speech";
import type { RunState, RunId } from "@game-core";

const AccuseSchema = z.object({
  idempotencyKey: z.string().min(1).max(128),
  suspectId: z.string().min(1).max(64),
  evidenceIds: z.array(z.string().min(1).max(64)).max(30),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;

    const rawToken = await getGuestTokenFromCookie();
    if (!rawToken) {
      return NextResponse.json({ error: "Not authorized" }, { status: 401 });
    }
    const tokenHash = hashToken(rawToken);

    const body = await req.json().catch(() => ({}));
    const parsed = AccuseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { idempotencyKey, suspectId, evidenceIds } = parsed.data;

    const store = getStore();
    const found = await store.findRunForToken(runId, tokenHash);
    if (!found) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const caseContent = getCase(found.run.caseId);
    if (!caseContent) {
      return NextResponse.json({ error: "Case not available" }, { status: 500 });
    }

    const before = found.run.stateJson as RunState;

    // A double-click or a retry after a dropped connection: show the same ending.
    if (before.endingId) {
      const closedView = buildPlayerView(caseContent, before);
      return NextResponse.json({
        kind: "ending",
        view: closedView,
        endingAudioUrl: closedView.ending
          ? speechUrl(caseContent.narratorVoice, closedView.ending.narration)
          : undefined,
      });
    }

    const outcome = accuse(caseContent, before, runId as RunId, idempotencyKey, suspectId, evidenceIds);
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.reason }, { status: 400 });
    }

    await store.insertEvents(
      outcome.newEvents.map((evt) => ({
        runId,
        sequence: evt.sequence,
        eventType: evt.eventType,
        payload: evt.payload,
      }))
    );
    await store.updateRunState(runId, outcome.updatedState, before.revision);
    await store.insertTurn({
      runId,
      idempotencyKey,
      actor: "player",
      decisionCode: "ACCUSATION",
      audioGenerated: false,
    });
    await store.incrementSessionRequests(found.session.id);

    const endedView = buildPlayerView(caseContent, outcome.updatedState);
    return NextResponse.json({
      kind: "ending",
      view: endedView,
      endingAudioUrl: endedView.ending
        ? speechUrl(caseContent.narratorVoice, endedView.ending.narration)
        : undefined,
    });
  } catch (err) {
    console.error("[POST /api/runs/:runId/accuse]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
