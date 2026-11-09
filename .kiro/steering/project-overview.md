# Radio Night — Project Overview & Steering

**Working title:** Radio Night  
**Competition:** Kiroween 2026 · Resurrection category  
**Submission deadline:** December 4, 2026 at 2:00 PM Pacific Time  
**Repository:** Public GitHub, open-source licensed  
**Kiro session start:** November 8, 2026  

---

## What is Radio Night?

An atmospheric, browser-based, voice-first interactive radio detective game. Players listen to an authored murder mystery, question suspects in natural speech or by typing, gather evidence, and make an accusation. It supports solo play or shared "Radio Night" group play via a Bluetooth or wired speaker.

The game resurrects the golden-age radio drama format, giving it one capability radio never had: **the characters can hear you and answer back.**

**One-sentence definition:** Authored mystery + improvisational character performance + deterministic investigative logic.

---

## Resurrection rationale (Kiroween)

Radio Night revives the 1930s–1940s radio drama and the participatory communal listening ritual of gathering around a broadcast. It brings those formats into a modern browser with natural voice interaction, a structured investigation UI, and a shared-speaker mode for families and groups.

---

## Kiro usage log

This section is updated as Kiro contributes to the project.

### Session 2 — November 8, 2026 (continued)
- Authored the complete first mystery bible: "The Sitting" (docs/mystery/01-mystery-bible.md)
- Locked all canon: killer (Ray Kowalski), victim (Gerald Fenn), setting (Millhaven NH, Oct 1981), weapon (glass ashtray)
- Designed full fair-play clue chain: 3 tiers, 9 named clues, 4-of-6 accusation rubric
- Wrote character knowledge boundaries (truth/lie/omission matrix per character)
- Designed scene graph (6 locations, unlock conditions, exits)
- Wrote 5 scripted beats (prerecorded): opening, Room 5 entry, Carol disclosure, Ray admission, finale
- Created truth.ts (server-only canonical solution + accusation validator)
- Created characters.ts, scenes.ts, beats.ts for the radio-night-s01 case
- Created .kiro/specs/mystery-bible.md tracking all remaining tasks
- Dev server confirmed running at http://localhost:3000

### Session 1 — November 8, 2026
- Read and synthesized all four planning documents (Vision, GDD/Technical Spec, Build Readiness Plan, Checklist)
- Verified Kiroween 2026 rules and submission requirements
- Scaffolded the full Next.js/TypeScript/Tailwind project
- Created monorepo-style packages directory (game-core, audio-client, ai-orchestration, providers)
- Set up Drizzle ORM + Neon PostgreSQL schema and migration infrastructure
- Wrote .kiro/ steering files for project overview, architecture rules, coding conventions, and security
- Created .kiro/ spec for the vertical slice (first implementation milestone)
- Wrote all core TypeScript type definitions for game state, voice pipeline, and provider adapters
- Created Neon DB schema with all required tables (guest_sessions, runs, run_events, turns, audio_assets, provider_usage)
- Wrote provider adapter interfaces and mock implementations for STT, TTS, LLM
- Set up Vitest testing infrastructure
- Created .env.example documenting all required environment variables
- Created project README, MIT license, and docs/architecture.md

---

## Technology decisions

| Layer | Choice | Rationale | Status |
|---|---|---|---|
| Web framework | Next.js 15 + React + TypeScript | Responsive game + server routes + App Router | Locked |
| Styling | Tailwind CSS | Speed, consistency, mobile-first | Locked |
| Database | Neon PostgreSQL | Familiar, cost-effective, serverless-compatible | Locked |
| ORM | Drizzle ORM | Lightweight, type-safe, good migration tooling | Locked |
| Testing | Vitest | Fast, ESM-native, compatible with Next.js | Locked |
| Code format | Prettier + ESLint | Consistency | Locked |
| STT provider | Deepgram (first audition) | Streaming support, good accuracy | Provisional |
| TTS providers | ElevenLabs, Cartesia, Fish, Deepgram | Per-character casting | Provisional |
| LLM | Provider-agnostic adapter | A/B testing, cost control | Provisional |
| Hosting | Vercel | Straightforward Next.js deploy | Provisional |
| Audio editing | REAPER | Offline production and mastering | Locked |

---

## Non-goals for v1 (competition build)

- Mystery creator/editor
- Multiplayer networking or individual player accounts
- Always-on listening
- Animated avatars or 3D scenes
- Monetization or paid subscriptions
- A second complete mystery case

---

## Hard gates

1. **Gate 1:** Voice loop sounds human; STT works on real devices; turn latency is tolerable; no uncontrolled plot facts
2. **Gate 2:** Full playable story exists end-to-end with placeholders
3. **Gate 3:** Shared-speaker experience works without mic/speaker feedback
4. **Gate 4:** Stable public release with hosting, budget ceiling, licensing, source repo, demo video
