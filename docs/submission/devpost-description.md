# DRAFT: Devpost description

> Draft for the owner to edit. Nothing has been submitted. Items marked **[owner]** are things only you can confirm or word. The judges' access code is deliberately not in this public file: the private instructions, with the real code, are in `reports/devpost-private-fields.md` on your machine (git ignores that folder).

## Name
Radio Night

## Tagline (one line)
A 1981 murder mystery told as a radio drama, where the characters hear your questions and answer back.

## Category
Resurrection

## Inspiration
Golden-age radio drama was something people did together: a family around a set, listening, guessing who did it. The format died with television, and so did that kind of shared, ears-first evening. Radio Night brings it back with the one thing radio never had. You can talk to the people in the story, and they answer in their own voices.

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

## How we built it
- **Next.js 16, React 19 and TypeScript**, hosted on **Fly.io**, with saves in **Neon Postgres** through Drizzle.
- **Speech in:** Deepgram Nova-3. **Voices:** Deepgram Aura-2 (Ray), Cartesia (Dwight and Carol) and ElevenLabs (Edna, Dennis and the narrator), behind one router that keeps every voice on its own provider and never swaps one silently. Speech streams to the browser as raw audio and plays through Web Audio, so a reply starts in well under a second.
- **Characters:** Anthropic Claude (Haiku). Every reply passes a guard before it is spoken: no locked facts, no talk of being an AI, no naming a killer. A question that earns a clue gets the authored line the first time; the model colours everything else but cannot change the story.
- **Game state** lives on the server and changes only through validated events. The browser is only ever told what the player has earned.
- **Pictures** were generated with Lovable in one 1981 photographic style, with the prompt and date recorded for each. **Sound and music** were generated with ElevenLabs, chosen in the same blind test as the voices.
- **The look** is drawn in CSS and SVG, with no image files for the interface: woodgrain and brushed metal are SVG noise, and the VU meter reads the dialogue level through a Web Audio analyser.
- **Cost and abuse controls.** Everyone gets a voiced preview. Judges and friends get an access code for the full game. There are per-visitor and per-day caps on voice and on model replies, per-address rate limits, and a password-protected usage page that shows estimated cost per provider per day.
- **Kiro** throughout: specs, steering, hooks and property-based tests (see the write-up).

## Challenges we ran into
- **Keeping a language model inside a mystery.** Characters must sound alive without leaking the solution or confessing on request. We built a hostile interrogation harness, where a second model grades the answers, plus test suites of prompt injections and paraphrased "just tell me who did it" attacks. One suite found a real gap ("ignore all your instructions" slipped through), now closed with a regression test. A later playtest showed a character inventing a small fact (how long Ray had worked there), so what every character publicly knows now includes it.
- **Audio on phones.** Safari needed a different playback path (raw audio over Web Audio, not an audio element). The microphone checks its own level so a muted mic doesn't end in silence. Sound has to come back after a screen lock. On iPhone, using the microphone can leave later sound quieter, so the game switches the audio session back to playback when it lets the microphone go. The long opening narration sounded jerky on a phone until we stopped handing the browser the whole thing at once and fed it a few seconds at a time.
- **Voices that sit at the same level.** Three providers deliver speech at different loudness, and balancing by overall loudness made the bass-heavy voice the faintest on a phone speaker. Each voice is now levelled on the speech band a phone actually plays.
- **First-time players.** Our own playtests had the family's habits baked in. A friend who had never played did not find the microphone, the rooms or the tap-to-send step, which led to the guided first minute.
- **Cost.** Every voiced reply costs money, so the caps, the preview and the access code are part of the design and not an afterthought.

## Accomplishments that we're proud of
- A complete, fair, replayable mystery with four endings, not a demo room.
- Property-based tests that generate event sequences and orders of play, hundreds per rule, found a real rule gap: a second ending could replace the first. Fixed at the source.
- A blind, two-step audition for every voice, room sound and piece of music, scored by a family.
- 632 automated tests, and a public repository whose history shows the build from 8 November.

## What we learned
**[owner: your words.]** Suggested starting point: authored structure plus model improvisation works better than either alone. Tests that try to break the story matter as much as tests that check it works. Watching someone who has never seen the game teaches more in five minutes than weeks of your own testing. And radio drama really is better with other people in the room.

## What's next for Radio Night
**[owner]** Suggested: a hint system for players who do not know what to ask (a "Watson" who suggests questions without revealing what you have not earned), more cases in the same world, and a quieter host mode for gathered play.

## Built with
nextjs, react, typescript, tailwindcss, neon, postgresql, drizzle, fly.io, deepgram, cartesia, elevenlabs, anthropic, claude, lovable, web-audio-api, zod, vitest, fast-check, kiro

## Image gallery (shot list)
**[owner: take these on the live site with a fresh run. No shot shows the solution.]** Desktop 1280 by 800 unless noted.
1. The front page with the receiver picture and Play now.
2. The case screen in the Tap Room: walnut header and VU meter, the cast cards, the opening narration.
3. The "Who's who" card open, with portraits and the Ask buttons (phone, 390 by 844).
4. The large talk button listening (red) on a phone.
5. A spoken question to Dennis with his reply, the cassette mark beside "Detective".
6. Room 5 after examining the note: the evidence picture in the conversation and the index card in the casebook.
7. The accusation panel with a suspect and evidence chosen.
8. The "The wrong man" ending.

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
