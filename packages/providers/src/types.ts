/**
 * providers/types.ts
 * Provider adapter interfaces for STT, TTS, and LLM.
 * All real provider implementations must satisfy these contracts.
 */

// ---------------------------------------------------------------------------
// Speech-to-Text
// ---------------------------------------------------------------------------

export type SpeechContext = {
  caseId?: string;
  sceneId?: string;
  /** Period/setting hint for domain-specific vocabulary */
  periodHint?: string;
  /** Container of the recording, e.g. "audio/webm" (Chrome) or "audio/mp4" (Safari) */
  mimeType?: string;
  /** Names and places the recogniser should favour, e.g. "Kowalski" */
  keyterms?: string[];
};

export type TranscriptResult = {
  text: string;
  confidence: number; // 0–1
  durationMs: number;
  words?: Array<{ word: string; startMs: number; endMs: number }>;
};

export interface SpeechToTextProvider {
  transcribe(audio: Uint8Array, context: SpeechContext): Promise<TranscriptResult>;
  readonly providerName: string;
}

// ---------------------------------------------------------------------------
// Text-to-Speech
// ---------------------------------------------------------------------------

export type VoiceProfile = {
  characterId: string;
  provider: "elevenlabs" | "cartesia" | "fish" | "deepgram" | "mock";
  model: string;
  voiceId: string;
  delivery: {
    pace?: number;
    stability?: number;
    expressiveness?: number;
  };
  targetFormat: "pcm16" | "wav" | "mp3" | "opus";
  fallbackPolicy: "retry_same_voice" | "captions_only" | "approved_cached_line";
};

export type TTSRequest = {
  text: string;
  voice: VoiceProfile;
  requestId: string;
};

export type TTSAudio = {
  data: Uint8Array;
  mimeType: string;
  sampleRate?: number;
  durationMs?: number;
};

/** Audio delivered as it is produced, so playback can begin before synthesis ends. */
export type TTSStream = {
  stream: ReadableStream<Uint8Array>;
  mimeType: string;
};

export interface TextToSpeechProvider {
  synthesize(request: TTSRequest): Promise<TTSAudio>;
  /**
   * Optional. When present, callers prefer it: the first bytes arrive well before
   * the whole line is ready. Errors that can be known up front (a rejected key,
   * a bad voice) are thrown here, before any audio is returned.
   */
  synthesizeStream?(request: TTSRequest): Promise<TTSStream>;
  readonly providerName: string;
  readonly supportedFormats: VoiceProfile["targetFormat"][];
}

// ---------------------------------------------------------------------------
// LLM / Dialogue
// ---------------------------------------------------------------------------

/**
 * The authorized context passed to the LLM.
 * Server-side filtered: never includes truth, unrevealed secrets, or full solution.
 */
export type AuthorizedDialogueContext = {
  requestId: string;
  characterId: string;
  characterName: string;
  speechStyle: string;
  publicBackstory: string;
  /** Only facts this character is permitted to know and disclose right now */
  permittedFacts: Array<{ factId: string; description: string }>;
  /** The player's current question/utterance */
  playerQuestion: string;
  /** Last safe topic anchor for deflection fallback */
  lastSafeTopic?: string;
  /** Any claims the character has already made this run (for consistency) */
  previousClaims: Array<{ claimId: string; text: string }>;
  /** The historical period/setting constraints */
  periodConstraints: string[];
  /** Safe, non-committal lines the character may use when nothing is authored */
  fallbackLines?: string[];
  /**
   * A fully built prompt for model-backed providers: the character's system prompt
   * (already filtered to what this character may know) and the recent exchange.
   * The final message is always the detective's current question.
   */
  prompt?: DialoguePrompt;
};

export type DialoguePrompt = {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
};

export type ProposedResponse = {
  text: string;
  /** Claim IDs this response asserts — for server-side validation */
  assertedClaimIds?: string[];
  /** Whether this response reveals a new fact — server validates */
  revealsFactId?: string;
  /** Token use, when the provider reports it (for cost tracking) */
  usage?: { inputTokens: number; outputTokens: number };
};

export interface DialogueProvider {
  respond(context: AuthorizedDialogueContext): Promise<ProposedResponse>;
  readonly providerName: string;
  readonly modelId: string;
}

// ---------------------------------------------------------------------------
// Provider registry — maps character IDs to their assigned providers
// ---------------------------------------------------------------------------

export type ProviderConfig = {
  stt: SpeechToTextProvider;
  tts: TextToSpeechProvider;
  dialogue: DialogueProvider;
};
