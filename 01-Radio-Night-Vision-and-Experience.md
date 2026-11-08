# RADIO NIGHT
## Product Vision & Experience Bible

**Version:** 1.0 planning baseline  
**Date:** 5 November 2026  
**Project:** Kiroween 2026 · Resurrection category  
**Status:** Product vision approved in principle; first story deliberately unspecified  
**Companion:** `02-Radio-Night-Game-Design-and-Technical-Specification.md`

> **The story is listening.**
>
> An interactive radio mystery for one detective or a room full of them. Listen to the drama. Question the characters. Follow the evidence. Solve the case.

---

## 1. Executive vision

**Radio Night** resurrects the participatory social ritual of the golden-age radio drama, adding a capability radio never had: its characters can hear and answer the audience. Players enter a carefully authored mystery, interact with suspects through natural speech, review evidence, and reach a reasoned conclusion. They can play alone at a laptop, or gather in a living room and route sound from a phone or computer to a shared speaker. A rich but restrained screen offers scenes, portraits, notes, clues, and an investigation timeline; it enhances the detective work rather than competing with the sound.

This is not an infinite generative storytelling engine, an unrestricted chatbot, a multiplayer platform, or a video game that happens to have voice. It is **authored mystery + improvisational performance + deterministic investigative logic**.

**Working name:** Radio Night. Naming, domain and trademark clearance remain outstanding. The earlier working name *Spye* is superseded for planning; preserve it only as internal history if useful.

### One-sentence product definition

An atmospheric, browser-based, voice-first radio detective game with visual investigation tools and a shared-speaker mode for families and friends.

### Competition fit

Kiroween's **Resurrection** theme is intrinsic: the format revives the radio mystery and the communal listening experience. Kiro is used substantively to specify, build, test, and document the project. The entry is a **single polished, playable case**, not a case-creation platform.

---

## 2. The promise to the player

1. **A performance worth listening to.** Recognizable characters with consistent voices, excellent dialogue intelligibility, deliberate pacing, and disciplined audio production.
2. **Real investigative agency.** You can ask questions in your own words, revisit witnesses, inspect clues, challenge inconsistencies, and decide whom to accuse.
3. **A fair mystery.** The solution is fixed, clues are discoverable, testimony is distinguishable from fact, and the player can solve the case through reasoning rather than random guessing.
4. **An experience that welcomes a room.** The player can connect an ordinary speaker, discuss the case with others between turns, and take turns questioning the same cast.
5. **An optional visual companion.** Beautiful static scene art, suspects, evidence, timeline, and notebook; never an obligation to stare at a screen while listening.
6. **A bounded fictional world.** Characters remain in their setting. Irrelevant, inappropriate, or anachronistic inputs lead to short, in-character deflections and return to the matter at hand.
7. **A finished evening, not a service commitment.** One complete story, beginning to ending, in a contained session with reliable saving and resumption.

---

## 3. Target audience and contexts

**Primary:** Adults and older teens who enjoy detective fiction, radio plays, interactive fiction, escape-room reasoning, and audio storytelling. Shared play is especially compelling for families and small groups; the mystery's eventual content rating will be chosen during story development.

**Secondary:** Solo players at a desk or with headphones, including players who prefer typing, captions, and visual evidence review.

### Core play contexts

| Context | Setup | Experience |
|---|---|---|
| **Solo Investigation** | Browser on phone, tablet, or computer; optional headphones | Speak or type to suspects; inspect and organize the casebook visually. |
| **Radio Night / Gathered Play** | Browser on one device; audio routed to Bluetooth, wired or supported AirPlay/HomePod speaker | Everyone hears the story; participants discuss freely and take turns posing questions using one game session. |

**Naming note:** *Radio Night* is the title of the game, not an additional mandatory menu mode. For UI clarity, offer **Play Solo** and **Play Together**, with the latter described as “Radio Night with friends and family.” Avoid a confusing “Radio Night mode inside Radio Night.”

Group play is **one shared detective and one case state**. No individual participant accounts, recognition, voting, competing investigators, or multiple microphone channels in the competition release.

### Not a commute product

We are **not** positioning the game as a driving/commute experience. Shared listening at home is central. Speech turns deliberately pause for group discussion. Do not suggest safe hands-free use while driving.

---

## 4. Experience principles

### 4.1 Sound leads; the screen supports

