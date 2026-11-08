# Radio Night
## Build Readiness Plan & Master Checklist

**Version:** 1.0  
**Planning baseline:** November 8, 2026  
**Challenge:** Kiroween 2026, Resurrection category  
**Target submission:** December 4, 2026, 2:00 PM Pacific (December 5, 3:30 AM IST)  
**Purpose:** A practical, ordered build handoff for Kiro. This is not a dated milestone plan, and it does not replace the Product Vision or Technical Specification.

> **North star:** Deliver one complete, compelling, playable, voice-first whodunit. Build the end-to-end game before polishing every individual component.

## 1. Executive summary

**Radio Night** resurrects the shared experience of classic radio drama as an interactive detective mystery. Players listen, question suspects in natural language, examine the evidence, develop a theory, and make an accusation. It works for an individual or a group sharing a speaker. A rich but largely static visual interface offers character portraits, locations, transcript, casebook, suspects, evidence, and timeline.

The game uses a **chained voice pipeline**: player speech → STT → command/relevance classification → deterministic game-state and story constraints → LLM dialogue → character-specific TTS → independently mixed playback. Crucial scenes can be pre-generated, edited, and mastered.

The first game is a tightly scoped, single authored murder mystery, not a mystery generator. Code should support additional cases later without building a generic content platform now.

### Decisions already locked

- Working title: **Radio Night**. Earlier working title: Spye.
- Two entry experiences: **Play Solo** and **Play Together** (shared-speaker family/party experience). One underlying game state.
- Browser-based, responsive web application. Guest-first: no forced signup or payment.
- Static cinematic location backgrounds and character portraits; audio and conversation are the primary experiences.
- Natural speech or typed input; captions/transcript available.
- Push-to-talk for v1; no requirement for ambient always-listening or locked-screen operation.
- **Chained STT → governed dialogue → TTS**, not a monolithic realtime voice model.
- Multi-provider **TTS** adapters, allowing fixed character voices across ElevenLabs, Cartesia, Deepgram, and Fish Audio.
- Authoritative, deterministic mystery state. LLMs must not invent canonical evidence, change the solution, or leak secret facts.
- Irrelevant, inappropriate, out-of-period, and prompt-injection attempts receive bounded, in-character deflections; no game-state progression. Ordinary creative investigative questions remain permitted.
- Three independently controllable audio buses: **dialogue, music, ambience/SFX**, with automatic ducking and Dialogue Focus preset.
- **Neon PostgreSQL** is the production database. **No Supabase and no Turso.** Neon is also the preferred database for future experimental projects.
- IndexedDB for local settings and optional progress cache; server-side guest session and authoritative save in Neon.
- Next.js + TypeScript + Tailwind; Vercel remains provisional hosting choice.
- One public playable game, public source repository, open-source licensing, `.kiro` development artifacts, and a demo video in accordance with official challenge rules.

### Still provisional / requiring experiments

- Final STT provider and character-by-character TTS casting.
- LLM model and provider; latency, safety, and cost benchmarks.
- Audio asset generation tools and exact rights/licensing of outputs.
- Whether Vercel is sufficient for all low-latency streaming orchestration or a separate backend is warranted.
- Hosting/storage location for audio assets, caching policy, and file formats after real-device tests.
- Exact guest save expiration and transcript retention policy.
- First mystery's detailed causal chain, scene sequence, clue logic, names, and ending dialogue.

---

## 2. Build order at a glance

This is a **dependency order**, not a calendar. Adjacent tracks may overlap. Complete the thin playable path first.

1. **Repository and Kiro foundation.** Source control, docs, working app, test harness, deploy preview.
2. **Audio provider audition + minimum speech loop.** Test actual voices, STT, latency, and shared-speaker ergonomics.
3. **One-room governed dialogue vertical slice.** A disposable test character with hidden facts and relevance gate.
4. **Canonical first-mystery bible.** Develop true chronology, motive, suspects, clues, and the solvable deduction path in parallel.
5. **Playable game skeleton.** Guest flow, scene screen, casebook, save/resume, transitions, accusation/end state.
6. **Integrate the complete mystery.** Working playthrough using placeholder visuals and audio.
7. **Produce and integrate final art/audio.** Static scenes, portrait casting, voice recording/TTS, music, SFX, mixing.
8. **Full player testing and hardening.** Solo/group, desktop/mobile, failures, fairness, operating costs.
9. **Submission preparation.** GitHub, licensing, Kiro evidence, public demo, Devpost form, judging availability.

