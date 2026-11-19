# 0016. Surfaces of a 1981 receiver: walnut case, aluminium faceplate
Status: Accepted (owner's choice, 20 Nov 2026, from a side-by-side specimen of two directions).
## Context
After the typography change (ADR 0015) the pages still used flat 2020s surfaces: soft dark cards, outline buttons, a plain header. The design feedback asked for early-80s materials: walnut woodgrain veneer, brushed-aluminium faceplates and glowing amber VU meters.
Two directions were shown on the same game parts. A, "Hi-fi faceplate", used brushed-aluminium keys, amber lamp buttons, smoked-glass panels and a ruled index card. B, "Walnut cabinet", used a wood header, brass-edged wooden keys and a cream paper note. A alone felt cold and B alone was a lot of brown. A real receiver of the period had both: a walnut case around an aluminium faceplate.
## Decision
- **Walnut** for the case-screen header and the footers of the front pages (`.walnut`). The grain is stretched across the width instead of tiled, so it never shows a seam.
- **Brushed-aluminium keys** for ordinary buttons (`.btn-ghost`). A key that is held in (an open panel, voices on) is pressed in and, from tablet width up, shows a small amber lamp.
- **Amber lamps** for the main action on each screen (`.btn-primary`) and the microphone, which turns red while listening. A disabled lamp is unlit.
- **Smoked glass** for panels (`.card`) and person chips; text fields are recessed.
- **Casebook finds on a ruled index card** (`.index-card`), with the note in the typewriter face.
- **A VU meter** beside the case title (tablet width and up). Its needle reads the level of the dialogue bus through an `AnalyserNode` placed in series between the dialogue bus and the master gain, because Safari only runs an analyser that has an output. It rests in silence and when reduced motion is requested. It is decorative (`aria-hidden`), since every line is also written out.
- Everything is drawn in CSS and SVG noise. No new image or font files.
## Consequences
- The change is made in the shared classes, so every page picks it up, the admin usage page excepted (it has its own markup).
- The analyser adds one node to the speech path. It does not change the sound, and it does not touch run state.
- The phone header is unchanged in layout. The phone declutter is still being decided separately.
