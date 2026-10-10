# Copperplate Engraving — our demo

One example among many. Don't reuse its story, arc, shots, props or timings.

Demo: *The Honeybee, Plate VII* (40.0 s) · `engraving.mp4` · source in [`demo/`](demo/) · all words from [`demo/content.json`](demo/content.json)


## Story & structure

A scene demo, not a story: a **museum object label** for the screen next to a case. One object (the honeybee), its name, three things you did not know about it, and where to see the real one ("see the living hive in Gallery 4").

Structure (40 s): copper ECU → proof pulled → pull out to the plate → three magnified details (eye, hamuli, corbicula), each flying to its slot → silence → hand colouring → locked final plate → tissue-guard end card.

How the native moves served information in this demo:

- *The cut itself* was the hook: the first frame is the burin mid-stroke in copper, curl of copper rising ahead of the point. Nothing else is on screen, so the eye has one place to go.
- *The build* (outline → first hatching → cross-hatching → darks and hair) was the "this is a serious, made thing" beat, kept under 5 s and under the title.
- *The magnification roundel* was the information carrier: a ring is scribed around the part, the inside is burnished clean and re-engraved at magnification, and the roundel flies to its slot trailing a leader line. The viewer sees *where* the detail is and *what* it looks like in one move. Its label (roman capitals, italic term, script note) is engraved when it lands.
- *Hand colouring* was the climax, after a real silence and after all information is on the plate, so it read as reward, not as new information.
- *The final plate* was the poster: every label, the call to action and the engravers' credits at once, locked off.

The use-case table as first written for this demo, with the shot structure we had in mind for each (examples, not recipes):

| Use | Shot structure |
|---|---|
| Museum object label (the demo) | copper ECU → proof pulled → pull out to the plate → 1–4 magnified details, each flying to its slot → silence → hand colouring → locked final plate |
| "One minute on …" | same, with the narrator carrying the notes; end on the plate as the thumbnail |
| Textbook figure | no copper opening; start on paper at 1×, engrave the figure, then label parts with leaders one by one; no colour or colour only on the part being taught |
| Craft heritage (a watch, a violin, a knife) | ECU of the burin on the object's contour → build → roundels on the mechanism → colour only the material that matters (gold, varnish) |
| Map or site plan | engrave the coastline or plan, roundels become insets (a building, a harbour) |

## Shots

The camera is a loupe over the plate. Beat by beat in the demo:

| Beat | Camera | Why |
|---|---|---|
| Hook (0–2.5 s) | 4.2× on copper, **follows** the burin tip, 3° roll | one point of attention; the cut is the hook |
| Proof pulled (2.5–3.2) | locked while the sheet peels across | the medium's own transition |
| Build (3.2–6.2) | **pull out** 4× → 1×, log-zoom with screen-linear dolly feel | scale reveal: the curve was a bee's abdomen |
| Detail 1 (9.4–15.0) | **push** to 4.3× on the eye; **ride with the roundel** as it lifts off and flies to its slot, easing out to a 1.45× reading frame | the signature one-take: where → what → label |
| Detail 2 (15.0–19.4) | **tilt down** at 1.45× from the upper to the lower left, keeping detail 1's note in frame | faster, same grammar |
| Detail 3 (19.4–23.75) | **pull back** to the full plate while the roundel flies, then **push in** to read (after detail 2's note has had its time) | acceleration; reading time respected |
| Gather, silence, colour | full plate; a 2 % breathing push during colour | the colour moves, not the camera |
| Final plate | locked off | the poster |

Motion timings in this demo: the first line is one stroke followed by the camera, 5.4 s long, so at frame 0 it is already a third cut; strokes run 6–90 at once; roundels lift 30 px at mid-flight and grow to radius 120; colour regions bloom over 1.25–1.6 s each and start 0.42 s apart.

## Score structure

Three layers: room tone (a quiet workroom with a faint clock on copper; paper room after), foley keyed to picture events, and a baroque chamber score.

- **Score**: harpsichord + string quartet, 96 BPM, D major. `music/score.py` reads `events.json`: each detail section (A long / B tilt / C pull-back) is written once and placed where the film puts it; the outro shifts with the end of the details, so any number of details gets a matching score. Under narration the melody sits an octave up, out of the voice's band. Engraving sections are **all pizzicato** (the burin's small precise cuts), density growing pass by pass; each roundel = a high "ting" as the ring is scribed, a rising line as it flies, a low pizz as it lands. Before the colour: a run that stops dead, then **true silence** (1.25 s). The colour is the first time the strings use the bow. The final plate lands on a V–I cadence.
- **Silences**: 2.0–2.5 s (burin lifted, before the press thump and the downbeat) and 25.0–26.25 s (before the first drop of water).
- **Foley as built**: burin = band-passed hiss (2.6–9 kHz) with chatter clicks and a faint plate resonance (1.18/2.31/3.47 kHz); swarf = tiny 5–9 kHz pings; lift = metallic tick; press = low roller rumble (J-cut 0.35 s early) and a thump; peel = dense paper crackle; hatching = granular micro-scratches whose density rises with each pass; ring = circular scribe; burnish = soft rub; roundel flight = paper whoosh; landing = paper tap; letters = dotted ticks; notes = pen scratch at ~4 Hz strokes; colour = a falling water "plip" then a wet brush swish per region; end card = tissue rustle (J-cut).
- **Narrator**: Kokoro `bm_fable` (en-gb), speed 0.92, a gentle naturalist; music ducked to ~50 % under him (the bowed strings duck least).

