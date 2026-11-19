# 0015. Period typography: Bookman, Helvetica and the typewriter

Status: Accepted (owner's choice, 19 Nov 2026, from two rounds of side-by-side specimens).

## Context
Feedback on the front page: it read like a 2024 editorial tech site, while the game is set in October 1981. Playfair Display and Inter are typical of 2020s web design. A check also found that neither had ever loaded: the CSS variables `--font-display` and `--font-sans` referred to themselves, so every page fell back to the system font.

The faces the feedback suggested (ITC Benguiat, ITC Souvenir) are commercial. Their licences do not allow the font files in a public open-source repository, which the contest requires.

## Decision
- **Titles and headings:** Bookman. The repo ships TeX Gyre Bonum, a free clone of URW Bookman L, released under the GUST Font License (`src/fonts/tex-gyre-bonum/`, licence included). Ed Benguiat redrew Bookman for ITC in 1975, and it is the face of 1970s and early-80s paperbacks and album sleeves. The narrator's lines are set in Bookman italic.
- **Reading text:** Helvetica, slightly tight. It uses the system's Helvetica Neue on Apple devices and the nearest system face elsewhere, so there is nothing to ship or license.
- **Labels, buttons and small capitals:** Courier Prime, a typewriter face like an IBM Selectric (SIL Open Font License, served by the app through next/font).
- **Notes in the casebook:** Special Elite, a worn typewriter face (Apache License 2.0, through next/font).
- The CSS variables no longer refer to themselves: `--font-display`, `--font-sans`, `--font-label` and `--font-note` each point at a next/font variable, with a period fallback.

## Consequences
- Every page changes, the game screens included. Bookman is wide, so long titles shrink sooner. On a phone, "The Sitting" in the case-screen header is now truncated; the phone layout is being reconsidered separately.
- All font files are served by the app itself. No request goes to Google at runtime.
