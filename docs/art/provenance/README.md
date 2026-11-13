# Provenance of the pictures

The contest requires that everything in the public repository is the entrant's own work or properly licensed. For every picture that ships, we record where it came from. This folder holds the evidence.

## What goes here

1. **The tool's statement on ownership and publishing.** A dated screenshot of Lovable's reply saying the owner owns the generated images and may use them commercially and publish them in open-source repositories. Name it with the date, for example `lovable-image-rights-2026-11-13.png`.
2. **Batch notes.** One short file per batch of images, for example `pilot-2026-11.md`, listing for each image: the file name, the model and quality tier used, the exact prompt, any reference image used, the date, and the credits spent.
3. **Anything from the tool's terms of service** that the owner checked, with the date.

This is a record kept for the project, not legal advice. Skim the tool's terms for anything that contradicts its own statement.

## What is recorded in the manifest

For each final image, `content/cases/radio-night-s01/v1/images-manifest.json` holds the tool, model, prompt, references, date and licence. The credits page is generated from it.

## What must not be committed

The original full-size generated files live in `art/source/`, which is gitignored. Only the optimised copies in `public/images/` are committed.
