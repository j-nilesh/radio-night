# 0011. The cast is voiced by three providers, each voice pinned to its provider

Status: Accepted. The sound and music winners are chosen but not yet generated for shipping (see "Not done yet").

## Context
The blind audition (docs/voice-auditions.md) put Deepgram, Cartesia and ElevenLabs candidates side by side for every part. The listener picked one Yes per part, and the winners come from all three providers:

| Part | Provider | Voice |
|---|---|---|
| Ray Kowalski | Deepgram | Aura-2 `aries` |
| Dwight Wentworth | Cartesia | Reed (`533b2990-5b82-45a4-b9f2-367776972ca6`), sonic-3.6 |
| Carol Wentworth | Cartesia | Marian (`26403c37-80c1-4a1a-8692-540551ca2ae5`), sonic-3.6 |
| Edna Marsh | ElevenLabs | Jane Hackett (`aIu5oHglU5AHNc2x0AZu`), eleven_flash_v2_5 |
| Dennis Pruett | ElevenLabs | Bill (`pqHfZKP75CvOlQylNhV4`), eleven_flash_v2_5 |
| Narrator | ElevenLabs | Brian (`nPczCjzI2devNBz1zQrb`), eleven_flash_v2_5 |

Until now the game had one text-to-speech adapter (Deepgram) and every check assumed one live provider.

## Decision
Keep the cast as chosen. Serve it through one `RoutingTextToSpeechProvider` that holds an adapter per provider and sends each line to the adapter its voice is pinned to.

- Two new adapters, `CartesiaTextToSpeechProvider` and `ElevenLabsTextToSpeechProvider`, with the same contract as the Deepgram one: PCM 16-bit mono at 24 kHz, streaming, voice pinning, errors that carry an HTTP status and never a key or the spoken text. Contract tests run offline (`multi-voice-tts.test.ts`).
- The router never substitutes. A voice whose provider has no key is refused, the line is captions-only (the voice's `fallbackPolicy`), and the server logs which keys are missing at start-up.
- The signed speech link now carries the pinned model as well as the voice, so a model cannot be swapped without breaking the signature. The cache key includes it.
- `ttsServes(tts, provider)` replaces the old "voice.provider must equal tts.providerName" checks in `src/lib/speech.ts` and `/api/speech`.
- `npm run check:voices` speaks one line with each locked voice through the real adapters and writes WAV files to `reports/voice-check/`.

## Why
- The audition was blind and by ear. Re-casting everything onto one provider to simplify the code would throw away the result.
- Per-voice pinning already existed so that nothing swaps a voice silently. A router keeps that rule and extends it to three providers.
- Streaming PCM from all three means the browser plays every voice the same way (ADR 0002).

## Consequences
- Three keys (and three bills, three terms of service, three sets of limits) instead of one. A missing key silences only its characters.
- Free plans allow one request at a time on Cartesia and ElevenLabs. Two different lines requested at once can get a 409 or 429, which shows up as a captions-only line. A paid plan lifts this; so does generating a line once and sharing it (already done: one upstream request per line).
- Latency differs by provider. Measured in the audition: Cartesia 70 to 130 ms to first audio, ElevenLabs about 200 to 450 ms with rare spikes of 5 to 15 s seen on the Edna and Carol candidates, Deepgram 300 to 900 ms. Smoke test with the locked cast: Edna 2.6 s once, others under 0.8 s. If Edna's spikes recur in play, she is the first candidate for a recheck.
- Licences: the audition ran on free plans, which are for listening only. The shipped game needs paid plans that allow public, commercial use for every voice above. Until then the cast is for development.
- No New England accent exists in any catalogue. Ray, Edna and Dennis remain the largest compromises.

## Not done yet
- Regenerate the winning room beds, effects, stings and music with the paid ElevenLabs plan, so the shipped files carry its licence (the winning prompts are recorded in each round's `summary.md`), then update `public/audio` and `audio-manifest.json`.
- Re-measure Edna's first-audio time over a full playtest.
- Fill in the licence table in docs/voice-auditions.md once each plan is chosen.
