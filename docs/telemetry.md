# Development telemetry

Temporary tooling for playtests. It is not part of the shipped game.

## What it does

Server routes and the browser append events to `playtests/YYYY-MM-DD.jsonl`, one JSON object per line. `npm run playtest:report` turns a file into tables.

```
npm run playtest:report                       latest day
npm run playtest:report -- --file 2026-11-08
npm run playtest:report -- --all
npm run playtest:report -- --run ab12cd34     one run (8-character id)
npm run playtest:report -- --verbose          also model text and guard rejections
```

## Privacy
- **Never on the live site.** A production build does not record anything, whatever the environment says, and the browser side does not send. The `/api/dev/telemetry` route answers 404.
- **No words by default.** Questions, replies, transcripts and model text are replaced by their length (`questionChars`, `replyChars`, ...). Set `PLAYTEST_TEXT=on` for a local playtest where the developer needs to read what was said.
- Files stay on the developer's machine in `playtests/`, which is gitignored. Earlier files from November playtests still hold words, including a child's; delete them when they are no longer needed.
- Production keeps counts only (ADR 0014): voice characters, model replies and provider use per day, with no player text.

## Events

Server (`src/lib/telemetry.ts`):

| kind | key fields |
|---|---|
| `run.created`, `run.loaded` | run, browser, scene, clues |
| `turn` | run, key, character, source (voice/text), question, path, stt, classification, topic, model, reply, timings |
| `scene`, `accuse` | run, key, action or suspect, outcome |
| `speech` | line, source (new/shared/cache), outcome, ttfbMs, totalMs, bytes, range, budget |

Browser (`src/lib/telemetry-client.ts`, stored as `client.<name>`):

| name | meaning |
|---|---|
| `session` | user agent, viewport, connection, MediaRecorder and AudioContext support |
| `turn.ask`, `turn.response`, `turn.failed` | ask timing, round trip, errors; `turn` matches the server `key` |
| `audio.request` / `headers` / `first_chunk` / `play_called` / `first_sound` | stages of one line; `first_sound` carries `askToHearMs` and `responseToHearMs` |
| `audio.underrun`, `audio.stopped`, `audio.ended`, `audio.error`, `audio.interrupt` | playback health and why a line was cut |
| `mic.recording` | duration, peak and mean level, mute state, track label, upload verdict |
| `mic.rejected`, `mic.error`, `mic.track_mute` / `track_unmute` / `track_ended` | microphone problems |
| `voice.toggle`, `intro.choice`, `scene.action`, `accuse.submit`, `turn.control` | player choices and spoken commands |
| `cue.loaded`, `cue.bed`, `cue.play`, `cue.load_failed`, `cue.error`, `cue.unknown` | ambience and sound-effect loading and playback |
| `page.error`, `page.unhandled_rejection` | uncaught browser errors |

## Removal plan

Before the public release:

1. Delete `src/lib/telemetry.ts`, `src/lib/telemetry-client.ts`, `src/app/api/dev/telemetry/`, `scripts/playtest-report.ts` and the `playtest:report` script.
2. Remove the `logTelemetry(...)`, `track(...)` and `setTelemetryRun(...)` calls (search for those names; `src/lib/sound-client.ts` forwards cue events through `track`), and the `diagnostics` field in `TurnResult`.
3. If wanted, replace with anonymous counters (latency percentiles, error counts) that hold no question text.
