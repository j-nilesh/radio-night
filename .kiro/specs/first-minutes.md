# First minutes: onboarding a player who has never seen the game
Status: proposed 23 November 2026, after a playtest with a first-time player on a phone. Checklist: tick items as they land. Deadline context: feature freeze 25 Nov, submit 27 Nov (see launch-plan.md).

## What the playtest found
1. She did not know she could move between rooms, or tap a person to speak to them.
2. On a phone she saw only names (Ray, Edna, Dennis). Who they are was on the landing page, outside the game.
3. When the narrator finished, nothing told her to tap the microphone.
4. She did not understand the two-tap record-then-send flow.
5. She did not know what to ask. Playing detective is not natural for people who only watch or read mysteries. (Parked, see "Later".)

## Causes in the code
- The one-line hints under Speak to / Go to / Look at use `hidden sm:block` in `SceneBar.tsx`, so phones never see them.
- `HowToPlay.tsx` is a one-time modal, dismissed with one tap, before anything has happened.
- A role is shown only as a short phrase on the chip; the full role is a `title` tooltip, which does nothing on touch.
- `PushToTalk.tsx` shows a small microphone with a short label; the send step is only a label change.

## Principle
Teach at the moment each thing becomes useful, by doing it. Keep the up-front text to a minimum.

## Tasks
### 1. Narrator handoff (needs owner approval of the wording)
- [x] New scripted beat `beat-opening-handoff`, spoken right after the opening narration on a first run only (not on resume). Orientation only: no new case facts, no names beyond people present in the starting room, nothing that hints at a culprit.
- [x] Draft wording for the owner to edit (starting room and cast to be confirmed against `scenes.ts`): "That's the case, detective, and it's yours. The people around you were here when it happened. Tap a face to meet them, then ask what you would ask in life: who they are, where they were, what they saw. When a room runs dry, walk next door." (The Tap Room entry line already says where you are, so the handoff does not repeat it.)
- [x] Add a `ttsDirection`; spoken through the narrator voice like the rest of the opening. Not yet heard with real audio: listen once.
- [x] Test: beat plays once after the opening, not on resume, and contains no case-truth strings.

### 2. Who's who cast sheet
- [x] A sheet (bottom sheet on phones, panel on wide screens) with portrait, name, role and the public description from the character dossiers (public portions only), and a primary button "Ask <name>".
- [x] First tap on a chip opens the sheet; "Ask <name>" selects the person and closes it. Also a "People" button in the header or casebook.
- [x] Only people present or already met are listed; descriptions come through the player view, never the full dossier.
- [x] Test: the player view contains no non-public dossier fields; the sheet text is readable by screen readers.

### 3. Talk button
- [x] Replace the small microphone with one wide labelled button with a small microphone icon.
- [x] States: "Tap to ask <name>" (ready), "Listening... tap to send" (recording, red lamp, pulsing, level bar), "Done? Tap to send" (about 1.5 s of quiet after speech: label and faster pulse only, never an automatic send), "Sending..." (disabled).
- [x] No one selected: "Choose someone to ask"; tapping it highlights the people row.
- [x] Text field stays below with the placeholder "or type your question".
- [x] Silent or muted recording keeps the existing check; message: "I couldn't hear you. Tap to try again."
- [x] Reduced motion: no pulse, same labels. Touch target at least 44 px.
- [x] Tests: silence detection state change (pure function on level samples), label for each state, nothing is sent without a tap.

### 4. Phone layout
- [x] Phones: the coach strip carries the hints (the one-line hints stay on wide screens, because on a phone they pushed the conversation to two lines).
- [x] Current room name shown prominently.
- [x] Chips open the cast sheet (task 2).
- [x] Checked at 390x844 and 1280x800 in headless Chrome: no sideways scroll. Targets 44 px or taller: not measured.

### 5. Guided first minute (coach marks)
- [x] One mark at a time, each advancing when the player does the thing: tap a person; tap the talk button; "tap again when you're done"; after the first answer, highlight Go to.
- [x] A nudge after about 20 s of inactivity.
- [x] First visit ever only (localStorage flag, like `rn-howto-seen`); skippable; never shown on resume.

### 6. Trim the up-front text
- [x] Reduce the How to play modal to three lines, shown just before "Begin with sound"; keep a "?" in the header to reopen it.

### 7. Narration appears in step with the voice (added after the second playtest note)
- [x] The opening lines show one sentence at a time as the narrator reaches them, instead of all at once (`src/lib/reveal.ts`). Timing starts at first sound, is estimated from word counts, and uses the real audio length once the stream reports it. A line that is interrupted, fails, or is played with captions only shows in full at once.
- [ ] Not yet applied to replies or room narration after the opening (those are short).

## Order
Tasks 1, 2, 3 and 4 first, then 5, then 6. Verify in headless Chrome at phone size, then ask the owner to retest with someone new.

## Later (parked, not in this spec)
Help for "what do I ask?": a Watson-style assistant, or suggested questions tied to what the player has already learned. Open points: it must not reveal facts the player has not earned (the narrative-integrity rules apply), and a model-written hint would need the same reply guard as the characters. A cheaper first step is a few authored "you could ask about..." prompts per person, unlocked by state.
