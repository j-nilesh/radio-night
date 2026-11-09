# Spec: First Mystery — "The Sitting"

**Status:** Canon locked  
**Authored:** November 8, 2026  
**Case ID:** radio-night-s01  
**Version:** v1  

---

## Locked canon

| Element | Value |
|---|---|
| Title | "The Sitting" |
| Setting | Millhaven, New Hampshire, October 17–18, 1981 |
| Victim | Gerald Fenn, portrait painter |
| Killer | Ray Kowalski, bartender |
| Murder weapon | Glass ashtray, wiped |
| Motive | Extortion demand; Ray believed disclosure would endanger Carol |
| Red herring 1 | Dwight Wentworth (threatening note + prior argument) |
| Red herring 2 | Carol Wentworth (clear motive, solid alibi) |

## Characters (voice casting needed)

| Character | Role | Voice direction |
|---|---|---|
| Ray Kowalski | Killer | Warm, guarded, New England working-class |
| Dwight Wentworth | Red herring | Clipped, formal, cold anger |
| Carol Wentworth | Red herring | Precise, restrained, careful |
| Edna Marsh | Witness 1 | Dry, matter-of-fact, slightly impatient |
| Dennis Pruett | Witness 2 | Warm, rambling, bad with time |
| Narrator | Scene voice | Warm, late-night radio, authoritative |

## Clue chain

### Tier 1 (always available)
- `clue-ashtray` — Room 5, murder weapon
- `clue-whiskey-glass` — Room 5, Fenn was alone
- `clue-note-under-bed` — Room 5, Dwight's threatening note
- `clue-back-stairs` — Hallway, second staircase discovered
- `clue-friday-argument` — Any witness, Dwight vs Fenn

### Tier 2 (require one witness interview)
- `clue-dwight-went-upstairs` — Edna, ~5 minutes only
- `clue-carol-left-early` — Dennis or Edna, 9:15 PM
- `clue-ray-was-away` — Dennis, 10–30 minute gap (underestimated)
- `clue-kitchen-sink` — Edna, Ray washing hands after ~10 PM
- `clue-back-stairs-access` — Edna, staff route

### Tier 3 (require combining Tier 2 clues)
- `clue-gap-contradiction` — Dennis revises gap upward under pressure
- `clue-fenn-heard-carol` — Carol confirms Fenn knew her plans
- `clue-fenn-approach` — Ray admits Fenn approached him for money
- `clue-ray-admission-partial` — Ray admits going upstairs

## Accusation rubric
- Correct accusation (Ray): accepted with 4+ of 6 required clues
- Full ending: all 6 clues
- Partial ending: 4–5 clues
- Wrong (Dwight): fair trap, Edna's 5-minute sighting exonerates
- Wrong (Carol): alibi corroborated

## Scenes
1. Tap Room (start)
2. Back Room (interview snug)
3. Kitchen (unlocks after first Edna interview)
4. Back Stairs (unlocks after Kitchen or Hall)
5. Upstairs Hall (unlocks after first Edna interview)
6. Room 5 (crime scene, always accessible)

## Scripted beats (require TTS production)
- Opening narration (narrator)
- Room 5 first entry (narrator)
- Carol disclosure (Carol, Tier 3)
- Ray partial admission (Ray, Tier 3)
- Correct full ending (narrator)
- Wrong Dwight ending (narrator)

## Voice audition notes (for Step 2)
- Ray: audition the warmth-to-guarded register shift — this is his character arc
- Carol: test whether contractions vs. no-contractions reads naturally in TTS
- Narrator: intelligibility on Bluetooth speaker is the priority
- Edna: needs to sound like she has somewhere to be
- Dennis: test trailing-off and self-correction — does it feel natural or broken in TTS?
- Dwight: minimum role but needs to feel threatening without melodrama

## Tasks
- [x] Mystery bible written (docs/mystery/01-mystery-bible.md)
- [x] truth.ts (server-only canonical solution + accusation validator)
- [x] characters.ts (public character definitions)
- [x] scenes.ts (scene graph with unlock conditions)
- [x] beats.ts (5 scripted prerecorded beats)
- [ ] Wire case into CaseContent interface (src/lib/cases.ts)
- [ ] Write character fact stores (CaseContent.getCharacterFacts)
- [ ] LLM system prompts per character (content/cases/.../prompts/)
- [ ] Accusation API endpoint (/api/runs/:id/accuse)
- [ ] TTS production (Step 2 — requires provider selection)
- [ ] Audio asset manifest (audio-manifest.json)
