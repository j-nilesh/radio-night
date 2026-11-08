# Radio Night — Architecture Rules & Conventions

> These rules apply to all code written in this project. Kiro and all contributors must follow them without exception.

---

## 1. Directory structure

```
apps/                        (reserved for future multi-app expansion)
src/
  app/                       Next.js App Router pages and API routes
    (route)/
      page.tsx               Page component
      layout.tsx             Layout
    api/
      (route)/route.ts       API route handlers
  components/                Shared UI components
  lib/                       Shared utilities and server-side helpers
packages/
  game-core/src/             Domain: schemas, validators, reducer, unlock graph
  audio-client/src/          Browser: Web Audio mixer, buses, ducking, playback
  ai-orchestration/src/      Server: STT, classifier, dialogue director, safety
  providers/src/             Provider adapters: ElevenLabs, Cartesia, Fish, Deepgram, LLM
content/
  cases/
    <case-id>/
      <version>/
        truth.ts             SERVER ONLY — canonical facts, culprit, solution
        scenes.ts            Public scene content
        characters.ts        Character dossiers (public portions)
        beats.ts             Scripted narrative beats
        prompts/             LLM system prompts
        audio-manifest.json  Asset provenance registry
db/
  schema/                    Drizzle schema definitions
  migrations/                Generated SQL migrations
docs/                        Architecture docs, ADRs, planning documents
.kiro/
  steering/                  Always-included project context for Kiro
  specs/                     Structured implementation specs
  hooks/                     Automation hooks
```

---

## 2. Security rules (non-negotiable)

- **API keys and system prompts never reach the browser.** Server-only.
- **`truth.ts` files are never imported client-side.** Build-time enforcement via path aliases.
- **Guest tokens are opaque, signed, and random.** Never expose raw `runId` as sole auth.
- **All player input is treated as untrusted data.** Validate and sanitize before any use.
- **Rate limiting and budget caps are server-enforced.** Never rely on browser-side limits.
- **No raw audio stored by default.** Drop buffers after transcription.
- **Row-level security** applies to all privileged database mutations.

---

## 3. Narrative integrity rules (non-negotiable)

- **The LLM may not commit game events.** Only server validators write to RunState.
- **Truth, culprit, and timeline are immutable during a run.**
- **Testimony ≠ canonical fact.** Claims from characters are tagged as claims, never promoted to facts automatically.
- **Deflections must not advance state.** Out-of-scope/inappropriate turns cause zero game mutations.
- **No required evidence is permanently inaccessible.** Verify with the unlock graph.
- **Major reveal beats are scripted.** Free-form LLM generation only for valid conversational turns.

---

## 4. Code style

- TypeScript strict mode everywhere. No `any` without explicit justification comment.
- Server components by default in Next.js App Router. Use `'use client'` only where needed.
- Named exports preferred over default exports for modules (pages are the exception).
- All async functions handle errors explicitly. No unhandled promise rejections.
- Use `zod` for runtime schema validation at API boundaries.
- Prefer `const` and immutable patterns. Avoid mutation of shared state.
- File names: `kebab-case.ts`, component files: `PascalCase.tsx`.

---

## 5. Testing conventions

- **Game-core invariants** must have property-based tests (Vitest + fast-check if needed).
- **Provider adapters** must have contract tests and documented failure modes.
- **API routes** must validate inputs with `zod` and return structured error responses.
- **Security tests** must cover at least: prompt injection, premature fact disclosure, fact extraction via paraphrase.
- Mock providers first; swap in real providers behind `PROVIDER_*` env vars.

---

## 6. Audio rules

- Three buses: **Dialogue**, **Music**, **FX/Ambience**. All independently controllable.
- Automatic ducking during dialogue. No hard cuts — use attack/release gain automation.
- Settings persist in localStorage/IndexedDB, **not** in run state (changing volume cannot affect story progress).
- Voice identity is fixed per character. Silent provider switching is forbidden.
- All TTS responses validated before sending to client.

---

## 7. What Kiro must not do (scope protection)

- Do not invent mystery story content, character names, clue chains, or canonical facts.
- Do not implement a mystery creator, mystery generator, or multi-case platform.
- Do not introduce Supabase, Turso, or Firebase as a database replacement for Neon.
- Do not add monetization, paid accounts, or social features.
- Do not write code outside this repository without explicit instruction.
- Do not silently change the voice assigned to a character.
- Record significant architectural deviations as ADRs in `docs/adr/`.
