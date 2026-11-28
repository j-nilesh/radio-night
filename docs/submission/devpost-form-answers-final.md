# Radio Night: Kiroween 2026 Devpost form answers (final)

Revised 27 Nov 2026 after verifying every claim against the repo (commit `ef541b2`), running the test suite, and reading `NOTICE` directly. Three fixes were made to the repo as part of this review:
- `.kiro/specs/visual-identity.md` and `docs/submission/kiro-writeup.md` now agree: nothing from the earlier prototype, including its character cards, was used.
- `.kiro/steering/project-overview.md`'s stack table now says Next.js 16 and Fly.io, not the original plan's Next.js 15 and Vercel.
- The music-rights restriction below was promoted from "check before using" to a hard rule.

- **[YOU FILL]** is something only you can supply.
- **[CONFIRM]** is a claim the repo can't prove by itself, or that depends on Devpost's own rules page, which I could not fetch (it returned HTTP 403). Check it yourself before you submit.
- Each answer is in a grey box. Copy what's inside it.
- The contest deadline is **4 Dec 2026, 2:00 PM PT (5 Dec, 3:30 AM IST)**.

---

## Pre-submit checklist (do these first)

- [ ] **Judges' code works on the live site.** Confirm the code in `reports/devpost-private-fields.md` still resolves on `https://radionight.app/play?code=...` in a private window, and that a character speaks past the preview.
- [ ] **No generated music in the video.** `NOTICE` states plainly: "the Starter plan's media rights exclude film, TV, radio and studio games. Do not extract, redistribute or build on them." A public demo video is that excluded use. **Do not use any of the four ElevenLabs-generated music tracks in the video, full stop** — this isn't a judgment call. Room sounds, SFX and character/narrator voices are fine; only the music tracks are restricted.
- [ ] **Video:** on YouTube, set to Public, under 3:00, showing the real game running. [CONFIRM Devpost's exact visibility wording on the rules page — I could not fetch it to check.]
- [ ] **Devpost's excluded-country list and other eligibility rules** — [CONFIRM] directly on the rules page; I could not fetch it to verify the claims below about India's eligibility.
- [ ] **Gallery uploaded, thumbnail set.** Both done. Kiro credits already sorted on your end.
- [ ] After you submit, reopen the entry and check it says **Submitted**, not a draft.
- [ ] Paste the YouTube link into field 5 and also replace `[YouTube link]` in `docs/submission/devpost-description.md`, then commit.

---

## Project overview

- **Project name:** Radio Night
- **Elevator pitch:**

```text
A 1981 murder mystery told as a radio drama. Question the suspects out loud or by typing, and they answer back in their own voices.
```

- **Thumbnail:** uploaded (the receiver shot with "A radio mystery you can talk to").

---

## Project details (public page)

### 1. About the project (Markdown)

Taken from `docs/submission/devpost-description.md`, your final copy, word for word. No spoilers: the culprit, weapon and solution are not named.

~~~~markdown
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

## Disclosure
Started from `create-next-app` on 8 November 2026. Planning documents (vision, game design, build plan, checklist) are dated 5 November 2026 and are kept unchanged in `docs/planning/`. I had tried a text-only prototype of the idea earlier, in Claude Code, but it never came together and I'd dropped it entirely. Nothing from that prototype, including its character cards, was used in this build. Third-party assets and their terms are in `NOTICE`.
~~~~

### 2. Built with (verified against the repo)

```text
kiro, nextjs, react, typescript, tailwindcss, neon, postgresql, drizzle, fly.io, deepgram, cartesia, elevenlabs, anthropic, claude, lovable, web-audio-api, zod, vitest, fast-check, github-actions
```

Checked against `package.json` (next 16.4.5, react 19.3.0, zod, drizzle, vitest, fast-check, tailwind), `Dockerfile` (node:24-slim), `fly.toml`, `.github/workflows/ci.yml`, the provider adapters in `packages/providers/`, `content/.../voices.ts`, and the image/audio manifests (Lovable, ElevenLabs).

### 3. "Try it out" links

```text
https://radionight.app
```
```text
https://github.com/j-nilesh/radio-night
```

### 4. Image gallery (3:2)

Use the files already in `reports/devpost-gallery/` on your machine (gitignored, upload manually — this was a deliberate choice, not an oversight).

Checked directly for spoilers:
- `g09-room5-note.png` shows a threatening note signed "D.W." (Dwight Wentworth). This points at a suspect who is not the real culprit, so it's a fair red herring, not a spoiler.
- `g13-accuse-confirm.png` shows an accusation against Dwight, the wrong suspect — the "wrong man" path, not the true ending.
Neither shows the weapon identified as such, names the real killer, or confirms a correct ending. Both are safe to include.

Suggested set (desktop, 2700×1800, all already 3:2):
| # | File | Caption |
|---|---|---|
| 1 | `g01-front-page.png` | The front page: a 1981 receiver, an On Air lamp, and one button to start the broadcast. |
| 2 | `g03-case-start.png` | The Tap Room, just past eleven. The opening narration, with the VU meter following the narrator's voice. |
| 3 | `g04-ask-ray.png` | Ask anyone in your own words, by voice or typing. Ray answers in his own voice. |
| 4 | `g05-wrong-person.png` | Call Edna by the wrong name, and she tells you, in character. Nothing in the game moves. |
| 5 | `g09-room5-note.png` | Room 5. Every clue the solution needs can be found, in whatever order you explore. |
| 6 | `g10-casebook.png` | The casebook keeps what you found apart from what you were told. |
| 7 | `g11-accuse-choose.png` | Name a suspect, and the evidence that proves it. |
| 8 | `g14-ending-title-only.png` | Four endings, one fixed truth. |

Phone shots (`p01`–`p05`) are also available if Devpost allows more than 8.

### 5. Demo video URL

```text
[YOU FILL: YouTube URL, after recording]
```

- Public on YouTube, under 3:00.
- **No ElevenLabs-generated music** — see the pre-submit checklist. Room sounds, SFX and voices are fine.
- No third-party trademarks.
- Once you have the link: paste it here, replace `[YouTube link]` in `docs/submission/devpost-description.md`, and commit.

---

## Additional info (judges only)

### 6. Sponsor / Special Prizes

Open the dropdown in the actual form and read the live options — I can't see it from here. If it lists bonus prizes, pick the ones from section 15 below that you're entering. If it asks about sponsor tools, Kiro (and AWS, if relevant). Otherwise None.

### 7. Submitter country of residence

```text
India
```

[CONFIRM against Devpost's current excluded-country list on the rules page — I could not fetch that page to check it myself.]

### 8. Age and eligible-jurisdiction checkboxes

[YOU FILL] — tick these yourself; the rules require the age of majority where you live.

### 9. Category

```text
Resurrection
```

This is consistent throughout the repo: the README says "Kiroween 2026 · Resurrection category," the steering doc has a dedicated "Resurrection rationale" section, and the front page has an "A Resurrection" section. The pitch — golden-age radio drama revived with characters that can hear you — fits this category more directly than Frankenstein (several providers stitched together, but nothing about the combination is incompatible) or Costume Contest (the 1981 interface is polished but noir, not spooky).

### 10. Public GitHub repo URL

```text
https://github.com/j-nilesh/radio-night
```

Checked directly: the repo is public, `LICENSE` is MIT (confirmed by reading the file), `/.kiro` is at the repository root, committed, and not excluded by `.gitignore` (confirmed by `git check-ignore`), and `README.md` has setup and run instructions that I verified work from an isolated copy with no database or provider keys.

### 11. Working demo URL

```text
https://radionight.app
```

Confirmed live (HTTP 200) during this review. The front page explains the game and "Play now" leads to `/start`, then `/play`.

### 12. Testing instructions and credentials (judges only)

The exact text, with the real access code, is in `reports/devpost-private-fields.md` on your machine (gitignored, not reproduced here). Paste that block into Devpost's private field. It already covers: the one-click code link, turning sound on, speaking or typing questions, walking the inn, making an accusation, roughly how long a playthrough takes, what happens without a code, and basic troubleshooting (no sound, microphone blocked, code not recognised).

One line to add if it isn't already there: **[CONFIRM the exact browsers you tested — the draft lists Chrome/Safari/Firefox on a laptop and Safari/Chrome on a phone, but only you know your real test matrix.]**

### 13. How the project meets the main technology requirement (Kiro)

Taken from `docs/submission/kiro-writeup.md`, verified against the repo during this review (steering files, specs, hooks, property-based tests, and the ADR count, all confirmed present as described). One fact was corrected before this review: the steering file's stack table used to say Next.js 15 and Vercel; it now says Next.js 16 and Fly.io, matching what's actually shipped.

~~~~text
Radio Night was built from an empty create-next-app project between 8 and 27 November 2026, with Kiro as the development environment: the Kiro IDE. [CONFIRM: IDE only, or also Kiro CLI or Web?] Everything is committed in /.kiro, and the decisions it led to are recorded in 17 ADRs in docs/adr.

STEERING (.kiro/steering/, 3 files)
- architecture.md: directory layout plus non-negotiable rules. No keys or prompts in the browser, the solution file never imported client-side, the model never commits a game event, testimony never promoted to fact, and "do not invent mystery content".
- security.md: a checklist for every API route (token check first, zod validation, rate limits, player-safe responses), secret handling, data minimisation and prompt-injection defence.
- project-overview.md: goals, Resurrection rationale, stack, hard gates, and a running Kiro session log.
Writing rules as "must never happen, because…" let Kiro apply them to cases I hadn't named. For example, it routed pictures through the server's player view with opaque file names, so an undiscovered clue can't leak through a file name.

SPECS (.kiro/specs/, 5 files)
vertical-slice (first voice loop), mystery-bible (canon, clue chain, accusation rubric), visual-identity (art pipeline, with a "Resume here" section), launch-plan (milestones to submission) and first-minutes (onboarding fixes from a first-time playtest). Each is written as a task list with a done-check (typecheck, lint, tests, build, commit), so work survived across sessions, and decisions stayed with their reasons.

AGENT HOOKS (.kiro/hooks/, 5 hooks)
- Never print secrets (PreToolUse on shell): blocks commands like "cat .env.local" before they run.
- Keep the solution out of the browser (on save in src/): fails if a client file imports the solution or a server-only module.
- Test the case after a content change (on save in content/cases/): runs the mystery's 192 tests.
- Keep .kiro committed (on save of .gitignore): enforces the contest rule.
- Log the session (SessionStart agent prompt): appends to the usage log.

PROPERTY-BASED TESTING (fast-check)
Seven reducer properties and two over the real case in any order of play: no required clue is ever out of reach, and the player's view never holds the solution. The "closed case stays closed" property found a real bug unit tests had missed (a second ending could replace the first). fast-check shrank it to one event, and the fix went into the reducer.

SUB-AGENTS
Kiro's documentation sub-agent answered questions about Kiro itself (for example the hook file format) before the hooks were written. [CONFIRM]

NOT USED
No MCP servers, no custom agents and no Kiro powers were used in this project.

The full write-up is in docs/submission/kiro-writeup.md. 632 tests pass from a fresh clone with no keys.
~~~~

### 14. Pre-existing code or work

This now matches `kiro-writeup.md` and the fixed `visual-identity.md` exactly — both say the same thing, which they didn't before this review.

~~~~text
- Started from the standard create-next-app template on 8 November 2026, after the submission period opened. Standard frameworks and libraries (Next.js, React, Tailwind CSS, Drizzle, zod, Vitest, fast-check) are used under their own licences.
- Planning documents (vision, game design, build plan, checklist) were written before the first commit. The vision document is dated 5 November 2026. They're kept unchanged in docs/planning/.
- Earlier prototype: I had tried a text-only prototype of the idea earlier, in Claude Code [CONFIRM: roughly when], and dropped it entirely. Nothing from it, including its character cards, was used as a reference or carried over in any way.
- Third-party assets, all listed with source and terms in NOTICE and the audio and image manifests:
  - Music, room sounds and stings: generated with ElevenLabs on a paid plan. One placeholder sting is original and MIT.
  - Pictures (16): generated with Lovable. Under Lovable's terms the output is owned by me.
  - Fonts: TeX Gyre Bonum (GUST Font License, included), plus Courier Prime (SIL OFL) and Special Elite (Apache 2.0) from Google Fonts.
  - Voices are synthesised at run time by Deepgram, Cartesia and ElevenLabs. Character replies come from Anthropic Claude, and speech recognition from Deepgram. No voice recordings are in the repo.
- The code is MIT. The media files are included only so the game runs and aren't licensed for reuse. The ElevenLabs-generated music specifically is not licensed for use in film, TV, radio or studio games — see NOTICE.
~~~~

### 15. Bonus prizes: what to tick

| Prize | Recommendation | What it needs |
|---|---|---|
| Best Demo | Automatic | Nothing to tick, assuming the form handles it as you understand it. [CONFIRM] |
| Social Blitz | Tick if you post | A post on X, LinkedIn, Instagram or TikTok that **starts with `#KiroweenHackathon26`**, says your favourite thing about Kiro and how it changed your approach, is in your own words, is published before 4 Dec 2 PM PT, and is linked in field 17. |
| Blog | Tick if you write one | A public post on a third-party blog platform, about Kiro and the build, that **mentions it was written for the Kiroween 2026 hackathon**, published during the submission period, and linked in field 17. |
| Ghost of Kiroween Past | Only if you registered for Kiroween 2025 | You confirm it in field 18; Devpost checks their own records. |
| Best Startup Project ($10k) | Your call; I'd lean against it | Requires confirming you're a founder, plus LinkedIn and a startup website. The repo has no company, pricing or business plan, and the steering doc lists "monetization or paid subscriptions" as a non-goal. Only fits if Radio Night is run as an actual venture. |
| Best Student Project | Doesn't apply | |
| Best Kiro Crew App | Doesn't apply | The repo has no Kiro Crew app. |

### 16. Startup, Student and Kiro Crew detail fields

```text
N/A
```

Template if you do enter Startup:
```text
I confirm I am a founder of [YOU FILL: startup name].
LinkedIn: [YOU FILL]
Startup website: [YOU FILL]
```

### 17. Social Blitz URL and Blog URL

```text
Social Blitz post: [YOU FILL, if entering]
Blog post: [YOU FILL, if entering]
```

Leave empty if not entering. Should be in your own words either way.

### 18. Registered for Kiroween 2025?

```text
[YOU FILL: Yes / No]
```

### 19. Submitter type and organisation name

```text
[YOU FILL]
```

You built this alone, so "Individual" with no organisation is the natural choice.

### 20. Are you an AWS employee?

```text
[YOU FILL]
```

Answering yes means disqualification under the rules — sponsor employees aren't eligible.

### 21. The two survey dropdowns

Your call, nothing to prepare.
