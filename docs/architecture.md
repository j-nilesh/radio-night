# Radio Night — Architecture Overview

**Date:** November 8, 2026  
**Status:** Step 1 scaffold complete; vertical slice in progress

---

## System overview

Radio Night is a Next.js web application with a server-authoritative game engine,
a chained voice pipeline, and three independent audio buses.

```
Browser (React)
  │
  ├── Scene view       — static art + dialogue captions
  ├── Input layer      — push-to-talk mic OR text input
  ├── Audio mixer      — Web Audio API: Dialogue / Music / FX buses
  └── Casebook         — Notes, Suspects, Evidence, Timeline

  │  HTTP/streaming
  ▼

Next.js API routes (server)
  │
  ├── POST /api/runs             — create guest session + run
  ├── GET  /api/runs/:id         — player-safe RunState projection
  ├── POST /api/runs/:id/actions — process player turn
  ├── POST /api/stt              — transcription endpoint
  └── POST /api/runs/:id/accuse — accusation validation

  │
  ▼

packages/ai-orchestration
  │
  ├── 1. STT transcription      — audio → text
  ├── 2. Normalization          — confidence check, clean-up
  ├── 3. Control command check  — pause/recap/mute bypass dialogue
  ├── 4. Classification gate    — IN_SCOPE / OUT_OF_SCOPE / etc.
  ├── 5. Story validation       — check scene/knowledge boundaries
  ├── 6. LLM generation         — constrained by filtered context
  ├── 7. Response validation    — no forbidden reveals or invented facts
  └── 8. TTS synthesis          — text → audio

  │
  ▼

packages/game-core
  ├── RunState (authoritative)
  ├── applyEvent (reducer)
  └── checkInvariants

  │
  ▼

Neon PostgreSQL
  ├── guest_sessions
  ├── runs
  ├── run_events
  ├── turns
  ├── audio_assets
  └── provider_usage
```

---

## Key architectural decisions

### ADR-001: Chained pipeline, not monolithic voice model
**Decision:** STT → classify → LLM → TTS, not a single real-time voice model.  
**Rationale:** Control, auditability, per-character voice casting, prompt injection defense, fact validation between stages.  
**Trade-off:** Higher latency than a monolithic model. Target: first audible response ≤ 3 seconds.

### ADR-002: Server-authoritative state, events as audit log
**Decision:** RunState lives in Neon and is only modified by server validators.  
**Rationale:** LLMs cannot commit story facts. Prevents injection attacks from altering game outcomes.  
**Trade-off:** Every turn requires a server round-trip.

### ADR-003: Neon PostgreSQL over Supabase/Turso
**Decision:** Neon is the database. No Supabase, no Turso.  
**Rationale:** Per explicit project requirement in the build readiness plan.  
**Implication:** Use Drizzle ORM with `@neondatabase/serverless` for edge-compatible queries.

### ADR-004: Three independent audio buses
**Decision:** Web Audio API graph with Dialogue, Music, FX/Ambience gain nodes.  
**Rationale:** Critical accessibility feature — users must be able to hear dialogue clearly over ambient sound.  
**Implementation:** See `packages/audio-client/src/mixer.ts`.

### ADR-005: Mock providers first, real providers behind env flag
**Decision:** All provider adapters default to mocks. Set `USE_REAL_PROVIDERS=true` for real API calls.  
**Rationale:** Development without API costs, testable without credentials, safe CI/CD.

---

## Voice pipeline state machine

```
INITIAL → NEED_USER_AUDIO_GESTURE → READY
READY → SCRIPTED_PLAYBACK → READY
READY → RECORDING → UPLOADING_STT → CLASSIFYING
CLASSIFYING → CONTROL_EXECUTION → READY
CLASSIFYING → DEFLECTION_PLAYBACK → READY
CLASSIFYING → STORY_VALIDATION → LLM_GENERATION → TTS → PLAYBACK → READY
Any nonterminal → PAUSED → READY
Any service state → RECOVERABLE_ERROR → RETRY / TYPE / EXIT
```

---

## Security boundaries

| Boundary | Rule |
|---|---|
| Browser ↔ API | Guest token in httpOnly cookie. runId alone is not auth. |
| API ↔ Game engine | Only server validators commit RunState changes |
| API ↔ LLM | Never send full truth or unrevealed secrets to LLM context |
| API → Browser | Response filtered to player-safe projection only |
| Build | `content/*/truth.ts` imports blocked client-side via tsconfig paths |
