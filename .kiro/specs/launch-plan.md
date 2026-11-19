# Launch plan: from a finished game to a judged submission

Status: in progress. Written 19 November 2026. Checklist: tick items as they land; if work stops for any reason, pick up at the first unchecked item under the current milestone.

## Constraint

**all work and the Devpost submission are finished by 27 November**. The contest deadline is 4 December, 2:00 PM Pacific, but nothing depends on using the time between. Decisions from the owner come quickly; work that does not need one starts immediately.

## What the contest requires (from the Official Rules, kiroween.devpost.com/rules)

- Public GitHub repo with an OSI licence detectable in the About section, all source, assets and run instructions, and the `/.kiro` directory committed (never gitignored).
- A working app at a URL, free of charge and without restriction for judges until judging ends; credentials go in the private field of the Devpost form.
- Demo video under 3 minutes, public on YouTube, no third-party trademarks or copyrighted music.
- Text description, and a write-up of how Kiro was used (specs, hooks, steering, MCP, property-based testing, custom agents).
- Every third-party API used under its own terms (done: paid plans on ElevenLabs, Cartesia, Deepgram, Anthropic billing to confirm).

## Done before this plan

Complete game with four endings; fair-play clue chain; model-played characters behind a reply guard; 16 final pictures; locked cast across three voice providers; final sound and music; saved investigations with a welcome-back recap (ADR 0012); CI; 475 tests; ADRs 0001 to 0012; owner playtested and approved.

## Milestones

| Dates | Milestone | Exit test |
|---|---|---|
| **19 to 20 Nov** | **M1. Ready to deploy.** Work committed and pushed. Mobile fixes that need no device. Lazy audio loading. Fly build files. Neon connected. | `next build` passes; the standalone server runs locally; saves survive a server restart against Neon. |
| **21 to 22 Nov** | **M2. Live and protected.** Staging on Fly. Access code, per-visitor allowance, bot check, shared rate limits, session expiry, provider spend caps. Telemetry reduced. Privacy page updated. | A phone opens the HTTPS URL and plays; a run without a code gets text and a small voice allowance; limits survive a restart. |
| **23 to 24 Nov** | **M3. Proven on real devices.** Owner and family play the live URL on iPhone and Android, speaking and typing. Fixes from that pass. Cost per playthrough measured. | The mobile checklist below passes on every device the family has. |
| **25 Nov** | **M4. Frozen and public-ready.** Feature freeze. Property-based tests, hooks and specs brought up to date. Repo prepared to go public (old commits purged, secret scan, README, licence name). | A fresh clone builds and runs from the README; no secret in history. |
| **26 Nov** | **M5. Package.** Demo video recorded and uploaded. Devpost text and Kiro write-up. Optional blog and social posts. Repo made public. Production deploy of the frozen build. | All Devpost fields complete except the final press of Submit. |
| **27 Nov** | **M6. Submit.** Final check of the live URL and judge access, then submit. | Devpost shows the submission as entered. |

27 November is also the buffer for anything that slipped.

## Tasks

### M1. Ready to deploy
- [x] Commit and push everything (sound and music, saves) in logical commits
- [x] Mobile fixes that need no device (below, "Mobile: now"). Checked at 390x844 with touch emulation: every button 44px or taller, field text 16px, screen fits the viewport, no sideways scroll; desktop keeps the compact sizes. First load fetches 2 music files and 3 room beds (current room and its exits) instead of 6 rooms and 2 music files.
- [x] Preload only the current room's sound and the next likely ones; load the rest on demand
- [x] `output: "standalone"`, Dockerfile, `.dockerignore`, `fly.toml` (one machine, always on, region near Neon, secrets by `fly secrets`). App `radio-night` created in iad; certificates issued for radionight.app and www
- [x] Neon project, `DATABASE_URL`, schema migrated (db/migrations/0000), a save checked across a server restart; tests forced onto the in-memory store

