# Glass Product Render — Style Prompt

> Launch-film product rendering in transparent and frosted glass: a dark-field studio, strip-light sweeps, dispersion, caustics, light travelling inside the object, slow exploded views that snap shut on a downbeat.
> References (grammar only): premium launch films (a sweep drawing a contour in the dark, slow orbits, macro rack focus, cuts on the beat, ultra-thin wide type); transparent-hardware adverts (internals as ornament, exploded views, black and white plus one accent); dark-field glass photography. Copy none of their silhouettes, typefaces, sounds or colour templates, and never name them in the film.

## 1. Essence, and what it is not

A single hero object of **glass, metal and light** floating in an infinite black studio. Long strips *behind and beside* it turn clear glass into a thin white outline with rainbow edges; the internals show through as in a display case. Everything moves slowly and precisely; every cut, sweep and pulse lands on the beat.

The object is always **fictional**. Never reproduce a real product silhouette (a famous phone or headphone outline), a real brand name, logo, typeface or UI.

Not a white-cyclorama catalogue shot, not a wireframe HUD, not a keynote slide: material and light are the subject.

## 2. Materials & rendering

- **Studio = a strip-light scene, not an HDRI.** Photo-studio HDRIs contain windows and clutter that print as messy streaks on glass. Build a tiny black scene of emissive planes and bake it to PMREM **every frame** (`pmrem.fromScene(env, 0, 1, 1000)`, dispose the previous RT): tall side strips behind (silhouette), a wide far strip (horizon rim), a soft top box (volume for frosted glass and metal), a weak front card (off when concave glass faces camera), a top-front key only when parts must be read one by one, an accent card driven by the pulses, and **the sweep**: a tall strip on an arc *behind the camera* (azimuth = camera + π). Being real geometry, its highlight, refraction and dispersion move physically; never paint a 2D highlight.
- **Clear glass**: `MeshPhysicalMaterial`, transmission 1, roughness ≈ 0.015, IOR ≈ 1.5, thickness sets lensing (thicker = stronger), **dispersion on** (three r163+), near-neutral attenuation, `side: DoubleSide` so other glass sees its back faces.
- **Frosted glass**: transmission ~0.85, roughness ~0.4, milky tint, thick. On black it reads as dark grey plastic unless **something bright is behind or inside it**: an opaque emissive shape inside (blurred into a soft internal glow) and/or a bright gradient behind.
- **Metals** make transparency worth looking at: satin bands, chrome (roughness ≥ ~0.14), brushed surfaces via a roughness map, boards with gold traces. **Anything inside transmissive glass must be opaque** (only opaque objects reach the transmission buffer).
- **Light guides**: dark polished opaque acrylic, clearcoat, emissive **comet pulses** along a UV axis via `onBeforeCompile` (Gaussian head, exponential tail, white-hot core, hue drifting with age). Idle emission ≈ 0.
- **Background**: black with an optional dark-grey radial sweep that separates glass edges; the floor fades into it, **no horizon line**. **Floor**: black gloss, blurred mirror, radial fade, procedural caustics (lens ring with R/G/B radii offset, warped Voronoi filaments, rings spreading from events).
- **Post**: 2× supersampling; physical DoF (shallow macro, deep exploded views); bloom only above ~1.1; **Neutral tone mapping** (AgX washes accents to white); grain 0. Model in mm, near plane 1.

## 3. Colour logic

- The world is neutral: black, greys, the white of strip reflections, the metals' own tints.
- **One accent colour family, reserved for light** (emission, caustic rings, the dispersion line on UI), optionally drifting between two neighbouring hues with age or energy. Examples: ice blue → soft violet; amber → rose; green → cyan. Pick it from what the product does, never from a brand.
- Emitters that only illuminate (inside frosted glass) stay cool-white and dim.
- Dispersion rainbows are allowed only at thick glass edges and in the caustic, never as a gradient on surfaces or type.

## 4. Type & subtitles

- **Subtitles are a slab of frosted glass**: a centred rounded bar filled with the live frame blurred (`filter: blur() brightness()` on the WebGL canvas, `preserveDrawingBuffer: true`), a little cool white, a thin highlight stroke and an accent line on top. A licence-free grotesk (e.g. Inter Tight), light weight, ~36–44 px, near-white. Hold ≥ max(1.8 s, speech + 0.6 s).
- **Titles**: the same grotesk at an ultra-thin weight (200), very large (100–140 px) with very wide tracking, centred in the upper third; a diagonal glint sweeps across the letters in sync with the sweep light on the object. Small tracked caps (18–20 px) for kickers and credits.
- The product name and slogan are **title cards**, not subtitle lines.

## 5. Motion quality

- **Everything moves on ones** (24 fps), eased: ease-in-out for camera orbits, ease-out for parts decelerating into a float, ease-in for a snap back.
- **The camera always drifts**: slow orbits or push-ins; never a locked-off frame, never handheld, except a couple of frames of micro-shake on an impact.
- **Exploded view**: parts spread along the axis (~2× product size), each with a small deterministic tilt and a spin proportional to its offset; long ease-out apart → short drifting hover → **very short ease-in snap** on a downbeat.
- Objects lift out of cradles tilted toward camera and settle upright; lids hinge at the back and stand behind the object as a backlit halo.
- Light pulses and sweeps are events on the beat grid, not free animation.

## 6. Camera grammar

A vocabulary, not a route. Opening and ending come from the topic.

