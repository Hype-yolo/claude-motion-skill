# Watercolor Brush — Style Prompt

> A hand-painted journal page that paints itself: translucent brush strokes with dry-brush flying white on warm cotton paper, hand-written notes beside what is painted, nothing drawn with a vector line.
> References (grammar only): naturalist field-journal and botanical-plate watercolours (specimen + note); long horizontal handscroll panoramas (one continuous painted world); the textbook "transect" diagram (a gradient read across space). Borrow the grammar, never a specific artwork, character or layout.

## 1. Essence, and what it is not

- **One sheet of warm, fibrous paper** under everything; it is also the eraser (paper-coloured mist washes things away).
- **Everything is individual brush strokes**: a variable-width ribbon at partial opacity plus a few thin **bristle tracks** that break into dashes (flying white). Strokes overlap and darken where they cross, like transparent pigment. No vector outlines; a darker edge stroke along a form is the only "line".
- **Things paint themselves in**, stroke by stroke, structure before detail (trunk → branches → leaves; outline wash → shadow → accent).
- **An annotation layer** in a hand the painter would write with: labels with pen leader lines, a small measured value, a quiet title.
- Tone: calm, curious, precise. Numbers are real; the palette can carry data.

Not ink wash (colour, not ink tones; no calligraphic brush-as-gesture), not impasto (no thick paint, no knife), not a children's picture book (no crayon, no cute outlines), not vector illustration with a watercolour texture laid on top.

## 2. Materials & rendering

- **Paper**: a pre-generated image (warm base, three octaves of smooth noise ±3.5 %, a few thousand short curved fibres, fine grain, light vignette), drawn first every frame.
- **Stroke** (`engine.js` `mk`/`drawS`): a ribbon whose width follows a profile (`brush`, `leaf`, `even`, `tip`, `trunk`) with ~±22 % value-noise roughness, filled as a thin wash (≈ 0.55–0.6 body opacity when bristles are present), plus 3–9 bristle tracks at 30–85 % opacity, each with a random dash pattern and a random early end: that is the flying white. A stroke can be painted up to any fraction of its length (a moving brush tip).
- **Wash**: the same polygon painted in 3 passes with jittered vertices at a third of the opacity each, so edges darken where passes disagree (a pooled watercolour edge).
- **Depth by layers**: several parallax layers of washes and painted objects; farther = smaller, lighter, less saturated; paper-coloured mist bands between layers.
- **Cache finished objects as sprites**; draw stroke by stroke only what is being painted or transformed.
- **Everything is a pure function of `t`**; any stroke made inside `render(t)` is built under a fixed seed.

## 3. Colour logic

- **Paper is the white.** Never paint pure white; light is unpainted paper.
- **Transparent layering**: darker = more passes, not a darker pigment on top. Keep 3–5 hues per scene plus ink.
- **Ink** (a warm near-black and a lighter brown) for lines, text, edges and stems only.
- **Colour may carry the data or the mood**: blend sky, ground and background by position or time so the palette itself changes with the subject. Map ramps quantised into 4–6 bands read as paint, continuous ramps read as software.
- **One accent** (a vermilion, a rain blue) reserved for one element that recurs: a stamp, a marker, a key object.
- Examples: arid-to-wet — red ochre → sage → straw → blue-grey → deep green; a harbour at dawn — `#f3e2c8` sky, `#9fb4c4` water, `#5f7486` hulls, accent `#c8442a` buoys; a vegetable garden — `#e8e0c0` soil light, `#8ea860` leaves, `#4e6e3c` shade, accent `#d9632e` pumpkins.

## 4. Type & subtitles

- An elegant serif (e.g. Cormorant Garamond) for titles and subtitles, a handwriting face (e.g. Caveat) for notes, a small mono (e.g. IBM Plex Mono, wide tracking) for measured labels, Noto Serif SC for Chinese (subset to the characters used).
- Hand notes are drawn twice over a paper-coloured halo, revealed left to right like writing, with a pen leader line that grows to its specimen.
- **Subtitles** sit on the paper, not in a box: centred at the bottom, serif italic ~36 px (2 balanced lines max), a second-language line beneath at ~2/3 size, ink at ~78 % over a paper-coloured halo. Hold ≥ max(1.8 s, speech + 0.6 s).
- Numbers are spelled out in the TTS text and written as digits on screen.

## 5. Motion quality

- **Painting-in is the main motion**: an object's progress is a function of where it sits on screen or of a cue; strokes in a list each take a slice of that progress, so structure appears first.
- **Sway** only after an object is finished: a small horizontal skew (`sin(1.15t+φ) + .4 sin(2.7t+2φ)`), ~0.006 for trees, 0.01–0.03 for grass.
- **Brush-edge wipes**: a wavy vertical clip reveals a whole scene; lines grow by stroke progress; labels open with a left-to-right clip.
- **Mist** erases: paper-coloured layers with a wavy rising edge.
- Animated creatures and events may be phased to the music's beat grid so landings hit the beat.
- Smooth easing (`ss`, `eio`, `eo`, `ei`); 60 fps suits the slow, fluid brush; nothing jitters.

## 6. Camera grammar

