# DRAFT: Devpost description

> Draft for the owner to edit. Not published anywhere. Facts to confirm before use are marked **[check]**.

## Name
Radio Night

## Tagline (one line)
A 1981 murder mystery told as a radio drama, where the characters hear your questions and answer back.

## Category
Resurrection

## Inspiration
Golden-age radio drama was something people did together: a family around a set, listening, guessing who did it. It is a format that died with television, and so did that kind of shared, ears-first evening. Radio Night brings it back with the one thing radio never had. You can talk to the people in the story, and they answer in their own voices.

## What it does
- **An authored mystery, "The Sitting".** Millhaven, New Hampshire, October 1981. A portrait painter is found dead in Room 5 of the Bridgewater Inn while the bar downstairs is still open. Five people were in the building. One of them did it, and the case is fair: every clue the solution needs can be found, heard or reasoned out.
- **Question anyone in your own words,** by voice or by typing. Each character is played by a language model inside strict limits. They know only what they would know, keep their secrets until you earn them, deflect nonsense in character, and never confess because you asked them to.
- **Six voices, cast in a blind listening test.** Every character and the narrator has one fixed voice. A family scored the candidates without knowing which provider made them.
- **Walk the inn.** Six rooms, each with its own photograph, room sound and music. Examine what is there, see what you find, and keep it in a casebook that separates what you found from what you were told.
- **Make an accusation.** Choose a suspect and the evidence that proves it. There are four endings, and if you name the right person you get a debrief of what you proved and what you missed.
- **Play together.** Put the sound through a speaker, pass the phone, take turns asking. The game waits while people argue.
- **Pick up where you left off.** No account. Your case is saved, and the narrator recaps it when you come back.
- **Looks like 1981.** The screen is built from the materials of a hi-fi receiver of the time: a walnut case, brushed-aluminium keys, amber lamp buttons and a VU meter whose needle moves with whoever is speaking. Titles are set in Bookman, labels in a typewriter face, and the casebook keeps its finds on ruled index cards.
- **Works in a phone's browser** as well as on a laptop.

## How we built it
- **Next.js 16 and TypeScript**, hosted on **Fly.io**, with saves in **Neon Postgres**.
- **Speech in:** Deepgram Nova-3. **Voices:** Deepgram Aura-2, Cartesia Sonic and ElevenLabs, behind one router that keeps every voice on its own provider and never swaps one silently. Speech streams to the browser as raw audio and plays through Web Audio, so a reply starts in well under a second.
- **Characters:** Anthropic Claude (Haiku). Every reply passes a guard before it is spoken: no locked facts, no talk of being an AI, no naming a killer. Answers that earn a clue are always the authored line, so the model can colour the story but never change it.
- **Game state** lives on the server and changes only through validated events. The browser is only ever told what the player has earned.
- **Pictures** were generated with Lovable in a single 1981 photographic style, with provenance recorded for each one. **Sound and music** were generated with ElevenLabs on a paid plan, chosen in the same blind test as the voices.
- **The look** is drawn in CSS and SVG, with no image files for the interface: woodgrain and brushed metal are SVG noise, and the VU meter reads the dialogue level through a Web Audio analyser. The typefaces are free (TeX Gyre Bonum for Bookman, Courier Prime, Special Elite) because the commercial originals cannot ship in an open-source repository.
- **Kiro** throughout: specs, steering, hooks and property-based tests (see "How Kiro was used").

## Challenges we ran into
- **Keeping a language model inside a mystery.** Characters must sound alive without leaking the solution or confessing on request. We built a hostile interrogation harness, where a second model grades the answers, plus test suites of prompt injections and paraphrased "just tell me who did it" attacks. One of those suites found a real gap ("ignore all your instructions" slipped through), which is now closed with a regression test.
- **Audio on phones.** Safari needed a different playback path (raw audio over Web Audio instead of an audio element), the microphone has to check its own level so a muted mic doesn't end in silence, and sound has to come back after a screen lock.
- **Cost.** Every voiced reply costs money. Everyone gets a voiced preview, judges and friends get an access code for the full game, and the owner has a usage page with estimated cost per provider per day.

## Accomplishments that we're proud of
- A complete, fair, replayable mystery with four endings, not a demo room.
- Property-based tests that generate thousands of event sequences and orders of play found a real rule gap: a second ending could replace the first. Fixed at the source.
- A blind, two-step audition for every voice, room sound and piece of music, scored by a family.

## What we learned
**[check: owner's words]** Authored structure plus model improvisation works better than either alone. Tests that try to break the story are as important as tests that check it works. And radio drama really is better with other people in the room.

## What's next for Radio Night
**[check]** More cases in the same world, a host mode for parties, and a longer voiced experience if people want to pay for it.

## Built with
nextjs, typescript, react, tailwindcss, neon, postgresql, drizzle, fly.io, deepgram, cartesia, elevenlabs, anthropic, claude, web-audio-api, vitest, fast-check, kiro

## Image gallery (shot list)
**[check: take these once the front-page receiver picture is in]** Desktop screenshots at 1280 by 800 unless noted. No shot shows the solution.
1. The front page, with the receiver picture and Play now.
2. The case screen in the Tap Room: walnut header and VU meter, the cast cards, the opening narration.
3. A spoken question to Dennis with his reply, the cassette mark beside "Detective".
4. Room 5 after examining the ashtray: the evidence picture in the conversation and the index card in the casebook.
5. The accusation panel with a suspect and evidence chosen (Dwight, as in the video).
6. The "The wrong man" ending.
7. Phone, 390 by 844: the case screen.

## Links
- Live: https://radionight.app
- Code: https://github.com/j-nilesh/radio-night **[check: public repo URL after the move]**
- Video: **[YouTube link]**

## Testing instructions for judges (private field, not public)
- Open https://radionight.app/play?code=JUDGES-CODE **[paste the judges' code from .env.local]**, or enter the code on the start page under "Have an access code?".
- Best with sound on and headphones or a speaker. Chrome, Safari and Firefox on a laptop, or Safari or Chrome on a phone.
- A full playthrough takes about 30 to 45 minutes **[check]**. The case is saved, so you can come back to it.
- Without a code the game is fully playable. The voiced preview of the characters ends after about a dozen replies, then it continues in text.
