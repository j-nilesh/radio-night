# Radio Night: full production script (under 3 minutes)

> Merges the scene-by-scene draft with the verified shot list in `demo-video-script.md`. Every line of voice-over and every picture below is checked against the actual game, the actual repo, and the actual Kiro artefacts — nothing is invented to fit a beat. Where the original scene draft described something that isn't how the game actually works (it said "1940s" in one place and "1980s" in another; the game is 1981), that's corrected here.

**Target length:** 2:50. **Record:** a laptop browser for most of it, one phone shot for the shared-speaker beat. Use a fresh run with the judges' access code, voices on, into headphones or a speaker.

**Rules:** under 3:00, public on YouTube, no third-party trademarks, no music you don't have the rights to. **Do not use any of the four ElevenLabs-generated music tracks in this video.** `NOTICE` states the Starter plan's media rights exclude "film, TV, radio and studio games" — a public demo video is exactly that excluded use. The game's room sounds, sound effects and character/narrator voices are fine to use; only the four generated music tracks are off-limits.

**Spoilers:** never show the correct accusation. End on the wrong-accusation ending ("The wrong man," accusing Dwight Wentworth). That proves the endings work without naming the real killer (Ray Kowalski) or the weapon.

---

## Scene 1: The cold open (0:00–0:12)

**Picture:** Black screen, then the front page hero (the 1981 receiver picture) coming into focus, as in the live site. Hold on the "ON AIR" lamp before the title appears.

**Sound:** The game's own room ambience and a short burst of static/tuning sound effect (not the music track), then one in-game line.

**In-game audio:** A short, non-spoiler line from the opening narration — the first sentence the narrator speaks when a fresh case starts in the Tap Room (no character name, no clue, no plot fact). Capture this live from a fresh run rather than writing a stand-in line.

**On-screen text:** none needed; let the title card land clean.

**Transition:** Cut to creator on camera.

---

## Scene 2: The idea (0:12–0:30)

**Picture:** Creator on camera, natural light. Cut to the real front page (`/`) and a slow scroll through "How it works" and the cast halfway through the line.

**Creator, on camera:**

> Golden-age radio drama was something people did together — a family around the set, listening in the dark, guessing who did it. Television ended that. For Kiroween's Resurrection category, I wanted to bring it back, with the one thing radio never had: you can talk to the people in the story, and they answer in their own voices. This is Radio Night, built with Kiro.

**Sound:** Quiet room ambience under the voice-over; no generated music track.

---

## Scene 3: Playing Radio Night (0:30–1:40)

### 0:30–0:50 | Into the mystery

**Picture:** Press "Play now," then "Begin Investigation." The opening narration plays over the Tap Room photograph. Keep the VU meter beside the case title in frame — its needle follows the narrator's voice.

**Creator voice-over, under the first few seconds, then let the narrator take over:**

> An authored murder mystery. Millhaven, New Hampshire, October 1981. A portrait painter is found dead in Room 5 of the Bridgewater Inn, while the bar downstairs is still open.

Let the narrator speak for several seconds before cutting.

### 0:50–1:15 | Ask anyone, in your own words

**Picture:** Select Dennis. Ask **by voice**: "Was Ray behind the bar all night?" Show the transcript appear with the cassette mark, then let Dennis's full spoken answer play. Let the "Added to casebook" chip appear on screen.

**On-screen text:** "Ask in your own words, by voice or typing."

### 1:15–1:35 | Characters keep their secrets

**Picture:** Select Ray. Ask: "Did you kill Fenn?" Let Ray's in-character deflection play in full — do not cut away before it finishes.

**On-screen text:** "Characters keep their secrets until you earn them."

*(This is the "interrogation" beat from the original draft, played straight: the real design here is that a character deflects convincingly inside the fiction rather than breaking it. There is no scripted "gotcha" moment to stage, because the game is built not to allow one — testimony is never promoted to fact just because a player asked the right question twice.)*

