# Silkscreen Travel Poster — our demo

One example among many. Don't reuse its story, arc, shots, props or timings.

Demo: *Three Trails* (38.4 s) · `silkscreen-poster.mp4` · source in [`demo/`](demo/)


## Story & structure

A trail guide for a fictional park: three trail posters are printed, one faster than the last, the third is climbed in one long take, and all three end up on a visitor-center wall. No narration.

This is the first use case of STYLE.md §11 (trail / attraction guide). Shot structure: title banner pull → poster 1 printed layer by layer → poster 2 printed on eighth notes → last poster climbed in one take → pull back to the wall. Information order: park title → scene → trail name → difficulty → distance → time → climb → footer. Holds: title 3.2 s; name ≥ chars/12+1 s; stat row ≥ 2.2–3.0 s after its last item; 30–40 s for 3 trails.

The other use cases in STYLE.md §11 use the same engine: a scene is just a list of planes, the band template takes any 1–4 facts, and `swap` re-inks a whole poster in another palette.

**How the native moves serve information** (not story):
- *One ink, one beat*: each pull is one musical hit, so the eye is led through the layers in order and the facts are printed last, which is exactly when they are read.
- *Split fountain*: several inks in one pull. It opens the film, because one stroke fills the frame with colour.
- *Palette re-ink*: the whole poster pulled again in the next time-of-day palette. In the demo this is the data point "7 h": the day passes while the camera climbs.
- *Registration slip → snap*: during the climb the layers hang loose (white gaps, paper-thickness shadows), then clamp into register with one hit. This is the only time the film pauses before the most important facts.
- *Paper as a colour*: the waterfall is simply unprinted paper, the brightest thing on the sheet.
- *The trail as a printed layer*: the route is a dashed line in the sun ink, stamped segment by segment as the camera follows it.

## Shots

