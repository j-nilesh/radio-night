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
- [ ] `CaseContent.images`, `PlayerView` image fields (current room, present people, discovered clues, victim), with tests that nothing unearned is exposed
- [ ] `Photo` component and the shared grade in `globals.css`
- [ ] `SceneImage` banner with caption, crossfade, hide toggle; mic reachable on a 390x844 phone
- [ ] dev telemetry `image.error`
- [ ] screenshots at desktop and mobile; green; commit and push

### Task 3: Character cards and the casebook People view (with Fenn)
- [ ] Portrait cards in `SceneBar`
- [ ] People section in `Casebook`, victim first
- [ ] tests, screenshots; green; commit and push

### Task 4: Evidence art
- [ ] Thumbnails in the casebook, picture beside the examine text, note text set in code
- [ ] tests (no URL for undiscovered clues; note text equals `examineText` quote); green; commit and push

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
