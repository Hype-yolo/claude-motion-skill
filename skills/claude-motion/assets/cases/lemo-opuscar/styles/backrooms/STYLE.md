# Liminal Found Footage — Style Prompt

> Camcorder tapes recovered from empty, endless, fluorescent-lit spaces. Rules instead of monsters.
> Genre reference (grammar only): "the Backrooms" internet folklore and new-weird / rule-horror; 1990s consumer camcorder footage. **Never** use the word "Backrooms", wiki "Level" numbers, community entity names, or any existing organisation or logo inside the film. Everything on screen (rules, forms, company voice, any presence) is original.

Suits films of 45–60 s.

## 1. Essence, and what it is not

- **One first-person camcorder recording** (1990s VHS, 4:3), handheld, continuous.
- **An empty, familiar-but-wrong interior** that repeats: an office, a hotel floor, a school, a mall, a parking level, a hospital wing. Humming fluorescent light, no people.
- **Dread from emptiness, repetition, bureaucratic rules, and the camera's own machinery failing at the wrong moment.** Nothing chases anyone. A chill on the back of the neck, not a jump.
- **The medium is the storyteller**: focus, exposure, tape damage and the on-screen display carry the plot.

Not a horror film (no monster close-ups, no gore, no jump scares, no score stings), not an ASCII/CRT terminal piece (the artefacts are tape and lens, not phosphor and scanlines), not a ruin (clean is part of the style).

## 2. Materials & rendering

- **Frame**: 4:3 pillarboxed in 1920×1080. Render 3D at low resolution (e.g. 720×540) and let the VHS pass upscale; low resolution hides CG cleanliness.
- **Space**: axis-aligned partitions on a grid with random gaps and stubs, pillars, a drop ceiling of tiles with recessed light panels at regular intervals. A hand-authored route through procedurally filled space, so every doorway shows more emptiness.
- **Lighting = thousands of lights, no shadows**: store every panel's colour and intensity in a float texture; each fragment sums the nearest panels (emitter cosine × Lambert / (d² + ε)) plus a bounce term. No occlusion: this light is flat. Per-light variation (a few % warm/cool/green), a few % dead, a few % flickering. Ambient occlusion darkens seams.
- **Fog follows local light**: fog colour × (local light / average). Where lights are dead the haze is dark, so a silhouette there reads as a *hole in the light*. Background = fog × ~0.15, so corridors dissolve into darkness, never a bright wall.
- **Restrained decay**: tide-marks at the foot of some walls, a discoloured band under the ceiling, rare peeling seams, a few yellowed or missing tiles, dead insects in diffusers. Percentages in single digits.
- **Printed matter**: office laser-print on yellowed paper, condensed sans headers, form numbers and revisions, numbered rules, a polite closing line from "Management". Pinned or taped.
- **VHS camcorder pass** (not a CRT): small line jitter (≤ 0.25 px low-frequency wobble), a head-switching band, tracking tears on demand, barrel + vignette on the image but **not** the OSD, luma blur + edge ringing, chroma smeared right, light smear, drifting white balance, AGC noise in darks, dropouts, lifted blacks, soft clip. Noise at tape rate (30 fps). No scanlines, no RGB mask.
- **OSD**: a hand-made bitmap font with a black outline: REC dot, battery, time and date. A camcorder title generator uses the same font, larger.

## 3. Colour logic

- **One dominant sickly hue** from the location's materials (mustard wallpaper, institutional green, hospital blue, beige laminate), with a darker trim and a mottled floor of the same family; ceiling and light panels near-white and slightly warm.
- **Exactly one saturated colour**: a signal such as a red alarm lamp, a green emergency sign, an amber warning light. It is the only thing that blooms (drive its emissive high enough to cross the bloom threshold).
- White balance drifts; colour is never graded clean.
- Example material palettes: wallpaper `#d5bd66`, trim `#4d3d26`, carpet `#8c763c`; pool tile `#9fc7c0`, grout `#e6ece6`, water `#5e8f96`; school corridor `#b9c49a`, lockers `#6f7f66`, linoleum `#a89a7d`.

