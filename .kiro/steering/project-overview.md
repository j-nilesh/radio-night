# Radio Night — Project Overview & Steering

**Working title:** Radio Night  
**Competition:** Kiroween 2026 · Resurrection category  
**Submission deadline:** December 4, 2026 at 2:00 PM Pacific Time  
**Repository:** Public GitHub, open-source licensed  
**Kiro session start:** November 8, 2026  

---

## What is Radio Night?

An atmospheric, browser-based, voice-first interactive radio detective game. Players listen to an authored murder mystery, question suspects in natural speech or by typing, gather evidence, and make an accusation. It supports solo play or shared "Radio Night" group play via a Bluetooth or wired speaker.

The game resurrects the golden-age radio drama format, giving it one capability radio never had: **the characters can hear you and answer back.**

**One-sentence definition:** Authored mystery + improvisational character performance + deterministic investigative logic.

---

## Resurrection rationale (Kiroween)

Radio Night revives the 1930s–1940s radio drama and the participatory communal listening ritual of gathering around a broadcast. It brings those formats into a modern browser with natural voice interaction, a structured investigation UI, and a shared-speaker mode for families and groups.

---

## Kiro usage log

This section is updated as Kiro contributes to the project.

### Session 7 — November 23, 2026
- First-minutes onboarding after a first-time playtest (.kiro/specs/first-minutes.md): a "Who's who" cast sheet, a wide labelled talk button with a quiet-after-speech cue (never auto-sends), a narrator handoff beat, a skippable coach, a shorter How to play; the opening now appears sentence by sentence as the narrator speaks; 21 new tests

