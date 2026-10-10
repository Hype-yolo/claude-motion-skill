# Impasto · Palette Knife — Style Prompt

> Thick oil paint laid with a palette knife: big, flat, sharp-edged planes of colour, raked by light so every ridge of paint shows. Clarity first: value structure before texture, hard edges at the focus, calm planes everywhere else.
> References (grammar only): the opening titles of *The Umbrellas of Cherbourg* (1964) (overhead choreography read as moving colour); palette-knife street paintings (Leonid Afremov and the genre around him) (knife mosaic, vertical wet reflections, warm lights against cool shadow); Sorolla / Sargent (few, decisive strokes and strong light); Edgar Wright's music-locked editing (one action, one sound, one cut). Never copy their images, compositions, melodies or characters, and never name them in the film.

## 1. Essence, and what it is not

A moving oil painting made of knife strokes. Each stroke is a real object: a slanted plane of paint with a ridge where the blade pressed, a lip where it lifted off, broken streaks where the paint ran out, two colours dragged into each other. The world is **repainted from its strokes every frame**, but static paint never moves: only things that move in the story move. Light rakes across a height field, so the paint has body.

The look is clear and graphic (readable like a children's book at thumbnail size) but has the tactile surface of impasto at 100 % crop.

Not a Van Gogh swirl filter (strokes boiling everywhere), not a brush texture over flat vector art, not watercolour (paint is opaque), not a "painterly" photo filter (strokes are designed, not sampled from noise).

## 2. Materials & rendering

- **Value first.** Design each set as a flat, value-planned illustration (3 values minimum), then convert it to strokes. If the reference doesn't read at 480 px wide, no brushwork will save it.
- **Stroke sizes by importance and depth.** Coarse to fine: large planes in sky and walls, a few px only at edges and faces (per shape: `maxR`, `detail`, `dir`).
- **Strokes never cross shape groups**, so silhouettes stay crisp. Lost edges are opt-in (put two shapes in the same `group`).
- **Thin underpainting** (the reference itself, blurred ~1.5 px) under the strokes, so the canvas never peeks through as outlines.
- **Knife stroke**: longer than wide (≈ 1.7–3.1 × radius long, 0.95–1.45 × radius wide), slanted ends, small angle and value jitter (≈ ±13°, ±6 %). Solid objects that must read as silhouettes (figures, props) get little or no ragged run-out.
- **Light** rakes over a height field; wet or glossy surfaces get slightly more specular.
- **Reflections** (wet ground, glass, water) are **explicit stacks of short horizontal knife dabs** under each light source, broken and fading; never a painted rectangle.
- Render supersampled (2×). **No film grain**: grain plus compression eats the knife edges.

## 3. Colour logic

- Planes of mixed, slightly broken colour; each stroke may drag a second colour (`c2`) into the first. No gradients made by blending pixels: gradients are made by stroke-to-stroke steps.
- Warm light against cool shadow is the default temperature structure; the brightest, purest chroma is reserved for the story's subject (a prop, a crowd, a light source), not the background.
- **Colour can be an event.** Every stroke can hold a grey and a colour version; a monochrome world with one coloured exception, or a world re-laid from grey to colour, is native to the medium. The grey version is the luminance of the same strokes, slightly cool, with a small colour residue.
- Examples of palettes that fit: an after-rain sunset (cobalt → peach → gold sky, ochre facades, full-chroma props); a harvest field (straw yellow, burnt sienna earth, one viridian tractor); a night kitchen (umber shadows, sodium-lamp orange, one cold blue window). Choose from the topic.

## 4. Type & subtitles

- Titles are **laid in with the knife** (a stroke-by-stroke `appear` sweep of about a second) and can be taken off by the world (washed by rain, scraped, painted over). They move with the world.
- Small text (credits, data, captions) stays crisp DOM text over the painting: knife strokes can't carry small letters.
- A serif display face (e.g. Cormorant, OFL). Subtitles, if there is a voice: plain serif, ≤ 2 lines, in a calm plane; hold ≥ max(1.8 s, speech + 0.6 s).

## 5. Motion quality

- Static paint is static. Only the things the story moves move (weather, figures, props, ribbons, light). Smooth 24 fps, no stepping: clarity is the brief.
- Moving figures are procedural strokes rebuilt each frame from **fixed seeds**, so their paint doesn't boil (walk cycles, IK arms, props that open and close).
- Actions sit on the music grid: a change of direction, a pop, a swell lands on a beat.
- Anticipation → action → follow-through on every gesture (lift before the strike, dip before the snap, swing after the stop).

## 6. Camera grammar

A vocabulary, not a route. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Slow truck + push on a wide | a world observed; patience | a place; a routine; a crowd |
| Push-in through a silence | inner pressure | a doubt; a decision; giving up |
| Tilt-up from the ground or a reflection | discovery from below | a small character entering; a first sight |
| Pull-back from a close-up | reaction; the world answering | consequence; a reveal of who is watching |
| Rotating crane-out, overhead | pattern emerging from many | choreography; traffic; a gathering |
| Same wide, repeated | before/after | change of colour, season or time |
| Locked frame, light moves | time and weather as the actor | a day passing; a storm arriving |
| Macro slide along the paint surface | the matter itself | a texture; a crafted object; a map |
| Whip-pan into a new painted plate | energy, a jump | a list; montage; travel |

Framing: keep the camera **inside the painted plate** (`half = W/2/zoom`), or the canvas shows. The subject gets the hard edges and the smallest strokes; everything else stays in big calm planes. Transitions: paint-over sweeps and scrapes, hard cuts on beats; no dissolves (two layers of knife ridges turn to mud).

## 7. Sound palette

- **Foley follows the paint and the world**: palette-knife scrapes on every repaint or paint-over, wet dabs, the materials of the scene (wet stone, nylon, wood, fabric, glass).
- **Beds** in layers (a hiss, near grains, one distinct detail), filtered when the camera goes under cover.
- **Acoustic instruments with a hand-made grain**: solo strings, accordion, pizzicato, harp arpeggios, glockenspiel or celesta for pops, piano, guitar, woodwinds; a solo instrument for a lonely world, an ensemble for a shared one.
- Options: **one action = one sound = one cut** (music-locked edit); pops pitched as a rising arpeggio so a sequence of events climbs; an unresolved phrase that the film resolves later; a hard silence that cuts music and beds to digital zero, containing at most one sound; a J-cut of the next scene's foley into a silence.
- Mix: music and ambience duck under any voice (~8 dB); −14 LUFS. Music and foley can carry a film without narration.

## 8. Native moves

A menu: use the ones your story needs.

- **Colour re-laid by the knife.** Every stroke keeps a grey and a colour version; a reveal wave re-paints them stroke by stroke (`reveal`, `revC`). *Fits content like:* a town waking up; a patient recovering; a brand relaunch; a season turning.
- **The one coloured thing.** The world drawn with `grey: 1`, one object with `grey: 0`. *Fits content like:* one person in a crowd; the fruit that ripened; a warning light.
- **Motion paints the picture.** Moving objects drip their colour as knife dabs; seen from above, their paths leave a painted pattern. *Fits content like:* a dance; delivery routes across a city; a football play; migration.
- **Raking light.** At the peak, drop the light to a grazing angle so every ridge catches it, then let it settle. *Fits content like:* a sunrise; a moment of recognition; unveiling a sculpture.
- **Paint-over transition.** The next shot's strokes are laid over the previous one in a sweep (`appear`), with a scrape on the soundtrack. *Fits content like:* a renovation; memory replacing the present; a timeline of versions.
- **Sound made visible.** A note or a voice becomes a paint ribbon that carries colour to what it touches. *Fits content like:* a song reaching listeners; a radio broadcast; a rumour spreading.

## 9. Pitfalls of the medium

- Confined strokes shrink near edges and leave canvas-coloured outlines → add the underpainting texture.
- Draw order in the reference matters: painting the ground after the buildings covers their feet.
- Plain rectangles read as posts or blocks → give silhouettes taper, a lit edge, and one or two defining dabs (shoulder, hair, handle).
- Proportions carry the object's identity at this stroke size: a prop drawn too wide reads as a different thing. Check silhouettes at thumbnail size.
- Film grain or heavy compression destroys the knife edges → no grain, supersample, high bitrate.
- Strokes that are re-seeded every frame boil → fixed seeds per stroke.
- Engine-level WebGL traps (reserved words, VAO binding) are listed in DEMO.md build notes.

## 10. Engine

Files: `demo/engine/impasto.js` (renderer), `demo/engine/plate.js` (reference → strokes).

Main calls: `new Impasto(canvas,{W,H,ss})`, `E.begin()` / `E.finish(post)` (raking light + grade), `E.batch()` → `E.draw(batch,o)` for static plates (`cam`, `grey`, `reveal`, `appear`), `E.drawNow()` for moving strokes, `E.under()` for the underpainting, `new Strokes().push({...})` (`KNIFE`, `BRUSH`, `DAB`, `LINE`), `new Ref()` + `paintRef()` (reference illustration → coarse-to-fine strokes confined to shape groups), `strokePath()`. Full parameter table: DEMO.md "Engine reference".

Minimal example: a warm-orange four-point sparkle with a short cursor tail, in knife paint.
```js
import { Impasto, Strokes, KNIFE, DAB, hex } from './engine/impasto.js';
const E = new Impasto(canvas), s = new Strokes(), c = hex('#D97757');
for (let k = 0; k < 4; k++) {                                   // four tapered knife points
  const a = k * Math.PI / 2;
  s.push({ x: 960 + Math.cos(a) * 60, y: 540 + Math.sin(a) * 60, ang: a, len: 120, wid: 46, c, c2: hex('#f0a07a'), type: KNIFE, taper: .95, seed: k });
}
s.push({ x: 960, y: 540, len: 40, wid: 40, c: hex('#f6c0a0'), type: DAB, seed: 9 });   // bright core
s.push({ x: 1060, y: 610, ang: .6, len: 90, wid: 16, c, type: KNIFE, alpha: .8, seed: 10 });   // cursor tail
E.begin(); E.drawNow(s.data(), { grey: 0, run: 0 }); E.finish();
```
"Only one colour" (monochrome with one exception): draw the world with `grey: 1, reveal: 1e6`, draw the exception with `grey: 0`.

## 11. Variation space

You decide the structure, the cast (or none), the sets, the opening, the ending, the camera path, the pacing, whether there is a voice, and where colour lives. All far from our demo:

- Structures: **one object, many hands** (a bowl or a boat passes through the people who make and use it, one painted plate per hand); **a still life comes alive** (a locked table whose objects move in turn, the light crossing it hour by hour); **a portrait in layers** (a face painted coarse to fine as a voice tells one life, each layer a decade).
- Openings: **the bare canvas** (underpainting only; the first knife stroke is the first event); **macro on a ridge of paint** that pulls back to become a mountain or a roof; **mid-action** (a figure already running across a finished plate).
- Endings: **scraped back** (the knife takes the painting off to the underpainting, leaving one mark); **the light goes out** (raking light sinks until only the ridges glow, then black); **the frame in a room** (the film was a painting hanging somewhere, seen by someone).

---

How our demo was made (story, shots, score, end card, build): [DEMO.md](DEMO.md). Read it after your treatment exists.
