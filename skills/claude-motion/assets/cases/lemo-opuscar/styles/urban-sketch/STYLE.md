# Urban Sketch · Pen & Wash — Style Prompt

> A sketchbook page drawn on location: fine sepia fineliner lines that wobble, overshoot and never quite close, with loose transparent watercolour dropped on top. The colour sits slightly off the lines, spills over them, and dissolves into cream cold-press paper at the page edge.
> References (grammar only):
> - Urban-sketching sketchbook pages: line first, then wash; colour off-register; handwritten date and place in the corner; the page edge breaking up into dabs.
> - *Paperman* (2012): a monochrome world with one coloured object.
> - *The Red Balloon* (1956): an object as the protagonist, the camera following it across a city.
> - Jazz waltz (the Vince Guaraldi school): 3/4 swing, walking bass, brushes, a woodwind lead.
>
> Nothing is copied from these: no characters, melodies, layouts or type.

## 1. Essence, and what it is not

Reportage drawing, made on location in a few minutes. Two layers that stay visibly separate:

1. **Ink.** One thin, near-constant line (a 0.3–0.5 mm fineliner) in dark sepia. It wobbles slightly, overshoots corners by a few pixels, breaks mid-stroke, and suggests rather than describes: a few window marks instead of a grid, scalloped fragments instead of a whole tree outline.
2. **Wash.** Transparent watercolour glazed on top, **misregistered** by 1–3 px from the line, sometimes spilling past it, leaving paper white for highlights and figures (reserves). Dried edges are darker (pigment pools at the rim), and pigment granulates into the paper tooth.

**The page is part of the image**: warm cream cold-press paper with large-scale mottling and fine tooth. Nothing is painted edge to edge; the painting frays into leaf-sized dabs and white holes, leaving margins for handwriting.

Not Watercolor Brush (no line-free wet-in-wet painting, no painterly edges without ink), not Whiteboard (no marker, no explainer diagrams), not Chinese Ink Wash (no brush calligraphy, no monochrome ink tones). Line and wash, both, always.

## 2. Materials & rendering

- **Paper**: two octaves of fbm mottling (a few %), a tooth tile multiplied over everything, figures included.
- **Ink**: ~96 % coverage; world line width thinner far, thicker near (e.g. 1.3–3.4 px); wobble ~1 px; overshoot 3–8 px; a third to half of long strokes get one small gap. Strokes are baked with their **draw time per pixel**, so the shader plays back stroke order.
- **Wash**: 2–3 rough-edged layers, multiply, alpha ~0.4–0.65, offset from the line by about one line width, a dried edge at 30–40 %; granulation = pigment × (0.82 + 0.36 · fbm).
- **Colour arrival field**: every pixel has a time at which colour reaches it. The wash is revealed through it with a ragged wet front (darkened band just behind the front) and noisy edges. Figures bloom from a point with a noisy circular clip.
- **Foliage**: pale base wash, then light and shadow masses, then small leaf dabs coloured by light direction, holes at the rim, scalloped ink only on the outline.
- **Sky**: a few big soft washes at low alpha, fading upward; clouds are reserves with a tinted belly.
- **Buildings**: local colour; shadow side mixed ~45 % with a cool violet-grey; distant blocks mixed ~50 % with a haze colour.
- **Figures**: a 3D skeleton in orthographic projection; torso from cross-sections; limbs as organic tapered tubes; hair and head as one mass; face left blank (one nose tick in profile); shadow side mixed with violet.
- **Page edge**: a noisy boundary, a white-dab band inside, a coloured-dab spray outside.
- Deterministic: same seed, same marks.

## 3. Colour logic

- **Ink is one colour** (dark sepia or warm black); it never changes.
- **Wash is local colour, lightly**: few pigments, mixed on the page; shadows are the local colour mixed toward one shared cool violet; distance mixes toward one haze.
- **Paper white is the brightest value**; it is reserved, never painted.
- **Colour can be withheld**: a page may be ink-only with colour as an event (one tinted object, colour arriving with a cause).
- Example palettes: park in summer (lawn `#c3c96f`, leaves `#7fa04a`, sky `#9fbcd6`, limestone `#d8c6a0`); harbour morning (sea `#7fa6b8`, hulls `#c9573f`, rope `#c8a86b`, sky `#bcd0dc`); winter market (roofs `#8b93a6`, lights `#e2b04a`, awnings `#b8483e`, snow = paper).

## 4. Type & subtitles

- **All text is handwriting on the page**, written on left to right with pen sound, and moves with the camera: a corner note (e.g. Reenie Beanie: day, time, weather, place), titles and colophon in a casual hand (e.g. Caveat 500–600), left-aligned in the blank margin.
- **Subtitles**, if there is a voice: handwritten lines in the page margin or a caption strip written into the lower margin, never a generic overlay box. Hold ≥ max(1.8 s, speech + 0.6 s).
- The style works well without any voice.

## 5. Motion quality

- **Figures boil at 12 fps** (line wobble and wash seeds change every 1/12 s). The static page does not boil (it is a real page); the camera moves every frame, smoothly.
- **Performance**: anticipation, action, follow-through; footsteps on the beat.
- **Invisible forces are drawn**: wind as ink curls that draw on and erase from the tail, trailing dabs; sound as ink lines; heat as wavy strokes.
- **Colour never snaps**: it blooms from a point or arrives through the field.
- Stroke-order draw-on for anything that "appears".

## 6. Camera grammar

