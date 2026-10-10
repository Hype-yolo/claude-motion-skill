# Low-poly Isometric Island — Style Prompt

> A tiny faceted world seen through an orthographic isometric lens: everything is a geometric block, and everything that appears arrives with a bounce and a note.
> References (grammar only): *Townscaper* (building is the performance; every piece lands with a springy bounce and a sound; pieces sprout small details by themselves); *Monument Valley* (isometric geometry, soft pastel palettes, gradient skies, calm pacing, lots of empty space). Never copy their grids, buildings, characters, UI or typography, and never name them on screen.

## 1. Essence, and what it is not

A miniature world built from **flat-shaded low-poly geometry** (hexagonal tile columns, box buildings with prism roofs, cone and icosahedron trees) floating in a faceted sea or void, watched by an **orthographic camera** at an isometric angle. No perspective and no horizon: distance dissolves into a **screen-space sky gradient**, so the world looks like a model suspended in colour. **Light, not texture, tells time**: every facet changes colour as the sun moves; in the dark only emissive blocks keep their colour.

Not a voxel game (no cubes-of-cubes, no pixel texture), not a tilt-shift photograph of a real place (no perspective, no photo detail), not a smooth-shaded 3D cartoon (no rounded normals, no subsurface).

## 2. Materials & rendering

