# Tilt-Shift Miniature — Style Prompt

> A real-looking place photographed from high above with a tilted lens and a time-lapse camera, so the whole world reads as a tabletop model.
> References (grammar only): Sam O'Hare's *The Sandpit* (2010) and tilt-shift time-lapse photography in general: high vantage points, the blur band, time-lapse rhythm, cloud shadows sweeping over streets. Copy none of its places or music; show no real landmarks, brands or logos.

## 1. Essence, and what it is not

A place seen from high up through a **tilt-shift lens**: only a thin horizontal strip of the frame is sharp, everything above and below melts into blur. The eye reads that as a macro shot of something small, so the world becomes a model. Two more things make the trick work: **saturated, sunny colour** (model-railway paint) and **time-lapse** (vehicles and people move in fast, jittery steps like wind-up toys).

Not a toy or clay render (the world is photoreal, only the lens and the clock make it small), not a game's top-down view (no UI, no clean flat shading), not drone footage (the band, the saturation and the stutter are mandatory).

## 2. Materials & rendering

- **Vantage**: always high. Oblique views at roughly 45–55° pitch from 100–200 m with a moderately long lens (~27–30° vertical FOV); straight top-down for the most "board game" look. Real tilt-shift is never shot from street level, except for a deliberate intimate moment: a true medium close-up at the actors' height, a blurred foreground object framing sharp actors who fill ~1/4–1/3 of the frame height (a long lens from high up keeps them as dots).
- **Blur band** (`demo/post.js`): physical depth of field mixed with a screen-space band. CoC in pixels = `mix(aper·(1/focus − 1/z), sign(dy)·amp·(max(0,|dy|−w)/0.5)^1.2, mix)`, clamped (~30 px). Put the band on the subject; when the subject moves, project it to screen every frame and slide the band there. Narrow the band for intimacy. Gather at output resolution after a 2× supersampled render, with many spiral taps and per-pixel rotation; far samples must not bleed onto nearer sharp ones.
- **Grade**: neutral tone mapping, strong saturation boost, soft added contrast, slightly warm highlights, a vignette. Lower saturation at night.
- **Light**: a hard sun with sharp shadows (a big shadow map fitted to each shot), a low hemisphere fill with warm ground bounce so shadows stay blue but not murky, a sky-gradient environment map for glass and paint. **Cheat the sun azimuth per shot**: each time-lapse clip is its own shot, so front-light the facades you see; one fixed sun leaves half a film backlit and grey.
- **Model-like detail** (what separates "filmed miniature" from "game CG"): facades with several window types, 1.6–3 m bays, dark reveals, world-space grime, sky-reflective glass and walls darkening toward the ground; roof clutter, awnings and signs; worn markings and stains; vehicles with dark glass, a soft contact shadow and brake lights; ambient occlusion over everything.
- **People** are small colour capsules, like model-railway figures. Actors seen up close get organic bodies with a soft sheen material and are made 20–30 % larger than real so they read.

## 3. Colour logic

- Saturated, sunny, "freshly painted model": a pale warm ground of buildings with a few candy accents, very saturated greens, dark ground surfaces so white markings and vehicles pop.
- Shadows stay blue and clean, never grey. Night and dawn are the only low-saturation states; dawn must read as early morning (a warm low fill from the sunrise side, few lit windows), not midnight.
- The subject you want found should be the one saturated thing in the sharp band, or move against the flow.
- Examples: a Mediterranean harbour (whitewash, cobalt shutters, terracotta, turquoise water); a snowy ski village (white, pine green, red gondolas, long blue shadows); a desert market (sand, saffron, indigo awnings, dusty olive).

## 4. Type & subtitles

- Subtitles belong to the world's own signage: a panel in the graphic language of the place's signs (road sign, platform board, harbour notice…), an open sign-revival font (Overpass, OFL, is a Highway-Gothic revival), sitting inside the lower blur band. Hold ≥ max(1.8 s, speech + 0.6 s).
- A **time-lapse clock** with a speed readout (e.g. `×24 TIME-LAPSE` / `×1 REAL TIME`, monospace) is the audience's speedometer for the native trick; use it whenever speed changes carry meaning.
- Titles live in the world: letters on a roof, a sign or a field, placed where nothing blocks them, lit or revealed on the beat.

## 5. Motion quality

- **Time-lapse stutter is the soul of the style.** In fast-forward the whole world (vehicles, people, lights, sun) updates at a low rate and holds each position for several frames (8 Hz = 3 frames at 24 fps); choose the rate so every jump lands on the musical grid. **The camera stays smooth on every frame.** Step at a middle rate while the speed is moderate; below about ×2 the stutter disappears and motion becomes silky, which makes a drop to real time hit hard.
- Systems run on simple simulations pre-computed per clip (car-following, signal cycles, crowds gathering and surging), with cycle offsets chosen so changes land on bar lines.
- Hero actors get art-directed timing (scripted paths fitted through beat times), never a hope that the sim hits a beat.
- Close-up acting: anticipation squash → stretch → land squash → settle; a failed attempt before success is the comedy engine.

## 6. Camera grammar

