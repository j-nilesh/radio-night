# 0013. Host on Fly.io: one always-on machine, Neon in the same region

Status: Accepted. App `radio-night` created; not yet deployed.

## Context
The game streams each spoken line for up to 90 seconds, and several things live in the server's memory: rate limits, the daily voice budget, the voice cache and the "one synthesis per line, shared by every listener" logic (ADRs 0002, 0003). Saves live in Neon once connected (ADR 0005). The owner has a Fly.io account in use, and Vercel Pro. Judges must be able to use the app free of charge until judging ends.

Compared (19 Nov 2026): Fly.io, Vercel and Cloudflare Workers. Vercel and Cloudflare run many short-lived instances, so every in-memory limit and the cache would multiply or split, and would have to move to shared storage before launch. Cloudflare's Next.js adapter did not list Next 16. Fly runs a normal Node server in a container.

## Decision
- **Fly.io, app `radio-night`, region `iad` (Ashburn).** Neon in AWS US East 1 (N. Virginia), next to it.
- **Exactly one machine, always on** (`min_machines_running = 1`, `auto_stop_machines = "off"`), shared-cpu-1x with 1 GB. A judge never waits for a cold start, and the in-memory state is correct.
- **Next.js standalone output** in a three-stage Node 24 image, run as a non-root user. The build needs no secrets; keys are read at request time.
- **Secrets by `fly secrets`**, never in `fly.toml` or the image. `.dockerignore` keeps `.env*`, reports, playtests and the original art out of the build context.
- **Domain `radionight.app`**, certificate from Fly. `.app` is HTTPS-only by browser rule, which suits the microphone (it needs HTTPS).

## Consequences
- **Do not scale to two machines** until the limits, budget and cache move to shared storage; a second machine would double every limit.
- **A deploy restarts the machine.** Saves survive only because they are in Neon; anything held in memory (the voice cache, rate-limit windows, a line mid-stream) is lost. Deploy outside play sessions during judging.
- Cost: about $7 a month for the machine plus a few cents of traffic (24 kHz speech is about 48 KB a second).
- Health check is the home page, every 30 seconds.