The soundtrack and spoken performance carry the atmosphere and essential plot. The visuals make spatial context, records, and progress legible. A player should be able to meaningfully progress by listening and speaking alone, but can use the casebook to reduce memory burden.

### 4.2 Detective, not chatbot user

Dialogue is anchored to characters, scenes, knowledge, motives, and permissions. The player cannot ask for general news, sports scores, modern AI advice, or the hidden system prompt and receive an assistant-like reply. However, seemingly unexpected **investigative** questions deserve meaningful, bounded answers, including “I don't know” when appropriate.

### 4.3 Story integrity over generative freedom

All canonical events, the culprit, chronology, evidence, relevant lies, and solution conditions are authored and represented as data. The model chooses **how** an approved response is voiced, not **what is true** or which clue exists. Signature scenes and revelations are prewritten and prerecorded where appropriate.

### 4.4 Fair play, no accidental spoilers

The notebook differentiates established fact, sourced testimony, inference, and unresolved question. It does not silently declare a suspect guilty. The system must not prematurely reveal protected facts. A wrong accusation should be a fair outcome, not an impossible-to-explain trap.

### 4.5 Listen together, think together

In gathered play, the discussion between spoken turns is a feature. The experience must tolerate silence. Push-to-talk avoids transcribing family conversation as a question. A recap is always available.

### 4.6 Period authenticity without opacity

Setting, diction, sounds, technology, and social details should support a convincing historical world. Dialogue remains comprehensible to modern listeners. Authenticity should not mean inaccessible accents, excessive radio static, or muddy recordings.

### 4.7 No mandatory login to be intrigued

A visitor should be able to start the experience as a guest. Local progress should save automatically when practical; optional account login enables cross-device persistence later. The first few minutes must demonstrate the magic before asking for commitment.

### 4.8 Accessibility is part of authorship

Captions, typed input, replay and recap, adjustable dialogue/music/effects volumes, reduced motion, keyboard navigation, readable contrast, and non-audio access to essential clues are core affordances.

---

## 5. The player journey

### 5.1 Public landing page

A visually confident, cinematic introduction: **Radio Night** logotype, a dramatic still image, concise hook, a short playable/audible teaser, **Begin Investigation** button, and a clear “Play solo or with a room full of detectives” explanation. Mention microphone and headphones/speaker options without technical jargon. Avoid a wall of architecture details or pricing. Include privacy and accessibility links.

**Desired emotional move:** From curiosity to “I want to hear what happens next.”

### 5.2 Enter the detective's office

Play as Guest; sign in only if desired. Present **New Case** / **Resume Case** and a choice between **Solo** and **Play Together** guidance. First-run setup asks for audio playback permission through a user gesture; microphone is requested when the player first chooses to speak. Offer a short optional audio check.

### 5.3 Cold open and case briefing

Start with a short, polished radio-drama introduction rather than a lengthy settings screen. Establish situation and first question. Demonstrate that the player can interrupt only at safe interaction points in v1. Introduce the narrator or host and the spoken “What do we know?” recap command.

### 5.4 Investigation

At a scene, the player hears an initial character statement. They can ask in natural language, inspect a relevant object, move to another available location, or review notes. Important discoveries play a discreet audio cue and enter the casebook with their provenance. The game never uses a crude “62% mystery solved” progress bar.

### 5.5 Casebook and theories

Four primary views: **Notes**, **Suspects**, **Evidence**, **Timeline**. The source of every claim is visible. Bookmarking a suspicious statement and comparing testimony are useful, but a large freeform corkboard is not required for v1. A player can request a spoken, spoiler-safe summary.

### 5.6 Accusation and resolution

The player names a suspect and supports the theory with relevant evidence. The finale is highly authored, audio-led, and cinematic. Provide an assessment grounded in what the player discovered and reasoned, without relying solely on a numeric score. Offer replay / alternative approaches where appropriate.

### 5.7 Return visit

Resume with an optional “Previously, on Radio Night…” recap. Restore current scene, discovered evidence, casebook, turn context, mode, caption preference, and volume settings. Never depend on a living model's hidden memory as the save file.

---

## 6. Visual identity and screen philosophy

**Art direction:** 1930s–1940s broadcast and detective-office references: photographic compositions, dramatic shadow, paper textures, warm brass, dark charcoal, aged cream, restrained crimson or amber accent. The exact story may be set in another period; the *shell* evokes radio-noir, while scene art and costumes must fit the specific case's historical period.

