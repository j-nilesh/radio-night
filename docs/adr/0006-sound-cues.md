# 0006. Data-driven ambience and stings with placeholder assets

Status: Accepted

## Context

The mixer has dialogue, music and effects buses, but nothing played on the last two. Final recordings need choosing and licensing, which takes time the engineering does not have to wait for.

## Decision

- `packages/audio-client/src/cues.ts` (`CuePlayer`) plays looping beds (ambience, music) with crossfades, and one-shot stings and effects. It knows nothing about any one mystery.
- Each case lists its sounds in `audio-manifest.json` (file, bus, gain, status, source, licence) and maps scenes and events to them in `cues.ts`. The test suite checks that every file exists, every scene has ambience, and every asset states its source and licence.
- Placeholders are synthesised by `npm run audio:placeholders`, so they are original work with no third-party rights. They are marked `placeholder` and are not meant to ship.
- A missing or broken sound is silence, never an error.
- Ambience is hushed while the player records, so a microphone near a shared speaker hears the person and not the room tone. Settings (volume, ducking) belong to the mixer and never touch run state.
- Ducking applies only to beds. Stings and effects bypass it, because they land as speech begins and were otherwise inaudible (found in the second playtest). Ambience sits low (gain 0.2) and swells to about 2.4 times that while the characters think, then settles when the voice starts. Hush wins over the swell.
- Ambience starts after the player's first click. A resumed run asks for that click again ("Continue with sound").

## Consequences

- Swapping in real assets is a file and manifest change, not a code change.
- Ambience follows the Voice switch. A separate sound-only switch is possible later.
- Any clue conveyed only by sound must also be available in words (a roadmap rule). No current cue carries information.
