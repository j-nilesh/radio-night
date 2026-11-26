# Devpost description

## Name
Radio Night

## Tagline (one line)
A 1981 murder mystery told as a radio drama, where the characters hear your questions and answer back.

## Category
Resurrection

## Inspiration
Golden-age radio drama was something people did together: a family around a set, listening, guessing who did it. The format died with television, and so did that kind of shared, ears-first evening. I wanted to bring it back with the one thing radio never had. You can talk to the people in the story, and they answer in their own voices.

## What it does
- **An authored mystery, "The Sitting".** Millhaven, New Hampshire, October 1981. A portrait painter is found dead in Room 5 of the Bridgewater Inn while the bar downstairs is still open. Five people are tied to the night, and one of them did it. The case is fair: every clue the solution needs can be found, heard or reasoned out, in whatever order you explore.
- **Question anyone in your own words,** by voice or by typing. Each character is played by a language model inside strict limits. They know only what they would know, keep their secrets until you earn them, deflect nonsense in character, and never confess because you asked them to.
- **They notice who you are talking to.** Ask Edna "So, Carol, where were you earlier?" and Edna says she is not Carol. Nothing in the game moves, and she tells you nothing about Carol's evening.
- **A first minute that explains itself.** A friend who had never played got lost in the opening, so the game now teaches itself. The narrator ends the opening by telling you what to do, and the text appears a sentence at a time as he speaks. Tap a face and a "Who's who" card says who that person is. One large button reads "Tap to ask Ray", turns red while it listens, and says "Done? Tap to send" when you go quiet. A short coach strip points to the next thing to try, and can be skipped.
- **Walk the inn.** Six rooms, each with its own photograph, room sound and music. Examine what is there, and keep what you find in a casebook that separates what you found from what you were told.
- **Make an accusation.** Choose a suspect and the evidence that proves it. There are four endings, and if you name the right person you get a debrief of what you proved and what you missed.
- **Alone or around a speaker.** Play on your own, or put the sound through a speaker, pass the phone and take turns asking. It is the same game either way.
- **Pick up where you left off.** No account. Your case is saved, and the narrator recaps it when you come back.
- **Looks like 1981.** The screen is built from the materials of a hi-fi receiver of the time: a walnut case, brushed-aluminium keys, amber lamp buttons and a VU meter whose needle moves with whoever is speaking. Titles are set in Bookman, labels in a typewriter face, and the casebook keeps its finds on ruled index cards.
- **Works in a phone's browser** as well as on a laptop.

## How I built it
- **Next.js 16, React 19 and TypeScript**, hosted on **Fly.io**, with saves in **Neon Postgres** through Drizzle.
- **Speech in:** Deepgram Nova-3. **Voices:** Deepgram Aura-2 (Ray), Cartesia (Dwight and Carol) and ElevenLabs (Edna, Dennis and the narrator), behind one router that keeps every voice on its own provider and never swaps one silently. Speech streams to the browser as raw audio and plays through Web Audio, so a reply starts in well under a second.
- **Characters:** Anthropic Claude (Haiku). Every reply passes a guard before it is spoken: no locked facts, no talk of being an AI, no naming a killer. A question that earns a clue gets the authored line the first time; the model colours everything else but cannot change the story.
- **Game state** lives on the server and changes only through validated events. The browser is only ever told what the player has earned.
- **Pictures** were generated with Lovable in one 1981 photographic style, with the prompt and date recorded for each. **Sound and music** were generated with ElevenLabs, chosen in the same blind test as the voices.
- **The look** is drawn in CSS and SVG, with no image files for the interface: woodgrain and brushed metal are SVG noise, and the VU meter reads the dialogue level through a Web Audio analyser.
- **Cost and abuse controls.** Everyone gets a voiced preview. Judges and friends get an access code for the full game. There are per-visitor and per-day caps on voice and on model replies, per-address rate limits, and a password-protected usage page that shows estimated cost per provider per day.
- **Built with Kiro end to end.** Steering files (`.kiro/steering/`) held the project's non-negotiables (no secrets or solution reaching the browser, the model may never commit a game event) in every session. Specs (`.kiro/specs/`) turned playtest findings into checkable, resumable task lists. Hooks (`.kiro/hooks/`) blocked any command that would print a secret and ran the mystery's test suite on every content change. Property-based tests (fast-check), required by the steering rules, generated hundreds of random event sequences per rule and found a real bug no unit test had: the reducer let a second ending silently replace the first. Full detail in the Kiro write-up linked below.

