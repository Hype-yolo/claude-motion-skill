# Sci-fi Hologram HUD — Style Prompt

> An object is scanned into a glowing wireframe. Target boxes lock onto its parts; each opens in a local exploded view, a leader pulls out, and its number rolls from garbage glyphs into the real value. It may light up, once, into a solid hologram.
> References (grammar only): the *Iron Man* / *Avengers* HUDs (target boxes, callouts, rolling numbers, layered depth); the *Oblivion* interfaces (one colour, hairlines, space); CAD exploded views. Copy none of their layouts, icons, fonts or colours.

A **scene style**: it does a practical job (a spec walkthrough, a teardown, a loop screen) for any object with parts. See §11 for the jobs.

## 1. Essence, and what it is not

The subject is always a **line wireframe made of light** above a round projector pad on a near-black stage, never a rendered object. Everything reads as *scanned data*: a scan plane grows the model, parts pull apart along their assembly axes, numbers are *computed* on screen.

Three depth layers are always present: a **background dot grid** (slow parallax), the **subject** with its pad and floor, and the **foreground HUD** (corner brackets, rulers that parallax faster, status text).

Not a type-driven keynote (dark-keynote), not a drafting sheet (blueprint), not a product render (glass-product). The subject stays a wireframe; it may gain translucent faces once, and even then the lines stay on top.

## 2. Materials & rendering

- **Stage**: near-black tinted by the hue, a radial lift behind the subject, a fading dot grid, a strong vignette.
- **Projector pad** in true perspective: concentric rings (one bright, one dashed), ticks, faint rays; it rotates slowly and spins with any turntable move.
- **Wireframe**: additive ~1.3 px strokes in a few alpha levels set by **depth fog** (near bright, far ~25 %), plus two low-res glow passes.
- **Hot edges** (near-white of the hue) only for what matters now: the scan front, inner pieces flagged `hot` when opened, a light wave, a part being pinged.
- **Real CAD topology**: tubes are rings plus longitudinal lines. **Every part is physically connected**: a floating piece is noticed first.
- **Solid hologram**: faces filled with a screen-space **Fresnel** × a scrolling **interlace**; lines thicken as it ignites; a light wave climbs the model. A **beam** (one path, nonzero winding) with faint rays and dust.
- **HUD furniture**: corner brackets, parallaxing rulers, subject // mode top left, a live status line top right, telemetry at the bottom.
- **Text never sits on the wireframe**: every text block has its own **dark plate** (translucent near-black, 1 px border, corner ticks); the camera still keeps the subject clear of text.

## 3. Colour logic

- **One cold hue plus one warm accent**, both parameters (e.g. mint/orange, violet/lime, ice-blue/red; choose from the subject).
- The hue carries lines, HUD and fills. The **accent is spent on locked values only**: a number turns accent-coloured at the frame it becomes true. Nothing else ever uses it.
- White is heat: near-white edges and one-frame flashes mark what is active. Everything at rest sits in the hue's alpha levels.
- One object may keep its own colour (the single-colour exception, `keep`), for a brand mark, never for decoration.

## 4. Type & subtitles

- Rajdhani, all caps: Light for big numbers and the product name (wide tracking), Medium/SemiBold for labels. Share Tech Mono for micro data (coordinates, counters, zoom).
- Numbers are **monospaced** so rolls never jitter; the decimal point is a small square (a glowing "." reads as a comma).
- Subtitles are HUD: a dark plate with corner brackets and "voiceprint" bars moving with the speech, near-white Rajdhani Medium, bottom centre; in just before the voice, hold ≥ max(1.8 s, speech + 0.6 s).
- The title is part of the scene (no title card): the name rolls in like a value, then code, category and tagline.

## 5. Motion quality

- **Everything on ones at 24 fps.** Only glyph scrambling steps, every frame.
- **Target lock**: oversized, rotated 45°, faint; snaps to fit in ~0.2 s (cubic ease-out), flashes white 3 frames on the downbeat.
- **Explode** along each piece's assembly axis: the shell slides *along its own axis*, the contents stay in place and glow. Open over a beat or two, close fast.
- **Leader**: anchor ring → diagonal → horizontal to the card in ~0.5 s. **Rolling value**: characters lock right-to-left and turn accent on the downbeat with a one-frame flash.
- **Chip dock**: a finished value slides into a side rail and stays until the end.
- **The camera follows the box**: cubic ease, starting *before* the next lock, **real motion blur** only inside the whip (sub-frames, 180° shutter); HUD stays sharp.
- **No cuts or fades inside the scene**: only the scan plane (scanning in or erasing) and a loupe iris. A **glitch** of three frames at most once, on the biggest change.

## 6. Camera grammar

An orbit camera (yaw, pitch, distance, narrow fov) with a screen position for the target, so the subject can sit beside text. A vocabulary, not a route. Opening and ending come from the topic.

| Move | Expresses | Can serve |
|---|---|---|
| High 3/4, slow orbit craning down | Examination; a scan plane reads as an ellipse | a scan-in; a survey |
| Top-down plan view | Layout, order | a parts inventory; an assembly sequence |
| Eye-level profile, locked | The object as it stands in use | a height; a before/after |
| Push-in, then drift, 3/4 | This part matters; internals come towards the lens | the key spec; a flaw |
| Whip following the target box | Attention jumps to the next part | a list of parts |
| Orbit around a part's own axis | Axial structure only reads in rotation | rotors, stacks, hinges, lenses |
| Lateral dolly along a long part | Length, a path | a beam; a cable run |
| Pull back + loupe (frame in frame) | Where (wide) and what (loupe) | small parts; a sensor |
| Crane to eye level or back up | Status change: the object stands up or settles | a transformation; scale |
| Turntable 360° | Every side | a whole object; a symmetry |
| Nearly static, slow dolly | Reading time without a dead frame | a spec sheet; a checklist |

