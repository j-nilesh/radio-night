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
- [x] Staging deploy on Fly (HTTPS): https://radionight.app live 19 Nov; secrets by `fly secrets` (fresh production token secret, daily voice budget 20,000 characters until the allowance exists); checked home, http to https, run creation (Secure cookie), a voiced reply, the save, dev telemetry off (404)
- [x] Access code tier (ADR 0014): hashed codes in the environment, a per-session allowance of voiced and model-played replies, text fallback when it runs out; codes on the start page, in the link, or added to a saved case
- [ ] Bot check on run creation (left out for now, ADR 0014: the per-IP run limit and the daily budget bound the cost)
- [x] Usage page for the owner at /admin/usage (ADR 0014)
- [x] Rate limits and the daily voice budget: kept in memory (correct on the single machine, ADR 0013); the per-visitor counts that matter are in Neon (ADR 0014)
- [x] Session expiry enforced and renewed by play (sliding 30 days)
- [ ] Provider spend caps and alerts set (owner)
- [x] Production access codes (judges, friends) and the usage-page password made; plain values only in the owner's .env.local, hashes on Fly; daily voice budget raised to 60,000 characters
- [x] Fixed narration (opening, rooms, arrivals, endings) is cached after its first synthesis and not charged to visitors (ADR 0014); pre-rendering to files was not needed
- [x] Development telemetry can never run in production and records no words by default (docs/telemetry.md)
- [x] Privacy page: three voice providers, the 30-day sliding cookie, access-code label, counts-only usage, where it runs; credits page names the cast's providers
- [x] Remove the `test-keeper` case from the registry (kept as a test fixture only)
- [x] Drop raw state from the run and action responses

- Note: running `next build` while `next dev` is running made the dev server reload every page in a loop (both use .next). Stop the dev server, or delete .next, before a local production build.

### M3. Real devices
- [ ] Owner and family play the staging URL on phones, speaking and typing
- [ ] Fix list from that pass
- [x] Edna's voice latency re-measured (19 Nov): 10 lines, median 311 ms, slowest 587 ms, none over 2 s; the earlier 2.6 s and 15 s starts were one-offs
- [ ] Measure cost per full playthrough; decide the ElevenLabs plan for the judging month

### M4. Freeze
- [x] Property-based tests (fast-check): 7 reducer properties over thousands of generated event sequences (invariants, nothing forgotten, no duplicates, no mutation, revision, replay, a closed case stays closed) and 2 case properties over any order of play (no required clue out of reach; the view never carries the solution and shows only what was earned). The closed-case property found a real gap: the reducer let a second ending replace the first. Fixed in the reducer.
- [x] Hooks that do real work (.kiro/hooks/project-hooks.json): block shell commands that would print secrets; check browser code never imports the solution or server-only modules; run the case's tests after a content change; check .kiro stays committed
- [x] Refresh stale spec checkboxes (vertical-slice, mystery-bible)
- [ ] Purge the old commits on GitHub (or move to a fresh repo), secret scan, README from a clean clone
- [x] Owner confirms the name in LICENSE and the credits (Nilesh Jahagirdar)

### M4b. Period look (owner feedback: "reads like a 2024 tech app")
- [x] Front page at / explaining the game; AI and tech sections folded into "Behind the broadcast"
- [x] Typography: Bookman, Helvetica, typewriter labels (ADR 0015)
- [x] Surfaces of a 1981 receiver and a live VU meter (ADR 0016); emoji replaced with period line drawings
- [ ] Front-page hero: an early-80s receiver picture from Lovable (brief: docs/art/lovable-brief-hero-receiver.md), wired with provenance via scripts/optimise-images.ts
- [ ] Phone declutter (owner deciding)
### M5. Package
- [x] Demo video script and a recommended path through the game (draft: docs/submission/demo-video-script.md); owner records
- [x] Devpost description and Kiro write-up drafted (docs/submission/, not published; [check] items for the owner)
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
- First load reasonable on cellular (sound files not preloaded wholesale). One-shot sounds are MP3 since 19 Nov (3 MB to 0.4 MB, WAV kept as a decode fallback); looping beds stay WAV to avoid an encoder gap at the loop point.
- Landscape does not break (it need not be good).

### Mobile: now (no device needed)
- [x] Case screen uses dynamic viewport height instead of 100vh
- [x] Text field at 16px on touch screens so iOS does not zoom
- [x] 44 point minimum height for compact buttons on touch screens
- [x] Resume the audio when the page becomes visible again
- [x] Preload only what the current room needs

### Mobile: needs a phone and HTTPS (M3)
- [x] The conversation area was too short on a phone. Fixed after the iPhone 13 Pro test (one sideways row each for people and exits, smaller picture): about 185px at 390x664 with Safari's bars; recheck on the device
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
| Database | One shared Neon database for local and live (owner, 19 Nov: a contest entry, not a launch) |
| Public access | Open to everyone with a small voice allowance; owner monitors consumption |
| ElevenLabs | Upgrade for the judging month |
| Name | Nilesh Jahagirdar (LICENSE, credits, README) |
| Decisions still open | bonus prizes, who records the video |