## Challenges I ran into
- **Keeping a language model inside a mystery.** Characters must sound alive without leaking the solution or confessing on request. I built a hostile interrogation harness, where a second model grades the answers, plus test suites of prompt injections and paraphrased "just tell me who did it" attacks. One suite found a real gap ("ignore all your instructions" slipped through), now closed with a regression test. A later playtest showed a character inventing a small fact (how long Ray had worked there), so what every character publicly knows now includes it.
- **Audio on phones.** Safari needed a different playback path (raw audio over Web Audio, not an audio element). The microphone checks its own level so a muted mic doesn't end in silence. Sound has to come back after a screen lock. On iPhone, using the microphone can leave later sound quieter, so the game switches the audio session back to playback when it lets the microphone go. The long opening narration sounded jerky on a phone until I stopped handing the browser the whole thing at once and fed it a few seconds at a time.
- **Voices that sit at the same level.** Three providers deliver speech at different loudness, and balancing by overall loudness made the bass-heavy voice the faintest on a phone speaker. Each voice is now levelled on the speech band a phone actually plays.
- **First-time players.** My own playtests had my family's habits baked in. A friend who had never played did not find the microphone, the rooms or the tap-to-send step, which led to the guided first minute.
- **Cost.** Every voiced reply costs money, so the caps, the preview and the access code are part of the design and not an afterthought.

## Accomplishments I'm proud of
- A complete, fair, replayable mystery with four endings, not a demo room.
- Property-based tests that generate event sequences and orders of play, hundreds per rule, found a real rule gap: a second ending could replace the first. Fixed at the source.
- A blind, two-step audition for every voice, room sound and piece of music, scored by my family.
- 632 automated tests, and a public repository whose history shows the build from 8 November, MIT-licensed so the engine, the hooks and the test harness can outlive the hackathon.

## What I learned
The trick was figuring out what not to leave to the AI. I wrote the mystery and decided who knew what. The model gave each suspect room to answer a question I hadn't anticipated, and that freedom only worked because the facts stayed fixed: a suspect can dodge a question, but they can't invent an alibi.

I also set a few ground rules for the kind of suspense I wanted: no children or animals suffering, no gory descriptions. Radio Night is still a murder mystery and I wanted it to give you a shiver, but I also wanted to put it on a speaker and play it with my family. For this story, the thrill comes from what someone is hiding, not from how vividly I describe what happened in Room 5.

I also learned how easily you can mistake knowing your own game for having made it intuitive. My family and I knew how to navigate the inn and question a suspect. Then a friend tried it cold and couldn't find the microphone or work out how to send a question. That playtest changed the first minute more than any of my own runs did. And the game felt most like the thing I'd imagined when we played it around a speaker and started arguing about what to ask next.

## What's next for Radio Night
I'd like to write another case. The Sitting was a chance to see whether one complete mystery could work this way. A second would let me try a different kind of mystery and find out what the format can do beyond the Bridgewater Inn.

I'd also like to give the detective a Watson: if you're stuck, Watson could suggest a question based on what you've already found, without telling you the answer. And I'd like to make it easier to play around a speaker, with fewer reasons to look down at the phone while everyone's arguing through a theory.

## Built with
nextjs, react, typescript, tailwindcss, neon, postgresql, drizzle, fly.io, deepgram, cartesia, elevenlabs, anthropic, claude, lovable, web-audio-api, zod, vitest, fast-check, kiro

## Image gallery
Shot on the live site with a fresh run. No shot shows the solution. Local working files at `reports/devpost-gallery/` (gitignored; upload to Devpost manually).
- Desktop (2700×1800): `g00-opening-gate.png`, `g01-front-page.png`, `g02-front-page-scrolled.png`, `g03-case-start.png`, `g04-ask-ray.png`, `g05-wrong-person.png`, `g06-dennis.png`, `g07-upstairs-find.png`, `g08-room5.png`, `g09-room5-note.png`, `g10-casebook.png`, `g11-accuse-choose.png`, `g12-accuse-selected.png`, `g13-accuse-confirm.png`, `g14-ending-title-only.png`.
- Phone: `p01-gate.png`, `p02-start.png`, `p03-whos-who.png`, `p04-listening.png`, `p05-reply.png`.

## Links
- Live: https://radionight.app
- Code: https://github.com/j-nilesh/radio-night
- Video: **[YouTube link]**

## Testing instructions for judges (private field, not public)
The ready-to-paste version, with the access code and the one-click link, is in `reports/devpost-private-fields.md` on your machine. In short:
- Open the one-click link (it fills in the access code), or enter the code on the start page under "Have an access code?".
- Best with sound on and headphones or a speaker. Chrome, Safari and Firefox on a laptop, or Safari or Chrome on a phone. The microphone needs the HTTPS site.
- A full playthrough takes about 30 to 45 minutes. The case is saved, so a judge can come back to it.
- Without a code the game is fully playable. The voiced preview ends after about a dozen replies, then it continues in text.