## 4. Type & subtitles

- **Closed captions (CEA-608 style)**: a monospace (e.g. IBM Plex Mono 600) ~42 px, white on a solid black box per row, ≤ 32 characters, centred inside the 4:3 frame above the OSD. Untouched by tape noise (the TV decodes them). Hold ≥ max(1.8 s, speech + 0.6 s).
- **Speaker marks**: `[PA]` for announcements, italics for the operator, SDH descriptions in brackets (`[LIGHTS FLICKER]`, `[TAPE NOISE]`, `[SILENCE]`).
- **Rules on notices are not captioned**: they are the picture. Readable at 1080p, ≥ 3–4 s uncovered. For close-ups **lower the camera so the lens is parallel to the page**; pitching down at a vertical sheet shears words into fake italics.
- The **title** is camcorder title-generator text over the first shot.

## 5. Motion quality

- **One continuous handheld take.** Cuts happen only where the tape breaks: power-on roll-in, tracking tear, REC off.
- **Handheld** = walking gait (head bob a few cm, sway, small roll) + breathing (~0.27 Hz) + tremor noise at a few frequencies whose amplitude follows a **fear** curve. At a held breath, **freeze all of it**.
- **Looking down** shows only shoe toes and floor, never legs.
- **Autofocus** = focus distance animated with overshoot: blur → lock → slip → lock. Blur comes from pulling focus *near*. Zoom narrows the FOV and opens the aperture.
- **Lights flicker** as short blackouts (~0.1 s); auto-exposure catches up with a lag (~0.45 s) and gain noise pumps.
- Things move by themselves slowly (a door over >1 s, eased), never snap.

## 6. Camera grammar

A vocabulary, not a route. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Walking POV down a corridor | routine, the endless | establishing the space; time passing |
| Slow pan off a detail to the space | scale; the space goes on | a reveal; a first look |
| Glance down at the feet | obedience, avoidance | obeying a rule; not looking |
| Crouch and hold on printed text | reading; bureaucracy | a rule; a contradiction |
| Zoom + focus hunt into the distance | seeing / not seeing | a presence; a doubt |
| Identical framing after a tear, only the OSD changed | time removed | a jump; a loss |
| Turn a corner, hold still | a threshold | an exit; a choice |
| Slow push-in with no sound | the pull of something | a door; a sign |
| Backing away while filming | retreat, fear | leaving a room; a rule broken |
| Camera set down on a surface, static, recording alone | abandonment | the operator gone; a long wait |
| Whip toward a sound, then nothing | expectation denied | a noise with no source |

Framing: text readable and uncovered; any presence small, far, and in a region of dead lights. Transitions: tape events only.

## 7. Sound palette

- **No score.** Only what the tape would have recorded. Music exists only inside the world (hold music, a radio through walls, a tinny PA jingle), filtered and reverberant, possibly slowing with tape wow.
- **Fluorescent bed**: 120 Hz (or 100 Hz) + harmonics, a buzzy band-passed component, a faint ballast whine, bad-tube bursts; gated by the same light curve as the picture; closer in small rooms.
- **PA voice**: calm, corporate, through a ceiling speaker (band-pass ~300–3500 Hz, cone resonance, saturation, room reverb), dry enough to stay intelligible. A short original chime before announcements; after a time jump, chime and voice may drift flat.
- **Operator**: a few short, quiet lines with proximity bass and breath; breathing whose rate follows fear; a held breath and one long exhale.
- **Foley by material**: carpet steps (low thud + wet squelch) or hard-floor squeaks, cloth rustles, camcorder clack and motor, zoom servo, AF ticks, ballast tink on flickers, a stick-slip hinge, a drag overhead, a vending machine, a pipe.
- **Silence**: digital zero for a second or more (tails included), captioned `[SILENCE]`, is the strongest tool. A soft scare at most: everything restriking at once when sound returns.
- **Drone** options: a low brown-noise band with beating sines rising slowly; the room tone itself pitch-shifting; nothing.
- **Mix**: bed and in-world music ≈ −8 dB under voices. −14 LUFS; no added grain (the noise is in the picture).

