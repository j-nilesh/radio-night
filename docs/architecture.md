# Radio Night: Architecture Overview

**Status:** "The Sitting" is playable end to end. Decisions and their reasoning are in [docs/adr](adr/README.md); this page is the map.

---

## System overview

A Next.js web app with a server-authoritative game engine, a chained voice pipeline, and three independent audio buses.

```
Browser (React)
  ├── Case page        scene bar, dialogue captions, casebook, accusation
  ├── Input            push-to-talk mic (level-checked before upload) or typing
  ├── Speech playback  raw PCM streamed over fetch, played through Web Audio
  ├── Cue player       room ambience, stings and effects (data-driven)
  └── Mixer            Dialogue / Music / FX buses, ducking, saved volume

  │  HTTPS, httpOnly guest cookie
  ▼

Next.js API routes
  ├── POST /api/runs                 create guest session and run        (rate limited)
  ├── GET  /api/runs/:id             player-safe view of a run           (rate limited)
  ├── POST /api/runs/:id/actions     a question, a spoken question, travel or examine
  ├── POST /api/runs/:id/accuse      accusation and ending               (rate limited)
  ├── GET  /api/speech?t=<signed>    streams one spoken line             (rate limited)
  └── POST /api/dev/telemetry        development playtest telemetry only

packages/ai-orchestration  (one turn)
  1. Speech-to-text (Deepgram), if audio was sent. Empty and low-confidence results are told apart.
  2. Classify: command, attack on the game, out of scope, out of period, or a question
  3. Commands: recap and help answered in words; the rest acted on by the browser
  4. Pick the reply: authored line (earned clues and admissions, first time) or a model-played character
  5. Reply guard: no leaks, no AI talk, no naming a killer, stage directions stripped; else the authored fallback
  6. Commit events (server only), update the casebook
  7. Return text plus a signed link; the browser fetches the voice

packages/game-core         RunState, events, reducer (authoritative)
packages/providers         Deepgram STT and TTS, Anthropic dialogue, mocks
packages/audio-client      mixer, PCM streaming, cue player
content/cases/<case>       public content, plus truth.ts (server only)
```

Voice synthesis happens after the text reply is sent, so a slow or failed voice never delays the captions.

## Storage

Neon PostgreSQL through Drizzle is the production store (tables: guest_sessions, runs, run_events, turns, audio_assets, provider_usage). Without `DATABASE_URL` an in-memory store is used for development. See ADR 0005.

## Decisions at a glance

| ADR | Decision |
|---|---|
| [0001](adr/0001-chained-voice-pipeline.md) | Chained STT, game logic, TTS, not speech-to-speech |
| [0002](adr/0002-pcm-streaming-playback.md) | Stream raw PCM and play with Web Audio (Safari-safe) |
| [0003](adr/0003-rate-limiting.md) | In-process rate limits; shared storage before serverless |
| [0004](adr/0004-model-played-characters.md) | Model-played characters behind authored clues and a reply guard |
| [0005](adr/0005-store-and-saves.md) | Neon for saves, in-memory fallback for development |
| [0006](adr/0006-sound-cues.md) | Data-driven ambience and stings with placeholder assets |
| [0007](adr/0007-dev-telemetry.md) | Development-only playtest telemetry |
| [0008](adr/0008-audio-stays-on-our-server.md) | Player audio goes through our server, not straight to a provider |

## Turn flow, in states

```
READY → RECORDING → (level check) → UPLOADING → TRANSCRIBING → CLASSIFYING
CLASSIFYING → COMMAND → READY
CLASSIFYING → DEFLECTION → READY
CLASSIFYING → AUTHORED LINE or MODEL REPLY → GUARD → COMMIT → CAPTIONS → VOICE STREAM → READY
Any failure → a plain notice; progress is never lost
```

## Security boundaries

| Boundary | Rule |
|---|---|
| Browser to API | Guest token in an httpOnly cookie. A run id alone is not authorisation. |
| API to game engine | Only server code commits RunState changes |
| API to model | A character's prompt holds only what that character knows |
| API to browser | Only the player-safe view; no truth, no diagnostics |
| Speech links | Signed (HMAC), so the endpoint cannot voice arbitrary text |
| Build | `content/*/truth.ts` is never imported by browser code (a test checks the cue data) |
| Load | Rate limits per token and IP; daily voice budget; `DISABLE_AI_PROVIDERS` kill switch |
