# Visual identity: art direction, images and UI

Status: in progress. This file is the checklist. If work stops for any reason (for example Kiro credits), pick up at the first unchecked item under "Resume here".

## Goal

The game is text-first today. Add a photographic visual layer: a room image on the case screen, portrait cards for the people, evidence pictures, a redesigned home page and ending visuals. The final art is made by the owner in Lovable (images only, never code) and delivered later. Everything is built now with generated placeholder art, a manifest with provenance, and tests, so real images drop in with no code change.

## Decisions (made by the owner; do not re-ask)

- Look: a warm, grainy 1981 colour photograph (80s film look). Photographic, not painted or illustrated. The earlier prototype's painted cards are a layout reference only (framed portrait on top, serif name below, small spaced-caps role line, gold border when selected). None of its images or characters are reused.
- Lovable can output standalone PNG or JPG, no watermark, 512 to 1920 px on a side, accepts reference images (reduces drift, does not remove it); the owner owns the output and may publish it in open-source repos. The owner saves a dated screenshot of that reply in `docs/art/provenance/`.
- Pilot: one character (Ray Kowalski) and one background (the Tap Room). Settle the style, then the remaining 14.
- Mockups are done in code. No Lovable code is imported.
- Character looks are approved (see `docs/art/art-bible.md`). The casebook shows a card for Gerald Fenn, the victim.
- About 16 images. Endings reuse room art with different grading in code. No narrator face.

## Rules

- No invented canon. Fair play: no clue is conveyed only by a picture. Room 5 art shows no ashtray, glass, note, body or blood. Evidence art matches `examineText`. The note's words are set in code.
- Portraits must not telegraph guilt. Carol shows no injury or distress.
- Secrecy: image references reach the browser only through the server-built `PlayerView` (current room, present people, discovered clues, the victim card). Evidence files have opaque names (`x-01`...). The client never imports the full image manifest.
- Accessibility: alt text on every image, focus states, reduced motion honoured, no colour-only signalling.

## Checklist

### Task 1: Foundations (docs, manifest, tests, placeholders, Lovable brief)
- [x] This spec, ADR 0010, `docs/adr/README.md` row
- [x] `docs/art/art-bible.md`, `docs/art/prompts.md`, `docs/art/provenance/README.md`
- [x] `docs/art/lovable-brief.md` (self-contained; pilot = Tap Room + Ray)
- [x] `content/cases/radio-night-s01/v1/images-manifest.json` and `images.ts`
- [x] `scripts/make-placeholder-images.ts`, `npm run art:placeholders`, `art/source/` in `.gitignore`
- [x] `images.test.ts`
- [x] typecheck, lint, tests, build green; commit and push

### Task 2: Images through the server view, `Photo`, room image on the case screen
- [x] `CaseContent.images` and `victim`, `PlayerView` image fields (current room, present people, interviewed people, discovered clues, victim), with tests that nothing unearned is exposed (`view-images.test.ts`)
- [x] `Photo` component and the shared grade in `globals.css`
- [x] `SceneImage` banner with caption, crossfade (`src/lib/crossfade.ts`, tested), hide toggle; mic reachable on a 390x844 phone
- [x] dev telemetry `image.error`
- [x] screenshots at desktop (1280x800) and phone (390x844); green; commit and push
- Found and fixed while checking in a browser: the header's six buttons were 672px wide on a 390px phone (the `.btn` class sets its own padding, so Tailwind `px-3 py-1.5` never applied). Added `.btn-sm`, a phone Menu button, stacked scene-bar labels, a smaller banner, and one-time hints (shown only until the first question).

### Task 3: Character cards and the casebook People view (with Fenn)
- [x] Portrait cards in `SceneBar`
- [x] People section in `Casebook`, victim first
- [x] tests, screenshots; green; commit and push
- Wide screens (1024px and up) now put the picture and the people on the left and the conversation beside them, because stacking them ate the conversation's height. Below that, people are compact round-portrait chips. Verified at 1280x800, 820x1180 and 390x844: no sideways scroll, microphone in view, keyboard Tab and Enter changes the selection.
- Note for testing: the new-run limit (12 per hour per address) trips after many test runs; start the dev server with RATE_CREATE_RUN_PER_HOUR=500.

### Task 4: Evidence art
- [x] Thumbnails in the casebook, picture beside the examine text, note text set in code (`EvidencePhoto`, `ClueInfo.imageText`, `.note-slip`)
- [x] tests (no URL or note text for undiscovered clues; note text equals the `examineText` quote and the summary; only the note has writing); green; commit and push
- Checked in a real browser at 1280x800 and 390x844: picture beside the examine line, thumbnails in the casebook, no sideways scroll, no console errors.
- To recheck when the real x-03 arrives: the note slip is centred over the picture. If the paper sits off-centre in the final image, move `.note-slip` (left/top/rotation) or add a per-image position.

### Task 5: Landing page, metadata, endings, credits
- [ ] Landing redesign (hero, how it works, meet the cast, play modes), default SVGs removed
- [ ] Metadata, favicon, `opengraph-image`
- [ ] Ending screens with art and a grade per ending
- [ ] Credits page lists images from the manifest (people and rooms by name; evidence only as a count, never one by one, so it cannot spoil)
- [ ] docs, README, architecture, project log updated; green; commit and push

### Task 6 (deferred until the owner delivers the pilot images)
- [ ] Pilot review (dimensions, size, mobile crop, text contrast, checklist), style lock
- [ ] Remaining 14 images, `scripts/optimise-images.ts` (AVIF/WebP plus JPEG fallback within budgets)
- [ ] Manifest entries to `final` with full provenance; delete matching placeholders; tests; credits

## Resume here

Start at the first unchecked item above. After every task: typecheck (`npm run typecheck`), `npm run lint`, `npm test`, `node node_modules/next/dist/bin/next build`; then a commit with small, specific `git add` paths (never `reports/`, `playtests/`, `.env.local` or `art/source/`) and `git -c user.email=71657349+j-nilesh@users.noreply.github.com commit`; then push to origin main; then log it in `.kiro/steering/project-overview.md` (Session 4).