## 8. Native moves

A menu: use the ones your story needs.

- **Autofocus / auto-exposure hunting.** Something is there only while focus is correct. *Fits content like:* a missing pet on a hotel floor; a figure in an empty stadium; a shape at the end of a hospital corridor.
- **Tape tracking damage.** A tear is a cut the universe made; same framing after, but the clock jumped, the battery drained, a light died. *Fits content like:* a night-watch log; a lost weekend in a mall; a house that ages between tapes.
- **The OSD is plot.** REC, battery, date and time code are evidence. *Fits content like:* an alibi; a countdown; a dated inspection.
- **Rules as text in frame.** Notices and PA announcements start ordinary, drift wrong, contradict each other, and finally address the viewer. *Fits content like:* a pool's safety rules; a school fire drill; a museum after hours.
- **Emptiness and repetition.** The same notice in a different place; the same room with one detail changed; a corridor into fog. *Fits content like:* a moving-day walkthrough; an airport at 4 a.m.; an office after layoffs.
- **The thing that is almost human.** A distant silhouette wrong by 15–40 % (small head, long neck, narrow high shoulders, long arms), drawn as organic curves on a billboard, moving slowly. *Fits content like:* a mannequin that is not; a night guard; a reflection that lags.

## 9. Pitfalls of the medium

- **A fully bright scene reads as a hospital corridor** → partitions with gaps; far areas fall dark.
- **Lights leak through walls** (no occlusion) → a dead zone needs every light within ~±5 m dead, and the space behind it dim.
- **Background shows as a bright rectangle** at a corridor's end → background = fog × ~0.15.
- **Uniform fog lifts silhouettes to grey** → fog follows local light.
- **Line wobble skews text; pitching down italicises it** → ≤ 0.25 px wobble; lower the camera.
- **Primitive-built figures read as toys**, primitive legs as tubes → organic silhouettes; show only shoe toes.
- **Pure red never blooms** at low emissive (low luminance) → drive it far higher.
- **Normalising a filtered signal by its pre-filter peak** blows up a bus → normalise the processed signal.
- **Heavy PA reverb destroys intelligibility** → ASR-check processed lines and the full mix.
- **Billboards stamp dark rectangles** in AO → exclude them.
- **Time-compressing a finished timeline** → keyframes in original time mapped through one warp function, including hard-coded times elsewhere.

## 10. Engine

`demo/world.js` (layout, light DataTexture, custom lighting and fog shaders, props), `demo/tex.js` (procedural wallpaper, carpet, ceiling, panels, notices, signs), `demo/vhs.js` (VHS camcorder ShaderPass), `demo/osd.js` (bitmap font, REC, battery, clock, title generator), `demo/subs.js` (608 captions), `demo/thing2d.js` (organic silhouette), `demo/story.js` (timeline, camera keyframes, focus / fear curves, time warp), `demo/main.js` (renderer, post chain GTAO + DOF + bloom → VHS, handheld rig). File map and build: [DEMO.md](DEMO.md#build-notes).

## 11. Variation space

You decide the location and its materials, the procedure or reason for filming, the rules, the route, the presence (or none), the signal colour, the opening, the ending and the length.

All far from our demo:

- Structures: **two tapes** (the same route filmed twice, a year apart; the second tape finds what changed); **a real-estate walkthrough** where every room is described cheerfully by the operator while the house keeps adding rooms; **a checklist read aloud** item by item, each item ticked on a clipboard in frame, until an item is not on the list.
- Openings: **mid-sentence** (the tape starts with the operator already talking, tracking still rolling in); **a test pattern** and a date slate before the camera is picked up; **the lens cap on**, sound only, until the cap comes off.
- Endings: **battery dies** (the icon blinks, the frame freezes on the dead cell); **the camera is set down** and keeps recording an empty room; **the tape loops** back to the first shot, now with the operator's shoes visible in it.

---

How our demo was made (story, shots, score, end card, build): [DEMO.md](DEMO.md). Read it after your treatment exists.