A 2D camera over a large page (e.g. 5120 × 2880). Designed moves use cubic easing; follow shots use a critically damped spring on a lead-ahead target, so the camera lags like a hand-held follow. A vocabulary, not a route. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Push-in | attention; a detail observed | a face; a sign; a small event |
| Lateral follow on a spring | travel, pursuit | an object carried; a walker; a vehicle |
| Crane up | a new level, a view opening | a skyline; a tree; a balcony |
| Whip-tilt with slight roll | sudden change of direction | a fall; a gust; a surprise |
| Punch-in with a short shake | impact | a catch; a collision; a door slam |
| Pull back to the whole page | scale; the sketch as an object | a summary; a place in full |
| Tilt into the margin | from picture to words | notes; a date; a title |
| Slow pan across a line-only area | the world before colour | a quiet start; memory |
| Hold while the pen draws | the act of noticing | a subject being drawn |
| Page turn to a new spread | another time or place | a travel diary; a sequence of days |

Framing: subjects ≥ ⅓ of frame height at story beats; a small key object gets a faint paper halo (reserve) so it reads over busy foliage. Transitions: camera travel on the page, page turns, or colour arriving; no dissolves.

## 7. Sound palette

- **Ambience from the place**: paper room tone first, then the location once it has colour (birds, traffic, harbour gulls, market chatter). J-cut a place's sound a bar before we see it.
- **Pen on cold-press paper**: band-passed noise (~1.6–7.5 kHz) with a fibre texture and grain clicks, one burst per real stroke; thousands overlap into a hiss during a fast sketch; brighter short strokes read like a hi-hat.
- **Water and brush**: a wet brush "shhh" for blooms, a jar rinse, a drip.
- **Foley follows objects** at sketch scale: fabric or paper flapping for things in the wind (rate and level from speed, pan from screen x), steps on the beat, bells, splashes.
- **Music families**: a jazz waltz (walking bass in three, brushes, piano, clarinet or flute); a café accordion trio; solo nylon guitar; a string quartet pizzicato; a brass band for crowds. One colour instrument per area of the page works well.
- **Silence as a tool**: a bar of true silence (ambience included) at the height of suspense; the first sound after it is the next gesture.
- **Mix**: music ducks under key hits; foley high-passed ~90 Hz; −14 LUFS, moderate LRA.

## 8. Native moves

A menu: use the ones your story needs.

- **Line before colour.** The pen draws a subject in real stroke order, then the wash drops in; the drawing is the spectacle. *Fits content like:* a cathedral façade; a chef plating a dish; a street musician.
- **Colour as arrival.** Wash spreads from a source with a wet front, so an event paints the page; figures stay frozen line drawings until colour touches them. *Fits content like:* a sunrise over a harbour; a parade moving down a street; the lights of a market switching on.
- **The one coloured thing.** A colourless sketch with a single tinted object that becomes the protagonist. *Fits content like:* a red umbrella in the rain; a yellow taxi; a child's kite.
- **The page as frame.** Pull back until the whole page shows, edges dissolving, handwritten notes in the margin. *Fits content like:* a travel diary entry; a neighbourhood portrait; a day in a place.
- **Carrot people.** Distant crowds as one wash blob, two leg lines and a head dot. *Fits content like:* a station at rush hour; a stadium; a beach.

## 9. Pitfalls of the medium

- **Straight edges in the colour field** from clipping by a bounding box → clip by the actual noisy distance.
- **Rectangular masks around complex silhouettes** leave notches → mask with the real stepped silhouette.
- **Characters losing colour** when they move into unpainted areas → sample arrival once (or tie it to the event), never at the current position.
- **Static ink can't be occluded by later washes** → erase far ink inside nearer shapes before drawing; use carrot people for far crowds.
- **IK feet pinned while blending poses** splay the legs → blend foot targets toward under-hip.
- **Front-facing heads go bald** → draw the hair mass, then knock the face out of it.
- **Big canvases in headless Chrome**: pack ink and time into RGBA byte textures yourself and upload the arrival field as a filterable float texture (`R16F`).
- **Painting edge to edge** kills the sketchbook feel → leave margins and fray the edge.

## 10. Engine

`demo/engine.js` (deterministic): `penStroke` + `drawPen` (fineliner with wobble, overshoot, gaps, draw-on), `rasterPen` (bakes stroke order into an ink + time layer), `wash`, `reserve`, `dab` / `foliage`, `arrivalField` (colour arrival per cell from sources), `compositor` (WebGL page: paper × wash revealed by arrival × ink revealed by stroke time), `figure` + `drawPrims` (sketched people), `sketchShape` (any shape in this style in one call), `handwrite`. `demo/poses.js` holds a pose library. API table and a minimal example that draws something new: [DEMO.md](DEMO.md#engine-reference).

## 11. Variation space

You decide the place, the subjects, what colour does (always there, withheld, arriving), the voice (or none), the music family, the camera path, the opening, the ending and the length.

All far from our demo:

- Structures: **a travel diary** of five pages, one per day, each page turned by the wind or a hand; **a single street corner** drawn at four times of day, the wash changing while the ink stays; **a recipe** where each ingredient is drawn from life at the market and the final dish is painted last.
- Openings: **the blank page** with only the handwritten date, then the first line of the horizon; **a close-up of a coffee cup** on the page's edge, pulling back to find the city drawn behind it; **rain dots** landing on the paper and blooming into the first washes.
- Endings: **the sketchbook closes** on the page; **the last figure walks off the page** into the blank margin; **the colour drains** back to ink as the evening comes, leaving one lit window.

---

How our demo was made (story, shots, score, end card, build): [DEMO.md](DEMO.md). Read it after your treatment exists.