### M2. Live and protected
- [ ] Staging deploy on Fly (HTTPS)
- [ ] Access code tier (ADR 0009): hashed codes in the environment, a per-session allowance of voiced and model-played replies, text fallback when it runs out
- [ ] Bot check on run creation
- [ ] Rate limits and the daily voice budget on shared storage
- [ ] Session expiry enforced and renewed by play
- [ ] Provider spend caps and alerts set (owner)
- [ ] Pre-render the fixed narration (opening, scene text, notices, endings) so it costs nothing at run time
- [ ] Reduce development telemetry to anonymous metrics (docs/telemetry.md)
- [ ] Privacy page: three voice providers, the saves cookie, no audio kept
- [ ] Remove the `test-keeper` case from the registry; drop `state` from the run response

### M3. Real devices
- [ ] Owner and family play the staging URL on phones, speaking and typing
- [ ] Fix list from that pass
- [ ] Measure cost per full playthrough; decide the ElevenLabs plan for the judging month

### M4. Freeze
- [ ] Property-based tests for the game-core invariants (the architecture rules require them)
- [ ] More hooks that do real work (for example run tests on save, check `.kiro` is not ignored)
- [ ] Refresh stale spec checkboxes (vertical-slice, mystery-bible)
- [ ] Purge the old commits on GitHub (or move to a fresh repo), secret scan, README from a clean clone
- [x] Owner confirms the name in LICENSE and the credits (Nilesh Jahagirdar)

### M5. Package
- [ ] Demo video script and a recommended path through the game; owner records
- [ ] Devpost description and Kiro write-up
- [ ] Blog and social posts (optional bonus prizes)
- [ ] Repo public; production deploy

### M6. Submit
- [ ] Final walk through the live URL with the judge access code
- [ ] Submit

## Mobile: the acceptance checklist

A standard iPhone (Safari) and a standard Android phone (Chrome), portrait; browser only.

- Every screen usable with no sideways scroll, nothing hidden by the browser bar, keyboard or home indicator, nothing under the notch.
- Push-to-talk works end to end: permission, recording, level check, transcript, spoken reply; also through a Bluetooth speaker.
- Sound survives a screen lock, an app switch and an incoming call, and comes back without a stuck state.
- Typing works with the keyboard open and without the page zooming on focus.
- Tap targets at least 44 points.
- First load reasonable on cellular (sound files not preloaded wholesale).
- Landscape does not break (it need not be good).

### Mobile: now (no device needed)
- [x] Case screen uses dynamic viewport height instead of 100vh
- [x] Text field at 16px on touch screens so iOS does not zoom
- [x] 44 point minimum height for compact buttons on touch screens
- [x] Resume the audio when the page becomes visible again
- [x] Preload only what the current room needs

### Mobile: needs a phone and HTTPS (M3)
- [ ] The conversation area is short on a phone (about 130px at 390x844 with the picture and the people showing); check on a real screen with the browser bars and the keyboard, and consider collapsing the picture once the player starts asking
- Headless Chrome fed a recorded question as the microphone delivers silence, so the speaking path could not be tested there (the muted-microphone check correctly caught it). It needs a real phone.
- [ ] Microphone permission and recording on iPhone Safari (microphone access needs HTTPS)
- [ ] Silent switch and audio session behaviour on iPhone (whether to set the audio session type, tested against recording)
- [ ] Keyboard and layout on iPhone and Android
- [ ] Lock, switch and call recovery
- [ ] Bluetooth speaker

## Known state to design around

- All testing so far: Safari on a Mac Studio with a Yeti microphone. Nothing yet on a phone.
- In-process state (rate limits, speech cache, dev store) is correct only with exactly one Fly machine; shared storage removes the limit.
- Free-tier concurrency: the paid voice plans are small. Several judges at once can hit provider limits and get captions-only lines. Pre-rendered narration and the access code are the mitigation.
- Saves are durable only with Neon (ADR 0012).

## Decisions log (owner)

| Decision | Answer |
|---|---|
| Finish date | Everything, including submission, by 27 Nov |
| Mobile | In scope: standard iPhone and Android phone, browser only |
| Domain | radionight.app (bought 19 Nov) |
| Hosting | Fly app radio-night in iad; Neon AWS US East 1 |
| Public access | Open to everyone with a small voice allowance; owner monitors consumption |
| ElevenLabs | Upgrade for the judging month |
| Name | Nilesh Jahagirdar (LICENSE, credits, README) |
| Decisions still open | public access model, ElevenLabs plan for judging, name in LICENSE, bonus prizes, who records the video |