| Move | Use | Demo |
|---|---|---|
| Truck with the squeegee, slight roll (−1.7°), frame edge and handle ends in view | hook: the squeegee holds its place in frame while the bands stream past | 0–1.0 s |
| Fast pull-back (ease-out 0.65 s) | reveal the whole print as the screen lifts | 1.0–1.65 s |
| Tilt across the print table | from one sheet to the next | 4.8 s |
| Locked top-down full shot | watching layers stack | 5.4–7.8 s |
| Push + tilt to the info band | reading | 7.8–9.0 s |
| Truck through a foreground tree (screen-space silhouette in the previous poster's `near` ink, covers the frame for about 1 frame) | poster-to-poster transition | 13.2 s, 19.2 s |
| Pull-back from a detail to the whole sheet | "the white is the waterfall" | 14.4 s |
| **Crane up the trail, multi-plane parallax** (signature) | the hardest trail, one take | 19.2–23.4 s |
| Tilt down from summit to band | the climb ends in the data | 24.0 s |
| Log-zoom pull-back to the wall | final lockup, hold ≥ 3 s | 29.4–30.6 s |

Unified transition grammar: layers change by squeegee; posters change through foreground trees; the film ends with a squeegee pulling the end-card ink. No dissolves and no bare cuts.

Demo motion numbers: info band items 0.18 s each on eighth notes; accent inks `sub: 1` (half a beat late); screen lift 0.4 s; palette swap blade at −12° over 0.35 s; climb parallax `(camTopY − camY) × (depth − 1) × 0.42`, each spur slides sideways (Gaussian bump, 190 u × depth); paper gaps 3 u and thickness shadows 9 u at 28 %, scaled by "looseness", zero on the registration snap. Hook truck roll −1.7°.

## Score structure

- **Music**: American outdoor folk, 100 BPM, D major, open-D guitar strums (physical model), slide guitar (numpy), VCSL harmonica, cajon kick, brushes, upright bass. **Each pull is one strum**, and the chords climb D – D/F# – G – A as the layers come nearer. Poster 2 doubles to eighth notes (acceleration). The climb builds instrument by instrument. The registration snap is the loudest downbeat in the film.
- **Foley by material**: squeegee on mesh (band-passed noise with a 220–280 Hz amplitude grain from the mesh; faster pull = brighter), wet ink "squelch" (falling sine plus sticky noise), aluminium screen clack plus hinge creak, paper stamps for stats, 16th-note ticks for trail dashes, a paper hiss for sliding layers, and a wood-and-metal registration clamp.
- **Ambience**: studio room tone; the lake inside poster 1 fades in when the screen lifts (the print "wakes up"); waterfall (J-cut 0.9 s early); mountain wind (J-cut into the silence, L-cut out onto the wall); visitor-center murmur, a door, footsteps.
- **Silences**: 18.0–19.2 s (music off; the waterfall tail fades to about −59 dBFS; the first sound after it is a long slide up) and 23.4–24.0 s (wind only; the first sound after it is the clamp plus the full band).
- Music ducks 2.5 dB under foley. Master: −14 LUFS.

## Palette & props

- **Palette discipline**: one palette per poster, 6 inks: `sky1` (light sky), `sky2` (deep sky / bands), `far`, `mid`, `near` (darkest, also the info band), `sun` (the one bright accent: sun, trail, difficulty, climb). An optional `glow` is the lit face of mountains. A given poster should use ≤ 6 of these. The demo palettes are:
  - dawn `#F6CD98 #EE9A73 #9A7FA8 #3E7079 #1E3B3F #FBE6B4`
  - noon `#E4EEDC #86BCD0 #C2AE92 #4C8753 #1D4331 #F2C14A`
  - golden `#F7D787 #E9A94F #A57C68 #5E7A45 #2B3A28 #FFF1C4`
  - dusk `#F4B461 #D8613F #7C3E5F #43325A #1B1B2F #FBE3A6`
  - Paper `#F2E8D2`. Title banner `#F7C66B #E4683F #2F6F73 #1C2A33`.
- **Contrast is automatic**: text inks are picked by WCAG contrast against the ink underneath (`pickInk`). A night palette will not make the header vanish.
- **Shapes**: mountains are midpoint-displaced ridges with a jagged lit facet; pines are one outline of drooping tiers plus a short trunk; water is a flat body with horizontal glint bars; forests are rows of pines on a solid base. Everything is drawn with hard edges.
- **Poster template** (units 1000×1500): paper border 26 u; art area to y = 1140; the scene is shifted up 50 u, so a little sky is cropped to make room for the info band. The band (y 1148–1474, `near` ink) holds the trail name (Big Shoulders Display 900, up to 122 u, auto-fit), the number `01`–`04` in `sun`, a 6 u `sun` rule, and a row of stats: labels 34–38 u (Outfit 600, letter-spaced), values 48–68 u (Big Shoulders 800). Columns are sized by content. On a wall at 0.49 scale, labels are about 18 px and values about 31 px.
- **Header**: park name tracked out at 62 u, printed in the sky.
- **Texture budget**: paper tile at 0.6 u per texel, mottle multiply at 55 %, pinholes at 75 %, then ffmpeg grain 3. More than this starts to read as risograph.

## Titles & text

No narration and no subtitles: the poster text *is* the information. The title card is a printed 4:1 banner (1800×440 u, title split into two balanced lines), framed to fill the width (≈5 % margins, ≈40 % of frame height), which becomes the header of the final wall (hung at 1150 px wide so the posters keep ≥30 px values). Reading rule used in the demo: each text stays ≥ chars/12 + 1 s (min 1.5 s) after its **last** item lands. The timeline computes this from `content.json` and rounds up to the beat.

## End card

The end card is printed as a last landscape mini-poster in two pulls: a split-fountain pull for the art (sky bands, sun ring, ridge, trail dashes, title), then a `near` pull for the info band (style name, `Lemo-Opuscar`, `LemoLab × Claude Opus 5.5`, font and sample credits). The "LemoLab × Claude Opus 5.5" sign-off belongs to this library's demo only; a user's film carries no LemoLab credit and no copy of this card.

## Build notes

`sh styles/silkscreen-poster/demo/build.sh` rebuilds everything:
1. `tools/timeline.mjs` prints the timeline derived from `content.json`.
2. `core/render/events.mjs` → `events.json` (every pull, lift, band, name, item, wipe, swap, part, silence, clack).
3. `music/compose.py` reads `events.json` → `score.wav` plus stems.
4. `mix.py` → `mix.wav` (ambience, foley, ducking, silence windows).
5. `tools/cuecheck.py` checks the mix onsets against the events: median error 4 ms; 30/33 within 1 frame. The rest are overlapping events and slow harmonica attacks.
6. Render (`--workers 2`, through a render limiter if your machine has one) → `mux.sh … 24 3`.

Files: `engine/silk.js` (print engine), `engine/scenes.js` (5 built-in scenes), `engine/poster.js` (template, banner, contrast), `film.js` (timeline and shots), `mix.py`, `music/compose.py`. Roughly 0.1 s per frame; a full render takes under a minute.

### Pitfalls we hit

- **Stroke-based edge effects draw internal lines on unioned paths.** A forest drawn as a union of pines showed every tree outline. Do sheen and trap with fills only: fill the shape, then fill it again shifted, inside a clip.
- **Screen shadow darkened the whole print.** The frame's drop shadow must be a ring (even-odd), not a full rectangle, or everything under the mesh looks muddy.
- **Blue shadow facets on granite read as water.** Keep shadow planes in `near` and put them on the inside faces next to the waterfall.
- **A thick squeegee across a close-up splits the frame into "two pictures".** Tilt the blade, hide most of the handle, and keep the geometry continuous across it.
- **Jagged-triangle ink beads read as paper edges.** The bead needs roundness: lit half, dark underside, highlight and strands.
- **Parallax alone reads as "the mountains are moving".** Show paper gaps and thickness shadows while layers are loose, and snap them to zero with a sound.
- **Night palettes hid the header and labels.** Choose text inks by contrast (`pickInk`), never by a fixed key.
- **Wet-sheen gradient stuck at the end of the pull** (condition `p < 1.02` stays true forever). Fade it out by time.
- **Tree-wipe covered the frame for 0.4 s** (a dark blank). Centre the silhouette on the switch time so full cover lasts about 1 frame.
- Four trails at these reading times run to about 45 s. See "Four trails in 40 s" below for how to compress.
- **A 7:1 title banner is a sliver in a 16:9 frame** (about 1/5 of the height, lots of empty table). Make the banner about 4:1 so it can fill the width and about 40 % of the height.
- **Random coloured dots on the table read as confetti or placeholders.** Build a real workbench: planks, grain, knots, a few large muted ink stains and torn tape.
- **Close-ups on an info band must keep the whole band in frame** with ≥5 % side margins (z ≤ 1.75 for a 1000 u poster). Close-ups on a sheet being printed must keep the sheet's edge in frame, or the viewer sees only a flat colour.

## Engine reference

`engine/silk.js` prints **any shape** in this style: it only needs a `Path2D` in whatever units the current transform uses.

| Function | What it does |
|---|---|
| `makeTextures(paperHex, seed)` | paper, mottle and pinhole tiles (once) |
| `paperSheet(ctx, T, x, y, w, h)` | paper stock |
| `ink(ctx, part, o)` | one ink layer. `part = { path, knock?, paint? }` (`knock` = knocked-out holes, `paint(ctx)` = custom fill such as text). `o = { color, reg:[dx,dy], clip, sheen, trap }` |
| `wipeRegion(box, dir, p, seed)` / `wipeFront(...)` | the ragged squeegee front as a clip path, and where the blade is |
| `squeegee(ctx, a, b, lead, o)` | blade from `a` to `b` moving along `lead`; `o.beads=[{t0,t1,color}]` (split fountain), `roll`, `handle` 0–1, `scale` |
| `screenFrame(ctx, box, o)` | hinged screen with mesh, emulsion and tape; `lift` 0–1 |
| `inkFinish(ctx, T, x, y, w, h)` | mottle and pinholes over the sheet |
| `bandSteps(x, w, y0, y1, n)` | stepped colour bands (the gradient substitute) |
| `ridgeLine`, `polyPath`, `circlePath`, `ringPath` | shape helpers |

`engine/poster.js`: `buildPoster(content, trail, i, n)`, `drawPoster(ctx, P, { pal, T, prog, off, reg, sep, swap, items, … })`, `drawBanner`, `pickInk`. `engine/scenes.js`: `buildScene('lake'|'waterfall'|'ridge'|'forest'|'coast')` returns planes you can reorder or extend.

Minimal example: a warm-orange `#D97757` four-point spark with a cursor tail, printed in two inks and knocked out of a sky, then pulled in by the squeegee:
```js
import { makeTextures, paperSheet, ink, wipeRegion, wipeFront, squeegee, inkFinish, polyPath, rectPath, circlePath } from './engine/silk.js';
const T = makeTextures('#F2E8D2');
paperSheet(ctx, T, 0, 0, 800, 600);
const spark = polyPath([[400,180],[430,270],[520,300],[430,330],[400,420],[370,330],[280,300],[370,270]]);
const tail = rectPath(540, 285, 160, 30);
const p = 0.7;                                                    // 70 % of the pull done
const clip = wipeRegion([0, 0, 800, 600], 'right', p, 3);
ink(ctx, { path: rectPath(0, 0, 800, 600), knock: circlePath(400, 300, 150) }, { color: '#1C2A33', clip, sheen: 1 });   // sky with a knocked-out halo
ink(ctx, { path: spark }, { color: '#D97757', reg: [2, -1], clip, sheen: 1, trap: 1 });
ink(ctx, { path: tail }, { color: '#D97757', reg: [2, -1], clip, sheen: 1 });
const x = wipeFront([0, 0, 800, 600], 'right', p);
squeegee(ctx, [x + 10, -20], [x + 10, 620], [1, 0], { color: '#D97757', roll: x / 30 });
inkFinish(ctx, T, 0, 0, 800, 600);
```
Single-colour posters: keep one palette key (usually `sun`) as the only colour and set the other inks to tints of one hue. `pickInk` keeps the text legible.

## content.json fields

All text, data and colour come from `demo/content.json`; `film.js` has no copy in it.

| Field | Type | Range | If out of range |
|---|---|---|---|
| `park` | string | ≤ 22 chars | header is letter-spaced at 62 u; longer names overflow the sky width (shorten or reduce tracking) |
| `title` | string | ≤ 34 chars | auto-fits 132 → 60 u on the banner; under 60 u it gets too small to read |
| `footer` | string | ≤ 45 chars | one line in the banner strip; the wall hold grows with its reading time |
| `trails[]` | array | **1–4** | 1 = press only (no climb); 2 = press + climb; 3 = press, quick, climb; 4 = press, quick, quick, climb (about 45 s, see below). Above 4, the wall posters become too small to read |
| `trails[].name` | string | ≤ 22 chars | auto-fits 122 → 60 u |
| `trails[].difficulty` | `easy` \| `moderate` \| `hard` \| `expert` | — | unknown values show 1 filled triangle |
| `trails[].distance` | number | any | printed as `3.2 KM` (unit from `units.distance`) |
| `trails[].time` | string | ≤ 7 chars (`1 h`, `45 min`) | the column widens and all values shrink together (min 48 u) |
| `trails[].elevation` | number \| null | null hides the CLIMB column | shown in `sun` ink as `↑1,100 M` |
| `trails[].scene` | `lake` \| `waterfall` \| `ridge` \| `forest` \| `coast` | built in | unknown → `lake` |
| `trails[].time_of_day` | key into `palette` | `dawn`, `noon`, `golden`, `dusk`, `night` | missing → `noon`. The climb re-inks from the previous trail's palette through `golden` to this one |
| `palette.<time>` | `{sky1, sky2, far, mid, near, sun, glow?}` | hex | text contrast is checked automatically |
| `palette.paper`, `palette.wall`, `banner_time` | hex / object / key | — | — |

**Steps**: edit `content.json` → `sh demo/build.sh`. There is no TTS; the music and mix re-time themselves from `events.json`. To preview another file without overwriting: `node core/render/still.mjs styles/silkscreen-poster/demo 30 --q content=content_alt.json`.

**Four trails in 40 s**: the reading rule makes each middle poster about 6 s long. Options, in order of preference:
1. Print the two middle posters **side by side on one table in the same pulls** (one quick section, two bands, read together).
2. Drop the per-item stamp spacing from an eighth note to a sixteenth for middle posters.
3. Skip the band close-up on middle posters and let them be read on the final wall (extend the wall hold by 2 s).

`content_alt.json` (4 walks, dawn/golden/noon/night, a new park, wall and banner palette) is the tested example. Its stills are in `demo/stills/alt_*.jpg`.

Minimal content:
```json
{ "park": "Pine Lake", "title": "One Walk at Pine Lake", "footer": "Open dawn to dusk",
  "units": { "distance": "km", "elevation": "m" }, "banner_time": "dawn",
  "trails": [ { "name": "Shore Path", "difficulty": "easy", "distance": 2, "time": "40 min",
                "elevation": null, "scene": "lake", "time_of_day": "dawn" } ],
  "palette": { "paper": "#F2E8D2",
    "dawn": { "sky1": "#F6CD98", "sky2": "#EE9A73", "far": "#9A7FA8", "mid": "#3E7079", "near": "#1E3B3F", "sun": "#FBE6B4" } } }
```

Swapping this file and running `build.sh` checks that the engine re-flows; it is not how a user's film is made.
