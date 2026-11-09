/**
 * POST /api/runs/:runId/actions
 * Processes a player turn through the full pipeline.
 *
 * Request body:
 *   { idempotencyKey, text?, audioBase64?, targetCharacterId? }
 * Response: { responseText, audioAssetRef?, classification, updatedRunState, timings }
 *
 * Security:
 *   - Token auth on every request
 *   - Idempotency key checked for deduplication
 *   - Input length validated with zod
 *   - All game events committed server-side only
 *   - Per-session request cap enforced
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getGuestTokenFromCookie, hashToken } from "../../../../../lib/session";
import { getCase } from "../../../../../lib/cases";
import { getProviders } from "../../../../../lib/providers";
import { getStore } from "../../../../../lib/store";
import { processTurn } from "@ai-orchestration/orchestrator";
import type { RunState, RunId } from "@game-core";

const MAX_TEXT_LENGTH = 1000;
const MAX_AUDIO_BASE64_LENGTH = 1_500_000; // ~1MB audio
const PER_SESSION_REQUEST_CAP = 500;

const ActionSchema = z.object({
  idempotencyKey: z.string().min(1).max(128),
  text: z.string().max(MAX_TEXT_LENGTH).optional(),
  audioBase64: z.string().max(MAX_AUDIO_BASE64_LENGTH).optional(),
  targetCharacterId: z.string().max(64).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const requestStart = Date.now();

  try {
    const { runId } = await params;

    // ── Auth ───────────────────────────────────────────────────────────────
    const rawToken = await getGuestTokenFromCookie();
    if (!rawToken) {
      return NextResponse.json({ error: "Not authorized" }, { status: 401 });
    }
    const tokenHash = hashToken(rawToken);

    // ── Input validation ───────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const parsed = ActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    if (!parsed.data.text && !parsed.data.audioBase64) {
      return NextResponse.json(
        { error: "Provide either text or audioBase64" },
        { status: 400 }
      );
    }

    const { idempotencyKey, text, audioBase64, targetCharacterId } = parsed.data;
    const store = getStore();

    // ── Deduplication ──────────────────────────────────────────────────────
    const alreadyProcessed = await store.findTurnByIdempotencyKey(idempotencyKey);
    if (alreadyProcessed) {
      return NextResponse.json(
        { cached: true, message: "Turn already processed" },
        { status: 200 }
      );
    }

    // ── Load run with ownership check ──────────────────────────────────────
    const found = await store.findRunForToken(runId, tokenHash);
    if (!found) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // ── Per-session rate cap ───────────────────────────────────────────────
    if (found.session.requestCount >= PER_SESSION_REQUEST_CAP) {
      return NextResponse.json(
        { error: "Session request limit reached. Please start a new session." },
        { status: 429 }
      );
    }

    // ── Load case ──────────────────────────────────────────────────────────
    const caseContent = getCase(found.run.caseId);
    if (!caseContent) {
      return NextResponse.json({ error: "Case not available" }, { status: 500 });
    }

    // ── Decode audio if provided ───────────────────────────────────────────
    let audioBytes: Uint8Array | undefined;
    if (audioBase64) {
      try {
        audioBytes = new Uint8Array(Buffer.from(audioBase64, "base64"));
      } catch {
        return NextResponse.json({ error: "Invalid audio encoding" }, { status: 400 });
      }
    }

    // ── Process the turn ───────────────────────────────────────────────────
    const providers = getProviders();
    const currentState = found.run.stateJson as RunState;

    const result = await processTurn({
      runId: runId as RunId,
      idempotencyKey,
      text,
      audioBytes,
      state: currentState,
      caseContent,
      providers,
      targetCharacterId,
    });

    // ── Persist events ─────────────────────────────────────────────────────
    if (result.newEvents.length > 0) {
      await store.insertEvents(
        result.newEvents.map((evt) => ({
          runId,
          sequence: evt.sequence,
          eventType: evt.eventType,
          payload: evt.payload,
        }))
      );
    }

    // ── Update run state (optimistic concurrency) ──────────────────────────
    await store.updateRunState(
      runId,
      result.updatedRunState as RunState,
      currentState.revision
    );

    // ── Log turn (redacted) ────────────────────────────────────────────────
    await store.insertTurn({
      runId,
      idempotencyKey,
      actor: "player",
      decisionCode: result.classification.category,
      audioGenerated: !!result.audioAssetRef,
      timingsJson: result.timings,
    });

    // ── Increment session request count ────────────────────────────────────
    await store.incrementSessionRequests(found.session.id);

    return NextResponse.json({
      runId,
      idempotencyKey,
      responseText: result.responseText,
      audioAssetRef: result.audioAssetRef,
      classification: result.classification,
      updatedRunState: result.updatedRunState,
      timings: result.timings,
    });
  } catch (err) {
    console.error("[POST /api/runs/:runId/actions]", err);
    return NextResponse.json(
      { error: "Internal server error", totalMs: Date.now() - requestStart },
      { status: 500 }
    );
  }
}