### 1:35–1:55 | Walk the inn

**Picture:** Go to the Upstairs Hall, then Room 5. Examine "Under the bed": the note's picture and its written words appear, with the clue chime. Open the Casebook and show it separating finds from testimony.

**On-screen text:** "Explore the inn. Every clue is fair."

### 1:55–2:10 | Make an accusation

**Picture:** Press Accuse, choose Dwight Wentworth and two pieces of evidence, confirm. The "The wrong man" ending plays with its picture and narration.

**On-screen text:** "Four endings. Name the right person and prove it."

---

## Scene 4: Built with Kiro (2:10–2:40)

*(This replaces the original draft's longer Kiro section, compressed to fit a 3-minute total alongside the gameplay above. Every line below points at something that actually exists in the repo.)*

### 2:10–2:17 | The problem Kiro had to solve

**Creator voice-over:**

> The hard part was giving a language model enough freedom to sound alive, without ever letting it run the mystery.

### 2:17–2:26 | Steering and specs

**Picture:** Quick cut to `.kiro/steering/architecture.md` on screen, with "The LLM may not commit game events" and "Testimony ≠ canonical fact" visible, then a cut to `.kiro/specs/first-minutes.md`.

**Creator voice-over:**

> Steering rules like "the model may never commit a game event" held in every session. Specs turned real playtest problems — like a friend who couldn't find the microphone — into task lists Kiro could finish and I could check.

**On-screen label:** Steering & Specs

### 2:26–2:33 | Hooks

**Picture:** Cut to `.kiro/hooks/project-hooks.json` on screen, briefly highlighting the "Test the case after a content change" hook.

**Creator voice-over:**

> A hook ran the mystery's tests automatically every time I changed its content. Another one blocked any command that would print a secret before it could run.

**On-screen label:** Hooks | Automated guards

### 2:33–2:40 | What Kiro caught

**Picture:** Cut to the property-test file or a terminal showing the fast-check reducer test, with the "a closed case stays closed" property visible.

**Creator voice-over:**

> Property-based tests generated hundreds of random event sequences and found a real bug no unit test had: a second ending could silently replace the first. That's the kind of mistake you want a tool to find before a player does.

**On-screen label:** Property-based testing

---

## Scene 5: The closing transmission (2:40–2:50)

**Picture:** Return to the actual Radio Night interface — the front page or a wide shot of the case screen. Phone in hand beside a laptop or speaker, to show the shared-speaker mode, if time allows a quick cut. End on a title card.

**Creator voice-over:**

> Radio drama never really died. It was just waiting for its audience to talk back.

**Final title card:**

**RADIO NIGHT**
*Once, you listened to the mystery.*
**Now, you solve it.**
radionight.app
Built with Kiro | Kiroween 2026 | Resurrection

**Sound:** A radio click-off sound effect (not music). Fade to black.

---

## Before recording

- Turn voices on, close other tabs, silence notifications.
- Rehearse the two spoken questions (to Dennis, then to Ray) once, so they're heard clearly on the first real take.
- Start a fresh investigation so the opening narration plays from the beginning.
- If a character's improvised answer differs slightly from what's scripted here, keep it — any reasonable in-character answer works. Use the real recording, not a substitute line, for every exchange in Scene 3.
- If the Scene 4 screen recordings run long, trim narration there rather than cut into the gameplay beats in Scene 3 — the game itself is the stronger evidence.

## Upload checklist

- Public on YouTube, under 3:00, English.
- Description: one line about the game, the live URL (`https://radionight.app`), and the repo URL (`https://github.com/j-nilesh/radio-night`).
- No ElevenLabs-generated music anywhere in the video or its background — see the rule at the top of this document.
- No outside music, no third-party logos, no provider dashboards showing account details.
- Once uploaded: paste the link into `docs/submission/devpost-description.md` (replacing `[YouTube link]`) and into Devpost's video field, then commit.
