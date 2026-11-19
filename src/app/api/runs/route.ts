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
import { browserFamily, logTelemetry, shortId } from "../../../lib/telemetry";
import { clientIp, enforce, RULES } from "../../../lib/rate-limit";
import { checkAccessCode, codeVoiceChars } from "../../../lib/allowance";
import type { RunId, CaseId } from "@game-core";

const CreateRunSchema = z.object({
  caseId: z.string().min(1).max(64),
  playMode: z.enum(["solo", "together"]).default("solo"),
  /** Optional access code for a larger voice allowance (ADR 0014) */
  accessCode: z.string().max(64).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Each new run creates a guest session, so limit them per network address.
    const limited = enforce([[RULES.createRun(), clientIp(req)]]);
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    const parsed = CreateRunSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { caseId, playMode, accessCode } = parsed.data;
    // A code is checked before anything is created, so a mistyped code can simply be fixed.
    let accessLabel: string | null = null;
    if (accessCode?.trim()) {
      const tooFast = enforce([[RULES.accessCode(), clientIp(req)]]);
      if (tooFast) return tooFast;
      accessLabel = checkAccessCode(accessCode);
      if (!accessLabel) {
        return NextResponse.json({ error: "That access code isn't recognised. Check it, or leave it empty to play without one." }, { status: 400 });
      }
    }

    const caseContent = getCase(caseId);
    if (!caseContent) {
      return NextResponse.json({ error: `Case '${caseId}' not found` }, { status: 404 });
    }

    const store = getStore();

    // Create guest session (only the token hash is persisted)
    const { raw, hash } = generateGuestToken();
    const session = await store.createSession(hash, makeExpiryDate());
    if (accessLabel) await store.setAccess(session.id, accessLabel, codeVoiceChars());

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

    logTelemetry("run.created", {
      run: shortId(runId),
      caseId,
      playMode,
      browser: browserFamily(req.headers.get("user-agent")),
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
