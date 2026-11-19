/**
 * POST /api/runs/:runId/actions
 * Processes a player turn through the full pipeline.
 *
 * Request body:
 *   { idempotencyKey, text?, audioBase64?, targetCharacterId? }
 * Response: { responseText, audioUrl?, notices, view, ... }; audioUrl is a signed link to the spoken line
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
import { buildCookieHeader, getGuestTokenFromCookie, hashToken, makeExpiryDate } from "../../../../../lib/session";
import { getCase } from "../../../../../lib/cases";
import { getProviders } from "../../../../../lib/providers";
import { getStore } from "../../../../../lib/store";
import { modelRepliesLeft } from "../../../../../lib/allowance";
import { recordUsage, sttCost, llmCost } from "../../../../../lib/usage";
import { MockDialogueProvider } from "@providers";
import { processTurn } from "@ai-orchestration/orchestrator";
import { cleanMediaType } from "@providers";
import { makeSpeaker, speechUrl, voiceForTurn } from "../../../../../lib/speech";
import { logTelemetry, shortId } from "../../../../../lib/telemetry";
import { clientIp, enforce, RULES } from "../../../../../lib/rate-limit";
import {
  buildPlayerView,
  computeArrivals,
  travelTo,
  examineClue,
} from "@ai-orchestration/scene-view";
import type { RunState, RunId } from "@game-core";

// Speech recognition plus a model reply can take several seconds.
export const maxDuration = 30;

const MAX_TEXT_LENGTH = 1000;
const MAX_AUDIO_BASE64_LENGTH = 1_500_000; // ~1MB audio
const PER_SESSION_REQUEST_CAP = 500;

const ActionSchema = z.object({
  idempotencyKey: z.string().min(1).max(128),
  text: z.string().max(MAX_TEXT_LENGTH).optional(),
  audioBase64: z.string().max(MAX_AUDIO_BASE64_LENGTH).optional(),
  audioMimeType: z.string().max(100).optional(),
  targetCharacterId: z.string().max(64).optional(),
  // Deterministic scene actions: no classification, no model involved
  sceneAction: z
    .discriminatedUnion("type", [
      z.object({ type: z.literal("travel"), sceneId: z.string().min(1).max(64) }),
      z.object({ type: z.literal("examine"), clueId: z.string().min(1).max(64) }),
    ])
    .optional(),
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

    // ── Rate limits (before any parsing or provider work) ──────────────────
    const limited = enforce([
      [RULES.turnToken(), tokenHash],
      [RULES.turnIp(), clientIp(req)],
    ]);
    if (limited) return limited;

    // ── Input validation ───────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const parsed = ActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    if (!parsed.data.text && !parsed.data.audioBase64 && !parsed.data.sceneAction) {
      return NextResponse.json(
        { error: "Provide text, audioBase64, or a sceneAction" },
        { status: 400 }
      );
    }

    const { idempotencyKey, text, audioBase64, audioMimeType, targetCharacterId, sceneAction } =
      parsed.data;
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

    // ── A closed case takes no further questions ───────────────────────────
    if ((found.run.stateJson as RunState).endingId) {
      return NextResponse.json({ error: "The case is closed." }, { status: 409 });
    }

    // ── Deterministic scene actions (travel / examine) ─────────────────────
    if (sceneAction) {
      const before = found.run.stateJson as RunState;
      const outcome =
        sceneAction.type === "travel"
          ? travelTo(caseContent, before, runId as RunId, idempotencyKey, sceneAction.sceneId)
          : examineClue(caseContent, before, runId as RunId, idempotencyKey, sceneAction.clueId);

      if (!outcome.ok) {
        return NextResponse.json({ error: outcome.reason }, { status: 400 });
      }

      if (outcome.newEvents.length > 0) {
        await store.insertEvents(
          outcome.newEvents.map((evt) => ({
            runId,
            sequence: evt.sequence,
            eventType: evt.eventType,
            payload: evt.payload,
          }))
        );
        await store.updateRunState(runId, outcome.updatedState, before.revision);
      }

      await store.insertTurn({
        runId,
        idempotencyKey,
        actor: "player",
        decisionCode: sceneAction.type === "travel" ? "TRAVEL" : "EXAMINE",
        audioGenerated: false,
      });
      await store.incrementSessionRequests(found.session.id, makeExpiryDate());
      // Fixed narration is the same for every player and is cached after the first time, so it is not charged
      const narrationAudioUrl = speechUrl(caseContent.narratorVoice, outcome.narration);
      logTelemetry("scene", {
        run: shortId(runId),
        key: shortId(idempotencyKey),
        action: sceneAction.type,
        target: sceneAction.type === "travel" ? sceneAction.sceneId : sceneAction.clueId,
        from: before.currentSceneId,
        to: outcome.updatedState.currentSceneId,
        cluesGranted: outcome.newEvents
          .filter((e) => e.eventType === "EVIDENCE_DISCOVERED")
          .map((e) => e.payload.evidenceId),
        arrivals: computeArrivals(caseContent, before, outcome.updatedState).length,
        requestMs: Date.now() - requestStart,
      });
      const sceneNotices = computeArrivals(caseContent, before, outcome.updatedState).map((text) => ({
        text,
        audioUrl: speechUrl(caseContent.narratorVoice, text),
      }));
      const sceneResponse = NextResponse.json({
        kind: "scene",
        runId,
        idempotencyKey,
        narration: outcome.narration,
        narrationAudioUrl,
        notices: sceneNotices,
        view: buildPlayerView(caseContent, outcome.updatedState),
      });
      sceneResponse.headers.set("Set-Cookie", buildCookieHeader(rawToken));
      return sceneResponse;
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
    const live = getProviders();
    const providers = modelRepliesLeft(found.session) > 0 ? live : { ...live, dialogue: new MockDialogueProvider() };
    const currentState = found.run.stateJson as RunState;

    // The character's memory of this conversation (server-held; never from the browser)
    const history = targetCharacterId ? await store.getDialogue(runId, targetCharacterId) : [];
    const sceneName = caseContent.scenes?.find((sc) => sc.id === (currentState.currentSceneId as string))?.name;
    const othersPresent = buildPlayerView(caseContent, currentState)
      .characters.filter((c) => c.id !== targetCharacterId)
      .map((c) => c.name);

    const result = await processTurn({
      runId: runId as RunId,
      idempotencyKey,
      text,
      audioBytes,
      audioMimeType: cleanMediaType(audioMimeType),
      state: currentState,
      caseContent,
      providers,
      targetCharacterId,
      history,
      sceneName,
      othersPresent,
    });

    // Remember what was said, if a character actually answered a question.
    const question = text ?? result.transcribedText;
    if (
      targetCharacterId &&
      question &&
      result.responseText &&
      !result.systemMessage &&
      result.classification.category === "IN_SCOPE"
    ) {
      await store.appendDialogue(runId, targetCharacterId, { question, answer: result.responseText });
    }

    // Server-side diagnostics only; the rejected words are never sent to the browser.
    if (result.modelTrace?.rejected) {
      console.warn(`[actions] ${targetCharacterId}: model reply not used (${result.modelTrace.rejected})`);
    }

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

    // ── What the turn cost: model replies count against the visitor; usage is recorded ──
    if (result.modelTrace?.used) {
      await store.addModelReply(found.session.id);
      const u = result.modelTrace.usage;
      if (u) {
        void recordUsage({ runId, provider: providers.dialogue.providerName, feature: "llm", units: u.inputTokens + u.outputTokens, estimatedCostUsd: llmCost(u.inputTokens, u.outputTokens) });
      }
    }
    const sttDiag = result.diagnostics?.stt;
    if (sttDiag && providers.stt.providerName !== "mock") {
      const seconds = Math.max(1, Math.round((sttDiag.audioDurationMs ?? 0) / 1000));
      void recordUsage({ runId, provider: providers.stt.providerName, feature: "stt", units: seconds, estimatedCostUsd: sttCost(seconds) });
    }

    // ── Who speaks the reply, and a signed link to it ─────────────────────
    const speaker = makeSpeaker(found.session);
    const audioUrl = speaker.url(voiceForTurn(caseContent, result, targetCharacterId), result.responseText);

    // ── Log turn (redacted) ────────────────────────────────────────────────
    await store.insertTurn({
      runId,
      idempotencyKey,
      actor: "player",
      decisionCode: result.classification.category,
      audioGenerated: !!audioUrl,
      timingsJson: result.timings,
    });

    // ── Increment session request count ────────────────────────────────────
    await store.incrementSessionRequests(found.session.id, makeExpiryDate());
    const afterState = result.updatedRunState as RunState;

    const diag = result.diagnostics;
    logTelemetry("turn", {
      run: shortId(runId),
      key: shortId(idempotencyKey),
      character: targetCharacterId,
      scene: currentState.currentSceneId,
      revision: currentState.revision,
      source: audioBase64 ? "voice" : "text",
      question: result.transcribedText ?? text,
      audioBytes: audioBytes?.length,
      audioMime: audioMimeType,
      path: diag?.path,
      stt: diag?.stt,
      classification: diag?.classification,
      topic: diag?.topic,
      model: diag?.model,
      historyLength: diag?.historyLength,
      reply: result.responseText,
      systemMessage: !!result.systemMessage,
      voiced: !!audioUrl,
      cluesGranted: result.newEvents
        .filter((e) => e.eventType === "EVIDENCE_DISCOVERED")
        .map((e) => e.payload.evidenceId),
      timings: { ...result.timings, requestMs: Date.now() - requestStart },
    });

    const turnResponse = NextResponse.json({
      kind: "turn",
      runId,
      idempotencyKey,
      responseText: result.responseText,
      systemMessage: result.systemMessage ?? false,
      control: result.control,
      transcribedText: result.transcribedText,
      audioUrl,
      classification: result.classification,
      notices: computeArrivals(caseContent, currentState, afterState).map((text) => ({
        text,
        audioUrl: speechUrl(caseContent.narratorVoice, text),
      })),
      voiceLimitReached: speaker.limitReached,
      view: buildPlayerView(caseContent, afterState),
      timings: result.timings,
    });
    turnResponse.headers.set("Set-Cookie", buildCookieHeader(rawToken));
    return turnResponse;
  } catch (err) {
    console.error("[POST /api/runs/:runId/actions]", err);
    return NextResponse.json(
      { error: "Internal server error", totalMs: Date.now() - requestStart },
      { status: 500 }
    );
  }
}
