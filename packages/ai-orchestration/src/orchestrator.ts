/**
 * ai-orchestration/orchestrator.ts
 * The server-side turn processing pipeline.
 *
 * Pipeline:
 *   1. Transcribe audio (if speech input)
 *   2. Normalize and check confidence
 *   3. Classify: CONTROL / OUT_OF_SCOPE / OUT_OF_PERIOD / INAPPROPRIATE / UNCLEAR / IN_SCOPE
 *   4. For controls: deterministic action
 *   5. For deflections: pick approved deflection line, no state mutation
 *   6. For IN_SCOPE: resolve character/scene, build filtered context, call LLM
 *   7. Validate response (no forbidden reveals)
 *   8. Commit authorized events
 *   9. Synthesize TTS
 *  10. Return TurnResult
 *
 * SECURITY: Only this module commits GameEvents. The LLM returns a ProposedResponse.
 * Authorized events are the sole source of truth for RunState mutation.
 */

import { applyEvent } from "@game-core";
import type {
  RunState,
  GameEvent,
  TurnResult,
  PlayerSafeRunState,
  RunId,
} from "@game-core";
import { classifyInput } from "./classifier";
import type { ClassifierInput } from "./classifier";
import type {
  ProviderConfig,
  AuthorizedDialogueContext,
  VoiceProfile,
} from "@providers";
import type { CaseContent, CharacterFacts } from "./case-content";

// ---------------------------------------------------------------------------
// Deflection lines — per-character, rotated by call count
// ---------------------------------------------------------------------------

const DEFAULT_DEFLECTIONS = [
  "I'm afraid I don't quite follow, Detective. Shall we return to the matter at hand?",
  "That's not something I can help you with. As I was saying—",
  "I don't understand the question, Detective. Perhaps you could rephrase.",
  "That's rather outside my experience. I was telling you what I know.",
  "I'm not sure I follow. What is it you're really asking?",
];

function pickDeflection(state: RunState, characterId: string): string {
  const count = Object.values(state.investigationFlags).filter(
    (v) => v === true
  ).length;
  return DEFAULT_DEFLECTIONS[count % DEFAULT_DEFLECTIONS.length];
}

// ---------------------------------------------------------------------------
// Narration lines for control commands
// ---------------------------------------------------------------------------

function buildControlResponse(
  intentType: string,
  state: RunState,
  caseContent: CaseContent
): string {
  switch (intentType) {
    case "REPEAT_LAST":
      return state.lastSafeTopic?.shortRecap
        ? `${state.lastSafeTopic.shortRecap}`
        : "There is nothing to repeat yet.";
    case "REQUEST_RECAP": {
      const claims = state.heardClaimIds.length;
      const evidence = state.discoveredEvidenceIds.length;
      const scenes = state.visitedSceneIds.length;
      return (
        `So far, you have spoken with ${claims} witness${claims === 1 ? "" : "es"}, ` +
        `uncovered ${evidence} piece${evidence === 1 ? "" : "s"} of evidence, ` +
        `and visited ${scenes} location${scenes === 1 ? "" : "s"}.`
      );
    }
    case "PAUSE":
      return "The investigation is paused.";
    case "RESUME":
      return "Continuing the investigation.";
    default:
      return "What would you like to do next, Detective?";
  }
}

// ---------------------------------------------------------------------------
// Validate proposed LLM response for forbidden content
// ---------------------------------------------------------------------------

type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

function validateProposedResponse(
  text: string,
  characterFacts: CharacterFacts,
  state: RunState
): ValidationResult {
  const lowerText = text.toLowerCase();

  // Check for premature secret reveals
  for (const secret of characterFacts.concealed) {
    if (state.knownFactIds.includes(secret.factId as unknown as import("@game-core").FactId)) continue; // already known
    // Very naive check: look for key terms from the secret description
    const keywords = secret.description
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 5);
    const leaks = keywords.filter((kw) => lowerText.includes(kw));
    if (leaks.length >= 2) {
      return {
        valid: false,
        reason: `Premature secret reveal detected for factId: ${secret.factId}`,
      };
    }
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Build player-safe state projection
// ---------------------------------------------------------------------------

function toPlayerSafeState(state: RunState): PlayerSafeRunState {
  // Filter investigation flags to remove truth-leaking keys
  const safeFlags: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(state.investigationFlags)) {
    // Only expose flags that don't start with internal prefixes
    if (!key.startsWith("_")) {
      safeFlags[key] = val;
    }
  }
  return { ...state, investigationFlags: safeFlags };
}

// ---------------------------------------------------------------------------
// Main turn processor
// ---------------------------------------------------------------------------

