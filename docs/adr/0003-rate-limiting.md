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
- Behind a proxy the client address comes from `x-forwarded-for`. Locally every caller shares one address.
- Provider spend is also bounded by `TTS_DAILY_CHAR_BUDGET` and the `DISABLE_AI_PROVIDERS` kill switch. Speech-to-text and model spend caps are not built yet.
