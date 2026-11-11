# Radio Night

> *An atmospheric, browser-based, voice-first radio detective game with visual investigation tools and a shared-speaker mode for families and friends.*

**Kiroween 2026 · Resurrection category**  
Live at: _coming soon_  
Submission deadline: December 4, 2026

---

## What is Radio Night?

Radio Night resurrects the golden-age radio drama — the communal experience of gathering around a broadcast — and gives it one capability radio never had: **the characters can hear you and answer back.**

Players enter a carefully authored murder mystery, question suspects through natural speech or typing, gather evidence, and reach a reasoned accusation. It works solo at a laptop, or as a group experience with audio routed to a shared speaker.

This is **authored mystery + improvisational character performance + deterministic investigative logic** — not a generative chatbot.

---

## Quick start (local development)

### Prerequisites

- Node.js 20 or newer
- Optional: a [Neon PostgreSQL](https://neon.tech) database. Without one, progress is kept in memory and resets when the server restarts, which is fine for development.
- Optional: a Deepgram key (speech in and out) and an Anthropic key (the characters' improvised replies). Without them the game still runs: you type, characters answer with their written lines, and nothing is spoken.

### Setup

```bash
git clone https://github.com/j-nilesh/radio-night.git
cd radio-night
npm install

cp .env.example .env.local
# Set GUEST_TOKEN_SECRET (any random string of 32 or more characters).
# Add DEEPGRAM_API_KEY / ANTHROPIC_API_KEY and USE_REAL_PROVIDERS=true for voices and live characters.
# Add DATABASE_URL, then `npm run db:push`, to save progress in Neon.

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Checks

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # all tests; mock providers, no keys needed
npm run build       # production build
```

The same four run in CI on every push (`.github/workflows/ci.yml`).

### Tools for development

| Command | What it does |
|---|---|
| `npm run interrogate` | Hostile interviews of each character, graded by a second model (needs an Anthropic key) |
| `npm run check:stt` | Live speech-recognition smoke test (needs a Deepgram key) |
| `npm run playtest:report` | Summarises local playtest telemetry ([docs/telemetry.md](docs/telemetry.md)) |
| `npm run audio:placeholders` | Regenerates the placeholder room sounds |
| `npm run audition:build` / `audition:score` | Blind voice auditions: build a listening page, then reveal and rank the scores ([docs/voice-auditions.md](docs/voice-auditions.md)) |

### Environment variables

See [.env.example](./.env.example) for the full list. Only one is required:

| Variable | Description |
|---|---|
| `GUEST_TOKEN_SECRET` | Random secret, 32 or more characters, for session tokens |

Everything else is optional. Providers fall back to mocks when their keys are absent, and `DISABLE_AI_PROVIDERS=true` forces captions-only play.

---

## Architecture

```
src/app/              Next.js App Router pages and API routes
packages/
  game-core/          Domain: RunState, types, reducer, invariants
  audio-client/       Browser: Web Audio mixer, 3 buses, ducking
  ai-orchestration/   Server: STT → classify → LLM → TTS pipeline
  providers/          Adapters: ElevenLabs, Cartesia, Fish, Deepgram, mocks
db/
  schema/             Drizzle ORM schema (Neon PostgreSQL)
  migrations/         Generated SQL migrations
content/
  cases/              Mystery content (server-only truth separated from public)
.kiro/
  steering/           Kiro project conventions and architecture rules
  specs/              Structured implementation specs
```

The voice pipeline: **Speech → STT → Classify → Authored line or model → Reply guard → TTS → Mixer**

All game state is server-authoritative. The LLM can suggest wording but never commits game events, and a clue-earning answer is always the authored line the first time. See `.kiro/steering/architecture.md` for the rules and [docs/adr](docs/adr/README.md) for the reasoning behind the main decisions.

### Status

"The Sitting", a 1981 New Hampshire murder mystery, is playable from the first question to the accusation and four endings. Still to come: a Neon-backed deployment, final voice casting, final sound and music, and a public host. Sound files in `public/audio` are generated placeholders, listed in the [asset manifest](content/cases/radio-night-s01/v1/audio-manifest.json).

---

## Kiro usage

This project was built using [Kiro](https://kiro.dev) as the primary development environment. All `.kiro/` artifacts — steering files, specs, and hooks — document the Kiro-driven development process.

See `.kiro/steering/project-overview.md` for the full Kiro activity log.

---

## License

The **source code** is MIT licensed. See [LICENSE](./LICENSE).

**Audio and visual assets** have individual licenses documented in the [asset manifest](content/cases/radio-night-s01/v1/audio-manifest.json). Do not assume assets are freely redistributable — check the manifest for each asset.

---

## Competition context

Built for **Kiroween 2026** (Resurrection category). Radio Night revives the participatory social ritual of the golden-age radio drama, adding a capability radio never had: its characters can hear and answer the audience.

The entry is a single polished, playable murder mystery case — not a case-creation platform.