**Hard gate:** Do not spend most of the schedule polishing the landing page before a full game can be played end to end.

---

## 3. Master checklist

### A. Project setup and first Kiro session

- [ ] Purchase/activate the Kiro plan only when ready to use it.
- [ ] Create a **new** repository for Radio Night and verify the project is eligible under the hackathon's new-project rules.
- [ ] Add the existing **Product Vision & Experience Bible** and **Game Design & Technical Specification**.
- [ ] Add this plan as `docs/build-readiness-plan.md`.
- [ ] Create and commit root `.kiro/` steering/spec files from the start; preserve evidence of meaningful Kiro use.
- [ ] Add project instructions: no invented canon; no unsafe secret storage; architecture and licensing rules; test-first story invariants.
- [ ] Scaffold Next.js, TypeScript, Tailwind, linting, formatting, unit tests, and basic CI.
- [ ] Deploy a minimal page to Vercel or chosen equivalent.
- [ ] Establish `.env.example`, separate dev/production environments, and a secrets checklist.
- [ ] Set up a task list in the repo or Kiro specs; track explicit acceptance criteria.

### B. Neon and saves

- [ ] Create a dedicated **Neon PostgreSQL** project/database for Radio Night and configure connection pooling appropriate to the runtime.
- [ ] Select a minimal migration tool (e.g., Drizzle or Prisma) and version-control migrations.
- [ ] Start with tables/entities for `guest_session`, `investigation`, `discovered_fact`, `evidence`, `testimony`, `conversation_turn`, and `case_version` as needed; avoid premature schema complexity.
- [ ] Generate opaque, unguessable guest session tokens and store only appropriately protected representations server-side.
- [ ] Use secure cookies for session identity where feasible; implement rate limits and expiration.
- [ ] Store **authoritative** investigation progress in Neon. Use IndexedDB only for settings, draft UI state, and a recoverable cache.
- [ ] Implement save/resume and confirm a refresh or device restart does not discard a valid session.
- [ ] Keep raw player audio out of persistent storage by default. Define retention for text turns and error logs.
- [ ] Test Neon free-tier monitoring, database quotas, and recovery/export.
- [ ] Do not introduce Supabase Auth, Storage, or database services.

### C. Voice provider evaluation

- [ ] Write a shared audition script (below) with neutral, tense, frightened, irritated, and emotionally restrained lines.
- [ ] Audition **ElevenLabs**, **Cartesia**, **Fish Audio**, and **Deepgram** for TTS.
- [ ] Assign voice IDs per character, never change them silently at runtime.
- [ ] Compare **Deepgram**, **ElevenLabs Scribe**, and a third STT benchmark (e.g., OpenAI transcription) on real recordings.
- [ ] Test microphone capture in a quiet room, at a distance, with multiple speakers, and with game audio routed to Bluetooth/HomePod-compatible output.
- [ ] Measure end-of-utterance → first audible response, full-turn latency, transcription accuracy, and cost.
- [ ] Choose providers by voice/performance **per character**, not one universal winner.
- [ ] Document provider terms for commercial use, public demo use, voice IDs, and redistribution restrictions.
- [ ] Make TTS and STT adapters swappable with contract tests and clear failure modes.

### D. First governed-dialogue vertical slice

