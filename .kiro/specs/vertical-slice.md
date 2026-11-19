# Spec: Vertical Slice — First Playable Room

**Status:** Complete (superseded by the full case, "The Sitting"). Reviewed 19 November 2026.  
**Started:** November 8, 2026  
**Goal:** Prove the full voice pipeline end-to-end with a disposable test character.

---

## Requirements

### Functional

1. A guest opens the app and reaches a playable room **without signing in or paying**.
2. A player can ask a question **by text** and receive an on-topic, canon-respecting answer.
3. A player can ask **by microphone** (push-to-talk) and hear a TTS response.
4. At least **3 categories of irrelevant/abusive/anachronistic** inputs trigger in-character deflections with no state change.
5. A **restricted fact** cannot be extracted via paraphrase or prompt injection (verified by automated tests).
6. **Dialogue and ambience** can be adjusted independently without affecting TTS source audio.
7. **Save/refresh/resume** persists game state correctly against Neon.
8. API credentials are **never visible client-side**.
9. Logs show approximate **turn latency** and failures.
10. A short README allows the slice to run locally.

### Technical acceptance criteria

- [x] `POST /api/runs` creates a guest session and returns a run token (src/app/api/runs/route.ts; httpOnly Secure cookie)
- [x] `POST /api/runs/:id/actions` with typed action returns character response and updates RunState
- [x] Mock STT/TTS/LLM providers work end-to-end in development
- [x] Real provider path works behind `USE_REAL_PROVIDERS=true` env flag (Deepgram, Cartesia, ElevenLabs, Anthropic; live at radionight.app)
- [x] `GET /api/runs/:id` returns player-safe state (no truth fields; raw state removed from responses in ADR 0014)
- [x] Deflection tests pass: 3 out-of-scope, 1 prompt injection, 1 anachronism (and the injection suites in robustness.test.ts)
- [x] Audio buses: dialogue gain, music gain, fx gain independently adjustable
- [x] Vitest suite passes with no failing tests (CI on every push)

---

## Scope limits

- This slice uses a **disposable test character** unrelated to the actual mystery.
- The test character has ~12 public facts, ~5 concealed facts, ~3 discoverable facts with release conditions.
- **Do not implement the actual Radio Night mystery** in this slice.
- Do not build the full casebook UI — only text display of character response.
- Do not build scene art, portraits, or visual polish.

---

## Test character specification

**Name:** "The Keeper" (test only, will be deleted)  
**Setting:** An unnamed archive room, 1940s  
**Public facts:**
- Works in the archive, has done so for 15 years
- Keeps records of all visitors
- Dislikes the smell of cigarettes
- The archive closes at 6pm
- There was a fire in the west wing two years ago
- He saw a woman in a blue coat last Tuesday
- He did not speak to the visitor in Room 4
- The visitor arrived after nine
- He served as a courier during the war
- He cannot read shorthand
- The telephone in the archive has been broken for three weeks
- He does not own a car

**Concealed facts (not revealed without release condition):**
- He burned the ledger from the night of the fire
- He recognized the woman in the blue coat as the inspector's wife
- He was paid to say the visitor arrived after nine

**Discoverable facts (released when specified condition met):**
- ledger_destroyed: released when player asks specifically about the visitor log from two years ago
- recognized_woman: released when player already has visitor_seen_blue_coat + asks about her identity
- paid_for_testimony: released when player already has ledger_destroyed AND recognized_woman AND confronts him

---

## Implementation tasks

- [x] Project scaffold (Next.js, TypeScript, Tailwind, Drizzle, Vitest)
- [x] .kiro/ steering files
- [x] Neon DB schema and migration
- [x] Provider adapter interfaces (STT, TTS, LLM)
- [x] Mock provider implementations
- [x] Game-core: RunState schema and reducer
- [x] API: POST /api/runs
- [x] API: POST /api/runs/:id/actions
- [x] API: GET /api/runs/:id
- [x] Classification gate (relevance, deflection, control command)
- [x] Test character fact store wired to classification gate
- [x] TTS integration (mock first, real provider second)
- [x] Audio bus component (Web Audio API)
- [x] Basic room UI (text input, response display, audio controls)
- [x] Push-to-talk microphone capture
- [x] STT integration (mock first, real provider second)
- [x] Vitest tests for invariants and security
- [x] README with local setup instructions

## Outcome
Every requirement above is met by the full game rather than the test character, which is now a test fixture only (`content/cases/test-keeper`, used by the orchestrator tests and no longer playable). Requirement 7 (save and resume against Neon) was met on 19 November 2026 (ADR 0005, ADR 0012).