**Visual assets:** Static, high-quality scene backgrounds; period-appropriate character portraits; suspect dossier cards; individual evidence illustrations/photos; restrained animated transitions. No lip-synced avatars or costly full-motion character animation.

**Screen hierarchy:** Large scene visual; clear dialogue/caption area; prominent talk/type controls; unobtrusive path to casebook and navigation; discoverable audio settings and pause button.

**Mobile:** The scene and dialogue stay central. Casebook, suspects, timeline, and evidence open as accessible sheets or full views. Avoid dense desktop sidebars on narrow screens.

**Visual restraint:** No overdecorated faux-vintage UI that impairs reading. Authenticity serves orientation, not ornament.

---

## 7. The sound of Radio Night

### 7.1 Four authored sonic elements

- **Performance:** Narrator and cast with distinct, recognizable voices. Character-specific casting may use different TTS providers, assigned consistently.
- **Ambience:** Rain, night traffic, ward hum, creaking floorboards, clockwork, room tone, and other historical details.
- **Foley and cues:** Doors, telephones, paper, keys, footsteps, discovery stings, scene transitions.
- **Music:** Original or appropriately licensed motifs and restrained instrumental beds, with meaningful silence.

### 7.2 Three independent playback buses

**Dialogue**, **Music**, and **Effects/Ambience** have independent volume settings. Dialogue defaults high and clear; music and effects are quieter. Automatic **ducking** lowers beds during speech and restores them smoothly afterward. **Dialogue Focus** preset offers more pronounced ducking for shared speakers and noisy rooms. Never bury a plot-critical line under music or atmospheric noise.

### 7.3 Dramatic discipline

Treat silence, pauses, turn-taking, distance, and vocal nuance as part of the score. Period radio filters are subtle; overly narrow EQ, fake crackle across all speech, and excessive reverb harm understanding. Establish a consistent mastering target and audition on phone speakers, headphones, television speakers, and an ordinary Bluetooth speaker.

### 7.4 Essential evidence redundancy

If a sound conveys an essential clue, it must also become accessible through dialogue, description, replay, caption, or casebook. No solution depends on hearing a faint effect correctly.

---

## 8. Conversation, the narrative boundary, and fairness

**Allowed:** Questions about current suspects, plausible off-script investigative topics, object examination, requests to repeat/rephrase/recap, relevant character background, contradictions, actions permitted by the current game state.

**Not allowed as dialogue:** Contemporary irrelevant subjects, out-of-period pop culture, attempts to prompt-inject the model or extract secrets, unrelated general assistant tasks, abusive or sexually inappropriate detours.

**Expected reaction:** A brief, in-character, bounded deflection, typically referencing the last relevant subject: “I'm afraid I don't follow, Detective. As I was saying, I was on the night ward.” Rotate a small set of approved responses for naturalness, but avoid arguing or escalating. Such turns **never advance clues or state**. For repeat attempts, offer a neutral, nonjudgmental hint about what can be asked.

**Important distinctions:**

- A harmless anachronism is rejected as out-of-period; a genuine question about the historical setting can be answered if within the character's knowledge.
- A bizarre-sounding but relevant investigative question is not automatically off-limits.
- A safety-critical control command such as “stop,” “pause,” or “mute” takes precedence over dialogue classification.
- If transcription is uncertain, ask for repetition; do not classify a guessed transcript as abusive.
- Characters may contain dark fictional subject matter appropriate to the selected rating, but the game is not an invitation to sexualized, hateful, or abusive improvisation.

---

## 9. Solo and gathered interaction

### Solo

Use microphone or keyboard. Speak at explicit turn boundaries or use push-to-talk. Explore casebook visually. Replay lines and access transcript. Voice output and captions should remain consistent.

### Play Together

One browser session controls the case. Device routes audio to a speaker using standard OS capabilities; do not promise a custom HomePod connection or universal casting API. Ask one question at a time with push-to-talk. The game waits while people discuss. Offer **Replay last line**, **Summarize our case**, **Who have we interviewed?**, and **Return to the casebook** actions in spoken or visible form. Turn-taking should work even if a different family member speaks next.

**Audio feedback caveat:** Speaker output can bleed into the microphone. In v1, stop or heavily duck playback during capture and process player speech only after an explicit interaction. Test Bluetooth delay, device-route switches, echo cancellation, and permission flows. True always-listening group mode is not a release requirement.

---

## 10. Narrative design constraints for the future mystery

The future story must be designed **for this interaction model**, not merely adapted from prose. The first case should have:

