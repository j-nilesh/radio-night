# DRAFT: How Kiro was used

> Draft for the owner to edit. Not published anywhere. Items marked **[check]** need the owner's confirmation.

Radio Night was built from an empty Next.js app between 8 and 27 November 2026, in the Kiro IDE. **[check: also note any other Kiro app used.]** All Kiro artefacts are in the repository's `/.kiro` folder, and the decisions they led to are in `docs/adr` (14 records).

## Steering: rules the agent could not forget
Three always-included steering files carried the project's non-negotiables into every session.
- **`architecture.md`:** the directory layout, and three sets of rules.
  - Security: no keys or prompts in the browser, `truth.ts` never imported client-side.
  - Narrative integrity: the model may not commit game events, testimony is never promoted to fact, deflections never change state, major reveals are scripted.
  - Scope protection: "do not invent mystery content", "do not silently change a character's voice".
- **`security.md`:** a checklist applied to every API route (token check before data access, zod validation, rate limits, player-safe responses, idempotency), plus data minimisation and prompt-injection rules.
- **`project-overview.md`:** the goal, the stack decisions and a running usage log that Kiro updated after each piece of work. A `SessionStart` hook prompts the log entry.

What made the biggest difference was stating rules as things that must never happen, with the reason. The agent then applied them to situations the rules did not name. For example, when picture support was added, it routed images through the server's player view so an undiscovered piece of evidence could not leak through a file name.

## Specs: work that survives interruptions
- **`mystery-bible.md`:** the case's canon and the tasks to turn it into playable content.
- **`vertical-slice.md`:** the first end-to-end voice loop with a disposable test character.
- **`visual-identity.md`:** art direction and the picture pipeline, with a "Resume here" section written so work could restart cleanly if a session ended mid-task.
- **`launch-plan.md`:** the plan from finished game to submission, with dated milestones and an acceptance checklist for phones.

Compared with free-form prompting, specs did three things:
- They made "done" checkable: each task ends with typecheck, lint, tests, build and a commit.
- They let a long build continue across many sessions.
- They kept decisions with their reasons, so they were not argued twice.

## Hooks: automated guards
Five hooks in `.kiro/hooks/`, four of which run commands rather than prompts.
- **Never print secrets** (`PreToolUse`, shell): blocks commands such as `cat .env.local` or `echo $…_KEY` before they run, so keys can never land in the conversation.
- **Keep the solution out of the browser** (`PostFileSave` on `src/`): fails if any browser file imports the solution, the full image manifest or a server-only module.
- **Test the case after a content change** (`PostFileSave` on `content/cases/`): runs the mystery's 155 tests (fair play, clue chain, secrecy, attacks on characters, property-based order of play) in about 10 seconds.
- **Keep `.kiro` committed** (`PostFileSave` on `.gitignore`): the contest rules require it.
- **Log the session** (`SessionStart`, agent): keeps the usage log current.

## Property-based testing
The architecture rules require property-based tests for the game rules. We used fast-check.
- **Seven reducer properties**, each run over hundreds of generated event sequences:
  - invariants hold after every step;
  - nothing found or heard is ever forgotten;
  - nothing is recorded twice;
  - the input state is never mutated;
  - the revision count is exact;
  - replay is deterministic;
  - a closed case stays closed.
- **Two properties over the real case** with any order of play:
  - no required clue is ever out of reach;
  - the player's view never contains the solution and shows only what was earned.

**The closed-case property found a real bug** that unit tests had missed: the reducer let a second ending replace the first. The API happened to block that path, but the rules themselves allowed it. fast-check shrank the failure to a single event, and the fix went into the reducer.

Other tests that tried to break the game also found real problems:
- an injection suite caught "ignore all your instructions" slipping past the classifier;
- a shuffled-order playthrough suite found a locked denial that a general topic could bypass;
- playthrough tests found that single words like "stop" inside long questions were being read as commands.

## Sub-agents and MCP
- Kiro's documentation sub-agent answered questions about Kiro itself, for example the exact hook file format, before we wrote hooks.
- **[check]** MCP was not used.

## How Kiro changed the way we worked
**[check: owner's words]** The owner made the creative and product calls: the mystery, the look, the voices, the scope. Kiro did the building and the checking, and it pushed back when something broke a rule. It also verified its own work in a real headless browser, and it recorded each significant decision as an ADR. **[check: add a personal note, for example what surprised you.]**

## Disclosures
- **Pre-existing work:** **[check]** The project started from `create-next-app` on 8 November 2026. Four planning documents (vision, game design, build plan, checklist) were written by the owner before the build **[check: dates]**. An earlier prototype's painted character cards were used as a layout reference only; none of its code, images or characters are in this project.
- **Third-party services**, each used under a paid or usage-based plan:
  - Deepgram (speech recognition and one voice);
  - Cartesia and ElevenLabs (voices; ElevenLabs also made the sound and music);
  - Anthropic (character replies);
  - Lovable (pictures, owned by the owner per Lovable's written statement in `docs/art/provenance`).