- [ ] Build one room with one **disposable test character** unrelated to the actual mystery.
- [ ] Give the character ~12 public facts, several concealed facts, and a few discoverable facts with explicit release conditions.
- [ ] Implement typed question → intent/relevance classifier → story gate → LLM response → text display.
- [ ] Add microphone → STT with a visible recognized-text confirmation/correction path when needed.
- [ ] Add streamed or low-latency TTS response using one chosen test voice.
- [ ] Add command handling for pause, resume, repeat, recap, and settings, separate from character dialogue.
- [ ] Implement stock, in-character deflections for off-topic, out-of-period, inappropriate, and prompt-injection turns.
- [ ] Ensure deflections do **not** change relationships, unlock clues, or advance story state.
- [ ] Validate responses for forbidden revelations and invented canonical facts; retry safely or fall back to scripted dialogue.
- [ ] Cache reusable scripted lines and deflections.
- [ ] Test with questions phrased differently but meaning the same thing; preserve legitimate open-ended investigation.
- [ ] Verify complete speech and text fallback on desktop and mobile.

### E. First mystery bible, in parallel

- [x] Lock broad premise and core emotional reversal (summary in Section 7).
- [ ] Name the town, inn, painter, businessman, wife, bartender, innkeeper, and local regular.
- [ ] Specify the painter's concrete exploitative threat and its evidence.
- [ ] Specify **why** the bartender could reasonably perceive imminent danger and why confrontation escalates to murder. Do not hand-wave with “he panicked.”
- [ ] Lock murder method, time, location details, and whether an item is concealed/moved.
- [ ] Build minute-by-minute true chronology, including movements and who could observe whom.
- [ ] Establish the businessman's real misconduct and an incriminating-but-not-conclusive trail.
- [ ] Give the wife agency, knowledge boundaries, and her own decisions; avoid treating her solely as a motive.
- [ ] Define precisely three primary suspects, two informative witnesses, and each one's truth/lie/omission matrix.
- [ ] Design the smallest viable **fair-play** clue chain that uniquely identifies the bartender.
- [ ] Create the bar/lobby/private interview room/upstairs guest room/kitchen scene list; add no new background without need.
- [ ] Script opening, discovery beats, accusation, revelation, and ending; keep optional questions dynamic and bounded.
- [ ] Paper-playtest from the detective's available knowledge: can someone solve it without lucky guesses?
- [ ] Export structured canonical story data for engine tests.

### F. Gameplay/UI

- [ ] Landing page with atmospheric premise and a prominent **Begin Investigation** button.
- [ ] Guest entry without registration; Play Solo / Play Together choice.
- [ ] Case briefing with accessible narration and controls.
- [ ] Primary scene view with static setting and character art, audio, captions, microphone, and optional typing.
- [ ] Casebook: confirmed facts vs **attributed claims**, suspects, evidence, timeline, and player marks.
- [ ] Scene navigation and unlocking rules; never expose future locations early.
- [ ] Spoken, spoiler-safe case recap in both play experiences.
- [ ] Accusation flow requiring suspect selection and evidence/reasoning; outcome is determined by canonical game rules.
- [ ] Save/resume; loss of network or speech API must not corrupt progress.
- [ ] Responsive mobile layout, keyboard controls, captions, and accessible focus states.
- [ ] Complete one beginning-to-end playable build with placeholder assets before heavy polish.

### G. Music, effects, and voice production

- [ ] Build the Web Audio mixer with independent **dialogue**, **music**, and **ambience/SFX** gain buses.
- [ ] Add automatic music/ambience ducking during dialogue and a Dialogue Focus preset.
- [ ] Test that voice remains intelligible through mobile speakers and remote/Bluetooth outputs.
- [ ] Audition **ElevenLabs Sound Effects**, **Adobe Firefly** audio effects, and properly licensed sound libraries (Freesound/Pixabay subject to individual asset terms).
- [ ] Audition **AIVA** and **Eleven Music** for original instrumental score; consider manual editing/composition.
- [ ] Produce a modest asset list: signature theme, investigative bed, tense bed, reveal sting, closing music, bar murmur, glass clinks, door creaks, stairs, room tone, phone, rain if used.
- [ ] Pre-generate and master scripted dramatic lines; generate only unpredictable dialogue during play.
- [ ] Normalize perceived dialogue loudness across providers, while retaining dramatic dynamics.
- [ ] Ensure any clue embedded in audio is also recoverable through a spoken description, captions, or casebook.
- [ ] Maintain asset provenance/license manifest and clear rights to reuse/distribute each shipped file.
- [ ] Use REAPER or another DAW for trimming, fades, loops, leveling, export, and audition comparisons.