## Palette & props

**The sheet**: 1920×1080 world units, laid paper `#f1e8d2`, world-space paper texture (fibres, laid lines, sparse foxing `#9a6a34`). Plate mark (the pressed, bevelled rectangle) at (70, 44)–(1850, 1036): plate tone `#e8ddc2` at 55 % inside; bevel dark on the top/left walls, light on bottom/right (light from the upper left). Ruled border: 2.4 px rule + 0.8 px hairline 9 px inside, (100, 72)–(1820, 1008).

**Ink**: `#1c1510`. World line widths at 1× zoom: outlines 1.8–2.4 (swelling ×0.45–1.35), first hatching 0.18–2.0, cross-hatching ×0.78, third family ×0.6, hair and stipple 0.6–0.9. Hatch spacing on a 600-px figure: 3.1–3.7 px (first), ×1.1 (cross), ×1.25 (third). Hatch thresholds on a 0–1 tone: first family from 0.14, crossing from 0.46–0.5, third from 0.74–0.78.

**Light**: `{x: −0.55, y: −0.62, z: 0.56}`.

**Lettering**: Bodoni Moda (title 50 px, tracking 0.16; labels 17 px, tracking 0.14), italics for Latin (20–24 px), Pinyon Script for notes (29 px). Subtitles: Pinyon Script 38 px, `#2b1e14`, on a deckled paper slip (`#f4eddb`, soft shadow) at the bottom centre, max width 860, up to two lines; on 0.1 s before the line, off 0.6 s after it; never over the call to action.

**Roundels**: radius 120, double rule (2 px + 0.75 px, 4 px inside), ruled ground of horizontal lines every 11 local units; content drawn for a 500-unit radius and scaled in. Slots in order: upper left (300, 300), lower left (300, 700), lower right (1620, 700), upper right (1620, 300). An unused slot shows the specimen at **natural size** (plate ≈ 20 cm wide, so a 13 mm bee is 0.19× the main figure).

**Leaders**: 0.95 px, from a dot on the part to the roundel's rim, routed around wings and body with ≥ 34 px clearance (one waypoint), a small italic figure number near the root.

**Hand colouring**: abdomen amber `#d9962a`, thorax ochre `#a8743e`, head `#8a6242`, eyes `#6e4a3c`, wings pale blue-grey `#a9c3cf` (alpha 0.5), legs `#7a5a3c`, pollen `#eaa21a` (alpha 0.95). Multiply over paper; 3.5 px spill, 2/1.5 px misregister, tide-line at the wet edge, low-frequency density lift (0.55), 1–2 backruns in large regions, granulation.

**The copper (opening only)**: base `#5e2a12 → #94502c → #4e220e`, a swirl of polishing hairlines (overlay), a soft studio window reflected across the plate (four panes, blurred 14 px, over a 90 px room glow), dark room toward the frame edges. Grooves: dark trough `#240c05`, a bright burr `rgba(255,226,186)` offset toward the light, a warm glint on the far wall. Burin: lit face `#d9e0e6`, shadow face `#262b30`, sharp ridge highlight, brass ferrule, mushroom-shaped wooden handle with grain; turned 0.22 rad (≤ 15°); swarf a thin, narrowing copper ribbon curling irregularly (turns open out as it grows, an occasional twist).

**Subjects**: the honeybee (`subjects/bee.js`) with three drawn magnifications — compound eye, hamuli (wing hooks), corbicula (pollen basket) — in `subjects/details.js`; a second built-in subject, the great scallop (`subjects/scallop.js`), used by `content_alt.json`.

## End card

The title is part of the plate (engraved, not a separate card). End card: a translucent tissue guard falls over the plate; on it, engraved: film title, style name, `LEMO-OPUSCAR`, `LemoLab × Claude Opus 5.5`, three credit lines. The "LemoLab × Claude Opus 5.5" sign-off belongs to this library's demo only; a user's film carries no LemoLab credit and no copy of this card.

