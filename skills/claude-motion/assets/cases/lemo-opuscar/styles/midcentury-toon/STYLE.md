# Mid-century Cartoon — Style Prompt

> 1950s flat colour and limited animation for "follow along" films: colour printed a few pixels off its broken ink line, bodies that hold still while hands do the work, abstract colour-block rooms, a calm classroom narrator, and a cool-jazz combo.
> References (grammar only): UPA's early-1950s shorts (*Gerald McBoing-Boing*, *Rooty Toot Toot*): colour and line on separate cels, geometric people, colour-plane backgrounds, limited animation. 1950s classroom films (Coronet, Encyclopaedia Britannica): direct address, one sentence per picture, numbered cards. Charley Harper and Mary Blair: soft atomic-age complements, geometric figures. 1950s appliance manuals: numbered medallions, curved arrows, round call-outs, sunbursts. Copy none of their characters, drawings, lettering or music, and never name them in a film.

A **scene style**: it performs a real use (a set-up guide, a how-to, a recipe card, a safety card) rather than telling a story. The viewer should come away able to do the thing. See §11 for the jobs.

## 1. Essence, and what it is not

Flat, printed-looking colour with a thin, breathing ink line that never quite closes. **Every fill is a separate "cel" printed a few px off its line**, re-rolled on twos, so the picture shimmers like hand-registered paint while the camera glides. Light dry-brush tooth, paper grain, warm vignette.

People and things are geometric: egg or bean heads with the nose part of the face outline, simple garments in two or three flat colours, four-finger cartoon gloves. **A presenter's body is a held drawing: only arms, hands, eyes and mouth animate.** Rooms are not drawn: a scene is one colour plane, a floor band, a horizon line with gaps, and one or two props.

Not the 1930s rubber-hose cartoon (no black-and-white, no bouncing world, no hot jazz). Not a whiteboard explainer: it shows *how to do*, not *why*. The pictures are printed, not written on.

## 2. Materials & rendering

- **Off-register cels**: fill drawn with a small offset (a few px, down-right) from its line; the offset jitters ±1–2 px on twos. Keep it on everything, text included; switch it off only for a crisp diagram.
- **Line**: 3–5 px ink ribbons with ±40 % width breathing and 12–25 % breaks. Characters ~4 px, props 3–4.5 px, walls in plans thicker and broken. Hands: one outline around the union of palm and fingers, thin finger separations.
- **Shading**: one flat darker plane clipped inside a shape, never a gradient. Drop shadows are a copy of the shape offset down-right in a paper shade at ~50 %.
- **Ornaments**: 4-point atomic sparkles, 8–18-point starbursts, sunburst rays (~30 wedges, semi-transparent), boomerang and kidney shapes, polka dots.
- **Grain**: light; print, not film.

## 3. Colour logic

