/**
 * lib/store.ts
 * Data-access layer for runs, sessions, turns, and events.
 * SERVER-ONLY.
 *
 * Two backends:
 *   - Neon (Drizzle) when DATABASE_URL is set — authoritative production store
 *   - In-memory map when DATABASE_URL is absent — local dev / demo convenience
 *
 * Both backends implement the same RunStore interface, so API routes never
 * branch on which one is active. Security invariants (token-ownership checks,
 * idempotency dedup, per-session caps) are identical in both.
 *
 * NOTE: the in-memory store is NOT for production. Data resets on restart and
 * does not survive across serverless invocations. It exists so the game can be
 * explored end-to-end without provisioning a database.
 */

import type { RunState } from "@game-core";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type SessionRecord = {
  id: string;
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
  requestCount: number;
};

export type RunRecord = {
  id: string;
  guestSessionId: string;
  caseId: string;
  caseVersion: string;
  playMode: string;
  revision: number;
  stateJson: RunState;
};

export type TurnInsert = {
  runId: string;
  idempotencyKey: string;
  actor: string;
  decisionCode: string;
  audioGenerated: boolean;
  timingsJson?: unknown;
};

export type EventInsert = {
  runId: string;
  sequence: number;
  eventType: string;
  payload: Record<string, unknown>;
};

