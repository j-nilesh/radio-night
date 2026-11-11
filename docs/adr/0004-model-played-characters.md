# 0004. Model-played characters behind authored clues and a reply guard

Status: Accepted

## Context

Fully scripted answers feel canned; a free-running model can leak the solution, invent clues, or break the fiction. The central risk of the project is how a model behaves under hostile questioning.

## Decision

- A question that would earn a clue gets the authored line, verbatim, the first time. Repeats and everything else go to the model.
- Each character has a persona prompt written from the mystery bible. A character sees only their own knowledge. Ray's prompt contains his own secret on purpose, because a killer who does not know he is the killer cannot act guarded.
- Prompts change with game state. A locked topic is shown as a cover story to hold to; once earned it becomes something the character will say.
- Every model reply passes `reply-guard.ts` before it is spoken. It rejects reveals of locked topics, claims to be an AI, talk of instructions, and naming a killer; it strips stage directions and caps length. Any rejection or provider failure falls back to the authored line.
- Only the server commits events. The model proposes wording.
- Default model: Claude Haiku 5.5 (median about 1.2 s). Sonnet 5.5 sounded better and invented less but was about twice as slow and over twenty times the cost.

## Consequences

- Fair play is testable: `case.test.ts`, `model-path.test.ts` and `robustness.test.ts` run the real orchestrator against scripted and hostile models.
- `npm run interrogate` grades live model behaviour with a second model.
- Detail the model improvises (a jukebox, a television) can be inconsistent; the shared world text pins the facts that matter.
- Player questions and the last six exchanges per character go to the dialogue provider (Anthropic). The privacy page must say so.