- **Geometry** (world unit = one hex tile's circumradius): pointy-top hexagonal columns (`CylinderGeometry(r, r, h, 6)`), axial → world `x = √3(q + r/2)`, `z = 1.5 r`. Terrain height encodes material (sand low, grass, hills, rock highest). A thin separate top cap sits over a darker side colour; **sink the side column's top below the cap** or it z-fights. Leave a small gap between tiles so AO draws the seams.
- **Props** are primitive assemblies: boxes, prisms, low-segment cylinders and cones, icosahedra at detail 0, pinched boxes. Emissive parts (windows, lamps) get their own material per object so they can light individually.
- **Materials**: `MeshStandardMaterial({ flatShading: true, roughness ≈ .9 })`, **no textures**. Jitter each tile's lightness a few percent so the ground isn't a spreadsheet.
- **Water** (if any): a dense non-indexed plane displaced by summed sines in the shader, flat-shaded so each triangle glints on its own (not too low a roughness or facets flash white); a coarse plane below for zoom-outs; a **shallow map** redrawn per frame where land exists, mixing deep → shallow colour with a faint foam rim; a thin transparent ring at each tile's water line for surf.
- **Sky without a horizon**: in post, linearise the orthographic depth and blend distant pixels into a vertical screen gradient; set haze start/end as fractions of frustum height × cot(elevation) so the horizon band stays in the top third at any zoom. Stars (hash grid, twinkle) only where haze is thick.
- **Post**: MSAA + depth → **GTAO** (mandatory: it draws the seams between tiles and under roofs) → sky/haze composite → a very light tilt-shift at the frame edges → bloom (stronger at night) → pastel grade → Neutral tone mapping. Supersample 2×.
- **Light beams** (searchlight, projector, torch): a camera-facing ribbon with a Gaussian profile, bright at the root and fading with distance, plus a wider faint halo copy; light the surface under it in its own shader.

## 3. Colour logic

- **Pastel, low contrast, a handful of hues**: one ground family (sand/grass/earth or its equivalent), one neutral rock, and a small set of wall and roof colours repeated across buildings.
- **Time of day is a keyframed set of colours** (zenith, horizon, deep, shallow, sun colour, intensity, elevation, azimuth), interpolated. Day is airy and cool; dusk warms the horizon; night desaturates everything toward blue-violet.
- **At night, warm emissives are the only bright things** (windows, lamps, a beam). Keep the sun sideways to the camera in key shots (low sun behind the target turns faceted water into glare); water receives no shadows.
- No outlines, no black; shadows and AO are the only darks.

Examples of world palettes: sand, grass and coral roofs under a pale-blue day; snow tiles, pine greens and red cabins under a lilac sky; terracotta mesas, sage scrub and turquoise pools under an apricot dusk.

## 4. Type & subtitles

- Geometric OFL sans faces: a rounded one for subtitles (e.g. Quicksand 600), a geometric caps face with wide tracking for titles (e.g. Josefin Sans).
- **Subtitles**: no box; warm white with a soft dark-blue drop shadow, centred low; a small flat-shaded tile icon beside them whose top colour follows the time of day. Hold ≥ max(1.8 s, speech + 0.6 s), never overlapping the next line or a title.
- **Titles behave like tiles**: letters rise one by one from under a water line, overshoot and settle.
- A text card over the world leaves a gap where the world stays visible.

## 5. Motion quality

- On ones (24 fps), smooth. The charm is in the **arrival curves**, not stepping.
- **Rise from below**: a short cubic ease up, then a damped-sine overshoot; a splash ring and spray the moment it breaks the surface. The event time is when it settles.
- **Drop and stack** (floors, roofs, rings): a fast ease-in fall, a damped bounce, and volume-preserving squash-and-stretch on landing.
- **Pop** (trees, lamps, details): scale `1 − e^(−k s)·cos(ω s)`, about 25 % overshoot.
- **Life**: mills turn, smoke puffs, birds circle, boats bob with the same wave function as the water (evaluated on the CPU).
- **Schedule growth on the music grid**: at most one piece per smallest slot, so every event keeps its own note; accelerate by density (halves → quarters → eighths), not by tempo.
- Never moves: the projection (no perspective, no fov change).

## 6. Camera grammar

`THREE.OrthographicCamera`. **Frustum height is the zoom** (a few units for a close-up, the whole world at a dozen or more, hundreds for a scale reveal); place the camera ≥ 3 × frustum height away or the bottom of the frame looks under the sea. A vocabulary, not a route. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Turntable (azimuth sweep) | the thing seen from every side | building; inspecting; a product assembled |
| Pure orthographic zoom (frustum change) | scale without perspective | a detail in context; smallness; a world among worlds |
| Elevation change | low (≈20–25°) widens the sky band; high (≈50°) reads as a map | night and stars; a sweep across the whole world; a plan |
| Locked 3/4 wide | the world lives on its own | lights coming on; time-lapse; waiting |
| Tight close-up on one arrival | the bounce and the splash | a key piece; a milestone; a gag |
| Side angle trailing a mover | travel across the frame, never at the lens | a delivery; a departure; a route |
| Lateral truck along a row of tiles | a list, a sequence | steps of a process; a timeline |
| Time-lapse sun sweep, camera still | light is the time machine | a day; a season; history |

Intercut wide and close on beats: wide shows the shape growing, close sells the bounce. Transitions: hard cuts on the beat, a time-of-day change, a zoom through the sky; no dissolves, no perspective whip-pans.

## 7. Sound palette

- **Music can be event-driven**: growth events carry a note, and the score synthesizes each one at its exact time, so the picture writes the tune. Pitched percussion suits the facets: marimba, kalimba, woodblock, bells, vibraphone, celesta, steel drum; underneath, a soft pad, a gentle ostinato, light shaker or soft kick. Pentatonic or modal material keeps any order of notes consonant. **No piano, no strings.**
- **A single note can be a motif**: one sound owned by the world (a bell, a chime, a horn) that returns changed.
- **Foley follows material**, all synthesizable: bubble sweep + splash with droplet ticks for rising tiles (bigger = lower); wooden knock plus a quieter bounce knock for floors; ceramic clack for roofs; hollow plank knock; heavy stone thunk; glass tink; a low whump with electric hum for anything switching on.
- **Beds**: low-passed brown-noise water with swells, birds as downward-gliding FM chirps, creaking wood, crickets or wind at night.
- **Silence**: drop to a low drone and a bed; a moment of digital zero on the music bus before a big downbeat. Options: thin the ostinato to one voice instead of stopping it; let the world's own events carry the rhythm for a passage.
- **Voice**: clear and gentle, few short lines; avoid words that collide with the film's subject (a film about notes: "sea" heard as "C").
- **Mix**: voice compressed and well above the music, music ducked under it, −14 LUFS; **grain 0** (flat colour shimmers with grain).

## 8. Native moves

A menu: use the ones your story needs.

- **Building is composing**: every piece that lands plays a note; a later sweep can replay them in spatial order as a finished melody. *Fits content like:* a skyline whose floors are notes; a team assembling a product; a garden whose flowers form a chord.
- **Procedural growth**: tiles rise, floors stack, trees pop. *Fits content like:* a startup's first year; a coral reef recovering; a neighbourhood being planned.
- **Scale by pure zoom**: one object fills the frame, then the world becomes a speck (or the reverse). *Fits content like:* one user among millions; a village on a continent; a data centre inside a network.
- **Turntable**: a continuous rotation around the thing being made. *Fits content like:* a machine being assembled; a museum object; a house renovation.
- **Light as clock**: shadows sweep and facets re-colour. *Fits content like:* a day of a shop; a year of a farm; a shift at a hospital.
- **Emissive blocks in the dark**: lights coming on one by one, a beam sweeping like a clock hand. *Fits content like:* a network going live; a town at nightfall; volunteers joining a cause.

## 9. Pitfalls of the medium

- `perspectiveDepthToViewZ` in shared post code is wrong for an orthographic camera → `orthographicDepthToViewZ`.
- GTAO renders sprites and transparent objects as solid quads → hide them during the AO pass; set `visible = false` at zero opacity.
- Side column and top cap sharing one plane → z-fighting → sink the column.
- A double-sided additive cone reads as two white lines → a camera-facing Gaussian ribbon + halo.
- Camera too close for its frustum → the frame bottom shows below the sea → distance ≥ 3 × frustum height.
- Two pieces landing in one grid slot muddy the melody → one piece per slot.
- `half` is a reserved word in GLSL.

## 10. Engine

In `demo/` (three.js): `world.js` (hex layout, primitive props, growth schedule → events with notes, arrival curves), `sea.js` (faceted wave shader, shallow map, beam-lit water), `post.js` (ortho post: GTAO → sky/haze + stars → tilt-shift → bloom → grade), `story.js` (beat grid, time-of-day keyframes, shots), `main.js` (renderer, lights, per-shot cameras, HUD, event export), `music/score.py` (event-driven score; `music/check.py` compares audio onsets and pitches with the events), `mix.py` (foley, beds, ducking). File map and build steps: DEMO.md.

## 11. Variation space

You decide the world (island, town, orchard, factory floor, planet), what grows or changes, the palette within the colour logic, the opening, the ending, the camera path and the pacing. All far from our demo:

- Structures: **erosion** (a finished world loses pieces one by one, each removal a falling note, until only the essential piece remains); **two worlds** side by side trading pieces across a gap until they join; **a year in four seasons** on one fixed world, the palette keyframes carrying the story.
- Openings: **mid-construction** (a busy half-built world, many pieces already dropping); **from above** (a top-down map that tilts down into isometric); **the full world first**, then a push into one tile where the story lives.
- Endings: **a close-up on one final piece** landing, no pull-back; **the world packed away** (pieces fly up and stack into a box); **daylight** (dawn floods the world and the music resolves on the first sunlit facet).

---

How our demo was made (story, shots, score, end card, build): [DEMO.md](DEMO.md). Read it after your treatment exists.