### Session 6 — November 20, 2026
- Interface surfaces of a 1981 receiver (ADR 0016), chosen from a side-by-side specimen of two directions: the owner picked a mix of "Hi-fi faceplate" and "Walnut cabinet". Walnut header and footers, brushed-aluminium keys (a key that is on is pressed in with a small amber lamp), amber lamp buttons and microphone, smoked-glass panels and person chips, recessed fields, casebook finds on ruled index cards. All CSS and SVG noise, no new files; the woodgrain is stretched rather than tiled after the specimen showed a seam
- A VU meter beside the case title whose needle follows the voices: an analyser placed in series on the dialogue bus (Safari only runs an analyser that has an output), decibel scale with quick-rise, slow-fall ballistics, still under reduced motion; 2 tests for the scale
- Emoji replaced with period line drawings at the owner's request (a file-folder icon belongs to computer screens): a cassette recorder, a Polaroid and a police lineup in How it works, and a cassette tape marking a spoken question (read as "spoken" by screen readers). The lineup figure was given a number board so it would not read as a computer "user" symbol
- Checked at desktop and phone sizes in headless Chrome; found and fixed a VU meter that did not draw, low-contrast ticked keys, and a phone header made wider by the key lamp. Deployed to radionight.app
- Submission drafts brought in line with the redesign (the 1981 look, an image-gallery shot list, the video script's new shots)

### Session 5 — November 13, 2026
- Period typography after design feedback (ADR 0015): two rounds of side-by-side specimens; the owner chose Bookman titles (TeX Gyre Bonum, a free Bookman, since ITC Benguiat and Souvenir cannot ship in an open repo), tight Helvetica text, Courier Prime labels and buttons, Special Elite casebook notes. Fixed the bug that had kept any web font from loading
- New front page at / explaining the game (the radio-drama format, Millhaven in 1981, how it plays, what the AI does and never does, how it is built), with Play now leading to /start (the former home page); period touches (an On Air lamp, tuning-dial rules). Found that the display and body fonts were never applied anywhere (a circular CSS variable), left for the period-UI discussion
- M4 started: property-based tests with fast-check (7 reducer properties, 2 order-of-play properties over the real case); the closed-case property found that a second ending could replace the first in the reducer, now fixed. Four working hooks (block commands that would print secrets, keep the solution out of browser code, test the case after content changes, keep .kiro committed). Vertical-slice and mystery-bible specs brought up to date. Old playtest logs deleted at the owner's request
- Phone layout fixed after the first iPhone 13 Pro test (title under the buttons, no room for the conversation): one sideways row each for people and exits, smaller picture, tighter input. Voice allowance and access codes (ADR 0014): a voiced preview for everyone, codes for judges and friends (on the start page, in the link, or added to a saved case), model replies capped per visitor, usage recorded per provider with estimated cost, a password-protected /admin/usage page, sliding 30-day session expiry, raw state removed from responses. 15 new tests; verified live
- Live at https://radionight.app: Neon connected (first migration, saves survive a restart), Fly.io app radio-night (one always-on machine in iad, standalone Next.js image, secrets by fly secrets, ADR 0013), certificates for the apex and www; mobile fixes for phones (dynamic viewport height, 16px fields, 44px targets, sound resumes after a lock, nearby rooms only preloaded); launch plan to 27 Nov in .kiro/specs/launch-plan.md
- Saved investigations (ADR 0012): `GET /api/runs/current` finds the browser's most recent run through the guest cookie and returns a spoiler-safe summary; the home page and Begin Investigation page show a Continue card (starting over asks for a second press); a returning run opens on a "Where you left off" screen with the narrator's recap, spoken if the player continues with sound; the in-memory store survives dev hot reloads. 12 new tests
- Final sound: regenerated the room beds, door, stings and four music tracks from the winning prompts on the paid ElevenLabs plan (`npm run audio:final`), levelled to the placeholders they replace, music loops made seamless; wired music into the player (theme once, quiet investigation bed, tense bed while accusing, closing under the ending), checked in headless Chrome that the right files load; the placeholder script no longer overwrites final files
- Voice auditions step 2 done with the family: cast locked across three providers (Ray on Deepgram, Dwight and Carol on Cartesia, Edna, Dennis and the narrator on ElevenLabs). Added Cartesia and ElevenLabs voice adapters with offline contract tests, a router that sends each line to its pinned provider and never swaps a voice, the pinned model in the signed speech link, and `npm run check:voices`; all six voices spoke live and the speech route served Edna, Dennis and Ray. ADR 0011. Sound and music winners are chosen but not yet regenerated for shipping
- Visual layer, task 5: home page redesigned (hero picture, meet the cast), share metadata with a generated social card and a new icon, ending screens with a graded room picture per ending, and a credits section listing pictures by name (evidence counted only, so nothing is spoiled); unused default Next.js images removed
- Visual layer, art: reviewed three Lovable batches and picked winners; all 16 pictures are now final (AVIF, WebP and JPEG within size budgets via scripts/optimise-images.ts, provenance in the manifest). Back Room redone with an old radio on the bare table so no room hints at the weapon. Walked the whole game in headless Chrome at desktop and phone sizes: home, every room, evidence with the note set in code, casebook, and two endings

### Session 4 — November 2026 (build-side work between playtests)
- Second family playtest (Safari, 65 spoken questions, 32 minutes): duplicate audio requests gone (79 requests for 79 lines), no errors, muted-mic check worked
- Playtest findings fixed: an unlocked admission (Dwight and the note) is now delivered as written the first time instead of the model improvising a denial; characters are told who else is in the room; speech waits for 150 ms of audio before starting, removing a small gap in every line
- Feedback from the playtest: room sounds were too loud and the chimes inaudible (ducking was lowering them); ambience is now much quieter, stings and effects bypass ducking, and the room swells briefly while the characters think; added a How to play card and clearer Speak to / Go to hints for a first-time player
- Decided against sending player audio straight to Deepgram for speed (ADR 0008); audio stays on our server
- Recorded the usage-limit plan (ADR 0009): about $50 a month for a month after submission, text first with a little voice, an access code for judges and friends, shared-store counters before going public
- Round 2 of the voice audition adds Cartesia and ElevenLabs (210 clips); built a sound audition (room beds and stings, with a see-it-under-speech check) and fixed a bug it exposed: ElevenLabs sound generation returns stereo
- Reworked the audition into two steps at the owner's suggestion: a quick Keep / Maybe / Drop sieve by one person across all voices, sounds and music, then only the survivors scored independently by each listener; 8 voices per part, 3 short reads each in step 1 (all already made, so no extra credits); added old-time-radio music cues and an ElevenLabs music adapter
- Built the blind voice-audition system: casting briefs, test lines from authored text and real playtest replies, loudness matching, a self-contained listening page that hides provider names, and a scorer using the build plan's rubric (docs/voice-auditions.md)
- Tried Anthropic prompt caching: the cache missed on most turns because per-question text sits in the prompt, so it was reverted rather than shipped unproven
- Added server-side rate limits per guest token and IP on runs, questions, accusations, speech and reads, with 429 and Retry-After; tested live (the 31st question in a minute is refused)
- Added GitHub Actions CI (type check, lint, tests, build) and fixed the four lint errors that would have failed it; confirmed the build passes with no .env.local
- Found that repeat, recap, help, pause, mute and "casebook" commands were silent or wrong (repeat never had anything to repeat, recap printed counts, pause did nothing); rebuilt them: recap and help are spoken from the player's own view so they cannot spoil, repeat replays the last line, casebook opens the notes
- Added robustness suites: attacks and paraphrases against every character with a model that obeys everything, 30 shuffled orders of play that must still end in a solvable case, and garbage from the model provider. The injection suite found a real gap ("ignore all your instructions" slipped through) which is now fixed with a regression test
- Built a data-driven sound cue system: looping ambience per room with crossfades, stings for clues, travel and endings, hushed while the player records; assets listed in an audio manifest with source and licence, original placeholders generated by a script, integrity tests
- Found and fixed that a resumed run never asked for the click that unlocks sound
- Wrote ADRs 0001 to 0007, rewrote the README, added real Privacy and Credits pages (the footer linked to pages that did not exist)
- Verified ambience, crossfade and the travel effect in real headless Chrome

- Visual layer, task 1: art bible, prompt pack and a self-contained Lovable brief (pilot: Tap Room and Ray); an image manifest with provenance and 16 generated placeholders; 23 tests covering coverage, alt text, fair play (Room 5 shows no clue), secrecy (opaque evidence file names, no browser import of the manifest) and that the brief's pilot prompts match the prompt pack (ADR 0010)
- Visual layer, task 2: room pictures reach the browser only through the player view (current room, people present, finds already in the casebook, the victim card), proven by tests; a Photo component with the shared 1981 grade; a room banner with caption, crossfade and a hide switch. Checking in a real browser found that the header overflowed a phone (672px on a 390px screen) because the base .btn class overrides Tailwind padding; fixed with a compact button size, a Menu button on phones, and stacked labels
- Visual layer, pilot review: both Lovable pilot images accepted after a crop test at 5:1, 3:1 and a 42px chip (Ray A and Tap Room A). Asked Lovable to move the TV into the middle band and drop the ashtrays from the bar so no room picture hints at the weapon; wrote the brief for the remaining 14 images (docs/art/lovable-brief-full-set.md) with a fixed provenance report format
- Visual layer, task 4: evidence pictures. Examining a find now shows its picture beside the narration, and the casebook shows a thumbnail. The note's words are set in code over the blank paper (ClueInfo.imageText), and tests check the words match the examine text and stay out of the view until the note is found
- Visual layer, task 3: portrait cards (compact round chips on phones and tablets, framed cards with role on wide screens), a wide-screen two-column layout that gives the conversation its height back, a casebook People section with the victim first, and decorative portraits for screen readers. Also made the voice audition page warn about unfinished tabs when saving, after a shortlist was saved with four characters unmarked

### Session 3 — November 8, 2026
- Analysed the first family playtest (Safari, every turn spoken): found each line requested twice, slow replies and a muted-microphone dead end
- Added development-only playtest telemetry (server and browser) written to a local, gitignored `playtests/` folder, plus `npm run playtest:report`
- Rebuilt speech playback for Safari: raw PCM streamed over fetch and scheduled through Web Audio, instead of MP3 in an audio element (Safari needs HTTP Range support the stream cannot give)
- One upstream synthesis per line, shared by every listener, with a byte-bounded cache and a spend-cap refund on failure
- The microphone now measures its own level: a muted or silent recording is stopped before upload with a plain message, and the server tells an empty transcript from a low-confidence one
- Tuned Haiku's prompt using the interrogation test: a closing FORMAT section with a wrong/right example cut stage-direction narration from 16 replies to 0; a rule against calling the conversation 'a game' fixed the last meta-language slip (Ray's role-reversal answer is now in-world)
- Pushed the project to a private GitHub repository (j-nilesh/radio-night) as a cloud backup; to be made public for submission
- Rewrote commit author/committer email to the GitHub noreply address before the first push (file contents unchanged)
- Built the model-backed character path: per-character persona prompts written from the bible (each character sees only their own knowledge; Ray knows his secret)
- Prompts change with game state: a locked topic moves from 'keeping back' (with cover story) to 'will say' when the player earns it
- Clue-earning questions still get the authored line verbatim; the model improvises everything else
- Reply guard checks every model reply before it is spoken (locked-topic leaks, AI self-reference, naming a killer); failures fall back to the authored line
- Server-held conversation memory per character
- Interrogation harness (npm run interrogate): hostile interview suites per character, raw (model alone) and full (game pipeline) modes, graded by a second model
- Wired Deepgram Aura-2 text-to-speech: every character and the narrator now speak, with a provisional cast in one file (voices.ts)
- Audio streams to the browser through signed links, so playback starts in well under a second instead of waiting for the whole line
- Added a voice cache, a daily character budget, and voice identity pinning (a voice pinned to another provider is refused, never swapped)
- New questions interrupt whoever is speaking; the mic stops playback before listening; a click-to-begin screen satisfies browser autoplay rules
- Verified in real headless Chrome: intro gate, narration, interruption, Ray speaking, voice toggle, audio panel, no console errors
- Wired Deepgram (Nova-3) speech-to-text behind the existing STT adapter interface; the key is read only on the server
- Passes the recording format and the case's character names to the recogniser as keyterms
- A speech-service failure now degrades to a notice instead of a server error
- Added `npm run check:stt`, a live smoke test that speaks case phrases and reports transcript, confidence and latency
- Fixed the mock recogniser turning microphone audio into garbage text, and a mic button that could re-trigger itself
- Built the accusation flow: choose a suspect and the supporting evidence, confirm, then an authored ending with a debrief
- Wrote the two endings the bible had left open (correct-partial, wrong-Carol)
- Accusation rules live on the server; refusals are identical for every suspect so they never hint at the answer
- Rebuilt the validator around the six steps of the case, fixing a gap where `clue-fenn-heard-carol` could not stand in for the motive step
- Wired "The Sitting" into the engine: Ray, Dwight, Carol, Edna and Dennis are now playable
- Authored deterministic answer topics per character (trigger patterns, written lines, locked denials, clue grants)
- Added scenes with travel, examinable objects, and characters who arrive as the investigation progresses
- Added the casebook, which labels physical finds separately from witness testimony
- Found and fixed two engine flaws through the playthrough tests: a general topic could bypass a locked denial,
  and single words like "stop" or "evidence" inside long questions were being read as commands