- **A warm paper ground, a warm near-black ink, soft atomic-age complements.** Nothing pure or neon.
- **One ground colour per scene**: a lighter tint for walls, a darker shade for floors. Never place the product on its own colour, never the presenter on their own accent.
- **The product keeps one colour through the whole film**; the accent (a presenter's garment, stars, bullets) is a different hue. Step grounds rotate through the rest.
- Examples: *coral / mustard / turquoise* on cream; *tomato / olive / powder blue* on oatmeal; *plum / lime / sand* on off-white.

## 4. Type & subtitles

- Roles: a 1950s script for a kicker (Oleo Script Bold); a slab serif (Alfa Slab One) for titles, numerals and headers, in ink over an offset colour plate; a geometric sans (Jost 500/600) for body, details, labels and captions.
- **Caption card**: a paper-coloured rounded slab with a thin ink border (its colour cel offset too), small turning stars at the ends, ~40 px sans, bottom-centre. Fades in quickly with a small rise. Hold ≥ max(1.8 s, speech + 0.6 s, chars/12 + 1 s).
- **Step header**: an ink disc with a paper numeral, a small letter-spaced "STEP n OF N", and the step title with a cream plate; it slides in on twos.
- **Detail tags**: a paper card with a star bullet, popping on the action beat next to the call-out. Data lands on the picture, never as a slide.

## 5. Motion quality

- **On twos:** poses, hand shapes and the cel jitter change at 12 fps. The camera, iris wipes, arrows, plan routes and rays move at 24 fps.
- **Held body, moving hands:** switch poses with a single in-between. A hand action has anticipation (pull back or lift), a fast action (0.15–0.25 s, eased out), a follow-through (recoil, settle, lift away) and lands exactly on a beat.
- **Pop-ins:** medallions, tags, labels and titles scale in with a back-ease (~0.25 s, strong overshoot).
- **Reaching the floor**: a kneel pose with 2-bone IK keeps the hands on the object while it moves; never stretch standing arms.
- **Lettering**: a script writes on left→right with a clip; headers slide in on twos.

## 6. Camera grammar

The camera is "the stand": never handheld. A vocabulary, not a route. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Slow push (a few %) | Collecting the eye | a product on its stage; a result settling |
| Iris through a medallion | The number *is* the door | a change of step; a change of rule |
| Round call-out with a leader line | Context and detail at once | a hand action; a screen; a small part |
| Tilt with a pointing finger | The finger leads the frame | the one action that matters most |
| Push into a device, pan along signal rings | Person → interface → device | pairing; connecting |
| Iris from a round object into a top view | Circle to circle, function to plan | a button starting a job; a lid opening; a dial |
| Pull-back with counter-rotation from a detail to a plan | One lane becomes a pattern | a route, a schedule, a garden, a floor plan |
| Colour-block wipe (side, bottom-up) | Turning the manual's page | a tip; a summary; a new card |
| Split frame in two colour blocks | Right vs wrong, before vs after | a safety rule; an upgrade |
| Dead still ≥ 3 s | "This is the frame to screenshot" | a summary; a CTA; a QR code |
| Iris-out onto one object | The last circle | a closing on the product, the logo, the result |

Key subjects ≥ 1/3 frame height and clear of the caption band. Transitions are circles, colour-block wipes and cuts on a beat; no dissolves.

## 7. Sound palette

Three layers, always:
- **Music**: an original West-Coast cool-jazz combo: flute or muted trumpet, vibraphone (chords, arpeggios, glissandi, tremolo), pizzicato walking bass, brushes (sticks on the ride for energy), celesta, bongos or finger snaps. Not ragtime, not a spy big band, not piano and strings. Options: give **every step its own vibraphone chord** and bring them back one per summary item; halve or double the feel instead of changing tempo; move up a step for a payoff.
- **Silence as a tool**: cut *everything*, ambience included, for the beat before the most important action, so the first sound after it (the click, the pour) is the step. Room tone alone before a summary.
- **Foley by material**: cardboard creaks and thumps, appliance plastic knocks and clicks, floor scrapes, glass and ceramic clinks, pours, damped rubber stamps for medallions, paper swishes for wipes, slide whistles for dimension arrows, rising pips for "connected", pen scratches for a route, an iris "shhk".
- **Ambience**: warm room tone (low-passed brown noise, very quiet), a mantel-clock tick on the grid; a device's motor hum can take over when it works.
- **Mix**: J/L cuts (lines start before their iris, tails ring on); narration compressed on top, music ducks ~8 dB, foley unducked, −14 LUFS.
- **Voice**: calm classroom authority, one clause per line ("Step one. Set it against a wall."). Whisper-check every line; accents can blur key nouns.

## 8. Native moves

Each move serves information. A menu: use the ones your film needs.

- **Off-register colour** makes an info card hand-made and warm. *Fits content like:* museum rules; a bank app screen; hotel check-in.
- **Limited animation points the eye**: the still body leaves the hand as the only mover, and the hand *is* the step (one hand action per step, on a beat). *Fits content like:* threading a sewing machine; changing a bike tyre; setting a thermostat.
- **The round call-out** is the close-up; the step's data lands inside or on it on the action beat. *Fits content like:* a dosage on a measuring cup; a torque value on a bolt; a PIN on a keypad.
- **The numbered medallion** marks hierarchy and opens the next step; it stamps onto the outgoing subject and the camera goes through it. *Fits content like:* a pool's five rules; a checklist for a flight; stages of a recycling sort.
- **The payoff turns function into ornament**: a real process (a route, a watering schedule, a seating plan) draws itself region by region and, seen whole, reads as an atomic-age textile. *Fits content like:* a sprinkler's coverage; a delivery round; a week of medication.

## 9. Pitfalls of the medium

- A route that ignores obstacles → follow the product's real rules; flow streamlines bend around obstacles and never cross. Lay it one region per beat, not all at once.
- A separate nose wedge looks glued on → one open spline from the bridge round the skull, closed at the nose tip.
- Thin arms read as sticks from the neck → shoulders at the torso corners, sleeves as a thick ink ribbon with a colour ribbon on top.
- Fat-blob fingers turn the hand into a cloud → stroke every part first, fill second (one union outline), slender fingers with separation lines.
- Zooming the world triples the ink → close-ups in call-out circles drawn at native scale.
- Detail text without reading time → move the data into the detail, the context into the title and the voice; chars/12 + 1 s.
- A transition drawing the next scene before its start → clamp local time to just past the start.

## 10. Engine

`demo/engine/toon.js` (the style: `setClock`, `shape` for any shape in the style, `ink` ribbons, `plane`, two-plate `text`, `fit`, the manual `arrow`, ornaments, the global register `REG`), `demo/engine/chars.js` (presenter, glove hands, the demo product), `demo/engine/icons.js` (18 icons). `demo/film.js` has liftable helpers: `callout()`, `medallionAt()`, `tag()`, `stepHeader()`, the flow-route generator `laneY()` + `buildPath()`, and the transition block (medallion iris, button iris, colour-block wipe, iris-out). API table and a minimal example: [DEMO.md](DEMO.md#engine-reference).

## 11. Variation space

You decide the thing, the presenter (or none), which steps and in what order, the opening, the ending, the camera path, the colours, the pacing and the music. Use cases are **grammar for the order and duration of information**; build your own timeline from the user's facts.

| Use case | Information order | Hold per layer | Length |
|---|---|---|---|
| **Product set-up guide** | product name → title → step title → step detail on the action beat → payoff → tip → CTA | title ≥ 4 s; step title the whole step; detail ≥ chars/12 + 1 s; summary ≥ 3 s clean | 30–40 s, 2–5 steps |
| **Safety / rules card** | rule number → rule → one "why"; a held figure, a medallion, a gesture, a pictogram per rule | 3–4 s per rule | 20–40 s, 3–6 rules |
| **Recipe or ritual card** | step → quantity/time → result; side view, call-out on the hands, result as a top-view pattern | 3–5 s per step | 30–45 s |
| **Onboarding for an app or service** | screen action → setting value → confirmation stamp; the screen lives in the call-out | 3–4 s per action | 20–30 s |
| **Store or event notice** | headline → time/place → CTA; colour-block wipes between cards | ≥ 3 s per card | 15–25 s |

All far from our demo:

- Structures: **a rules card with no product**, one held figure and a medallion per rule; **a recipe on a tabletop**, seen from the side, ending in a top view; **a do / don't split**, each rule shown twice in two colour blocks.
- Openings: **the finished result first**, then "here's how"; **the problem in one gesture** (a hand fumbling a cable); **a numbered list** stamped on, then opened item by item.
- Endings: **a checklist ticking itself**; **the hands at rest** beside the finished thing; **a QR code** held dead still in a starburst.

Swapping `demo/content.json` and rebuilding is a technical check that the engine re-flows, not a way to make a film.

---

How our demo was made (story, shots, score, end card, build, content fields): [DEMO.md](DEMO.md). Read it after your treatment exists.
