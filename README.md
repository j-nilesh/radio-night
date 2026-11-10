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

- Node.js 20+
- A [Neon PostgreSQL](https://neon.tech) database (free tier is fine)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/j-nilesh/radio-night.git
cd radio-night

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your Neon connection string and GUEST_TOKEN_SECRET

# 4. Run database migrations
npm run db:push

# 5. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Running tests

```bash
npm test
```

All tests use mock providers and do not require real API keys.

### Environment variables

See [.env.example](./.env.example) for a full list with descriptions. Required for local dev:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string (pooled) |
| `GUEST_TOKEN_SECRET` | 32+ byte random secret for session tokens |

All other variables are optional — the app uses mock providers when they're absent.

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

The voice pipeline: **Speech → STT → Classify → Validate → LLM → TTS → Mixer**

All game state is server-authoritative. The LLM can suggest but never commit game events. See `.kiro/steering/architecture.md` for the full rule set.

---

## Kiro usage

This project was built using [Kiro](https://kiro.dev) as the primary development environment. All `.kiro/` artifacts — steering files, specs, and hooks — document the Kiro-driven development process.

See `.kiro/steering/project-overview.md` for the full Kiro activity log.

---

## License

The **source code** is MIT licensed. See [LICENSE](./LICENSE).

**Audio and visual assets** have individual licenses documented in the asset manifest. Do not assume assets are freely redistributable — check the manifest for each asset.

---

## Competition context

Built for **Kiroween 2026** (Resurrection category). Radio Night revives the participatory social ritual of the golden-age radio drama, adding a capability radio never had: its characters can hear and answer the audience.

The entry is a single polished, playable murder mystery case — not a case-creation platform.
