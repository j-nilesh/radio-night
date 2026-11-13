# Art bible: Radio Night, "The Sitting"

Source of truth for the look of the game's pictures. Story facts come from `docs/mystery/01-mystery-bible.md`; where this page and the bible differ, the bible wins. Decisions here were made by the project owner.

## The look

A 1981 colour negative film photograph. Warm tungsten practical light, visible film grain, shallow depth of field, small-town New Hampshire. Photographic, not painted, drawn or stylised. Nothing modern: no flat screens, LEDs, smartphones or contemporary clothing.

The site shell is radio-noir (deep charcoal browns, warm amber, aged cream). The pictures sit inside it as period photographs, so they should read as warm and dim, not bright.

Palette (the site's own tokens, so photographs and interface feel related):

| Role | Hex |
|---|---|
| Page background | `#0f0d0b` |
| Raised surface | `#1a1714` |
| Card surface | `#221f1b` |
| Border | `#2e2a25` |
| Amber | `#d97706` |
| Amber on dark | `#fcd34d` |
| Warm off-white text | `#f5f0e8` |

Prompt skeleton (use for every image, then add the subject):

> Photograph, 1981, colour negative film look, warm tungsten light, visible film grain, shallow depth of field, small-town New Hampshire. [subject]. No text, no logos, no watermark, nothing modern.

## The grade in code

Generated images will not match each other exactly, so the interface applies one shared grade to every photograph: a subtle sepia, saturation and contrast filter; a light film-grain overlay (about 6 percent); and a soft vignette. Endings reuse room art with a different grade: solved is lighter and cooler like dawn; case closed is dim and desaturated. No extra images are made for endings.

## Delivery specs

| Kind | Size | Ratio | Format |
|---|---|---|---|
| Room and hero | 1920 x 1080 | 16:9 | PNG, sRGB, highest quality |
| Portrait | 1536 x 1920 | 4:5 | PNG, sRGB, highest quality |
| Evidence | 1024 x 1024 | 1:1 | PNG, sRGB, highest quality |

Originals are kept in the gitignored `art/source/`. Committed copies are produced later by an optimise step (AVIF or WebP with a JPEG fallback) within these budgets: room or hero up to 300 KB, portrait up to 150 KB, evidence up to 100 KB.

Safe areas:
- Rooms: the banner is a wide strip (about 3:1 on a phone, up to about 5:1 on a tablet, close to 16:9 only on large screens), so the top and bottom are often cropped. Keep everything important in a horizontal band across the middle (about the middle 40 percent of the height), slightly above the centre line. The lowest quarter stays simple and darker, because the room name is laid over it.
- Hero: the radio in the left third, with dark empty space on the right for the title.
- Portraits: head and shoulders, face in the upper middle, uncluttered warm background.

## Characters (approved by the owner; ages from the bible)

| Id | Who | Look |
|---|---|---|
| `char-ray-kowalski` | Ray Kowalski, 44, bartender | Broad-shouldered, tired kind eyes, dark hair greying at the temples, white shirt with rolled sleeves, a bar towel over one shoulder. Warm and steady. Not shifty. |
| `char-dwight-wentworth` | Dwight Wentworth, 52, businessman | Lean, neatly groomed, brown three-piece suit with a tie pin. Controlled and stern, not villainous. |
| `char-carol-wentworth` | Carol Wentworth, 38 | Dark shoulder-length hair, neat camel wool coat over a cream blouse. Watchful and composed. No injury or distress. |
| `char-edna-marsh` | Edna Marsh, 63, innkeeper | Grey hair pinned up, a cardigan, glasses on a chain, keys at her belt. Practical. |
| `char-dennis-pruett` | Dennis Pruett, 55, retired mill foreman | Ruddy, flannel shirt and a worn work jacket, a friendly rumpled face. |
| `victim-gerald-fenn` | Gerald Fenn, 58, portrait painter (the victim) | Paint-stained cuffs, a sardonic expression. Shown on a casebook card. |

There is no narrator face.

Portraits must not telegraph guilt. A tired, decent Ray; a stern but not villainous Dwight; a composed Carol.

## Rooms (empty of identifiable people; details from the scene narration only)

| Id | Room | What the picture shows |
|---|---|---|
| `scene-tap-room` | The Tap Room | A long dark wooden bar, stools, bottles and glasses behind it, a small CRT television above the bar switched on with a faint blue glow, rain on the front window, wood paneling, warm lamps. No jukebox. |
| `scene-back-room` | The Back Room | The snug: a round table, four chairs, a window onto the alley, one lamp. |
| `scene-kitchen` | The Kitchen | Clean, one lamp burning, a steel sink slightly damp, a counter. |
| `scene-back-stairs` | The Back Stairs | A plain, narrow wooden staircase. |
| `scene-upstairs-hall` | The Upstairs Hall | A low corridor with six doors, old carpet, a window at the far end with rain. No extra door at the end of the hall (a hidden door is a clue the player finds by examining). |
| `scene-room-5` | Room 5 | A slept-in bed, an open suitcase on a chair, a lit lamp on a side table, a window with rain. Nothing else. |

## Evidence (square, neutral dark surface)

| Id | File | What it shows |
|---|---|---|
| `ev-ashtray` | `x-01` | A heavy glass ashtray, wiped and smeared, no ash, with a ring on the wood where it sat. |
| `ev-whiskey-glass` | `x-02` | One empty tumbler with a thin brown film in the bottom, beside a lamp. Only one glass. |
| `ev-note` | `x-03` | A blank folded sheet of paper, pushed as if kicked. No writing. The words are set in code. |

Evidence files have opaque names so a file name never gives away what an undiscovered clue is.

## Hero

A wooden tabletop radio with a softly glowing amber dial (blank, no writing) on the dark counter of a small-town inn bar at night. A rain-streaked window out of focus behind it, bottles catching warm light. The radio in the left third.

## The 16 images

Rooms: `scene-tap-room`, `scene-back-room`, `scene-kitchen`, `scene-back-stairs`, `scene-upstairs-hall`, `scene-room-5`. People: `char-ray-kowalski`, `char-dwight-wentworth`, `char-carol-wentworth`, `char-edna-marsh`, `char-dennis-pruett`, `victim-gerald-fenn`. Evidence: `ev-ashtray`, `ev-whiskey-glass`, `ev-note`. Hero: `hero-radio`.

## Rules

1. No invented canon. Everything not listed above comes from the bible.
2. Fair play: no clue is conveyed only by a picture. Room 5 shows no ashtray, glass, note, body or blood. Evidence pictures match their `examineText`.
3. No text inside any image. Words are set in code.
4. No people in room pictures.
5. Alt text on every image (it lives in the manifest).
6. Rights: record the tool, model, prompt, references, date and licence for every final image in the manifest.

## Consistency method

The Tap Room is the style anchor for rooms. For portraits, reference the style only; do not feed one person's face in as a reference for the next, or the faces drift toward each other. References reduce drift but do not remove it, so every later prompt repeats the same "style lock" paragraph.

## Review checklist for every image

- Nothing modern; the television is a small old CRT set.
- No garbled text, letters or numbers; no logos.
- Hands and faces look natural.
- Bottom quarter calm and dark enough for a caption.
- Everything important in a horizontal band across the middle (about the middle 40 percent of the height), since room pictures are cropped to a wide strip.
- Grain and warm tungsten light match the anchor.
- Ray looks decent and tired, not shifty. Carol shows no distress. Ray and Carol look like different people.
- Room 5 shows none of the evidence. The hall shows no door at the far end.
