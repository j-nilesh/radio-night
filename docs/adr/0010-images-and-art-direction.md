# 0010. Images and art direction

Status: Accepted. Placeholders are in; real art arrives from the owner.

## Context

The game is text-first. The vision calls for a restrained visual companion: room art, portraits and evidence, never an obligation to stare at a screen. Design is also a judged criterion. The owner will generate the art in Lovable (images only). Real art arrives after the code is written, and it has to be possible to build and test the whole interface before then.

## Decisions

- **Look.** A warm, grainy 1981 colour photograph, in keeping with the setting (Millhaven, New Hampshire, October 1981). Not painted or illustrated. The radio-noir shell of the site stays as it is; the pictures are period photographs.
- **Images only from Lovable.** No Lovable code is imported. Mockups and layout are built in code with Kiro.
- **A manifest, like the sound cues.** `images-manifest.json` lists every image with size, alt text, focal point, status (placeholder or final) and, for final art, the tool, model, prompt, references, date and licence. Tests enforce coverage, alt text, provenance and size budgets.
- **Placeholders first.** Generated SVGs share the final ids and dimensions, so layout, tests and the secrecy rules are real today and real art replaces files later with no code change.
- **Grade in code.** One warm grade, grain and vignette applied by CSS, so uneven generations sit together. Endings reuse room art with a different grade instead of extra images.
- **Pre-optimised static files.** No runtime image optimiser, which avoids host quotas. Originals live in gitignored `art/source/`; committed copies are AVIF or WebP with a JPEG fallback within size budgets.
- **Text is never in the picture.** Image models render text badly. The note's words are set in code over a blank folded-paper image, and the share card is drawn in code.

## Fair play and secrecy

- No clue is conveyed only by a picture. The Room 5 picture shows no ashtray, glass, note, body or blood. Evidence pictures match their `examineText`.
- Portraits must not telegraph guilt, and Carol is shown with no injury or distress.
- Image references reach the browser only through the server-built player view: the current room, people who are present, clues already discovered, and the victim card. Evidence files have opaque names, so a file name never reveals what an undiscovered clue is. The client never imports the full manifest.

## Consequences

- Real art can be swapped in by replacing files and updating manifest entries.
- The pilot (Ray and the Tap Room) settles the style before the other 14 images are made.
- Provenance is recorded per image. The owner keeps a dated screenshot of Lovable's statement on ownership and publishing in `docs/art/provenance/`; this is a record, not legal advice.
