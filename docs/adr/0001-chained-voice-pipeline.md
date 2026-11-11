# 0001. Chained speech pipeline, not speech-to-speech

Status: Accepted

## Context

A character who answers aloud could be built two ways: one realtime speech-to-speech model, or separate steps (speech-to-text, then the game's own logic and a language model, then text-to-speech).

## Decision

Use the chained pipeline: STT, classify, authored line or model reply, reply guard, TTS.

## Why

- The game must decide what a character may say before anyone hears it. With text in the middle, the server can classify the question, apply the unlock rules, and check the reply (ADR 0004) before synthesis.
- Each character keeps one pinned voice, and providers can be compared and swapped per step.
- A transcript exists for captions, the casebook, and testing.
- Cost and latency can be measured per stage.

## Consequences

- Latency is the sum of the stages (measured in playtests at roughly 1 s speech recognition, 1 to 2 s model, under 1 s to first audio).
- Voices cannot interrupt or overlap the way a realtime model can. Questions interrupt whoever is speaking instead.
- Provider adapters (`packages/providers`) must stay swappable, with mocks for tests.
