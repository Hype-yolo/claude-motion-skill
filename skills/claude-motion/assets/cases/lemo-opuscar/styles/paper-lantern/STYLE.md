# Paper-cut Lightbox — Style Prompt

> A layered paper-cut shadow box (纸雕灯) lit from behind: 6–9 sheets of cut card stacked in a shallow box, a warm light glowing through the paper, windows and moons burning through holes, soft shadows falling from each layer onto the next. The frame is the box; the camera is a macro lens inside a lamp.
> References (grammar only): commercial paper-cut shadow-box lamps (纸雕灯 / "shadow box lightbox") for the layer stack and backlight; Lotte Reiniger's silhouette films for the cut-out, jointed figure language; Chinese 剪纸 motifs (auspicious clouds, eaves, mountains) as one possible vocabulary. Do not copy any specific lamp design, film frame or character.

## 1. Essence, and what it is not

Every shot is **one physical object**: a shallow box (a cavity about 0.56 × 0.33 m, 0.16 m deep) holding parallel sheets of cut paper. Everything on screen is one of three things:

1. **A paper layer**: a flat cut sheet, one flat colour, fibre grain, a thin warm **rim of light on its top edge** and a **dark band on its bottom edge**. Back layers lighter and cooler, the front almost black: that value ladder *is* the depth.
2. **Light through paper**: a warm, cloudy translucency (pulp mottling), strongest near the light source. Windows, lanterns, trails of light are **holes / emissive windows** that burn and bloom.
3. **Shadows**: a top spot casts **soft shadows** from every layer onto the layers behind. This sells "real paper in a real box"; never turn it off.

The film may step out of the box into the **real world** (the lit lamp on a table, spill light on nearby objects) to say "this is an object someone keeps"; whether, where and how often is a choice of the film.

Not flat paper-cut animation (here: depth, backlight, cast shadows), not shadow puppetry (no single screen, no rods), not a 3D diorama (every element is a flat sheet parallel to the box front).

## 2. Materials & rendering

- **Units in metres, y up.** Layers from z ≈ −0.14 (sky) to 0 (front); camera at z ≈ 0.3–0.56, fov ~26°. Full-bleed sheets are **never larger than the cavity**.
- **A layer** is a Canvas2D drawing in metre space mapped to a plane; cut-outs are `destination-out` holes. Finish on every sheet: fibre grain (`source-atop`), a warm top rim and a dark bottom shade, each shifted a few px.
- **Backlight shader**: `emissive += albedo × lightCol × trans × lit × falloff × (base + cloud)`, with a Gaussian falloff around a per-shot light point and a tiled pulp-mottle texture. `trans` per layer goes from ~.9 (far) to ~.05 (front).
- **Emissive windows**: a second canvas (white = light) gated by a 0→1 "switch on" uniform; bloom makes them burn. Titles, lights and curtains in front neither cast nor receive shadows.
- **Lens**: shallow depth of field, bloom, a gentle vignette; supersample 2× so cut edges stay crisp.
- **Real-world set** (when used): wood frame, black lining, a dark room, an area light as the box's spill onto real objects.

## 3. Colour logic

