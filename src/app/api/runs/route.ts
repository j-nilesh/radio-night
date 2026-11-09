/**
 * POST /api/runs
 * Creates a new guest session and run.
 *
 * Request body: { caseId: string; playMode?: "solo" | "together" }
 * Response: { runId, caseId, playMode, state } + Set-Cookie (rn_guest_token)
 *
 * Security:
 *   - Guest token created fresh; only the hash is stored
 *   - runId is a UUID, not the sole auth — token required on later requests
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  generateGuestToken,
  makeExpiryDate,
  buildCookieHeader,
} from "../../../lib/session";
import { getStore } from "../../../lib/store";
import { createInitialRunState } from "@game-core";
import { getCase } from "../../../lib/cases";
import type { RunId, CaseId } from "@game-core";

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

    const caseContent = getCase(caseId);
    if (!caseContent) {
      return NextResponse.json({ error: `Case '${caseId}' not found` }, { status: 404 });
    }

    const store = getStore();

    // Create guest session (only the token hash is persisted)
    const { raw, hash } = generateGuestToken();
    const session = await store.createSession(hash, makeExpiryDate());

    // Build and persist initial run state
    const runId = crypto.randomUUID() as RunId;
    const initialState = createInitialRunState({
      runId,
      caseId: caseId as CaseId,
      caseVersion: caseContent.version,
      initialSceneId: caseContent.initialSceneId,
      playMode,
    });

    await store.createRun({
      id: runId,
      guestSessionId: session.id,
      caseId,
      caseVersion: caseContent.version,
      playMode,
      revision: 0,
      stateJson: initialState,
    });

    const response = NextResponse.json(
      { runId, caseId, playMode, state: initialState },
      { status: 201 }
    );
    response.headers.set("Set-Cookie", buildCookieHeader(raw));
    return response;
  } catch (err) {
    console.error("[POST /api/runs]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
