# 0003. In-process rate limiting, shared storage later

Status: Accepted, with a known limit

## Context

The security rules require rate limits per guest token and per IP, enforced on the server. Anyone can open many sessions, so a token limit alone is not enough.

## Decision

`src/lib/rate-limit.ts` keeps a sliding window of request times per subject in memory. Routes call `enforce()` before parsing input or touching a provider. Limits (all adjustable by environment variable): 12 new runs per hour per IP; 30 questions or scene actions per minute per token and 90 per IP; 10 accusations per minute per token; 120 speech requests per minute per IP; 60 run reads per minute per token. A refused request returns `429` with `Retry-After` and a message that reveals nothing.

## Consequences

- Correct for local development and a single long-running server.
- On serverless hosting every instance has its own counters, so the real limit is looser by roughly the number of warm instances. The speech cache and the daily voice budget have the same property.
- Before relying on these as a spending defence on Vercel, move the counters (and the voice budget) to shared storage, for example a small Neon table or a Redis-compatible store. The `checkLimit` interface is deliberately small so only that file changes.
- The client address comes from `Fly-Client-IP`, which Fly's proxy sets and overwrites. `X-Forwarded-For` is not read: its first entry is whatever the caller writes, and trusting it let a visitor dodge every per-address limit (found in a security pass, 26 Nov 2026). IPv6 callers are limited by their /64 prefix. Without the Fly header (local development) every caller shares one address. On any other host, read that host's own trusted header in `clientIp()`.
- Provider spend is also bounded by `TTS_DAILY_CHAR_BUDGET` and the `DISABLE_AI_PROVIDERS` kill switch. Model-played replies have a daily total as well as the per-visitor cap (`src/lib/model-budget.ts`): `MODEL_DAILY_REPLIES_PUBLIC` (default 1500) and `MODEL_DAILY_REPLIES_CODE` (default 3000), in separate pools so anonymous sessions cannot starve access-code holders. Past the cap, characters answer from their written lines. Speech-to-text has no daily cap yet.