### H. Testing, costs, and reliability

- [ ] Test the full mystery solo, from opening to accusation and ending.
- [ ] Test Play Together with at least two people and an external speaker; player input is explicit push-to-talk.
- [ ] Confirm game sound isn't inadvertently transcribed as a player question.
- [ ] Test off-topic questions, historical anachronisms, abuse, prompt injection, transcript errors, repeated questioning, and unexpected phrasing.
- [ ] Property-test story invariants: no early culprit reveal; no invented key evidence; no impossible clue unlock; no dead-end state.
- [ ] Test browser refreshes, failed API calls, slow responses, speaker switching, and interrupted audio.
- [ ] Set per-session request ceilings, token caps, audio caps, rate limits, a server-side kill switch, and alerts for provider spending.
- [ ] Review accessibility and content suitability for family/group play; label murder themes clearly.
- [ ] Log errors and performance without recording raw microphones by default.
- [ ] Observe at least one playtest where the tester is not coached; simplify confusing interaction.

### I. Kiroween submission readiness

- [ ] Re-check the **official Devpost rules** before submission; do not rely solely on this planning document for legal compliance.
- [ ] Maintain public GitHub repo and license appropriate for required open-source release.
- [ ] Commit usable source, required project assets, reproducible setup, and root `.kiro/` artifacts.
- [ ] Keep private API keys and nonredistributable provider files out of Git history.
- [ ] Explain clearly which Kiro features materially contributed to implementation, testing, or refactoring.
- [ ] Provide a working, free-to-try URL; keep it operational through judging.
- [ ] Prepare a public gameplay demo video **under three minutes** and screenshots.
- [ ] Write Resurrection category pitch: revive 1970s/1980s small-town radio mystery as participatory storytelling.
- [ ] Verify all asset and third-party tool licenses, plus attribution and voice rights.
- [ ] Submit on Devpost ahead of the deadline and verify all fields and URLs.

---

## 4. Monday launch sequence for Kiro

Do these **in this order** on the Mac Studio, without waiting for the completed mystery bible.

1. Open/create repository; add the three planning documents and scaffold project.
2. Add Kiro steering: product principles, scope boundaries, security, narrative canon, tech stack, testing conventions.
3. Configure lint/test/CI and deploy a simple working preview.
4. Create Neon DB and migrations; implement server-side opaque guest sessions and a test save/resume route.
5. Implement the provider adapter interfaces using **mock STT/TTS/LLM** services first.
6. Build disposable one-room test scene, typed dialogue path, and classification gate.
7. Add one real STT provider, one real TTS voice, and one LLM behind env-controlled adapters.
8. Add separate dialogue/music/effects buses and play a looping test ambience.
9. Run the first end-to-end interaction and log latency, cost, errors, and fidelity.
10. Stop, review, and change architecture if needed **before** expanding into multiple scenes.

### First Kiro implementation assignment (copy-ready)

> Build the first technical vertical slice of Radio Night from the attached Vision, Technical Specification, and Build Readiness Plan. Use Next.js/TypeScript/Tailwind, Neon PostgreSQL (not Supabase or Turso), guest sessions, and clean provider interfaces for STT/LLM/TTS. Start with mocks and a disposable single-room character. Implement text input, a constrained relevance/intent gate, authoritative fact disclosure, in-character deflections, captions, and one real chained speech interaction. Include independent dialogue/music/SFX gain controls with ducking. Commit `.kiro/` specs/steering and tests. Do **not** invent or implement the actual mystery, create a mystery generator, add paid accounts, or make unreviewed architecture changes. Deliver a running URL, setup instructions, test results, and a short list of unresolved choices.

### Definition of done for the first slice

