# 0009. Usage limits and access: text first, a little voice, a code for more

Status: Accepted as a plan. Not built yet; it depends on the shared store from ADR 0005.

## Context

The game will be open source and publicly hosted, and every spoken reply costs money. A full playthrough from the second family playtest used about 65 model-played replies of roughly 215 characters, so about 14,000 characters of live speech plus about 3,000 characters of fixed narration. At Deepgram's list price that is around 50 cents a playthrough; a $5 to $6 plan on ElevenLabs or Cartesia covers only a handful of full playthroughs a month. Public traffic cannot be allowed to spend without limit.

## Decisions (from the project owner)

- **Budget:** about $50 a month in total running cost, for roughly one month after submission, while judges try the game.
- **Who gets full voice:** the judges and some friends.
- **Everyone else:** mostly text. Voice is a small taste, a few minutes, after which the game continues in text and captions. (If the game were ever monetised, the same shape applies: a few minutes of voice, then a prompt to pay for more voice or carry on typing. That is worth exploring beyond the contest, and nothing here should rule it out.)

## Design

Layers, cheapest and most reliable first:

1. **Provider dashboard caps.** Hard monthly spend limits set at each provider. The final backstop; nothing in the app can exceed them.
2. **A global daily budget** per provider in the app (the voice one already exists as `TTS_DAILY_CHAR_BUDGET`), with a friendly message and automatic fall back to captions when it is reached. Speech-to-text and model budgets are still to build.
3. **A per-visitor allowance.** Each guest session may use a small number of voiced replies and model-played replies. When the allowance runs out the game carries on in text with the authored lines. The `captions_only` fallback already exists and is not a silent voice swap, which the voice-pinning rule forbids.
4. **An access code** (not a login). A visitor enters a code at the start; the server checks it against hashed codes held in its environment, each with its own allowance and expiry, and marks the session as a larger tier. Judges get a code in the submission notes; friends get their own. Codes grant allowance, never identity, so no personal data is collected.
5. **A bot check when starting a run** (for example Cloudflare Turnstile, free), because anyone can open many guest sessions.
6. **Fixed text is spoken once.** The opening, scene narration, notices and endings never change, so they can be synthesised ahead of time and served as static audio at no running cost. Only the model's improvised replies stay live.

## Consequences

- The counters for 2, 3 and 4 must live in the shared database (Neon), not in process memory, or a serverless host will multiply every limit. Rate limiting (ADR 0003) has the same requirement.
- Allowance sizes are a tuning question for the first judges' session: start generous for coded visitors and small for the public, watch the real cost, adjust through environment variables.
- The privacy page should state that access codes carry no personal data.
- A forked copy runs on its own keys and its own limits; nothing about this ties the code to the original keys.
