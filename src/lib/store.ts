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

/** One question and answer with a character. */
export type DialogueExchange = { question: string; answer: string };

/** How many exchanges per character are remembered. */
export const DIALOGUE_MEMORY = 6;
/** Longest stored question or answer, so memory cannot be used to bloat prompts. */
const MAX_REMEMBERED_CHARS = 1000;

function trimExchange(ex: DialogueExchange): DialogueExchange {
  return {
    question: ex.question.slice(0, MAX_REMEMBERED_CHARS),
    answer: ex.answer.slice(0, MAX_REMEMBERED_CHARS),
  };
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type SessionRecord = {
  id: string;
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
  requestCount: number;
  /** Characters of speech synthesised for this visitor */
  voiceCharsUsed: number;
  /** Voice allowance in characters; null means the public default (ADR 0014) */
  voiceCharsAllowance: number | null;
  modelRepliesUsed: number;
  /** Label of the access code this visitor entered, never the code itself */
  accessLabel: string | null;
};

/** One provider call, for the owner's usage page. No player text. */
export type UsageEntry = {
  runId?: string;
  provider: string;
  /** stt | tts | llm */
  feature: "stt" | "tts" | "llm";
  /** Characters (tts), seconds (stt) or tokens (llm) */
  units: number;
  estimatedCostUsd: number;
};

export type UsageDay = {
  day: string;
  provider: string;
  feature: string;
  calls: number;
  units: number;
  costUsd: number;
};

export type VisitorDay = { day: string; visitors: number; withCode: number; voiceCapped: number; runs: number };

export type RunRecord = {
  id: string;
  guestSessionId: string;
  caseId: string;
  caseVersion: string;
  playMode: string;
  revision: number;
  stateJson: RunState;
  /** When the run was last saved (set by the store; absent on a run being created) */
  updatedAt?: Date;
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
  /**
   * The most recently saved run belonging to a guest token, or null. This is what
   * "continue" offers. Same ownership rule as findRunForToken: only a matching,
   * unrevoked session can see its runs.
   */
  findLatestRunForToken(tokenHash: string): Promise<{ run: RunRecord; session: SessionRecord } | null>;
  findTurnByIdempotencyKey(idempotencyKey: string): Promise<boolean>;
  insertEvents(events: EventInsert[]): Promise<void>;
  /** Optimistic update: only applies if the run's current revision matches expectedRevision. */
  updateRunState(
    runId: string,
    newState: RunState,
    expectedRevision: number
  ): Promise<void>;
  insertTurn(turn: TurnInsert): Promise<void>;
  /** Counts a request and keeps the session alive for another `extendTo` (sliding expiry). */
  incrementSessionRequests(sessionId: string, extendTo?: Date): Promise<void>;
  /** The live (unrevoked, unexpired) session for a guest token. */
  findSessionByToken(tokenHash: string): Promise<SessionRecord | null>;
  addVoiceChars(sessionId: string, chars: number): Promise<void>;
  addModelReply(sessionId: string): Promise<void>;
  /** Record an access code on a session and set its voice allowance. */
  setAccess(sessionId: string, label: string, voiceCharsAllowance: number): Promise<void>;
  recordUsage(entry: UsageEntry): Promise<void>;
  /** Provider use per day for the last `days` days, newest first. */
  usageByDay(days: number): Promise<UsageDay[]>;
  visitorsByDay(days: number, publicVoiceChars: number): Promise<VisitorDay[]>;
  /** Recent exchanges between the detective and one character, oldest first. */
  getDialogue(runId: string, characterId: string): Promise<DialogueExchange[]>;
  appendDialogue(runId: string, characterId: string, exchange: DialogueExchange): Promise<void>;
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
  private dialogue = new Map<string, Record<string, DialogueExchange[]>>();
  private usage: Array<UsageEntry & { at: Date }> = [];
  private sessionCreated = new Map<string, Date>();

  async createSession(tokenHash: string, expiresAt: Date): Promise<SessionRecord> {
    const session: SessionRecord = {
      id: crypto.randomUUID(),
      tokenHash,
      expiresAt,
      revoked: false,
      requestCount: 0,
      voiceCharsUsed: 0,
      voiceCharsAllowance: null,
      modelRepliesUsed: 0,
      accessLabel: null,
    };
    this.sessions.set(session.id, session);
    this.sessionCreated.set(session.id, new Date());
    return session;
  }

  async createRun(run: RunRecord): Promise<void> {
    this.runs.set(run.id, { ...run, updatedAt: new Date() });
  }

  async findRunForToken(runId: string, tokenHash: string) {
    const run = this.runs.get(runId);
    if (!run) return null;
    const session = this.sessions.get(run.guestSessionId);
    if (!session || session.revoked || session.tokenHash !== tokenHash || session.expiresAt <= new Date()) return null;
    return { run: { ...run }, session: { ...session } };
  }

  async findLatestRunForToken(tokenHash: string) {
    let latest: RunRecord | undefined;
    for (const run of this.runs.values()) {
      const session = this.sessions.get(run.guestSessionId);
      if (!session || session.revoked || session.tokenHash !== tokenHash || session.expiresAt <= new Date()) continue;
      if (!latest || (run.updatedAt?.getTime() ?? 0) >= (latest.updatedAt?.getTime() ?? 0)) latest = run;
    }
    if (!latest) return null;
    return { run: { ...latest }, session: { ...this.sessions.get(latest.guestSessionId)! } };
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
    run.updatedAt = new Date();
  }

  async insertTurn(turn: TurnInsert): Promise<void> {
    this.turnKeys.add(turn.idempotencyKey);
  }

  async incrementSessionRequests(sessionId: string, extendTo?: Date): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.requestCount += 1;
      if (extendTo && extendTo > session.expiresAt) session.expiresAt = extendTo;
    }
  }
  async findSessionByToken(tokenHash: string): Promise<SessionRecord | null> {
    for (const session of this.sessions.values()) {
      if (session.tokenHash === tokenHash && !session.revoked && session.expiresAt > new Date()) return { ...session };
    }
    return null;
  }
  async addVoiceChars(sessionId: string, chars: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) session.voiceCharsUsed += chars;
  }
  async addModelReply(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) session.modelRepliesUsed += 1;
  }
  async setAccess(sessionId: string, label: string, voiceCharsAllowance: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.accessLabel = label;
      session.voiceCharsAllowance = voiceCharsAllowance;
    }
  }
  async recordUsage(entry: UsageEntry): Promise<void> {
    this.usage.push({ ...entry, at: new Date() });
  }
  async usageByDay(days: number): Promise<UsageDay[]> {
    const since = Date.now() - days * 86_400_000;
    const groups = new Map<string, UsageDay>();
    for (const u of this.usage) {
      if (u.at.getTime() < since) continue;
      const day = u.at.toISOString().slice(0, 10);
      const key = `${day}|${u.provider}|${u.feature}`;
      const g = groups.get(key) ?? { day, provider: u.provider, feature: u.feature, calls: 0, units: 0, costUsd: 0 };
      g.calls += 1;
      g.units += u.units;
      g.costUsd += u.estimatedCostUsd;
      groups.set(key, g);
    }
    return [...groups.values()].sort((a, b) => b.day.localeCompare(a.day) || a.provider.localeCompare(b.provider));
  }
  async visitorsByDay(days: number, publicVoiceChars: number): Promise<VisitorDay[]> {
    const since = Date.now() - days * 86_400_000;
    const out = new Map<string, VisitorDay>();
    for (const s of this.sessions.values()) {
      const created = this.sessionCreated.get(s.id);
      if (!created || created.getTime() < since) continue;
      const day = created.toISOString().slice(0, 10);
      const d = out.get(day) ?? { day, visitors: 0, withCode: 0, voiceCapped: 0, runs: 0 };
      d.visitors += 1;
      if (s.accessLabel) d.withCode += 1;
      if (s.voiceCharsUsed >= (s.voiceCharsAllowance ?? publicVoiceChars)) d.voiceCapped += 1;
      d.runs += [...this.runs.values()].filter((r) => r.guestSessionId === s.id).length;
      out.set(day, d);
    }
    return [...out.values()].sort((a, b) => b.day.localeCompare(a.day));
  }

  async getDialogue(runId: string, characterId: string): Promise<DialogueExchange[]> {
    return [...(this.dialogue.get(runId)?.[characterId] ?? [])];
  }

  async appendDialogue(runId: string, characterId: string, exchange: DialogueExchange): Promise<void> {
    const byCharacter = this.dialogue.get(runId) ?? {};
    const list = [...(byCharacter[characterId] ?? []), trimExchange(exchange)].slice(-DIALOGUE_MEMORY);
    this.dialogue.set(runId, { ...byCharacter, [characterId]: list });
  }
}