- Fixed Tailwind not being applied (missing PostCSS plugin) and the 500 on Start Investigation (missing env)
- Added an in-memory store fallback when DATABASE_URL is unset

### Session 2 — November 8, 2026 (continued)
- Authored the complete first mystery bible: "The Sitting" (docs/mystery/01-mystery-bible.md)
- Locked all canon: killer (Ray Kowalski), victim (Gerald Fenn), setting (Millhaven NH, Oct 1981), weapon (glass ashtray)
- Designed full fair-play clue chain: 3 tiers, 9 named clues, 4-of-6 accusation rubric
- Wrote character knowledge boundaries (truth/lie/omission matrix per character)
- Designed scene graph (6 locations, unlock conditions, exits)
- Wrote 5 scripted beats (prerecorded): opening, Room 5 entry, Carol disclosure, Ray admission, finale
- Created truth.ts (server-only canonical solution + accusation validator)
- Created characters.ts, scenes.ts, beats.ts for the radio-night-s01 case
- Created .kiro/specs/mystery-bible.md tracking all remaining tasks
- Dev server confirmed running at http://localhost:3000

### Session 1 — November 8, 2026
- Read and synthesized all four planning documents (Vision, GDD/Technical Spec, Build Readiness Plan, Checklist)
- Verified Kiroween 2026 rules and submission requirements
- Scaffolded the full Next.js/TypeScript/Tailwind project
- Created monorepo-style packages directory (game-core, audio-client, ai-orchestration, providers)
- Set up Drizzle ORM + Neon PostgreSQL schema and migration infrastructure
- Wrote .kiro/ steering files for project overview, architecture rules, coding conventions, and security
- Created .kiro/ spec for the vertical slice (first implementation milestone)
- Wrote all core TypeScript type definitions for game state, voice pipeline, and provider adapters
- Created Neon DB schema with all required tables (guest_sessions, runs, run_events, turns, audio_assets, provider_usage)
- Wrote provider adapter interfaces and mock implementations for STT, TTS, LLM
- Set up Vitest testing infrastructure
- Created .env.example documenting all required environment variables
- Created project README, MIT license, and docs/architecture.md

