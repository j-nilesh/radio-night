# DRAFT: How Kiro was used

> Draft for the owner to edit. Nothing has been submitted. Items marked **[owner]** need your confirmation or your own words.

Radio Night was built from an empty Next.js app between 8 and 27 November 2026, in the Kiro IDE. **[owner: say if you also tried the CLI, Web or Crew; this draft says only the IDE.]** Every Kiro artefact is in the repository's `/.kiro` folder, and the decisions they led to are in `docs/adr` (17 records). The commit history shows the build day by day.

## Steering: rules the agent could not forget
Three always-included steering files carried the project's non-negotiables into every session.
- **`architecture.md`:** the directory layout and three sets of rules.
  - Security: no keys or prompts in the browser, `truth.ts` never imported client-side.
  - Narrative integrity: the model may not commit game events, testimony is never promoted to fact, deflections never change state, major reveals are scripted.
  - Scope protection: "do not invent mystery content", "do not silently change a character's voice".
- **`security.md`:** a checklist for every API route (token check before data access, zod validation, rate limits, player-safe responses, idempotency), plus data minimisation and prompt-injection rules.
- **`project-overview.md`:** the goal, the stack decisions and a running log of what Kiro did in each session. A `SessionStart` hook prompts the log entry.

What made the biggest difference was stating rules as things that must never happen, with the reason. The agent then applied them to cases the rules did not name. When picture support was added, it routed images through the server's player view so an undiscovered piece of evidence could not leak through a file name. When the characters learned to notice who they were being spoken to, the rule "deflections must not advance state" decided the design: the check runs before any topic or model, so the wrong person can neither answer for someone else nor be made to invent an answer.

## Specs: work that survives interruptions
Five spec files in `.kiro/specs/`, written as task lists with an acceptance check for each task:
- **`mystery-bible.md`:** the case's canon and the tasks to turn it into playable content.
- **`vertical-slice.md`:** the first end-to-end voice loop with a disposable test character.
- **`visual-identity.md`:** art direction and the picture pipeline, with a "Resume here" section so work could restart cleanly if a session ended mid-task.
- **`launch-plan.md`:** the plan from finished game to submission, with dated milestones.
- **`first-minutes.md`:** written after a first-time player got lost in the opening. It lists what the playtest found, the causes in the code, the principle, and the tasks. Everything in it was built and verified in a real browser at phone size.

Compared with free-form prompting, specs did three things:
- They made "done" checkable: each task ends with typecheck, lint, tests, build and a commit.
- They let a long build continue across many sessions.
- They kept decisions with their reasons, so they were not argued twice.

The `first-minutes.md` spec shows the loop at its best. A playtest produced a list of complaints. Kiro read the code to find the cause of each (the hint text was hidden on phones, the instructions were a one-time pop-up, the roles were in a tooltip that touch screens do not show), wrote the spec, built it, and checked the result in a headless browser at 390 by 844. The things still unclear to a new player were parked in the spec's "Later" section instead of being half-built.

## Design by specimen
Visual choices were made by comparing finished options, not by describing them. For the typography and the surfaces of the interface, Kiro built a temporary specimen page showing two or three directions on the same real game parts, screenshotted them in a headless browser and recommended one. The owner chose, and Kiro then applied the choice site-wide, deleted the specimen and recorded the decision as an ADR.
- **Typography (ADR 0015):** two rounds. The owner chose Bookman titles, tight Helvetica text and typewriter labels. The specimen work also exposed a bug that had kept every web font from loading.
- **Surfaces (ADR 0016):** "Hi-fi faceplate" against "Walnut cabinet". The owner chose a mix, like a real 1981 receiver.
- **Icons:** the emoji in the interface were replaced with line drawings of period objects after the owner pointed out that a file-folder icon belongs to computer screens, not 1981.

## Hooks: automated guards
Five hooks in `.kiro/hooks/`, four of which run commands rather than prompts.
- **Never print secrets** (`PreToolUse`, shell): blocks commands such as `cat .env.local` or `echo $…_KEY` before they run, so keys can never land in the conversation. It fired once during this build, on a command that touched an environment file, and the command was rewritten so that nothing sensitive could be printed.
- **Keep the solution out of the browser** (`PostFileSave` on `src/`): fails if any browser file imports the solution, the full image manifest or a server-only module.
- **Test the case after a content change** (`PostFileSave` on `content/cases/`): runs the mystery's 192 tests (fair play, clue chain, secrecy, attacks on characters, property-based order of play) in seconds.
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

Other tests written to break the game also found real problems:
- an injection suite caught "ignore all your instructions" slipping past the classifier;
- a shuffled-order playthrough suite found a locked denial that a general topic could bypass;
- playthrough tests found that single words like "stop" inside long questions were being read as commands.

A smaller lesson from the last days: a test that proves "the model was never asked" is worthless if the stand-in model can never be called. The first version of the wrong-person test passed vacuously. We added a control that shows the stand-in does count a call for a fair question, and switched the detector off once to see the tests fail (23 of 28 did).

## Verifying in a real browser, and auditing before going public
Kiro drove headless Chrome to check its own work: the phone layout, the Who's who card, the talk button's states, the opening narration with the CPU slowed to see whether playback stayed smooth, and the live site's headers. Before the repository went public, Kiro audited it: it searched every commit for the actual secret values held in `.env.local` (none were there), scanned the history for key formats and personal data and cleaned what it found, checked a fresh clone installs, passes all 632 tests and builds with no keys, and read the ElevenLabs and Lovable terms to write the asset notice. A rewrite of the repository's history was blocked by Kiro's safety layer until the owner approved it, which is the behaviour we wanted from an agent working in a real repository.

## Sub-agents, MCP and powers
- Kiro's documentation sub-agent answered questions about Kiro itself, for example the exact hook file format, before the hooks were written. **[owner: confirm.]**
- MCP was not used: no MCP servers are configured for this project.
- No Kiro powers were installed, and no custom agents were created.

## How Kiro changed the way we worked
**[owner: your words.]** Suggested starting point: the owner made the creative and product calls (the mystery, the look, the voices, the scope). Kiro did the building and the checking, and it pushed back when something broke a rule. It recorded each significant decision as an ADR, and it caught its own mistakes by testing them in a real browser. Add a personal note, for example what surprised you.

## Disclosures
- **Pre-existing work:** the project started from `create-next-app` on 8 November 2026. Four planning documents (vision, game design, build plan, checklist) were written before the build and are kept in `docs/planning`. **[owner: confirm their dates, and whether an earlier prototype's painted character cards were used as a layout reference only.]**
- **Third-party services,** each used under a paid or usage-based plan, and each described in `NOTICE`:
  - Deepgram (speech recognition and one voice);
  - Cartesia and ElevenLabs (voices; ElevenLabs also generated the sound and music);
  - Anthropic (character replies);
  - Lovable (pictures; under Lovable's Terms the owner owns the output).
- **Assets:** the music, sounds and pictures are in the repository only so the game runs and are not licensed for reuse; the code is MIT. See `NOTICE`.