Framing: the subject is ≥ ⅓ of frame height at every key moment. Cards on one side, the chip rail on the other, subtitles bottom centre, a loupe above them: never colliding. Shorten explode vectors rather than fly a piece into text.

## 7. Sound palette

- **Music first**, on a grid (a bar = one information beat); locks land on downbeats, checked against the score.
- **Synth palette**: saw/square arpeggio with ping-pong delay (scooped 1–4 kHz for the voice), square pulse, 8th bass, synth hats and claps, detuned saw pads.
- **Density follows information.** Tools to pick from, in any order (most films need two or three): half-time for reading time; one beat of **true digital silence** (nothing, not even UI blips); a drop (808-style glide + wide saw chord) for the biggest change; a layer added or removed per part; deceleration by longer note values; a key change; a single sustained tone under a long hold.
- **Foley follows the material**: light = sines and FM blips **in the key**; machines = servo slides, pneumatic puffs, hydraulic hiss, metal tinks (J-cuts); a lock = thump + clack + two-tone beep; rolls tick at frame rate. Ambience: projector hum (40/80/120 Hz) and room tone.
- **Voice**: calm, confident. Duck music *and* foley with a **held** envelope (no pumping between words); lock transients escape. −14 LUFS.

## 8. Native moves

Each move serves information, not story. A menu: use the ones your film needs.

- **Scan growth = "this is real data."** *Fits content like:* a coffee machine; a satellite; an architectural model.
- **Target lock = "look here now."** The box is the camera. *Fits content like:* a car's sensors; a laptop's ports; a robot arm's joints.
- **Local explode = "why the number is true."** *Fits content like:* the burr set of a grinder; the layers of a running shoe sole; the elements of a camera lens.
- **Rolling digits = the payoff beat.** *Fits content like:* a brew temperature; a tolerance in microns; a price.
- **Chip accumulation = reading time.** *Fits content like:* 3–5 facts that must all be read.
- **Loupe = two scales at once.** *Fits content like:* a screw inside a watch; a chip on a board; a valve in an engine.
- **Solid hologram + beam = "the whole is ready."** Once, if at all. *Fits content like:* a launch reveal; a finished assembly; a v2 replacing v1.

## 9. Pitfalls of the medium

- Target boxes balloon → rest pose, skip `internal` pieces, long attachments `box:false`.
- Long diagonal leaders point at the wrong part → ring on the part body, flash the part.
- Two parallel boxes moving don't read as an explode → shell slides on its axis, contents stay and glow.
- A part built from generic boxes doesn't read as that part → give it its characteristic silhouette.
- Voice masked by foley, not music → duck foley too, hold the duck through word gaps.
- UI blips inside a silence break it → check cues against silence windows.
- A whip written inside the next segment plays as a hard cut → start it in the previous one.

## 10. Engine

`demo/engine/holo.js` (wireframe engine: projection, scan, explode, Fresnel faces, glow, pad, scan plane, `normalizeModel`, `modelFromPath` to extrude any 2D path), `demo/engine/hud.js` (theme, plate, target box, leader, rolling text, spec card, chip, marker, beam, subtitle, chrome, glitch), `demo/models/mkmodel.mjs` (primitives: tube, ring, disc, box, wheel, cells…). Models are normalised on load, so cameras work for any object. API, model format and an example: [DEMO.md](DEMO.md#engine-reference).

## 11. Variation space

You decide the object, its model, which parts and in what order, the opening, the ending, the camera path, the colours, the pacing and the music. Use cases are **grammar for the order and duration of information**; build your own timeline from the user's facts.

| Use case | Information order | Hold per layer | Length |
|---|---|---|---|
| **Spec walkthrough** | Name + tagline → one spec per part (label, value, unit, detail) → weight / price → CTA | Title ≥ 5 s; value ≥ 2.5 s, then docked; final sheet ≥ 3 s | 30–40 s, 2–5 parts |
| **Loop screen** | Name → 3–5 specs → CTA, no voice; last frame = first | 3 s per spec, 5 s final | 20–30 s loop |
| **Teardown** | Part → what it does → one number; internals only when opened | 4–6 s per part | 40–60 s |
| **Upgrade** | Part → old value (dim) → new value (accent); old part scan-erased, new one scanned in | 3 s per upgrade | 20–30 s |
| **Assembly order** | Step number → part name; parts snap home one by one | one bar per part | 20–40 s |

All far from our demo:

- Structures: **a loop screen** that never names a product and cycles five sensors; **a teardown** one layer deeper per shot until the core is a single hot piece; **an upgrade** where two versions share the pad and every number rolls from old to new.
- Openings: **a part first** (one component locked in close-up; the rest scans out from it); **a flat outline** (a 2D silhouette extrudes into the wireframe, `modelFromPath`); **plan view** (top-down, the pad as a dial, the object arriving as its footprint).
- Endings: **one value at eye level** (the wireframe dims around the single number that matters); **knolling** (parts fly into a labelled top-down layout); **power-down** (edges cool, HUD panels switch off until only the pad glows).

Swapping `demo/content.json` and rebuilding is a technical check that the engine re-flows, not a way to make a film.

---

How our demo was made (story, shots, score, end card, build, content fields): [DEMO.md](DEMO.md). Read it after your treatment exists.