---

## Technology decisions

| Layer | Choice | Rationale | Status |
|---|---|---|---|
| Web framework | Next.js 15 + React + TypeScript | Responsive game + server routes + App Router | Locked |
| Styling | Tailwind CSS | Speed, consistency, mobile-first | Locked |
| Database | Neon PostgreSQL | Familiar, cost-effective, serverless-compatible | Locked |
| ORM | Drizzle ORM | Lightweight, type-safe, good migration tooling | Locked |
| Testing | Vitest | Fast, ESM-native, compatible with Next.js | Locked |
| Code format | Prettier + ESLint | Consistency | Locked |
| STT provider | Deepgram (first audition) | Streaming support, good accuracy | Provisional |
| TTS providers | ElevenLabs, Cartesia, Fish, Deepgram | Per-character casting | Provisional |
| LLM | Provider-agnostic adapter | A/B testing, cost control | Provisional |
| Hosting | Vercel | Straightforward Next.js deploy | Provisional |
| Audio editing | REAPER | Offline production and mastering | Locked |

---

## Non-goals for v1 (competition build)

- Mystery creator/editor
- Multiplayer networking or individual player accounts
- Always-on listening
- Animated avatars or 3D scenes
- Monetization or paid subscriptions
- A second complete mystery case

---

## Hard gates

1. **Gate 1:** Voice loop sounds human; STT works on real devices; turn latency is tolerable; no uncontrolled plot facts
2. **Gate 2:** Full playable story exists end-to-end with placeholders
3. **Gate 3:** Shared-speaker experience works without mic/speaker feedback
4. **Gate 4:** Stable public release with hosting, budget ceiling, licensing, source repo, demo video
