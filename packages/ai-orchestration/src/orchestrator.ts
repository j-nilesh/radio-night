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
  EvidenceId,
  FactId,
} from "@game-core";
import { classifyInput } from "./classifier";
import type { ClassifierInput } from "./classifier";
import type {
  ProviderConfig,
  AuthorizedDialogueContext,
  ProposedResponse,
} from "@providers";
import type { CaseContent, CharacterFacts, FactEntry } from "./case-content";
import { matchTopic, firstSentence } from "./topics";

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
  /** Container of the recording, e.g. "audio/webm" */
  audioMimeType?: string;
  state: RunState;
  caseContent: CaseContent;
  providers: ProviderConfig;
  targetCharacterId?: string;
};

async function runTurn(
  input: TurnInput,
  ctx: { transcribedText?: string }
): Promise<TurnResult> {
  const start = Date.now();
  const timings: TurnResult["timings"] = { totalMs: 0 };
  let currentState = input.state;
  const newEvents: GameEvent[] = [];

  let text = input.text ?? "";

  // ── 1. STT (if audio provided) ───────────────────────────────────────────
  if (input.audioBytes && input.audioBytes.length > 0) {
    const sttStart = Date.now();
    let transcript;
    try {
      transcript = await input.providers.stt.transcribe(input.audioBytes, {
        caseId: currentState.caseId,
        sceneId: currentState.currentSceneId,
        periodHint: input.caseContent.period,
        mimeType: input.audioMimeType,
        keyterms: input.caseContent.speechKeyterms,
      });
    } catch (err) {
      // A speech-service outage must not break the game: say so and let them type.
      console.error(
        "[orchestrator] speech recognition failed:",
        err instanceof Error ? err.message : "unknown error"
      );
      timings.sttMs = Date.now() - sttStart;
      return {
        idempotencyKey: input.idempotencyKey,
        runId: input.runId,
        responseText:
          "I couldn't make out that recording just now. Please try again, or type your question.",
        systemMessage: true,
        newEvents: [],
        updatedRunState: toPlayerSafeState(currentState),
        classification: { category: "UNCLEAR" },
        timings: { ...timings, totalMs: Date.now() - start },
      };
    }
    timings.sttMs = Date.now() - sttStart;

    // Low confidence — ask to repeat. With the mock recogniser, repeating cannot
    // help, so say so plainly instead of inviting the player to try again.
    if (transcript.confidence < 0.4) {
      return {
        idempotencyKey: input.idempotencyKey,
        runId: input.runId,
        responseText:
          input.providers.stt.providerName === "mock"
            ? "Voice input isn't connected in this build yet. Please type your question."
            : "I didn't quite catch that. Could you repeat, or type your question?",
        systemMessage: true,
        newEvents: [],
        updatedRunState: toPlayerSafeState(currentState),
        classification: { category: "UNCLEAR" },
        timings: { ...timings, totalMs: Date.now() - start },
      };
    }

    text = transcript.text;
    ctx.transcribedText = transcript.text;
  }

  if (!text || text.trim().length === 0) {
    return {
      idempotencyKey: input.idempotencyKey,
      runId: input.runId,
      responseText: "I didn't catch a question. Try speaking or typing.",
      systemMessage: true,
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

  // ── 6. Choose the response ───────────────────────────────────────────────
  // Authored topics are deterministic and take priority. Only when nothing is
  // authored for the question do we ask the dialogue provider to improvise.
  const usesAuthoredTopics = !!characterFacts.ordered;
  const topic = characterFacts.ordered ? matchTopic(text, characterFacts.ordered) : null;

  let proposed: ProposedResponse;
  let disclosedFact: FactEntry | undefined;
  let evasionFact: FactEntry | undefined;

  if (topic?.kind === "disclose" && topic.fact.line) {
    disclosedFact = topic.fact;
    proposed = { text: topic.fact.line };
    timings.llmMs = 0;
  } else if (topic?.kind === "locked" && topic.fact.lockedLine) {
    evasionFact = topic.fact;
    proposed = { text: topic.fact.lockedLine };
    timings.llmMs = 0;
  } else {
    const llmStart = Date.now();
    const dialogueContext: AuthorizedDialogueContext = {
      requestId: input.idempotencyKey,
      characterId: character.id,
      characterName: character.name,
      speechStyle: character.speechStyle,
      publicBackstory: character.publicBackstory,
      // Topics with an authored line are handled above; never hand them to the model.
      permittedFacts: characterFacts.permitted
        .filter((f) => !f.line)
        .map((f) => ({ factId: f.factId, description: f.description })),
      playerQuestion: text,
      lastSafeTopic: currentState.lastSafeTopic?.shortRecap,
      previousClaims: currentState.heardClaimIds.map((id) => ({ claimId: id, text: "" })),
      periodConstraints: input.caseContent.periodConstraints,
      fallbackLines: character.fallbackLines,
    };

    proposed = await input.providers.dialogue.respond(dialogueContext);
    timings.llmMs = Date.now() - llmStart;

    // ── 7. Validate generated response ─────────────────────────────────────
    const validation = validateProposedResponse(proposed.text, characterFacts, currentState);
    if (!validation.valid) {
      console.error(`[orchestrator] LLM response validation failed: ${validation.reason}`);
      // Fall back to a safe deflection — never send invalid content
      proposed = { text: pickDeflection(currentState, character.id) };
    }
  }

  // ── 8. Commit authorized events ──────────────────────────────────────────
  let seq = currentState.revision;
  const commit = (
    eventType: GameEvent["eventType"],
    payload: Record<string, unknown>,
    suffix: string
  ) => {
    const evt: GameEvent = {
      eventId: `${input.idempotencyKey}-${suffix}`,
      runId: input.runId,
      sequence: ++seq,
      eventType,
      payload,
      createdAt: new Date(),
    };
    newEvents.push(evt);
    currentState = applyEvent(currentState, evt);
  };

  // First conversation with a character marks them as interviewed.
  if (!currentState.investigationFlags[`interviewed_${character.id}`]) {
    commit("CHARACTER_INTERVIEWED", { characterId: character.id }, "interview");
  }

  // Record what was said as a claim. A generic non-answer from an authored
  // character is not a claim, so it is not recorded.
  if (!usesAuthoredTopics || disclosedFact || evasionFact) {
    const claimId = disclosedFact
      ? `claim-${disclosedFact.factId}`
      : evasionFact
        ? `claim-${evasionFact.factId}-evasion`
        : `claim-${input.idempotencyKey}`;
    commit(
      "CLAIM_HEARD",
      {
        claimId,
        characterId: character.id,
        shortRecap: firstSentence(proposed.text),
      },
      "claim"
    );
  }

  // Authored disclosure that grants a clue (first time only).
  if (disclosedFact?.grantsClueId) {
    const clueId = disclosedFact.grantsClueId;
    if (!currentState.discoveredEvidenceIds.includes(clueId as unknown as EvidenceId)) {
      commit(
        "EVIDENCE_DISCOVERED",
        { evidenceId: clueId, characterId: character.id, source: "testimony" },
        `clue-${clueId}`
      );
    }
  }

  // Generated response that revealed a permitted fact (legacy single-room path).
  if (proposed.revealsFactId) {
    const fact = characterFacts.permitted.find((f) => f.factId === proposed.revealsFactId);
    if (fact && !currentState.knownFactIds.includes(fact.factId as unknown as FactId)) {
      commit(
        "EVIDENCE_DISCOVERED",
        { evidenceId: fact.factId, characterId: character.id, description: fact.description },
        "fact"
      );
    }
  }

  // Speech is not synthesised here. The API layer signs a link to the line, and the
  // browser fetches the audio, so a slow or failed voice never delays the text.

  timings.totalMs = Date.now() - start;

  return {
    idempotencyKey: input.idempotencyKey,
    runId: input.runId,
    responseText: proposed.text,
    newEvents,
    updatedRunState: toPlayerSafeState(currentState),
    classification: { category: classification.category },
    timings,
  };
}

/**
 * Process one player turn. When the turn came from speech, the transcript is
 * returned on every path (including deflections) so the player can see what
 * the system heard.
 */
export async function processTurn(input: TurnInput): Promise<TurnResult> {
  const ctx: { transcribedText?: string } = {};
  const result = await runTurn(input, ctx);
  return ctx.transcribedText ? { ...result, transcribedText: ctx.transcribedText } : result;
}
