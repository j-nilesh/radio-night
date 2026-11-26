# 0014. A voiced preview for everyone, access codes for more, and a usage page for the owner

Status: Accepted. Builds on ADR 0009 (the plan); this is what was built.

## Context
The game is open to anyone at https://radionight.app. Every live character reply costs money in voice (ElevenLabs, Cartesia, Deepgram) and in the model (Anthropic). The owner chose: open to everyone with a small voice allowance, a code for judges and friends, and a way to watch consumption. The judging rules require the app to be free and unrestricted for judges.

## Decision
- **Per-visitor voice allowance.** Each guest session counts the characters of speech made for it (`guest_sessions.voice_chars_used`). Without a code the allowance is `PUBLIC_VOICE_CHARS` (default 4,000: the recap and a dozen or so character replies). With a code it is `CODE_VOICE_CHARS` (default 60,000: more than a full playthrough).
- **Fixed narration is free to the visitor.** The opening, room narration, arrivals and endings are the same for everyone and are cached after the first synthesis, so they do not count. Character replies and the personal recap do.
- **Charged when made, checked when offered.** Each speech link carries the session id inside its signature; the speech route charges the session when a line is synthesised for the first time (a cache hit costs nothing and charges nothing). Links are only handed out while the visitor has characters left. When a line goes unvoiced for that reason the response says so, and the browser tells the player once that the voiced preview is over and the investigation continues in text.
- **Model replies are capped per visitor** (`PUBLIC_MODEL_REPLIES` 120, `CODE_MODEL_REPLIES` 400). Past the cap the character answers from the written lines (the mock dialogue provider), so the game stays playable and the bill bounded.
- **Access codes** live only as SHA-256 hashes in `ACCESS_CODES` ("label:hash,..."), compared in constant time, ignoring case, spaces and dashes. A code can be entered on the start page, can arrive in the link (`/play?code=...`), and can be added to a saved investigation (`POST /api/access`) without starting over. Attempts are rate limited per IP. The session records the code's label, never the code.
- **The global daily voice budget stays** (`TTS_DAILY_CHAR_BUDGET`), as the backstop above every visitor.
- **Usage is recorded** in `provider_usage` for each new synthesis (characters), each transcription (seconds) and each model reply (tokens), with an estimated cost from list prices. No player text is stored.
- **Usage page at `/admin/usage`**, HTTP Basic auth (user `admin`, `ADMIN_PASSWORD`), not linked anywhere and marked noindex. It shows estimated cost today and this month, today's voice characters against the daily cap, and per day: visitors, runs, how many had a code, how many used up their voice, and use by provider.
- **Sessions expire after 30 days without play**, sliding: every action renews the session and the cookie, and lookups ignore expired sessions.
- Responses no longer include the raw run state.

## Consequences
- Bots can open sessions to collect more preview voice, bounded by the run-creation limit per IP (12 an hour) and the daily budget. A bot check was considered and left out for now: it adds friction for judges and the two caps already bound the cost.
- Cost figures are estimates; the provider dashboards are the record. The ElevenLabs estimate assumes the small plan's price per credit.
- The daily budget counter is in memory and resets on a restart or deploy (one machine, ADR 0013); the per-visitor counts are in the database and survive.
- Local development shares the production database (owner's decision, 19 Nov), so local test sessions appear on the usage page.
