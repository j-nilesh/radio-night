/**
 * db/schema/index.ts
 * Drizzle ORM schema for Radio Night.
 * Database: Neon PostgreSQL
 *
 * Tables:
 *   guest_sessions   — opaque tokens for guest players
 *   runs             — one per player investigation
 *   run_events       — append-only event log for each run
 *   turns            — per-turn request/response log (redacted text)
 *   audio_assets     — licensed asset registry with provenance
 *   provider_usage   — per-request API cost tracking
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  real,
  uuid,
  index,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Guest sessions
// ---------------------------------------------------------------------------

export const guestSessions = pgTable("guest_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** HMAC-SHA256 of the random token — never store the raw token */
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  /** Soft-deleted flag for abuse management */
  revoked: boolean("revoked").notNull().default(false),
  /** Rough request count for rate-limiting */
  requestCount: integer("request_count").notNull().default(0),
  /** Characters of speech synthesised for this visitor (ADR 0014) */
  voiceCharsUsed: integer("voice_chars_used").notNull().default(0),
  /** This visitor's voice allowance in characters; null means the public default */
  voiceCharsAllowance: integer("voice_chars_allowance"),
  /** Model-played replies so far (the rest fall back to the written lines) */
  modelRepliesUsed: integer("model_replies_used").notNull().default(0),
  /** Which access code this visitor entered (its label, never the code) */
  accessLabel: text("access_label"),
});

// ---------------------------------------------------------------------------
// Runs — one per investigation
// ---------------------------------------------------------------------------

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Foreign key to guest_sessions.id — nullable if account-based auth added later */
    guestSessionId: uuid("guest_session_id").references(() => guestSessions.id),
    caseId: text("case_id").notNull(),
    caseVersion: text("case_version").notNull(),
    playMode: text("play_mode").notNull().default("solo"), // 'solo' | 'together'
    /** Monotonically increasing version counter for optimistic concurrency */
    revision: integer("revision").notNull().default(0),
    /** Full RunState as JSON — authoritative server state */
    stateJson: jsonb("state_json").notNull(),
    /**
     * Recent exchanges per character ({ [characterId]: [{question, answer}] }),
     * capped at a few per character, so a model-voiced character remembers the
     * conversation. Kept server-side because a history sent by the browser could be forged.
     */
    dialogueJson: jsonb("dialogue_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** True after the player reaches an ending */
    finished: boolean("finished").notNull().default(false),
  },
  (table) => ({
    guestSessionIdx: index("runs_guest_session_idx").on(table.guestSessionId),
    caseIdx: index("runs_case_idx").on(table.caseId),
  })
);

// ---------------------------------------------------------------------------
// Run events — append-only event log
// ---------------------------------------------------------------------------

export const runEvents = pgTable(
  "run_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id),
    /** Monotonically increasing per run */
    sequence: integer("sequence").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    runSequenceIdx: index("run_events_run_sequence_idx").on(table.runId, table.sequence),
  })
);

// ---------------------------------------------------------------------------
// Turns — per-interaction request/response log
// ---------------------------------------------------------------------------

export const turns = pgTable(
  "turns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id),
    /** Caller-provided idempotency key — used for deduplication */
    idempotencyKey: text("idempotency_key").notNull().unique(),
    /** 'player' or 'narrator' */
    actor: text("actor").notNull(),
    /** Redacted player text — only stored if explicit opt-in; default null */
    redactedText: text("redacted_text"),
    /** Classification result: IN_SCOPE, OUT_OF_SCOPE, etc. */
    decisionCode: text("decision_code").notNull(),
    /** Whether TTS audio was generated */
    audioGenerated: boolean("audio_generated").notNull().default(false),
    /** Asset ID reference if prerecorded or cached */
    audioAssetRef: text("audio_asset_ref"),
    /** End-to-end timing breakdown in ms */
    timingsJson: jsonb("timings_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    runIdx: index("turns_run_idx").on(table.runId),
    idempotencyIdx: index("turns_idempotency_idx").on(table.idempotencyKey),
  })
);

// ---------------------------------------------------------------------------
// Audio assets — licensed asset registry
// ---------------------------------------------------------------------------

export const audioAssets = pgTable("audio_assets", {
  assetId: text("asset_id").primaryKey(),
  /** 'dialogue' | 'music' | 'fx' | 'ambience' */
  category: text("category").notNull(),
  purpose: text("purpose").notNull(),
  /** 'generated' | 'licensed' | 'recorded' | 'composed' */
  sourceType: text("source_type").notNull(),
  provider: text("provider"),
  modelOrLibrary: text("model_or_library"),
  /** License short name: MIT, CC-BY-4.0, commercial, etc. */
  license: text("license"),
  redistributionAllowed: boolean("redistribution_allowed"),
  proofLocation: text("proof_location"),
  version: text("version").notNull().default("1.0"),
  fileUrl: text("file_url"),
  loop: boolean("loop").notNull().default(false),
  durationMs: integer("duration_ms"),
  /** LUFS loudness — null until mastered */
  loudnessLufs: real("loudness_lufs"),
  /** Spoken caption for accessibility */
  captionText: text("caption_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Provider usage — server-side cost tracking
// ---------------------------------------------------------------------------

export const providerUsage = pgTable(
  "provider_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").references(() => runs.id),
    turnId: uuid("turn_id").references(() => turns.id),
    /** elevenlabs | cartesia | fish | deepgram | openai | anthropic */
    provider: text("provider").notNull(),
    /** stt | tts | llm | sfx */
    feature: text("feature").notNull(),
    /** Tokens (LLM), characters (TTS), seconds (STT) */
    units: real("units"),
    /** Estimated cost in USD */
    estimatedCostUsd: real("estimated_cost_usd"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    runIdx: index("provider_usage_run_idx").on(table.runId),
    providerIdx: index("provider_usage_provider_idx").on(table.provider),
  })
);
