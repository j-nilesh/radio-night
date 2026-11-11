# 0007. Development-only playtest telemetry

Status: Accepted. To be removed or reduced before launch.

## Context

Playtests with family on real devices exposed problems (duplicate audio requests, a muted microphone) that could only be diagnosed from detailed records.

## Decision

Record per-turn timings, audio and microphone events, and raw questions and replies to a local, gitignored `playtests/` folder, read by `npm run playtest:report`. On in development, off in production unless `PLAYTEST_TELEMETRY=on`. Everything goes through `logTelemetry()` (server) and `track()` (browser), so removal is mechanical. See `docs/telemetry.md`.

## Consequences

- The files contain a child's words. They never leave the developer's machine and are not committed.
- Public builds must not carry this level of tracking. The removal plan is in `docs/telemetry.md`; anonymous latency and error counters may replace it.