export interface RunStore {
  readonly backend: "neon" | "memory";
  createSession(tokenHash: string, expiresAt: Date): Promise<SessionRecord>;
  createRun(run: RunRecord): Promise<void>;
  /** Returns run + owning session, or null if not found / token mismatch / revoked. */
  findRunForToken(
    runId: string,
    tokenHash: string
  ): Promise<{ run: RunRecord; session: SessionRecord } | null>;
  findTurnByIdempotencyKey(idempotencyKey: string): Promise<boolean>;
  insertEvents(events: EventInsert[]): Promise<void>;
  /** Optimistic update: only applies if the run's current revision matches expectedRevision. */
  updateRunState(
    runId: string,
    newState: RunState,
    expectedRevision: number
  ): Promise<void>;
  insertTurn(turn: TurnInsert): Promise<void>;
  incrementSessionRequests(sessionId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory implementation
// ---------------------------------------------------------------------------

class MemoryStore implements RunStore {
  readonly backend = "memory" as const;

  private sessions = new Map<string, SessionRecord>();
  private runs = new Map<string, RunRecord>();
  private turnKeys = new Set<string>();
  private events: EventInsert[] = [];

  async createSession(tokenHash: string, expiresAt: Date): Promise<SessionRecord> {
    const session: SessionRecord = {
      id: crypto.randomUUID(),
      tokenHash,
      expiresAt,
      revoked: false,
      requestCount: 0,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async createRun(run: RunRecord): Promise<void> {
    this.runs.set(run.id, { ...run });
  }

  async findRunForToken(runId: string, tokenHash: string) {
    const run = this.runs.get(runId);
    if (!run) return null;
    const session = this.sessions.get(run.guestSessionId);
    if (!session || session.revoked || session.tokenHash !== tokenHash) return null;
    return { run: { ...run }, session: { ...session } };
  }

  async findTurnByIdempotencyKey(idempotencyKey: string): Promise<boolean> {
    return this.turnKeys.has(idempotencyKey);
  }

  async insertEvents(events: EventInsert[]): Promise<void> {
    this.events.push(...events);
  }

  async updateRunState(
    runId: string,
    newState: RunState,
    expectedRevision: number
  ): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) return;
    // Optimistic concurrency: skip if revision drifted
    if (run.revision !== expectedRevision) return;
    run.stateJson = newState;
    run.revision = newState.revision;
  }

  async insertTurn(turn: TurnInsert): Promise<void> {
    this.turnKeys.add(turn.idempotencyKey);
  }

  async incrementSessionRequests(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.requestCount += 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Neon (Drizzle) implementation
// ---------------------------------------------------------------------------

class NeonStore implements RunStore {
  readonly backend = "neon" as const;

  async createSession(tokenHash: string, expiresAt: Date): Promise<SessionRecord> {
    const { db, guestSessions } = await import("../../db");
    const [row] = await db
      .insert(guestSessions)
      .values({ tokenHash, expiresAt })
      .returning();
    return {
      id: row.id,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      revoked: row.revoked,
      requestCount: row.requestCount,
    };
  }

  async createRun(run: RunRecord): Promise<void> {
    const { db, runs } = await import("../../db");
    await db.insert(runs).values({
      id: run.id,
      guestSessionId: run.guestSessionId,
      caseId: run.caseId,
      caseVersion: run.caseVersion,
      playMode: run.playMode,
      revision: run.revision,
      stateJson: run.stateJson,
    });
  }

  async findRunForToken(runId: string, tokenHash: string) {
    const { db, runs, guestSessions } = await import("../../db");
    const { eq, and } = await import("drizzle-orm");
    const [row] = await db
      .select()
      .from(runs)
      .innerJoin(guestSessions, eq(runs.guestSessionId, guestSessions.id))
      .where(
        and(
          eq(runs.id, runId),
          eq(guestSessions.tokenHash, tokenHash),
          eq(guestSessions.revoked, false)
        )
      )
      .limit(1);

    if (!row) return null;
    return {
      run: {
        id: row.runs.id,
        guestSessionId: row.runs.guestSessionId ?? "",
        caseId: row.runs.caseId,
        caseVersion: row.runs.caseVersion,
        playMode: row.runs.playMode,
        revision: row.runs.revision,
        stateJson: row.runs.stateJson as RunState,
      },
      session: {
        id: row.guest_sessions.id,
        tokenHash: row.guest_sessions.tokenHash,
        expiresAt: row.guest_sessions.expiresAt,
        revoked: row.guest_sessions.revoked,
        requestCount: row.guest_sessions.requestCount,
      },
    };
  }

  async findTurnByIdempotencyKey(idempotencyKey: string): Promise<boolean> {
    const { db, turns } = await import("../../db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select({ id: turns.id })
      .from(turns)
      .where(eq(turns.idempotencyKey, idempotencyKey))
      .limit(1);
    return !!row;
  }

  async insertEvents(events: EventInsert[]): Promise<void> {
    if (events.length === 0) return;
    const { db, runEvents } = await import("../../db");
    await db.insert(runEvents).values(events);
  }

  async updateRunState(
    runId: string,
    newState: RunState,
    expectedRevision: number
  ): Promise<void> {
    const { db, runs } = await import("../../db");
    const { eq, and } = await import("drizzle-orm");
    await db
      .update(runs)
      .set({ stateJson: newState, revision: newState.revision, updatedAt: new Date() })
      .where(and(eq(runs.id, runId), eq(runs.revision, expectedRevision)));
  }

  async insertTurn(turn: TurnInsert): Promise<void> {
    const { db, turns } = await import("../../db");
    await db.insert(turns).values({
      runId: turn.runId,
      idempotencyKey: turn.idempotencyKey,
      actor: turn.actor,
      redactedText: null,
      decisionCode: turn.decisionCode,
      audioGenerated: turn.audioGenerated,
      timingsJson: turn.timingsJson,
    });
  }

  async incrementSessionRequests(sessionId: string): Promise<void> {
    const { db, guestSessions } = await import("../../db");
    const { eq, sql } = await import("drizzle-orm");
    await db
      .update(guestSessions)
      .set({
        requestCount: sql`${guestSessions.requestCount} + 1`,
        lastSeenAt: new Date(),
      })
      .where(eq(guestSessions.id, sessionId));
  }
}

// ---------------------------------------------------------------------------
// Store selection (singleton)
// ---------------------------------------------------------------------------

let _store: RunStore | null = null;

export function getStore(): RunStore {
  if (_store) return _store;

  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
    _store = new NeonStore();
  } else {
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[store] DATABASE_URL not set — using in-memory store. " +
          "Data will not persist across restarts. Set DATABASE_URL for persistent saves."
      );
    }
    _store = new MemoryStore();
  }
  return _store;
}