A vocabulary, not a route. The picture is one painted sheet; cutting is rare. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Long lateral dolly over a continuous world | a gradient; a journey; cause and consequence | a transect; a route; a timeline |
| Vertical tilt along one object | scale; measurement | a tall tree; a building; a depth |
| Locked sheet, things painted in | study; attention | a specimen plate; a recipe; a diagram |
| Slow push into a detail | the observer leaning in | a seed; an insect; a hand-written note |
| Pull-back to a map or diagram | the whole re-framed | where it all happened; a system |
| Mist wash to blank paper | chapter end; time passing | a season; forgetting; a new place |
| Page turn / new sheet slides over | a new entry in the journal | a new day; a new species; a new case |
| Change in time on a locked view | growth; decay; history | a season cycle; before/after; deep time |

Framing: generous paper margins; one hero subject per view with its note; labels never cover the subject. Transitions: brush-edge wipes, mist, a page turn, or a continuous camera move; no hard video cuts, no dissolves between unrelated pictures.

## 7. Sound palette

- **Music**: acoustic and gentle: felt piano, fingerpicked guitar, woodwinds, light strings, glockenspiel, kalimba, soft pads. A licensed track can be edited with beat-aligned jumps; the picture can then take its beat grid.
- **Foley made from the scene's matter**: a paper brush rustle for each painting-in (band-passed noise, light tremolo, a panned sweep); pencil scratch for notes; a soft thump for a stamp; page flips; nature beds and creatures of the subject (birds, wind, rain plinks, water, insects, fire crackle).
- **Silence**: the brush lifted: music out, only paper and room; it frames a single painted moment.
- **Mix character**: voice forward (RMS a few dB over the music), music ducked ~4 dB under voice with a smoothed envelope, a short soft reverb, final −14 LUFS. Kokoro voices are peaky (~17 dB peak-to-RMS): limit before level-matching.
- **Voice**: warm, unhurried documentary read, one line per idea.

## 8. Native moves

A menu: use the ones your story needs.

- **Painting-in as reveal.** A new thing appears stroke by stroke as it enters. *Fits content like:* the stages of a building; the ingredients of a dish; the organs of a body.
- **Burst.** A whole group paints in at once (≤ 1 s) for a peak. *Fits content like:* a festival crowd; a field in bloom; a city lighting up.
- **Palette as data.** Sky, ground and background blend by a measured value. *Fits content like:* pollution along a river; temperature by altitude; noise across a city.
- **Specimen + note.** One hero object with a hand-written label and leader line. *Fits content like:* a tool kit; a wine region's grapes; parts of a bicycle.
- **Mist erase.** The world washes back to paper. *Fits content like:* forgetting; a dream ending; a site demolished.
- **Map in time.** A painted map whose fills change continuously through years. *Fits content like:* a language spreading; a coastline eroding; a railway network growing.
- **Painted transformation.** Objects cross-fade to a burnt, wet or aged sprite and regrow. *Fits content like:* a wildfire and recovery; a flood; a restoration.

## 9. Pitfalls of the medium

- Offscreen wash strips too short flatten tall shapes into flat tops and expose seams on tilts → size strips well beyond the frame.
- A translucent wash that ends at its canvas edge shows a hard seam under other layers → extend below the frame and fade to paper with a gradient.
- Classic scripts share one global scope: touching a `const` before its declaration in async init leaves `READY` false and every screenshot times out → build everything inside the init; read `[pageerror]` lines.
- The stroke builder consumes the global RNG: any stroke created in `render(t)` must be wrapped in `withSeed` or parallel workers disagree.
- Thousands of strokes per frame are too slow → sprite cache.
- Beat-locked animation must be re-derived when the music edit changes.
- New CJK subtitle characters fall back to another font until the subset is rebuilt.

## 10. Engine

In `demo/`: `engine.js` (RNG, easing, noise, monotone keyframe tracks; the stroke engine `mk`, `drawS`, `drawList`, `sprite`, `clump`, `edgeOf`, `withSeed`), `plants.js` (plant and prop generators, local coordinates, root at 0,0), `scene.js` (layers, wash strips `washPoly`, world placement `add`, annotations `hand` / `leader` / `note`), `main.js` (map, mist, HUD, subtitles, `render(t)`, async init → `READY`), `paper.py`, `fetch_fonts.mjs`, `mix.py`, `render.mjs`. API table and a minimal example: [DEMO.md](DEMO.md) "Engine reference".

## 11. Variation space

You decide the subject, the structure, what gets painted, the palette logic, whether anything is measured, the opening, the ending and the camera. All far from our demo:

- Structures: **a journal kept over one year** (locked page per month, each painted over the last); **anatomy of one object** (a single specimen dissected into labelled parts, each part a painted close-up); **a recipe or process** (steps painted top to bottom on one tall sheet, tilting down).
- Openings: **a finished painting** that we then watch being painted backwards to its first stroke, and forwards again; **a close-up of wet pigment** spreading, pulled back to show what it became; **a hand-written question** on blank paper, answered by painting.
- Endings: **the page left unfinished**, brush lifted mid-stroke; **a close-up of one detail** as the rest fades to paper; **the sheet dries and is filed** into a stack of other pages.

---

How our demo was made (story, shots, score, end card, build): [DEMO.md](DEMO.md). Read it after your treatment exists.