- A compelling cold open and audio-first dramatic stakes.
- A limited, memorable cast with distinguishable voices.
- A finite number of locations, clear scene transitions, and useful objects.
- A fixed truth model: events, time, motives, deception, evidence, and solution.
- Multiple investigative paths and enough clues to support fair deduction.
- A play length tentatively targeting **45–75 minutes**, to validate in tests rather than force artificially.
- A satisfying accusation sequence and authored finale.
- A manageable set of soundscapes, voice assets, and dynamic responses.
- Character knowledge boundaries so no witness can reveal the entire answer by accident.

**Not decided here:** Decade, country, crime, culprit, cast names, number of suspects, exact content rating, detailed clue graph, title of the first episode. Any sample nurse/butler/widow or estate imagery discussed previously is illustrative, **not canon**.

---

## 11. Anti-goals and exclusions

Do not build, for the first competition submission: a user-authored mystery studio, generative case factory, multiple story campaigns, competitive multiplayer, account-based leaderboards, native iOS/Android apps, lip-synced avatars, character face animation, payments, sophisticated social features, open microphone always-on listening, or mandatory registration.

Keep architecture extensible where cheap, but do not use “future proofing” as a reason to miss the single-case deadline.

---

## 12. Experience quality bar

A release is successful if representative first-time players can:

1. Start without creating an account or reading an instruction manual.
2. Hear and understand a compelling introduction over ordinary playback hardware.
3. Ask a valid free-form question and receive a plausible, in-character answer promptly.
4. Ask an unrelated question and observe an in-world refusal without derailment.
5. Ask an unexpectedly relevant question without being punished for phrasing.
6. Review facts versus testimony without the UI telling them the solution.
7. Change dialogue/music/effect volumes independently during play.
8. Play together through a consumer speaker without constant microphone feedback.
9. Save and resume the same investigation accurately.
10. Reach the ending and understand why the conclusion follows from the evidence.

Qualitative user testing should probe enjoyment, confusion, sense of agency, voice credibility, reasoning fairness, and family participation. Instrumentation should collect minimal operational data and avoid retaining raw voice by default.

---

## 13. Decisions register

### Locked product decisions

- Working game title **Radio Night**; former prototype name *Spye* is retired for external product copy.
- Responsive web app, with static cinematic scenes and character portraits.
- **Solo** and **Play Together** experiences share one state and one mystery engine.
- Group listening via ordinary device speaker routing; **one collective investigator**.
- **Chained STT → intent/boundary/engine → LLM → TTS**, not a black-box speech-to-speech agent.
- **Multi-provider voice casting**, with fixed voice identity by character.
- Prerecorded key scenes; dynamic synthesis for valid conversational turns.
- Separate dialogue, music, effects/ambience controls with ducking and Dialogue Focus.
- Natural-language questions constrained by story relevance, time period, safety, and fixed truth.
- In-character deflections for irrelevant/inappropriate questions; no state progression from those turns.
- Authoritative deterministic state; structured casebook with provenance.
- Guest-first entry, optional sign-in, save/resume.
- One completed mystery for Kiroween; mystery contents not yet chosen.

### Provisional implementation choices

Next.js/React/TypeScript, Tailwind, Supabase/PostgreSQL, Vercel, REAPER, Deepgram for initial STT audition, ElevenLabs/Cartesia/Fish/Deepgram for TTS auditions, ElevenLabs SFX and Adobe Firefly for effects, AIVA and Eleven Music for composition. These are **evaluation candidates**, not procurement commitments.

### Open decisions

- Final brand/domain/trademark clearance and visual logotype.
- Detailed final audience/content rating and historic setting.
- Cast and precise voice provider assignments.
- STT winner and LLM provider/model.
- Final audio generation, commercial use and repository redistribution rights.
- Exact game length, art production techniques, and release hosting/budget.
- Whether an account-based save is required for judging or simply offered.

---

## 14. Relationship to the technical specification and story bible

The companion technical specification defines interface contracts, state transitions, data schemas, provider adapters, testing, Kiro workflow, licensing, and delivery requirements. It should implement the principles here without quietly changing them.

A **separate, future First Mystery Story Bible** will define the immutable truth, suspects, chronology, clues, scenes, authored dialogue, reveal conditions, and ending. It must be written after this experience architecture is accepted.

**Guiding sentence:** *A radio play whose audience can ask questions, but whose mystery cannot cheat.*
