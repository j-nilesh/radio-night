# Radio Night

> *An atmospheric, browser-based, voice-first radio detective game. The characters can hear you and answer back.*

**Kiroween 2026 · Resurrection category**
**Play it: [radionight.app](https://radionight.app)**

> **Spoiler warning.** This is an open-source repository, so the full solution of the mystery is in it: `content/cases/radio-night-s01/v1/truth.ts` and `docs/mystery/`. If you want to play the game, play it first.

---

## What is Radio Night?

Radio Night resurrects the golden-age radio drama, the evening a family spent gathered around a broadcast, and gives it one capability radio never had: **the characters can hear you and answer back.**

You are the detective in a 1981 New Hampshire murder mystery, "The Sitting". You question the suspects by speaking or typing, walk between the rooms of an inn, gather evidence, and make an accusation. Play on your own at a phone or laptop, or put the sound through a speaker and take turns asking with a room full of people.

It is **authored mystery + improvisational character performance + deterministic investigative logic**, and not a generative chatbot:

- The mystery, the clue chain and the endings are written by hand and checked by tests (it is always solvable, in any order of play).
- Characters improvise their *wording* with a language model, but a server-side guard checks every reply before anyone hears it. The model can never commit a game event, name the killer, or reveal what you have not earned; clues are granted by the game's own rules, and a clue-earning question always gets the authored line the first time.
- A character who is spoken to as someone else says so, in character, and nothing moves.

---

## Quick start (local development)

### Prerequisites

- Node.js 20 or newer (CI runs 22)
- Optional: a [Neon PostgreSQL](https://neon.tech) database. `DATABASE_URL` is blank by default, which keeps progress in memory; it resets when the server restarts, which is fine for development. See "Persistent saves with Neon" below to turn this on.
- Optional: a Deepgram key (speech in, and Ray's voice), Cartesia and ElevenLabs keys (the rest of the cast; a character whose provider has no key is captions-only) and an Anthropic key (the characters' improvised replies). Without them the game still runs: you type, characters answer with their written lines, and nothing is spoken.

### Setup

```bash
git clone https://github.com/j-nilesh/radio-night.git
cd radio-night
npm install

cp .env.example .env.local
# Set GUEST_TOKEN_SECRET (any random string of 32 or more characters).
# That's it — leave everything else blank and run:

npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start a case. With no provider keys, characters answer with their written lines and nothing is spoken. With `DATABASE_URL` left blank, progress is kept in memory and resets when the server restarts — fine for development.

To add voices and live characters, set the provider keys in `.env.local` and `USE_REAL_PROVIDERS=true`.

### Persistent saves with Neon (optional)

By default `DATABASE_URL` is blank and progress lives in memory only. To keep saves across restarts:

1. Create a [Neon PostgreSQL](https://neon.tech) database and copy its pooled connection string.
2. Set `DATABASE_URL` in `.env.local` to that string.
3. Run the migration. Drizzle's CLI reads `process.env.DATABASE_URL` directly and does not load `.env.local` the way `next dev` does, so export it in the shell first:

   ```bash
   export DATABASE_URL="postgresql://..."   # same value as in .env.local
   npm run db:push
   ```

4. Restart `npm run dev`. Next.js loads `.env.local` on its own, so the app itself needs no export.

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
| `npm run check:voices` | Speaks one line with each locked voice through the real adapters (needs the three voice keys) |
| `npm run check:levels` | Measures how loud each voice is on the speech band a phone plays, and suggests corrections |
| `npm run make:code -- judges` | Makes a random access code and the `ACCESS_CODES` entry for it |
| `npm run playtest:report` | Summarises local playtest telemetry ([docs/telemetry.md](docs/telemetry.md)) |
| `npm run audition:build` / `audition:score` | Two-step blind auditions of voices, sounds and music ([docs/voice-auditions.md](docs/voice-auditions.md)) |

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
  audio-client/       Browser: Web Audio mixer, three buses, ducking
  ai-orchestration/   Server: speech in, classify, topic or model, reply guard
  providers/          Adapters: Deepgram, Cartesia, ElevenLabs, Anthropic, mocks
db/
  schema/             Drizzle ORM schema (Neon PostgreSQL)
  migrations/         Generated SQL migrations
content/
  cases/              The mystery (the truth is server-only, kept apart from public content)
docs/
  adr/                Architecture decision records
  planning/           The original vision and technical planning documents
.kiro/
  steering/           Kiro project conventions and architecture rules
  specs/              Specs written and tracked with Kiro
  hooks/              Hooks that guard secrets and the solution
```

The voice pipeline: **speech, transcription, classify, authored line or model, reply guard, speech synthesis, mixer.**

All game state is server-authoritative. The model can suggest wording but never commits game events, and a clue-earning answer is always the authored line the first time. See [.kiro/steering/architecture.md](.kiro/steering/architecture.md) for the rules and [docs/adr](docs/adr/README.md) for the reasoning behind the main decisions.

### Status

"The Sitting" is complete and live: a 1981 New Hampshire murder mystery with four endings, five voiced characters and a narrator, final room sounds and music, and sixteen pictures. It runs on Fly.io with Neon. One sound is still a generated placeholder (the short clue sting). The costs of voice and model replies are capped per visitor and per day; visitors without an access code get a voiced preview and then play in text.

---

## Built with Kiro

This project was built using [Kiro](https://kiro.dev) as the primary development environment. The `.kiro/` directory is the record of that: steering files that fix the architecture and security rules, specs for each stage, and hooks that block commands that would print secrets and keep the solution out of browser code. `.kiro/steering/project-overview.md` holds the session-by-session log.

---

## License

The **source code** is MIT licensed. See [LICENSE](./LICENSE).

The **music, sounds, pictures and fonts** are not MIT licensed. They are included only so the game runs, and are not licensed for reuse. See [NOTICE](./NOTICE) for each, and the [audio](content/cases/radio-night-s01/v1/audio-manifest.json) and [image](content/cases/radio-night-s01/v1/images-manifest.json) manifests for sources.

---

## Competition context

Built for **Kiroween 2026** (Resurrection category). Radio Night revives the participatory social ritual of the golden-age radio drama, adding a capability radio never had: its characters can hear and answer the audience.

The entry is a single polished, playable murder mystery case, not a case-creation platform.

Made by Nilesh Jahagirdar.
