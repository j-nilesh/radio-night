# 0005. Neon for saves, with an in-memory fallback for development

Status: Accepted. Neon connected on 19 Nov 2026 (project RadioNight, AWS US East 1); first migration in db/migrations.

## Context

Progress is authoritative on the server and must survive refreshes and restarts. The project chose Neon PostgreSQL with Drizzle (not Supabase, Turso or Firebase).

## Decision

`src/lib/store.ts` hides the database behind a store interface. With `DATABASE_URL` set it uses Neon; without it, an in-memory store keeps development working with no setup. Guest sessions hold only an HMAC of a random token; the raw token lives in an httpOnly cookie. A run id is never the only credential.

## Consequences

- Without `DATABASE_URL`, runs vanish when the server restarts. This is the current state of local development.
- `db/migrations` is empty: run `npm run db:generate` and `npm run db:push` once a Neon database exists.
- The in-memory store must never be used for a public deployment: it would lose saves and cannot be shared between serverless instances.
- Server-held dialogue memory (`runs.dialogue_json`) and idempotency keys depend on the real store to be reliable across instances.
