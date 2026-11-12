# Voice and sound auditions

How the cast of voices is chosen. Voices are chosen per character, by ear, blind, then checked in the game. Nobody picks a voice from a vendor demo or a price list.

## The rounds

| Round | What | Who |
|---|---|---|
| 0 | Casting briefs and test lines (`scripts/audition/casting.ts`) | built |
| 1 | Blind listening, Deepgram voices only: four per character read the same lines; scores saved as files | two or more listeners |
| 1b ("round 2" in the tools) | The same, with the current Deepgram cast as the yardstick plus two Cartesia and two ElevenLabs voices per part | two or more listeners |
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

## Providers wired

| Provider | Model used | Notes |
|---|---|---|
| Deepgram | Aura-2 | Fixed voices, no control over pace or feeling. Four requests at a time. |
| Cartesia | sonic-3.6 | One request at a time on this plan (more returns 429; the tool waits and retries). Shortlist is from its American voices. |
| ElevenLabs | eleven_flash_v2_5 | One request at a time (a second returns 409 "already running"). Mix of premade and community-library voices. Flash is the low-latency model; the best-sounding finalists can be re-tried on a richer model in the in-game round. |
| Fish Audio | not wired | Held in reserve in case the others fall short. |

The ElevenLabs key needs the permissions Text to speech and Voices read; User read (to show the plan) is optional. Keys are restricted per permission, so a missing one shows as a 401 "missing permission" message.

Candidates carry a `rounds` list in `casting.ts`; `--round N` builds only the candidates in that round. The current-cast Deepgram voices are in both rounds so there is always a yardstick.

## Adding a provider

1. Put the key in `.env.local` (names are in `.env.example`: `ELEVENLABS_API_KEY`, `CARTESIA_API_KEY`, `FISH_AUDIO_API_KEY`). Never paste a key into a chat or commit it.
2. Add its adapter to `scripts/audition/providers.ts` and its request limit to `CONCURRENCY`. Check the request format against the provider's current documentation first, and ask for 24 kHz 16-bit audio so clips compare fairly.
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

## Sound auditions (room sounds and stings)

The same blind method, for the six room beds and the five stings and effects.

```bash
npm run audition:sounds -- --round 1 --dry     # plan and estimated credits
npm run audition:sounds -- --round 1           # generate and build the page
open reports/audition/round-s1/index.html
npm run audition:score -- --round s1
```

- Each cue has three prompts (`scripts/audition/sounds.ts`) that make three candidates with ElevenLabs sound effects, plus our current synthetic placeholder as a baseline. The prompts describe only places and events the bible already establishes.
- Rooms are heard twice: on their own (looping), and under a spoken line at about the level they would have in the game. Whether it gets in the way of the voice is the real test.
- Scored by ear alone: fits the place 30, mood 25, holds together (loops cleanly) 15, stays out of the way 10, out of 80. There is no latency or running cost: the winners are generated once and shipped as files.
- The winning prompt is recorded in `summary.md`. **Re-generate the winners after the paid ElevenLabs plan is in place.** Sounds made on the free plan carry no commercial licence, so they are for listening only.
- Cost: about 1,600 credits for all 33 sounds (11 credits for a 2-second sound; the response header `character-cost` reports the real figure).
- Two things found while building it: the sound endpoint returns **stereo** (the adapter mixes it down to mono; final assets could keep stereo for width), and it needs the "Sound generation" permission on a restricted key.
