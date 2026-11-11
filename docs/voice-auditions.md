# Voice auditions

How the cast of voices is chosen. Voices are chosen per character, by ear, blind, then checked in the game. Nobody picks a voice from a vendor demo or a price list.

## The rounds

| Round | What | Who |
|---|---|---|
| 0 | Casting briefs and test lines (`scripts/audition/casting.ts`) | built |
| 1 | Blind listening: four voices per character read the same lines; scores saved as files | two or more listeners |
| 2 | The two finalists per character go into the game (`voices.ts`) for a short scene: drift over 20 lines, sound against the ambience, a phone or Bluetooth speaker | a playtest |
| 3 | Lock the cast; record each provider's licence terms and cost per session | decision |

## Running round 1

```bash
npm run audition:build -- --round 1 --dry     # show the plan and estimated cost
npm run audition:build -- --round 1           # make the clips and the page
open reports/audition/round-1/index.html
```

Each listener enters a name, listens, moves the sliders, picks Yes, Maybe or No, and presses "Save my scores". That downloads `scores-round1-<name>.json`; move each file into `reports/audition/round-1/`. Then:

```bash
npm run audition:score -- --round 1
```

This reveals the voices and writes `summary.md`. Do not open `key.json` before everyone has scored.

Everything under `reports/` is gitignored.

## What is on the page

For each character, eight lines (the narrator gets three): four authored lines, including the cover stories a character gives when holding something back, and four real replies the live model wrote in playtests, because those are the lines that expose a flat or robotic voice. All clips are brought to the same loudness first, so a louder voice does not win for being louder. Voices appear only as letters.

## Scoring

From the build plan's rubric, out of 100:

| Part | Points | How |
|---|---|---|
| Believable person | 30 | by ear (slider) |
| Feeling and restraint | 25 | by ear |
| Same person throughout | 15 | by ear |
| Clear on a phone speaker | 10 | by ear |
| Latency | 15 | measured: median time to first audio; full marks at 0.4 s or less, none at 1.5 s or more |
| Cost | 5 | estimated from price per 1,000 characters |

A voice with a "No" from any listener should be dropped unless nothing better exists for that part. Large disagreement between listeners is shown, because it usually means the voice is a matter of taste and worth a second listen.

## Adding a provider

1. Put the key in `.env.local` (names are in `.env.example`: `ELEVENLABS_API_KEY`, `CARTESIA_API_KEY`, `FISH_AUDIO_API_KEY`). Never paste a key into a chat or commit it.
2. Add its adapter to `scripts/audition/providers.ts`. Check the request format against the provider's current documentation first, and ask for 24 kHz 16-bit audio so clips compare fairly.
3. Add shortlisted voices to `scripts/audition/casting.ts` and its price to `COST_PER_1K_CHARS`.
4. A provider with no key, or no adapter yet, is skipped with a one-line reason.

Ask the provider for American voices that are not obviously urban or Californian. No voice cloning: it raises rights questions the project does not need.

## Licence record (fill in at Round 3)

| Provider | Plan | Commercial or public use allowed | Voice-specific terms | Attribution | Cost per typical session |
|---|---|---|---|---|---|
| Deepgram | | | | | |
| ElevenLabs | | | | | |
| Cartesia | | | | | |
| Fish Audio | | | | | |

Free plans often exclude public or commercial use. The game will be free to play and publicly hosted, so confirm each provider's terms before choosing a voice from it.

## Budget

Round 1 with Deepgram only costs under a dollar. The agreed ceiling for the whole audition, across all providers, is $10.