A vocabulary, not a route. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| High oblique wide, very slow slide | a whole system at a glance | setting a place; routine; many small actors |
| Band follows one subject across a wide | "this one" | a single commuter; a delivery; a lost child |
| Rack of the band from one subject to another | attention changing hands | cause and effect; a handover; a comparison |
| Slow push on an intersection, station or yard | a system heating up | rush hour; a festival setting up; a queue |
| Straight top-down, slowly rotating | the world as a board or machine | patterns; logistics; choreography |
| Continuous dive from high to actor height with a speed ramp | the one small thing that matters | a twist; a joke; a meeting |
| Band narrowing to a sliver | intimacy | a confession; a reunion; one decision |
| Vertical rise with logarithmic height | scale, letting go | aftermath; a summary; a system becoming a pattern |
| Lateral track along a line (rail, river, road) | a process in order | a supply chain; a parade; a race |
| Locked frame across hours | time as the actor | a construction; a market day; tide |

Framing: stay high; the sharp band carries the subject; vehicles and people stay tiny except in a close-up. Transitions: cuts on the beat, speed ramps, dives and rises; avoid dissolves that reveal the fake lens.

## 7. Sound palette

- **Ensemble**: tuned percussion carries the style (marimba, glockenspiel, vibraphone, woodblocks, kalimba, celesta), pulse-based and minimalist (Reich grammar: phasing, voices added one at a time, pulsing chords), plus plucked strings or a small reed section. Not generic piano and strings.
- **Techniques, as options**: world events gate the notes of a fixed phrase skeleton (vehicles crossing a line, lights changing, crowds moving each trigger an instrument), with a base fill rate so the phrase stays audible; tuned horns or bells voiced as chords; a tape-stop (varispeed down, voices dropping out) into silence when time slows; single notes for single events in a rest; phasing two identical lines apart; a music-box version of the theme for the smallest scale.
- **Sound follows speed**: in time-lapse, music first with a faint granular "sped-up world" hiss, clacks and relay clicks. At real speed the world turns suddenly real: idling engines, distant traffic, birds, small voices, footsteps. On release, engines rev and wind rises.
- **Silence** is the moment real time arrives: cut the music, keep one or two real sounds.
- **Voice**: relaxed, few short lines, music ducked ~8 dB. Verify every line with whisper; write numbers as words and put digits in the `asr` field. Master to −14 LUFS.

## 8. Native moves

A menu: use the ones your story needs.

- **The speed drop (×40 → ×1).** Time crashes to real speed on one detail. *Fits content like:* one worker finishing a shift; a child dropping an ice cream; a proposal on a crowded pier.
- **The band as pointer.** Slide or narrow the sharp strip to steer the eye. *Fits content like:* a courier through a market; a single wrong-way skier; one boat leaving port.
- **God's-eye system.** The place as a sequencer or machine. *Fits content like:* a port unloading ships; an airport's turnaround; a farm harvest.
- **Long-exposure light.** At dusk, lights leave trails that draw on the world. *Fits content like:* ferries crossing a bay; runners with headlamps; lanterns along a river.
- **The scale reveal.** Rise until the place becomes a pattern. *Fits content like:* a festival from setup to crowd; a school at recess; a city grid at night.
- **Cloud shadows sweeping.** Weather crossing the model. *Fits content like:* a season turning; a mood change; a news cycle.

## 9. Pitfalls of the medium

- Tall buildings plus shallow pitch hide the ground → low to mid-rise buildings, pitch 45°+.
- The subject hides in a canyon or behind a facade → route it on the camera side and let the band follow it.
- Instance caps silently drop actors → cull by distance from the camera (≈ 4× camera height) and raise the cap.
- Simulated vehicles stop short of lines (the jam gap) → subtract it where the story needs contact.
- Focus lags a frame → update actors before the camera.
- A top-down → oblique dive twists → rotate the top-down so its screen-up matches the target shot.
- A close-up from high up is too far → go low and close, small near plane for foreground objects.
- Clouds wash out a rise → unlit white, low opacity, nothing below the camera. Light pools read as bubbles → denser, larger, fainter pools.
- Scene backlit and grey → cheat the sun per shot. Dawn reads as midnight → warm low fill, fewer lit windows.

## 10. Engine

In `demo/`: `post.js` (tilt-shift DOF: band + physical, grade; `band.follow`), `city.js` (procedural town, facade shader, sign), `geo.js` (merged geometry), `sky.js` (clock → sun, sky, fog, env map), `traffic.js` (lanes, lights, IDM sim, fleet, trails, walkers), `train.js`, `ducks.js` (lathe-turned characters + hop choreography), `main.js` (cameras, stepping, crowds, HUD), `music/score.py` (sampled marimba, skeleton + event gating). A minimal new use: build a harbour from `geo.js` boxes, run boats as a one-lane `traffic.js` fleet on water, and point `band.follow` at one of them.

## 11. Variation space

You decide the place, the system, the tiny actor, the structure, the opening, the ending, the camera path, the speed curve and the palette within the colour logic. All far from our demo:

- Structures: **one day, dawn to night** (a single locked vantage, the sun and the shadows sweep, one shop's light the last to go out); **the relay** (the band hands attention from actor to actor across a whole place, each one passing something to the next); **before/after** (a construction site time-lapsed from empty lot to opening day, with one real-time moment per stage).
- Openings: **mid-bustle at full density** with the band already on one oddity; **a top-down pattern** that only slowly tilts into a place; **real time first**: one person at actor height, then the lens lifts and time speeds up.
- Endings: **a drop to real time that stays there** (no pull-back); **lights going out one by one** at night from high above; **the lens un-tilts**: the band widens to full sharpness and the model becomes a real place.

---

How our demo was made (story, shots, score, end card, build): [DEMO.md](DEMO.md). Read it after your treatment exists.
