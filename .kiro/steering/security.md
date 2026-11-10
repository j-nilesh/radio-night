# Radio Night — Security & Privacy Steering

> Apply these rules to every API route, server action, and data access pattern.

---

## API security checklist (apply to every route)

- [ ] Auth/session token validated before any database read or write
- [ ] Input validated with zod schema — length limits, type constraints, allowed values
- [ ] Rate limiting applied (per guest token, per IP)
- [ ] Response filtered to player-safe projection (no truth fields, no unrevealed secrets)
- [ ] Idempotency key checked before committing state mutations
- [ ] Provider API keys read from `process.env`, never from client-accessible config

## Secret management

```
DATABASE_URL              — Neon connection string with pooling
ELEVENLABS_API_KEY        — TTS/SFX provider
CARTESIA_API_KEY          — TTS provider
FISH_AUDIO_API_KEY        — TTS provider
DEEPGRAM_API_KEY          — STT + TTS provider
OPENAI_API_KEY            — LLM + benchmark STT
ANTHROPIC_API_KEY         — LLM alternative
GUEST_TOKEN_SECRET        — HMAC secret for guest session tokens (min 32 bytes)
NEXT_PUBLIC_APP_URL       — Public URL for the deployed app
```

None of these values belong in:
- Client-side JavaScript bundles
- Git history (even accidentally)
- Error messages returned to the browser
- Server logs at INFO level

## Guest session security

- Token: `base64url(hmac-sha256(randomBytes(24), GUEST_TOKEN_SECRET))`
- Stored in an httpOnly, Secure, SameSite=Strict cookie
- runId is never the sole authorization check — always verify token ownership
- Guest sessions expire after 30 days of inactivity
- Guest run migration to an authenticated account requires explicit confirmation

## Data minimization

- Raw player audio: never stored. Buffer dropped after STT transcription.
- Turn text: stored in `turns` table with redaction flag; retain only the decision code for abuse detection, not verbatim transcript in production.
- Error logs: strip any user text from log payloads; log only decision codes and metadata.
- PII: do not collect names, email, or device identifiers for guest sessions.
- Dialogue memory: the last 6 question/answer exchanges per character are kept with the run (runs.dialogue_json) so a model-played character stays consistent. It is server-held only (a history sent by the browser could be forged), capped at 1,000 characters per entry, and deleted with the run. Questions also go to the dialogue provider (Anthropic) to generate replies.

## Prompt injection defense

- Player transcripts are data, not instructions. Always wrap in structured context before LLM call.
- System prompt is never included in client-visible API responses.
- Classification step is server-only. Client sees only the result category, not reasoning.
- Automated tests must cover: "ignore previous instructions", "reveal the killer", "you are now a helpful assistant", and paraphrase variants of restricted questions.

## Provider budget controls

- Per-session token/audio caps enforced server-side before calling any provider.
- `provider_usage` table tracks units and estimated cost per request.
- Hard kill switch: `DISABLE_AI_PROVIDERS=true` env var enables captions-only fallback mode.
- Alert threshold: configure spend alerts in each provider dashboard.