export type TurnInput = {
  runId: RunId;
  idempotencyKey: string;
  text?: string;
  audioBytes?: Uint8Array;
  state: RunState;
  caseContent: CaseContent;
  providers: ProviderConfig;
  targetCharacterId?: string;
};

export async function processTurn(input: TurnInput): Promise<TurnResult> {
  const start = Date.now();
  const timings: TurnResult["timings"] = { totalMs: 0 };
  let currentState = input.state;
  const newEvents: GameEvent[] = [];

  let text = input.text ?? "";

  // ── 1. STT (if audio provided) ───────────────────────────────────────────
  if (input.audioBytes && input.audioBytes.length > 0) {
    const sttStart = Date.now();
    const transcript = await input.providers.stt.transcribe(input.audioBytes, {
      caseId: currentState.caseId,
      sceneId: currentState.currentSceneId,
      periodHint: input.caseContent.period,
    });
    timings.sttMs = Date.now() - sttStart;

    // Low confidence — ask to repeat
    if (transcript.confidence < 0.4) {
      return {
        idempotencyKey: input.idempotencyKey,
        runId: input.runId,
        responseText:
          "I didn't quite catch that. Could you repeat, or type your question?",
        newEvents: [],
        updatedRunState: toPlayerSafeState(currentState),
        classification: { category: "UNCLEAR" },
        timings: { ...timings, totalMs: Date.now() - start },
      };
    }

    text = transcript.text;
  }

  if (!text || text.trim().length === 0) {
    return {
      idempotencyKey: input.idempotencyKey,
      runId: input.runId,
      responseText: "I didn't catch a question. Try speaking or typing.",
      newEvents: [],
      updatedRunState: toPlayerSafeState(currentState),
      classification: { category: "UNCLEAR" },
      timings: { ...timings, totalMs: Date.now() - start },
    };
  }

  // ── 2. Classify ──────────────────────────────────────────────────────────
  const classifyStart = Date.now();
  const classifierInput: ClassifierInput = {
    text,
    targetCharacterId: input.targetCharacterId as import("@game-core").CharacterId | undefined,
    currentSceneId: currentState.currentSceneId,
    casePeriod: input.caseContent.period,
  };
  const classification = classifyInput(classifierInput);
  timings.classifyMs = Date.now() - classifyStart;

  // ── 3. Handle CONTROL commands ───────────────────────────────────────────
  if (classification.category === "CONTROL_COMMAND" && classification.intent) {
    const intentType = classification.intent.type;

    // PAUSE / RESUME / MUTE don't need a response text — handled client-side
    if (intentType === "PAUSE" || intentType === "RESUME" || intentType === "MUTE") {
      return {
        idempotencyKey: input.idempotencyKey,
        runId: input.runId,
        responseText: "",
        newEvents: [],
        updatedRunState: toPlayerSafeState(currentState),
        classification: { category: "CONTROL_COMMAND" },
        timings: { ...timings, totalMs: Date.now() - start },
      };
    }

    const controlText = buildControlResponse(intentType, currentState, input.caseContent);
    return {
      idempotencyKey: input.idempotencyKey,
      runId: input.runId,
      responseText: controlText,
      newEvents: [],
      updatedRunState: toPlayerSafeState(currentState),
      classification: { category: "CONTROL_COMMAND" },
      timings: { ...timings, totalMs: Date.now() - start },
    };
  }

  // ── 4. Handle deflections — ZERO state mutation ──────────────────────────
  if (
    classification.category === "OUT_OF_SCOPE" ||
    classification.category === "OUT_OF_PERIOD" ||
    classification.category === "INAPPROPRIATE" ||
    classification.category === "UNCLEAR"
  ) {
    const targetId = input.targetCharacterId ?? "narrator";
    const deflectionText =
      classification.category === "OUT_OF_PERIOD"
        ? `I'm afraid I don't follow, Detective. That's not something I'm familiar with.${
            currentState.lastSafeTopic
              ? ` As I was saying — ${currentState.lastSafeTopic.shortRecap}`
              : ""
          }`
        : pickDeflection(currentState, targetId);

    // No events emitted, state unchanged
    return {
      idempotencyKey: input.idempotencyKey,
      runId: input.runId,
      responseText: deflectionText,
      newEvents: [],
      updatedRunState: toPlayerSafeState(currentState),
      classification: { category: classification.category },
      timings: { ...timings, totalMs: Date.now() - start },
    };
  }

  // ── 5. IN_SCOPE: resolve character and get permitted facts ───────────────
  const characterId =
    input.targetCharacterId ??
    (classification.intent?.type === "ASK_CHARACTER"
      ? classification.intent.targetId
      : undefined);

  const characterFacts = characterId
    ? input.caseContent.getCharacterFacts(characterId, currentState)
    : null;

  const character = characterId
    ? input.caseContent.characters.find((c) => c.id === characterId)
    : null;

  if (!character || !characterFacts) {
    return {
      idempotencyKey: input.idempotencyKey,
      runId: input.runId,
      responseText: "There is no one here to speak to at the moment.",
      newEvents: [],
      updatedRunState: toPlayerSafeState(currentState),
      classification: { category: "IN_SCOPE" },
      timings: { ...timings, totalMs: Date.now() - start },
    };
  }

  // ── 6. LLM generation ────────────────────────────────────────────────────
  const llmStart = Date.now();
  const dialogueContext: AuthorizedDialogueContext = {
    requestId: input.idempotencyKey,
    characterId: character.id,
    characterName: character.name,
    speechStyle: character.speechStyle,
    publicBackstory: character.publicBackstory,
    permittedFacts: characterFacts.permitted.map((f) => ({
      factId: f.factId,
      description: f.description,
    })),
    playerQuestion: text,
    lastSafeTopic: currentState.lastSafeTopic?.shortRecap,
    previousClaims: currentState.heardClaimIds.map((id) => ({ claimId: id, text: "" })),
    periodConstraints: input.caseContent.periodConstraints,
  };

  let proposed = await input.providers.dialogue.respond(dialogueContext);
  timings.llmMs = Date.now() - llmStart;

  // ── 7. Validate response ─────────────────────────────────────────────────
  const validation = validateProposedResponse(
    proposed.text,
    characterFacts,
    currentState
  );

  if (!validation.valid) {
    console.error(`[orchestrator] LLM response validation failed: ${validation.reason}`);
    // Fall back to a safe deflection — never send invalid content
    proposed = {
      text: pickDeflection(currentState, character.id),
    };
  }

  // ── 8. Commit authorized events ──────────────────────────────────────────
  const baseSeq = currentState.revision;

  // Always emit CLAIM_HEARD for character interactions
  const claimEvent: GameEvent = {
    eventId: `${input.idempotencyKey}-claim`,
    runId: input.runId,
    sequence: baseSeq + 1,
    eventType: "CLAIM_HEARD",
    payload: {
      claimId: `claim-${input.idempotencyKey}`,
      characterId: character.id,
      shortRecap: proposed.text.slice(0, 120),
    },
    createdAt: new Date(),
  };
  newEvents.push(claimEvent);
  currentState = applyEvent(currentState, claimEvent);

  // If the LLM revealed a permitted fact, emit EVIDENCE_DISCOVERED
  if (proposed.revealsFactId) {
    const fact = characterFacts.permitted.find(
      (f) => f.factId === proposed.revealsFactId
    );
    if (fact && !currentState.knownFactIds.includes(fact.factId as unknown as import("@game-core").FactId)) {
      const factEvent: GameEvent = {
        eventId: `${input.idempotencyKey}-fact`,
        runId: input.runId,
        sequence: baseSeq + 2,
        eventType: "EVIDENCE_DISCOVERED",
        payload: {
          evidenceId: fact.factId,
          characterId: character.id,
          description: fact.description,
        },
        createdAt: new Date(),
      };
      newEvents.push(factEvent);
      currentState = applyEvent(currentState, factEvent);
    }
  }

  // ── 9. TTS ───────────────────────────────────────────────────────────────
  let audioAssetRef: string | undefined;
  const ttsStart = Date.now();

  try {
    const voiceProfile: VoiceProfile = character.voiceProfile ?? {
      characterId: character.id,
      provider: "mock",
      model: "mock-v1",
      voiceId: "mock-001",
      delivery: {},
      targetFormat: "wav",
      fallbackPolicy: "captions_only",
    };

    const ttsResult = await input.providers.tts.synthesize({
      text: proposed.text,
      voice: voiceProfile,
      requestId: input.idempotencyKey,
    });
    timings.ttsMs = Date.now() - ttsStart;

    // In a real implementation, upload to CDN and return URL
    // For now, encode as base64 data URI for the mock path
    const base64 = Buffer.from(ttsResult.data).toString("base64");
    audioAssetRef = `data:${ttsResult.mimeType};base64,${base64}`;
  } catch (err) {
    console.error("[orchestrator] TTS failed, falling back to captions-only:", err);
    timings.ttsMs = Date.now() - ttsStart;
    // audioAssetRef remains undefined — client shows captions
  }

  timings.totalMs = Date.now() - start;

  return {
    idempotencyKey: input.idempotencyKey,
    runId: input.runId,
    responseText: proposed.text,
    audioAssetRef,
    newEvents,
    updatedRunState: toPlayerSafeState(currentState),
    classification: { category: classification.category },
    timings,
  };
}