| Move | Expresses | Can serve |
|---|---|---|
| Sweep over a dark object, slow push | Contour before content | an unknown thing; a before-state |
| Slow high 3/4 orbit | The whole object in one move | a mechanism opening; variants |
| Macro, rack focus surface → part inside | Nothing to hide | an ingredient; a sensor |
| Side macro orbit | Material contrast | layers; a seam |
| Exploded view, axis ~40° to view, orbit | Technical beauty, suspension | architecture; a pause before a turn |
| Straight-on front, slight push | Declaration | a single number; a name |
| Top-down macro | A pattern at full size | channels; a circuit |
| Top-down on the floor | The effect leaving the object | range; spreading energy |
| Low orbit under the object | Monument, weight | durability; a flagship |
| Slow pull-back into negative space | Room for type | a claim; a question |

Framing: one hero, centred or on a strong diagonal, never cropped by the frame edge in a wide. Cut only on beats (bar lines where possible). Product films need **no spatial continuity** between shots: each shot is its own presentation stage, so hide or move anything that doesn't serve it. Transitions are cuts on the beat or a sweep passing through black; never dissolves or wipes.

## 7. Sound palette

- **Minimal electronic, never piano-and-strings.** Timbres, as options: bowed-glass or wet-finger tones, granular crystal clouds, glass bells and FM glass plucks, a filtered tick grid for precision, a warm pad, sub drone, soft short kicks and claps, 808 bass (sine with pitch envelope, soft saturation, slides), noise and saw risers, a high glass ding. Minor and modal colours suit the dark studio.
- **Lock every pulse, sweep and snap to the score**: write the cue map first and share one hit list between the score and the renderer; light pulses may follow a syncopated bass pattern exactly.
- **Silence as a tool**: a short stretch of total silence (reverb tails cut too) before a release, at most a reverse whoosh inside it.
- **Foley follows the material**: glass shimmer for sweeps (band-passed noise + inharmonic partials, panned with the strip); glass-metal friction for moving covers; magnetic clicks (sub-2 ms transient + 3–5 kHz metal resonances + low thump); air puffs for moving parts; a snap = a cluster of clicks ms apart + an inharmonic glass chord (partials ×2.76, ×5.4); glass-on-glass ticks.
- **Voice**: restrained, low, launch-like, very few very short lines. Never a product name alone (ASR and viewers mishear it): give it a verb.
- **Mix**: duck music ~12 dB and foley ~6 dB under the voice; limit the biggest bass peaks ~3 dB so loudnorm stays linear; −14 LUFS; grain 0.

## 8. Native moves

A menu: use the ones your story needs. Adapting any topic: find **the invisible thing the product does** and make it visible as light inside glass.

- **Transparency.** The inside is the hero; rack focus from the shell to the part within. *Fits content like:* a juicer's blades; a watch movement; a supplement capsule's layers.
- **Lensing.** A thick glass dome magnifies and bends what is behind it; macro through it feels like looking into a jewel. *Fits content like:* a camera module; a magnifying tool; a water filter.
- **Dispersion.** A sweep crossing a thick edge becomes a moving spectrum. *Fits content like:* a prism lamp; a display's colour range; a skincare bottle.
- **Light that travels inside.** Energy (charge, data, heat, sound) runs as light through channels. *Fits content like:* a battery filling; a router's data threads; a kettle heating.
- **Caustics.** An internal pulse becomes a ring spreading over the floor. *Fits content like:* a speaker's range; a perfume's trail; a wireless charger's field.
- **Exploded view and snap.** Parts float apart and snap back on a downbeat. *Fits content like:* a modular backpack; a pen's refill system; a repairable phone.
- **Frost to clear.** A frosted shell clears (roughness and tint animate to zero) and the inside appears. *Fits content like:* a privacy feature; a fridge's contents; an honest price breakdown.

## 9. Pitfalls of the medium

- A manually updated mirror uses last frame's camera → call `scene.updateMatrixWorld(); camera.updateMatrixWorld()` first; the transmission pre-pass re-renders it → no-op its `onBeforeRender`, update once per frame.
- A coloured emitter inside frosted glass tints the whole object; idle glow under a lens dome becomes a pale blob; AgX turns accents white; frosted glass on black is black; mirror chrome becomes a white disc → the rules in §2–§3.
- An exploded view seen perpendicular to its axis is edge-on lines → axis ~40° to camera.
- Pure profiles read as simple shapes (mushrooms, pot lids) → 3/4 views, lids upright behind.
- Bass peaks without headroom push loudnorm into dynamic mode → limit them in the mix.
- Concave glass facing camera prints the front card as a grey rectangle → card off.

## 10. Engine

In `demo/`: `studio.js` (strip env baked per frame, sweep, background, floor mirror + caustics + rings), `product.js` (glass / frosted / metal / guide materials, comet-pulse shader, `explode()`), `main.js` (staging, cameras, frosted subtitle bar, title glint), `story.js` (beat-grid timeline shared with the score), `music/score.py`, `mix.py` (foley + voice + ducking). New object: replace the geometry in `product.js` (e.g. a glass cylinder with a coiled light guide), keep materials and `studio.js`.

## 11. Variation space

You decide the object (always fictional), internals, accent, structure, opening, ending, camera path, pacing and music. All far from our demo:

- Structures: **a line-up** (three variants compared by what glows inside); **a day in light** (one object through morning, noon and night, the strip kit rotating around it); **material stack** (one layer removed per beat until the core stands alone).
- Openings: **inside first** (one internal part; the shell forms around it); **caustic first** (light on the floor, followed up to the object); **silhouettes** (several dark outlines; one begins to glow).
- Endings: **floor only** (the object leaves, its caustic keeps pulsing); **cool down** (emission fades to bare strip outlines); **held macro** (no pull-back; one detail, the name small).

---

How our demo was made (story, shots, score, end card, build): [DEMO.md](DEMO.md). Read it after your treatment exists.