- A guest opens the page and reaches a playable room without signing in.
- A player asks a question by **text** and receives an on-topic, canon-respecting answer.
- A player asks by **microphone** and hears a coherent TTS response.
- At least three irrelevant/abusive/anachronistic examples trigger predictable deflections and no state change.
- A restricted fact cannot be extracted through paraphrase or prompt injection in the specified automated tests.
- Dialogue and ambience can be adjusted separately without changing the voice source audio.
- Save/refresh/resume works against Neon.
- Logs show approximate turn latency and failures; API credentials never appear client-side.
- A short README allows the slice to run locally.

---

## 5. Audio provider audition pack

### 5.1 Evaluation roles

Use **three test voice profiles**, not final names:

1. **Narrator / detective guide:** Calm, clear, lightly atmospheric; intelligibility matters most.
2. **Reserved, difficult painter (scripted memories or recordings only, if used):** Dry, perceptive, impatient; subtle restraint.
3. **Bartender:** Friendly, contained, ultimately vulnerable; should handle natural dialogue and a high-intensity revelation.

Consider an additional older character voice to expose accent or age limitations. Actual casting requires the mystery's character bible.

### 5.2 Standardized audition lines

Use identical text across providers, with the same intended direction:

- **Neutral:** “The gentleman came in just after nine. Ordered a whiskey. Sat by the window and said very little.”
- **Suspicious:** “I didn't say I never saw him. I said I never spoke to him.”
- **Contained anger:** “You keep asking the same question, Detective. I'm beginning to wonder what answer you want.”
- **Unease:** “There was somebody on the stairs. I heard them. I just couldn't tell you who.”
- **Understated grief:** “He wasn't an easy man. That doesn't mean he deserved what happened.”
- **Deflection:** “I don't quite follow. As I was saying, he left the bar shortly after nine.”

Audition each in a short paragraph too, because a voice that excels at single lines may drift or flatten in longer dialogue.

### 5.3 Scoring rubric (100 points)

| Dimension | Weight | What to listen for |
|---|---:|---|
| Character authenticity | 30 | Believable human identity, period tone, no assistant cadence |
| Emotional performance | 25 | Restraint, tension, hesitation, shifts without melodrama |
| Voice consistency | 15 | Same voice/accent over multiple turns and emotions |
| Latency | 15 | Time to first audible response and overall conversational flow |
| Intelligibility | 10 | Clear on phone/Bluetooth, unaffected by music |
| Cost | 5 | Cost per typical live turn and complete session |

Record provider, model, voice ID, settings, sample text, generation duration, real-world latency, estimated cost, strengths/weaknesses, and licensing note. **Never choose solely on vendor demos or pricing.**

### 5.4 STT test phrases

Use natural question variants, with and without background bar noise:

- “Where were you when the painter went upstairs?”
- “You said nine-fifteen earlier. Are you changing your story?”
- “What did the woman in the blue coat order?”
- “Can we hear the last answer again?”
- “What do we know so far?”
- “Did you watch the Dodgers game last night?” (anachronism/relevance test, not a transcription failure)

**Metrics:** word-level accuracy, preservation of names and time expressions, turn detection, sensitivity to bar ambience, separation of speaker audio from microphone input, and end-to-end latency.

### 5.5 Adapter contracts (conceptual)

```ts
interface SpeechToTextProvider {
  transcribe(audio: Uint8Array, context: SpeechContext): Promise<TranscriptResult>;
}
interface TextToSpeechProvider {
  synthesize(text: string, voice: VoiceConfig): Promise<AudioResult>;
}
interface DialogueProvider {
  respond(context: AuthorizedDialogueContext): Promise<ProposedResponse>;
}
```

Character configuration should pin `provider`, `model`, `voiceId`, `style`, `format`, and `version`; keep the fictional character model separate from the provider implementation. Response authorization occurs **before** TTS. The app should not switch providers for a character without an explicit compatible-voice approval.

### 5.6 Sound and music research

