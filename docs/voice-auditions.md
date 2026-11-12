# Voice, sound and music auditions

How the cast of voices and the sound of the game are chosen: blind, by ear, in two steps, then checked in the game. Nobody picks from a vendor demo or a price list.

## The two steps

| Step | Who | What |
|---|---|---|
| 1. Sieve | one person | Every option, short reads. Mark each Keep, Maybe or Drop. Drop the obvious misses quickly. |
| 2. Score | each listener, on their own | Only the survivors, re-blinded with new letters, full reads, full sliders. |
| 3. In the game | a playtest | The finalists in a real scene: drift over 20 lines, sound against the ambience, a phone or Bluetooth speaker. Then lock the cast and record licences. |

The second step is scored independently by each listener and the results are shown side by side, with the disagreement, so a taste difference is visible rather than averaged away.

What is covered: the six character voices (five characters and the narrator), the six room beds, the effects and stings, and the music (an opening theme, an investigation underscore, a tense underscore, and a closing piece, all in the style of old-time radio drama).

## Running step 1

```bash
npm run audition:build -- --stage triage --name t1 --dry   # plan and cost; calls nothing
npm run audition:build -- --stage triage --name t1         # voices and sounds
npm run audition:build -- --stage triage --name t1 --music # also compose the music (see "Music" below)
open reports/audition/round-t1/index.html
```

On the page: enter a name, tap Keep, Maybe or Drop on each option (voices read three short lines; rooms play alone and under a spoken line), and add a note when something specific is wrong. "Hide the ones I dropped" tidies the page as you go. Press **Save my shortlist**; a `shortlist-…json` file lands in Downloads. Move it into `reports/audition/round-t1/`.

## Running step 2

```bash
npm run audition:build -- --stage final --from t1 --name f1
open reports/audition/round-f1/index.html
```

This builds a page from the shortlist only. The default is to carry forward anything marked Keep or Maybe (`--include keep` for strict). If several people did step 1, an option goes through if any of them kept it. Options nobody marked are held back and reported, so a missed one is noticed. If only one option survives for a part it is reported as chosen and not scored.

Each listener opens the page, enters their own name, scores every option on the sliders (1 poor, 10 excellent), picks Yes, Maybe or No, and presses **Save my scores**. Move each `scores-…json` into `reports/audition/round-f1/`. Please score before comparing notes. Then:

```bash
npm run audition:score -- --round f1
```

This reveals which option each letter was and writes `summary.md`. Do not open `key.json` before everyone has scored. Everything under `reports/` is gitignored.

## What is on the pages

- **Voices.** The test lines are authored lines (including the cover stories a character gives when holding something back) and real replies the live model wrote in playtests, because those are the lines that expose a flat or robotic voice. Step 1 uses three of the eight (a calm one, one under pressure, a real reply); step 2 uses all eight. The narrator reads the opening and endings. Every clip is brought to the same loudness, so a louder voice does not win for being louder.
- **Room sounds.** Looping beds, each with our synthetic placeholder in as a baseline. Heard alone and under a spoken line at about the level they would have in the game, because "does it get in the way of the voice" is the real test. Let a loop run for a while: one that is fine for ten seconds can wear on you.
- **Effects, stings and music.** Played once. Music beds are also heard under speech.

## Scoring

From the build plan's rubric.

| Part | Voices | Sounds and music |
|---|---|---|
| Believable person / fits the place / feels like old radio drama | 30 | 30 |
| Feeling and restraint / mood | 25 | 25 |
| Same person throughout / holds together | 15 | 15 |
| Clear on a phone speaker / stays out of the way of speech | 10 | 10 |
| Latency (measured: median time to first audio; full marks at 0.4 s or less, none at 1.5 s or more) | 15 | not used |
| Cost (estimated from price per 1,000 characters) | 5 | not used |

A "No" from any listener should rule an option out unless nothing better exists for that part.

## Providers wired

| Provider | Used for | Notes |
|---|---|---|
| Deepgram Aura-2 | voices | Fixed voices, no control over pace or feeling. Four requests at a time. |
| Cartesia (sonic-3.6) | voices | One request at a time on this plan; the tool waits and retries on 429. |
| ElevenLabs | voices (eleven_flash_v2_5), sound effects, music (music_v1) | One request at a time (a second returns 409 "already running"). The key needs the permissions Text to speech, Voices read and Sound generation, and Music for music; User read is optional. A missing one shows as a 401 "missing permission" message. |
| Fish Audio | not wired | Held in reserve in case the others fall short. |

Two quirks found while building this: the sound-effect and music endpoints return **stereo** (the tool mixes them down to mono for the audition; final assets could keep stereo for width), and the newer ElevenLabs music models answered a 24 kHz request with 48 kHz audio, so `music_v1` is used here.

## Music

The music API reports no cost per request, so music is generated only when you pass `--music`, and a dry run reports how many seconds will be composed. Check the ElevenLabs credit balance before and after the first run. 12 clips of 20 to 30 seconds are planned (3 prompts for each of 4 cues).

## Licences and the free plan

Anything generated while on a free plan is for listening only. After the paid plan is in place, **re-generate the winners** (the winning prompt is recorded in `summary.md`) so the shipped files carry its commercial licence. The same applies to a voice: the audition uses the free plan, the shipped game needs a plan that allows public, commercial use. The game will be free to play and publicly hosted, so confirm each chosen provider's terms before relying on a voice.

| Provider | Plan | Commercial or public use allowed | Voice-specific terms | Attribution | Cost per typical session |
|---|---|---|---|---|---|
| Deepgram | | | | | |
| ElevenLabs | free now; Starter planned | Starter adds a commercial licence | | | |
| Cartesia | free now | | | | |

## Adding a provider or a candidate

1. Put the key in `.env.local` (names are in `.env.example`). Never paste a key into a chat or commit it.
2. Add its adapter to `scripts/audition/providers.ts` and its request limit to `CONCURRENCY`. Check the request format against the provider's current documentation, and ask for 24 kHz 16-bit audio so clips compare fairly.
3. Add shortlisted voices to `scripts/audition/casting.ts` (and sounds or music prompts to `scripts/audition/sounds.ts`). A provider with no key is skipped with a one-line reason.

Ask for American voices that are not obviously urban or Californian. No voice cloning.

## Budget

The agreed ceiling for the whole audition, across all providers, is $10. Deepgram and Cartesia have cost almost nothing so far; ElevenLabs credits are the thing to watch.