- **Back layers bright and translucent, front layers dark and opaque.** Each layer is one flat colour; the ladder of values from back to front is the depth. Never break it (a pale front layer flattens the box).
- **One temperature per stack**, chosen by the scene (cool night, warm interior, violet or green elsewhere). Changing ladder is how the film says "another place".
- **Light is warm** (amber to gold) against the stack, and it is the only saturated element besides one accent.
- **One accent colour** (a seal red, or a single object's colour) marks what the story is about. A second accent only when the story has two sides (one each).
- Examples of ladders: night village — `#0a1330` sky → `#6a86c2` far → `#3f5a92` mid → `#0e1532` front, windows `#ffb862`; desert caravan — `#f0c890` dusk sky → `#c07850` dunes → `#6a3020` → `#1e0e08`, fires `#ffd080`; winter forest — `#dfe6ee` → `#9aaec4` → `#4a6078` → `#101820`, one red scarf.

## 4. Type & subtitles

- **Text in the picture is paper**: titles, letters, poems and captions are cut strips inside the box, revealed by growing from an anchor edge (scale the texture repeat with the mesh so glyphs aren't squashed), with an optional small seal.
- Chinese: an OFL brush font (e.g. Ma Shan Zheng) for titles, a running script for handwriting, Noto Serif SC for subtitles. Latin: an OFL serif (e.g. Cormorant) at similar weight.
- **Subtitles** are a quiet burned-in line under the box (serif 500, ~40 px CJK / ~38 px Latin, warm off-white, soft shadow, ~74 px from the bottom), fading in just before the line. Split long lines at the comma nearest the middle (~21 CJK / ~42 Latin characters).
- **Words that appear as paper are not subtitled**: never show the same words twice.
- Hold ≥ max(1.8 s, speech + 0.6 s).

## 5. Motion quality

- **Everything moves like paper on a stick**: layers slide (x/y), rotate about a pivot, scale in from 0 along one axis ("written out"), or light up. No squash and stretch, no morphing, no bending.
- **Jointed figures**: a body sheet + separate limb sheets anchored at the joint; animate rotation only.
- **Light cues are the big motion**: the source, then each layer's translucency in a ~0.4 s stagger, then windows, then flicker (`1 + .06·sin(7.3t)·sin(3.1t)`).
- **Hard action lands on spoken words** (use whisper word timings): an object slams, a character flashes, a light arc grows on its word.
- Hand-held micro-drift on the camera (~0.6 mm) keeps a locked frame alive. Render on ones at 30 fps; never step.

## 6. Camera grammar

A vocabulary, not a route. The lens is small and the box is shallow: moves are short. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Slow dolly in, nearly frontal | intimacy; being drawn into a place | a memory; a detail that matters; a lit window |
| Slow dolly out | context; loneliness; scale | a figure alone; before/after; the whole place at once |
| Rack focus between layers | attention moving in depth | two people near and far; a clue behind; now and then |
| Lateral travel with depth parallax | journey; time passing | a road trip; a process in stages; a timeline |
| Top-down layer stack | a made thing seen as a craftsman sees it | a recipe; a letter; a map; a product being assembled |
| Pull out of / push into the box | the frame as object; "this is a story told" | a keepsake; a framing device; returning to the present |
| Locked frame with only light changing | waiting; the passage of a day or a night | a vigil; seasons; a city going to sleep |
| Tilt up/down the stack | climbing; falling; sky vs ground | a mountain; a well; hope and weight |
| Near-plane occluder wipe | a curtain between scenes | chapter changes; dreams; a secret revealed |

Framing: the story layer in focus, foreground and far layers soft; box edges fully out of frame inside, clearly in frame outside, never half. Transitions: dissolves (0.5–1.2 s), an iris, light off/on, a near-plane curtain whose halves meet exactly. No whip pans, no digital zooms.

## 7. Sound palette

- **Instruments** that sit like light behind paper: felt piano, music box, celesta, harp or plucked zithers, bamboo flutes, soft strings; a solo instrument of the topic's culture. No drum kit; percussion only as single soft strokes (woodblock, small gong, hand drum).
- **Foley is paper and light**: switch click + rising shimmer when a light turns on; paper rustle and slide; card-stock tap; lid thud; chimes on reveals; soft whoosh for curtains; beds from the scene (river, rails, city hum, crickets, snow wind).
- **Silence**: the lamp switched off — all sound but a room tone drops out, then returns with the light.
- **Mix character**: voice compressed and forward (RMS ~−18 dB), music underneath with ~5–6 dB of ducking under speech, foley low (−24…−34 dB), peak-limited, final at −14 LUFS.
- **Options**: a new instrument entering when the film changes place; one foley sound per light cue; a music hand-over solved backwards so a swell lands on the line that matters.
- **Voice**: warm, a storyteller at a table, not an announcer. Proof every line with whisper; for Chinese polyphonic characters feed TTS a homophone and keep the real text for subtitles.

## 8. Native moves

A menu: use the ones your story needs.

- **The lamp turns on.** Source, then far layers, then windows light up one by one. *Fits content like:* a shop opening at dawn; a startup's first customer; a stadium before a match.
- **Two windows, one light.** Two lit places sharing one light source (a moon, a lighthouse, a satellite). *Fits content like:* a long-distance friendship; two labs working on the same problem; a sister city pair.
- **Depth as distance.** A stack of ranges or streets makes "far away" visible; travel moves layers at speeds proportional to depth. *Fits content like:* a migration route; shipping a parcel; the history of a river.
- **Paper that writes itself.** A strip grows from its edge on the spoken word. *Fits content like:* a recipe; the terms of a treaty; a child's first word.
- **The box as keepsake.** The camera finds the real lamp in a room, real objects lit by its spill. *Fits content like:* a wedding anniversary; a product unboxing; a museum object's story.
- **Light burst from an opened thing.** A lid lifts and analytic glow spills out. *Fits content like:* a gift; a discovery; a new idea.
- **Silhouette in a window.** One jointed figure inside a lit frame. *Fits content like:* someone working late; a portrait of a craftsperson; a patient waiting.

## 9. Pitfalls of the medium

- `destination-out` cut-outs need an **opaque fillStyle** before punching, or the hole is half-cut (`props.js` `cut(x, fn)` does it).
- Soft shadows bleed and halo: layers that must not take part need **both** `shadow: false` and `recv: false`.
- A transparent radial-gradient texture shows a square edge as an additive glow → use an analytic shader falloff (`burst()`).
- A near-plane curtain whose halves don't meet at their **front edges** leaves a slit of the old shot.
- Sheets larger than the cavity poke through the frame in outside shots.
- **Grade state must not carry over** between shots: every grade key a shot omits must fall back to a default each frame, or renders depend on which frame a worker started on (visible pops at worker boundaries).
- Headless Chrome must run with GPU flags; SwiftShader is ~6× slower.

## 10. Engine

In `demo/src/`: `paper.js` (`sheet()` = one lit paper layer; `skyPanel`, `moon`, `text`, `burst`), `stage.js` (scene, top spot, `aim()` camera), `post.js` (DoF, bloom, transitions, grade), `room.js` (the real box and table), `art.js` / `people.js` / `props.js` (motifs, jointed figures, props), `lib.js`. `src/main.js` schedules shots, each `build(E) → { S, update(t), post(t), grade(t) }`. API table and a minimal shot: [DEMO.md](DEMO.md) "Engine reference".

## 11. Variation space

You decide the places, the figures (or none), the ladders, the light source, whether the real world appears, the opening, the ending and the camera path. All far from our demo:

- Structures: **one window, one year** (a locked lamp; the scene inside changes season by season, light the only transition); **a vertical stack** (the film tilts down through sky, city, street, underground, each a chapter); **a relay of objects** (a single object passes hand to hand across five small boxes, each a different ladder).
- Openings: **already lit, mid-scene** (a figure walking through a lit street; we learn it is paper only when the camera racks focus); **darkness and one hole** (a single pinprick of light widens into a moon, a door, an eye); **top-down** (hands' view of a sheet being cut; the cut sheet slides into the stack).
- Endings: **the lights go out one by one**, the last window last; **rack focus to the front layer** until the story blurs into warm light; **a new sheet slides in** at the front, starting the next story.

---

How our demo was made (story, shots, score, end card, build): [DEMO.md](DEMO.md). Read it after your treatment exists.