| Need | Candidates | Key question |
|---|---|---|
| Foley / one-shots | ElevenLabs Sound Effects, Adobe Firefly, licensed libraries | Can we generate convincing short cues and legally redistribute them? |
| Atmosphere loops | ElevenLabs Sound Effects, licensed ambiences, edited recordings | Clean loop points and restrained background noise? |
| Musical cues | AIVA, Eleven Music, commissioned/original instrumental composition | Appropriate noir/late-70s feel, stems/editability, redistribution rights? |
| Editing/mastering | REAPER, Audacity (simpler alternative) | Consistent gain, fades, EQ, loops, export formats? |

Keep source prompts, model names, asset URLs where applicable, receipt/license terms, and a rights note in a manifest. Generated output is not automatically copyright-protected or freely redistributable in every jurisdiction.

---

## 6. Narrative boundary and game-state rules

**The characters are fictional witnesses, not general assistants.** Player creativity is welcome *within* the investigation; the game does not answer arbitrary unrelated questions.

### Input handling order

1. Recognize controls first: pause, repeat, recap, settings, leave room, accessibility.
2. Transcribe spoken input; signal uncertainty where recognition is poor.
3. Classify relevance and historical plausibility against the active scene.
4. For off-topic, anachronistic, abusive, or prompt-injection turns: play an approved in-character deflection; **no progression or knowledge change**.
5. For investigative turns: select relevant character knowledge from the authoritative state.
6. Generate dialogue within a constrained factual context, validate important assertions, and deliver through the assigned voice.
7. Update only allowable evidence/progression facts through the deterministic engine.

### Required invariants

- The killer, true chronology, and meaning of canonical clues cannot be rewritten by a model.
- A witness may lie according to the authored character bible, but the LLM may not invent new relevant lies with game implications.
- **Claim** (“she says she was in the bar”) is never automatically promoted to **fact** (“she was in the bar”).
- Off-topic interaction cannot produce a new clue, shift suspicion, or unlock a location.
- No major evidence becomes inaccessible through unexpected questioning order.
- A player can correctly identify the culprit from recoverable evidence, not by random guessing or narrator exposition.
- The player can complete every essential step through audio-led play, with visual evidence spoken or described accessibly.

---

## 7. First mystery: current canon and unfinished work

### Locked high-level story (spoilers)

The story takes place **around 1980** in a fictional, regionally neutral small American town. At its center is an old inn with upstairs guest rooms and a busy bar downstairs. The investigating detective, officially assigned to the murder, uses a private room adjoining the bar for one-on-one interviews. The innkeeper, bartender, and local regular bring the town into the room through conversation; additional playable locations should be limited.

A respected but difficult, observant portrait painter is in town to paint the **much younger new wife** of a wealthy local businessman. The businessman commissioned the portrait; sittings take place in a **private sitting room at his house**. The painter lodges at the inn and is murdered **in the upstairs guest room**.

The wife is quietly preparing to leave her controlling husband. The **bartender** is helping her and is **not romantically involved** with her. The painter discovers her plans and attempts to **exploit**, rather than selflessly rescue, her. The bartender confronts the painter, and the painter is killed. The bartender is the killer; the businessman and wife are the other two main suspects. The innkeeper and a local regular are important witnesses.

The intended emotional progression is: broad suspicion → growing conviction that the businessman is murderer and morally culpable → evidence exposes the seemingly helpful bartender → a second revelation explains his complicated protective motive without excusing murder. The wife retains agency and does not endorse the killing. The painter need not be secretly noble; justice does not depend on likability.

### Not locked yet, and **must not be invented by coding agents**

- Names of characters, town, and inn.
- Precise form of painter's leverage or demand.
- Why the immediate threat is compelling and why confrontation becomes fatal.
- Murder method, weapon, exact time, discovery, and physical staging.
- Specific alibis and contradictions; whether any secondary theft matters.
- Precise evidence chain that distinguishes bartender from businessman.
- Timelines of every character's movements, scene progression, branch unlocks.
- Final confession and dialogue; case assessment and ending.

### Story deliverables to author separately