// ---------------------------------------------------------------------------
// Neon (Drizzle) implementation
// ---------------------------------------------------------------------------

type SessionRow = {
  id: string;
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
  requestCount: number;
  voiceCharsUsed: number;
  voiceCharsAllowance: number | null;
  modelRepliesUsed: number;
  accessLabel: string | null;
};
function sessionFromRow(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    revoked: row.revoked,
    requestCount: row.requestCount,
    voiceCharsUsed: row.voiceCharsUsed,
    voiceCharsAllowance: row.voiceCharsAllowance,
    modelRepliesUsed: row.modelRepliesUsed,
    accessLabel: row.accessLabel,
  };
}

class NeonStore implements RunStore {
  readonly backend = "neon" as const;

  async createSession(tokenHash: string, expiresAt: Date): Promise<SessionRecord> {
    const { db, guestSessions } = await import("../../db");
    const [row] = await db
      .insert(guestSessions)
      .values({ tokenHash, expiresAt })
      .returning();
    return sessionFromRow(row);
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
    const { eq, and, gt } = await import("drizzle-orm");
    const [row] = await db
      .select()
      .from(runs)
      .innerJoin(guestSessions, eq(runs.guestSessionId, guestSessions.id))
      .where(
        and(
          eq(runs.id, runId),
          eq(guestSessions.tokenHash, tokenHash),
          eq(guestSessions.revoked, false),
          gt(guestSessions.expiresAt, new Date())
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
      session: sessionFromRow(row.guest_sessions),
    };
  }

  async findLatestRunForToken(tokenHash: string) {
    const { db, runs, guestSessions } = await import("../../db");
    const { eq, and, desc, gt } = await import("drizzle-orm");
    const [row] = await db
      .select()
      .from(runs)
      .innerJoin(guestSessions, eq(runs.guestSessionId, guestSessions.id))
      .where(and(eq(guestSessions.tokenHash, tokenHash), eq(guestSessions.revoked, false), gt(guestSessions.expiresAt, new Date())))
      .orderBy(desc(runs.updatedAt))
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
        updatedAt: row.runs.updatedAt,
      },
      session: sessionFromRow(row.guest_sessions),
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

  async incrementSessionRequests(sessionId: string, extendTo?: Date): Promise<void> {
    const { db, guestSessions } = await import("../../db");
    const { eq, sql } = await import("drizzle-orm");
    await db
      .update(guestSessions)
      .set({
        requestCount: sql`${guestSessions.requestCount} + 1`,
        lastSeenAt: new Date(),
        ...(extendTo ? { expiresAt: sql`greatest(${guestSessions.expiresAt}, ${extendTo})` } : {}),
      })
      .where(eq(guestSessions.id, sessionId));
  }
  async findSessionByToken(tokenHash: string): Promise<SessionRecord | null> {
    const { db, guestSessions } = await import("../../db");
    const { eq, and, gt } = await import("drizzle-orm");
    const [row] = await db
      .select()
      .from(guestSessions)
      .where(and(eq(guestSessions.tokenHash, tokenHash), eq(guestSessions.revoked, false), gt(guestSessions.expiresAt, new Date())))
      .limit(1);
    return row ? sessionFromRow(row) : null;
  }
  async addVoiceChars(sessionId: string, chars: number): Promise<void> {
    const { db, guestSessions } = await import("../../db");
    const { eq, sql } = await import("drizzle-orm");
    await db
      .update(guestSessions)
      .set({ voiceCharsUsed: sql`${guestSessions.voiceCharsUsed} + ${Math.round(chars)}` })
      .where(eq(guestSessions.id, sessionId));
  }
  async addModelReply(sessionId: string): Promise<void> {
    const { db, guestSessions } = await import("../../db");
    const { eq, sql } = await import("drizzle-orm");
    await db
      .update(guestSessions)
      .set({ modelRepliesUsed: sql`${guestSessions.modelRepliesUsed} + 1` })
      .where(eq(guestSessions.id, sessionId));
  }
  async setAccess(sessionId: string, label: string, voiceCharsAllowance: number): Promise<void> {
    const { db, guestSessions } = await import("../../db");
    const { eq } = await import("drizzle-orm");
    await db.update(guestSessions).set({ accessLabel: label, voiceCharsAllowance }).where(eq(guestSessions.id, sessionId));
  }
  async recordUsage(entry: UsageEntry): Promise<void> {
    const { db, providerUsage } = await import("../../db");
    await db.insert(providerUsage).values({
      runId: entry.runId,
      provider: entry.provider,
      feature: entry.feature,
      units: entry.units,
      estimatedCostUsd: entry.estimatedCostUsd,
    });
  }
  async usageByDay(days: number): Promise<UsageDay[]> {
    const { db } = await import("../../db");
    const { sql } = await import("drizzle-orm");
    const rows = await db.execute(sql`
      select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, provider, feature,
             count(*)::int as calls, coalesce(sum(units), 0)::float as units, coalesce(sum(estimated_cost_usd), 0)::float as cost
      from provider_usage
      where created_at > now() - make_interval(days => ${days})
      group by 1, 2, 3
      order by 1 desc, 2, 3`);
    return (rows.rows as Array<Record<string, unknown>>).map((r) => ({
      day: String(r.day),
      provider: String(r.provider),
      feature: String(r.feature),
      calls: Number(r.calls),
      units: Number(r.units),
      costUsd: Number(r.cost),
    }));
  }
  async visitorsByDay(days: number, publicVoiceChars: number): Promise<VisitorDay[]> {
    const { db } = await import("../../db");
    const { sql } = await import("drizzle-orm");
    const rows = await db.execute(sql`
      select to_char(date_trunc('day', s.created_at), 'YYYY-MM-DD') as day,
             count(distinct s.id)::int as visitors,
             count(distinct s.id) filter (where s.access_label is not null)::int as with_code,
             count(distinct s.id) filter (where s.voice_chars_used >= coalesce(s.voice_chars_allowance, ${publicVoiceChars}))::int as capped,
             count(r.id)::int as runs
      from guest_sessions s left join runs r on r.guest_session_id = s.id
      where s.created_at > now() - make_interval(days => ${days})
      group by 1
      order by 1 desc`);
    return (rows.rows as Array<Record<string, unknown>>).map((r) => ({
      day: String(r.day),
      visitors: Number(r.visitors),
      withCode: Number(r.with_code),
      voiceCapped: Number(r.capped),
      runs: Number(r.runs),
    }));
  }

  async getDialogue(runId: string, characterId: string): Promise<DialogueExchange[]> {
    const { db, runs } = await import("../../db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select({ d: runs.dialogueJson }).from(runs).where(eq(runs.id, runId)).limit(1);
    const all = (row?.d ?? {}) as Record<string, DialogueExchange[]>;
    return [...(all[characterId] ?? [])];
  }

  async appendDialogue(runId: string, characterId: string, exchange: DialogueExchange): Promise<void> {
    const { db, runs } = await import("../../db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select({ d: runs.dialogueJson }).from(runs).where(eq(runs.id, runId)).limit(1);
    const all = (row?.d ?? {}) as Record<string, DialogueExchange[]>;
    const list = [...(all[characterId] ?? []), trimExchange(exchange)].slice(-DIALOGUE_MEMORY);
    await db.update(runs).set({ dialogueJson: { ...all, [characterId]: list } }).where(eq(runs.id, runId));
  }
}

// ---------------------------------------------------------------------------
// Store selection (singleton)
// ---------------------------------------------------------------------------

// Kept on globalThis, not in a module variable, so a development hot reload does not
// throw away the in-memory runs (a player mid-investigation would lose their save).
const holder = globalThis as typeof globalThis & { __radioNightStore?: RunStore | null };

export function getStore(): RunStore {
  if (holder.__radioNightStore) return holder.__radioNightStore;

  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
    holder.__radioNightStore = new NeonStore();
  } else {
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[store] DATABASE_URL not set — using in-memory store. " +
          "Data will not persist across restarts. Set DATABASE_URL for persistent saves."
      );
    }
    holder.__radioNightStore = new MemoryStore();
  }
  return holder.__radioNightStore;
}
