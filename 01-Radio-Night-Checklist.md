## 1. Project foundation
- [ ] Purchase and configure the Kiro plan
- [ ] Create the new public GitHub repository and commit the .kiro directory
- [ ] Add the vision document and technical specification
- [ ] Set up Next.js, TypeScript, Tailwind, local development and deployment
- [ ] Establish Kiro steering documents, specs, and testing conventions
- [ ] Create a working deployment and basic landing-page skeleton

## 2. Research and audition the audio stack
- [ ] Create standardized audition dialogue featuring different accents and emotional states
- [ ] Test ElevenLabs, Cartesia, Fish Audio, and Deepgram TTS
- [ ] Choose character-voice assignment rules and provider adapters
- [ ] Benchmark Deepgram and at least one alternative STT provider
- [ ] Test speech latency, accent recognition, and room-distance microphone input
- [ ] Prototype phone-to-Bluetooth-speaker playback and microphone turn-taking
- [ ] Lock initial voice providers and acceptable operating costs

## 3. Build the dialogue vertical slice
- [ ] Create a disposable test character with known and hidden facts
- [ ] Implement speech transcription, intent classification, dialogue generation, and TTS
- [ ] Implement in-character deflections for irrelevant, inappropriate, and out-of-period questions
- [ ] Ensure control commands bypass character dialogue
- [ ] Implement deterministic clue disclosure and response validation
- [ ] Add microphone, typed input, transcript, and spoken responses
- [ ] Test repeated questioning, interruptions, prompt injection, and accidental revelations

## 4. Design and write the first mystery
- [ ] Choose historical period, setting, tone, and the central crime
- [ ] Establish what actually happened, including the culprit and complete true chronology
- [ ] Create suspects, motives, relationships, alibis, and personal secrets
- [ ] Design evidence, contradictions, red herrings, and the logical solution
- [ ] Map locations, interviews, discovery paths, and investigative dependencies
- [ ] Write the opening, key revelations, accusation sequence, and ending
- [ ] Produce character bibles and knowledge boundaries
- [ ] Playtest the mystery on paper for fairness, pacing, and solvability

## 5. Develop the game and casebook
- [ ] Implement the mystery state machine and save/resume system
- [ ] Create the complete casebook: notes, suspects, evidence, and timeline
- [ ] Implement scene navigation and location availability
- [ ] Connect characters, clues, facts, and dialogue to the mystery engine
- [ ] Add guided accusation and final deduction flow
- [ ] Create the player onboarding and case briefing
- [ ] Support Play Solo and Play Together from the same saved game
- [ ] Complete a rough but fully playable version using placeholder visuals and audio

## 6. Produce visual and audio assets
- [ ] Lock a coherent noir-inspired visual art direction
- [ ] Produce character portraits and location backgrounds
- [ ] Generate and select period-appropriate sound effects and ambient loops
- [ ] Audition AIVA and Eleven Music for the score
- [ ] Create the main theme, atmosphere beds, and dramatic stings
- [ ] Pre-generate and master scripted dialogue
- [ ] Implement separate dialogue, music, and effects audio buses
- [ ] Add ducking, Dialogue Focus, subtitles, and audio preferences
- [ ] Document licensing and attribution for every shipped asset

## 7. Refine the complete player experience
- [ ] Polish landing page, guest entry, case selection, and game screen
- [ ] Finalize responsive desktop, tablet, and phone layouts
- [ ] Make Play Together practical with a shared speaker
- [ ] Improve narration, player feedback, transitions, and loading states
- [ ] Implement spoken recap, repeat, pause, and resume
- [ ] Tune casebook clarity without giving away deductions
- [ ] Check accessibility, captions, keyboard controls, and audio intelligibility
- [ ] Evaluate onboarding with someone who has never seen the project

## 8. Test, stabilize, and control costs
- [ ] Run complete solo and group playthroughs
- [ ] Test whether players can solve the mystery without hints
- [ ] Test unexpected, irrelevant, repeated, and adversarial questions
- [ ] Check clue dependencies, dead ends, and premature solution disclosure
- [ ] Test provider outages, slow APIs, malformed responses, and retries
- [ ] Test mobile browser, Bluetooth, HomePod-compatible routing, and microphone permissions
- [ ] Add rate limits, server-side budgets, logs, and secret management
- [ ] Verify saves, resumed sessions, and accessible fallbacks
- [ ] Fix critical problems before adding optional features

## 9. Prepare and submit Kiroween entry
- [ ] Finalize repository README, license, asset manifest, and setup instructions
- [ ] Verify .kiro artifacts demonstrate substantive Kiro usage
- [ ] Check that the public repository includes everything required by the rules
- [ ] Write the project description and Resurrection rationale
- [ ] Record and edit the public demonstration video under three minutes
- [ ] Prepare screenshots and a clear path for judges to play
- [ ] Verify the live URL, guest experience, and free availability
- [ ] Submit through Devpost and verify the submission
- [ ] Keep the game operational through the judging period