1. One-page canonical truth.
2. Six character profiles (victim, businessman, wife, bartender, innkeeper, local regular), plus narrator/detective-role rules.
3. Time-and-location movement grid.
4. Truth/claim/lie/omission matrix per living character.
5. Evidence catalog with discovery, interpretation, and availability conditions.
6. Deduction dependency graph and acceptable final accusation.
7. Scene/event graph and critical scripted dialogue.
8. Audio/visual asset list derived from the finished scene graph.
9. Fair-play paper test and revision log.

---

## 8. Scope discipline and decision gates

### Non-goals for the competition build

- Mystery creator/editor, dynamic procedural mysteries, or multiple finished cases.
- Multiplayer networking, individual player votes, family accounts, or speaker identification.
- Always-on listening or guaranteed locked-screen background operation.
- Animated avatars, elaborate 3D scenes, or cinematics.
- Monetization, paid subscriptions, or extensive account management.
- A broad admin/CMS platform or generalized narrative authoring framework.

### Decision gates

**Gate 1: Convincing voice loop.** Audio sounds human; STT works on real devices; turn latency is tolerable; no uncontrolled plot facts.

**Gate 2: Complete playable story.** Start to finish exists with placeholders; clues lead to a fair solution.

**Gate 3: Shared-speaker experience.** Two or more people can participate with a phone and speaker; microphone/game audio do not interfere.

**Gate 4: Stable public release.** Hosting, budget ceiling, licensing, source repository, documentation, video, and judging availability are ready.

**If schedule pressure mounts:** cut optional scenes, additional voices, fancy transitions, extra music, and accounts **before** cutting the full mystery, clear audio, casebook, or fair accusation.

---

## 9. Operating economics and privacy

- **Neon:** use the existing familiar free/low-cost PostgreSQL setup; track project usage. Do not create a paid service just because a project exists.
- **Voice:** capture cost per minute and per typical game session separately for STT, dynamic TTS, and LLM.
- **Static assets:** pre-generate and serve via cache/CDN where licensed; avoid regenerating common lines.
- **Guest abuse:** use request limits, cooldowns, bot mitigation where justified, and hard provider budget controls. Do not rely on browser-enforced limits alone.
- **Secret management:** provider keys server-side only, restricted scopes, rotation procedure, no credentials in public repo.
- **Data minimization:** don't retain raw player microphone audio by default; make transcript retention explicit; redact personally identifying accidental utterances from logs where practicable.
- **Recovery:** when speech fails, show transcript/text fallback; when TTS fails, show captions and allow retry without damaging case state.
- **Open source vs content:** retain rights and document license for source, artwork, voices, music, and sound individually. Confirm competition's requirements for public inclusion of functioning assets before setting mixed-license boundaries.

---

## 10. Immediate priorities

**Before or during the first Kiro session:**

1. Commit the Vision, Technical Spec, and this plan to the repository.
2. Initialize the app, tests, `.kiro`, Neon, and a working preview.
3. Start audio provider auditions and the disposable scene in parallel.
4. Keep the story writing separate until the causal truth and clue graph are fixed.

**The strongest early success signal is not a polished home page. It is this:** a person can question a character aloud, receive a compelling voiced answer, test an unexpected but legitimate question, and observe that off-topic or adversarial input does not break the fiction.

---

## 11. Source and provider links for implementation verification

Check current docs, quotas, pricing, SDKs, and licensing terms at implementation time; these may change.

- Challenge rules: https://kiroween.devpost.com/rules
- Neon: https://neon.tech/docs
- Vercel: https://vercel.com/docs
- Kiro: https://kiro.dev/docs/
- ElevenLabs: https://elevenlabs.io/docs
- Cartesia: https://docs.cartesia.ai/
- Deepgram: https://developers.deepgram.com/
- Fish Audio: https://fish.audio/developers/
- Adobe Firefly: https://firefly.adobe.com/
- AIVA: https://www.aiva.ai/
- Eleven Music: https://elevenlabs.io/music
- REAPER: https://www.reaper.fm/
- Freesound: https://freesound.org/

*This document is a build plan and working decision record, not legal advice or a guarantee of provider pricing or hackathon eligibility. Re-verify relevant terms before release.*