## Build notes

```
sh styles/engraving/demo/build.sh              # voice → check → score → events → mix → cue check → srt → frames → mux → stills
```
- `demo/engine/`: `burin.js` (lines), `plate.js` (sheet, lettering, roundels), `wash.js` (colour), `copper.js` (copper, burin, swarf), `index.js` (public entry + `engraveShape`).
- `demo/subjects/`: `bee.js`, `details.js` (eye, hamuli, corbicula roundel drawings), `scallop.js` (second built-in subject).
- `demo/film.js`: timeline (96 BPM grid), camera, render; reads `content.json`. `demo/mix.py`: foley + voice + ducked stems. `demo/music/score.py`: the score (written by a composer sub-agent against the cue map in `demo/TREATMENT.md`). `demo/tools/cuecheck.py`: score accents vs picture events (all within 1 frame) and the silence level.
- Render with `core/render/video.mjs --workers 2`; frames take 60–500 ms (copper and colour frames are the slowest).

Pitfalls tied to this demo's props:

- **Wing veins must close their cells.** Random vein strokes look fake; define long veins as curves and snap cross-veins onto them (`bee.js`, `FX`).
- **Leg joints drawn as full capsules look like beads.** Exclude the previous segment so only the distal cap shows.
- **Two renders of the same demo folder collide**: `video.mjs` writes its segments to `<demo>/out/`, so render the main and alt films one after the other.
- **Burin skew**: 30° read as poking beside the line; 0.22 rad fixed it.
- **Leaders** hugging a wing read as crossing it until routed with ≥ 34 px clearance.
- "Apis mellifera": Kokoro says it acceptably but whisper can't transcribe it; the line uses the `asr` field.

## content.json fields

`demo/content.json` drives every word, number and colour.

| Field | Type | Range | If out of range |
|---|---|---|---|
| `title` | string | ≤ 22 characters | longer titles run past the latin line's width; shorten or drop to 44 px in `film.js` |
| `latin` | string | ≤ 30 characters | read time grows (chars/12 + 1 s must fit before the first push at 9.4 s) |
| `plate_no`, `series` | string | ≤ 10 / ≤ 48 characters | series collides with the title above ~48 characters |
| `subject` | `"bee"` \| `"scallop"` | built-in subjects | unknown → `bee`; a new subject is a module returning `{ink, regions, focus}` with an `ol0` first stroke (see `subjects/scallop.js`) |
| `details[]` | array of `{name, latin, note, focus}` | 1–4 | >4 are ignored; fewer leaves slots → the first empty one shows the natural-size figure; the timeline re-flows (first 9 beats, others 7 beats each) |
| `details[].focus` | string | bee: `eye`, `hamuli`, `corbicula` (drawn magnifications); any subject: its `focus` keys | a key with no drawn magnification gets a live magnification of the figure itself |
| `details[].note` | string | ≤ 60 characters (2 lines at 29 px) | a third line starts to meet the next roundel |
| `colors[]` | `{region, color}` | regions of the subject (bee: abdomen, thorax, head, eyes, wings, legs, pollen; scallop: shell, bands, ears) | unknown regions are skipped; order = order of colouring |
| `caption` | string | ≤ 50 characters | must stay readable ≥ chars/12 + 1 s inside the 4.4 s final plate |
| `signature.left/right` | string | short | — |
| `nat_size_label` | string | ≤ 16 characters | — |
| `voice.voice`, `voice.speed`, `voice.lines[]` | Kokoro voice, 0.8–1.0, `{id, text, asr?}` | ids: `title`, `d1`…`dN`, `close` | a line longer than its section overlaps the next one; keep d-lines ≤ 4.5 s |
| `end.film_title`, `end.style_name`, `end.credits[]` | strings | credits ≤ 3 lines of ≤ 35 characters | longer lines break the end card's reading time |

