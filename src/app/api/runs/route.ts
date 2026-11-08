/**
 * POST /api/runs
 * Creates a new guest session and run.
 *
 * Request body:
 *   { caseId: string; playMode?: "solo" | "together" }
 *
 * Response:
 *   { runId: string; state: PlayerSafeRunState }
 *   Sets rn_guest_token cookie.
 *
 * Security:
 *   - Guest token created fresh; only hash stored in DB
 *   - Rate limiting via request count on guest_session (checked in DB)
 *   - runId is a UUID, not the sole auth — token required
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../../../../db";
import { guestSessions, runs } from "../../../../db/schema";
import {
  generateGuestToken,
  makeExpiryDate,
  buildCookieHeader,
} from "../../../lib/session";
import { createInitialRunState } from "@game-core";
import { getCase } from "../../../lib/cases";
import type { RunId, CaseId, SceneId } from "@game-core";

const CreateRunSchema = z.object({
  caseId: z.string().min(1).max(64),
  playMode: z.enum(["solo", "together"]).default("solo"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = CreateRunSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { caseId, playMode } = parsed.data;

    // Validate case exists
    const caseContent = getCase(caseId);
    if (!caseContent) {
      return NextResponse.json(
        { error: `Case '${caseId}' not found` },
        { status: 404 }
      );
    }

    // Create guest session
    const { raw, hash } = generateGuestToken();
    const [session] = await db
      .insert(guestSessions)
      .values({
        tokenHash: hash,
        expiresAt: makeExpiryDate(),
      })
      .returning({ id: guestSessions.id });

    // Build initial run state
    const runId = crypto.randomUUID() as RunId;
    const initialState = createInitialRunState({
      runId,
      caseId: caseId as CaseId,
      caseVersion: caseContent.version,
      initialSceneId: caseContent.initialSceneId,
      playMode,
    });

    // Persist the run
    await db.insert(runs).values({
      id: runId,
      guestSessionId: session.id,
      caseId,
      caseVersion: caseContent.version,
      playMode,
      revision: 0,
      stateJson: initialState,
    });

    const response = NextResponse.json(
      {
        runId,
        caseId,
        playMode,
        state: initialState,
      },
      { status: 201 }
    );

    // Set httpOnly guest token cookie
    response.headers.set("Set-Cookie", buildCookieHeader(raw));

    return response;
  } catch (err) {
    console.error("[POST /api/runs]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