Steps: edit (or copy) the JSON → `sh styles/engraving/demo/build.sh my_content.json` (TTS + whisper check, events, score re-placed from the events, mix, cue check, subtitles, frames). To keep the main film untouched, `sh styles/engraving/demo/tools/build_alt.sh my_content.json` builds everything in `demo/out/alt/` instead (the demo's `content_alt.json`, 2 details, 35.6 s, passes the cue check).

Minimal example:

```json
{
  "title": "The Great Scallop", "latin": "Pecten maximus", "plate_no": "Pl. XII",
  "series": "Shore Gallery · Shells of the Atlantic Coast", "subject": "scallop",
  "details": [ { "name": "Hinge", "latin": "umbo", "note": "The oldest part of the shell.", "focus": "umbo" } ],
  "colors": [ { "region": "shell", "color": "#d98a5c" }, { "region": "bands", "color": "#a8423a" } ],
  "caption": "Hold a real shell at the Discovery Table",
  "voice": { "voice": "bm_fable", "speed": 0.92, "lines": [ { "id": "title", "text": "Plate twelve. The great scallop." } ] }
}
```

Swapping this file and running `build.sh` checks that the engine re-flows; it is not how a user's film is made.

## Engine reference

```js
import { B, engraveShape, Wash, drawSheet, engraveText } from './engine/index.js';

// 1. any shape + a light direction → an engraved figure (contour lines follow the form), cut in order
const { ink, shape: spark } = engraveShape(
  'M0 -120 C12 -40 40 -12 120 0 C40 12 12 40 0 120 C-12 40 -40 12 -120 0 C-40 -12 -12 -40 0 -120 Z',  // a four-pointed spark
  { at: B.xf(860, 560, 1.9), light: [-0.6, -0.7], spacing: 4.2, style: 'contour' });               // or style: 'hatch'
engraveShape('M0 0 H150 V26 H0 Z', { at: B.xf(1140, 740, 1), ink, g: 't' });                        // its cursor tail, same ink
ink.schedule(['ol', 'tol'], 0, 1.1, { conc: 2 }); ink.schedule(['h1', 'th1'], 0.8, 2.2, { conc: 40 });
ink.schedule(['h2', 'th2'], 1.6, 2.7, { conc: 40 }); ink.schedule(['h3', 'th3'], 2.2, 3.0, { conc: 40 }); ink.build();

// 2. the "only colour": hand-colour one element and leave everything else in black ink
const w = new Wash({ scale: 1.5 });
w.add({ path: spark.path, polys: spark.polys, color: '#D97757', origin: [860, 560], t0: 3.0, dur: 1.2, alpha: 0.85 });

window.render = t => {
  drawSheet(ctx);                 // paper, plate tone, plate mark
  w.draw(ctx, t);                 // colour under the ink (omit for pure black-and-white)
  ink.draw(ctx, t);               // everything cut by time t; lines being cut grow
  engraveText(ctx, 'THE SPARK.', 960, 170, { size: 50, weight: 600, track: 0.16, p: t - 1.5 });
};
```
Runnable as `demo/example/index.html` (`node core/render/still.mjs styles/engraving/demo/example 4.5`), output in `demo/stills/engine_example.jpg`.

Main functions:

| Function | What it does | Key parameters |
|---|---|---|
| `B.shape(d, xf)` | SVG path → world rings + Path2D | `xf(x, y, scale, rot, flip)` |
| `B.Ink` | ordered, width-bucketed stroke store | `group(name)`, `schedule(group, t0, t1, {conc})`, `instant(group)`, `draw(ctx, t, {color, wScale, dx, dy})` → tips being cut |
| `B.hatch(ink, polys, o)` | one family of swelling lines bent to the form | `angle, spacing, bend, tone(x,y), thr, wMin, wMax, swell, excl` |
| `B.engraveTone(ink, polys, o)` | the engraver's three passes | `angle, cross, third, t2, t3, g` |
| `B.formTone(polys, {light})` | any shape → pillow-lit tone field (+ `.df` distance) | `light, lz, base, radius, rim` |
| `B.contourHatch(ink, polys, o)` | lines following the form (iso-distance contours) | `spacing, tone, thr, wMax` |
| `B.outline / B.stroke` | swelling contour / open burin stroke | `w, light, vary, run, pinch, swell, excl` |
| `B.stipple`, `B.fur` | dots by tone; combed hair flicks | `density, r, tone` / `len, dir(x,y), curl` |
| `B.sphereTone`, `B.cylTone`, `B.linTone`, `B.blobTone` | analytic tone fields | light from `B.LIGHT` |
| `Wash` | hand colouring, cached per region | `add({path, polys, color, alpha, origin, t0, dur, spill, offset, lift, pool})`, `draw(ctx, t)` |
| `drawSheet`, `borderInk` | paper, plate tone, bevel; ruled border as ink | `plate: [x0, y0, x1, y1]` |
| `engraveText`, `writeScript`, `wrapLines` | cut roman lettering; written script; fixed-size balanced wrap | `size, weight, italic, track, align, p` |
| `roundelFrame` | double-ruled circle scribed by `p` | `x, y, r, p, w` |
| `Copper.drawCopper / copperLight / drawGrooves / drawBurin / drawSwarf` | the copper close-up | `zoom, lift, skew, s` |

A minimal runnable example of the whole thing is `demo/film.js` with `content_alt.json` (a different subject, two details).
