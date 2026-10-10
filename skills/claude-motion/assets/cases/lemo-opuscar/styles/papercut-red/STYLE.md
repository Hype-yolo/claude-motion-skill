# Red Paper-cut — Style Prompt

> Chinese window-flower paper-cuts brought to life: jointed red cut-outs on paper grounds, where the cut *is* the drawing and the holes are where the light gets in.
> References (grammar only): folk window flowers of Shaanxi and Yuxian (sawtooth, crescent, cloud and swirl cuts, fold-symmetric rosettes, *yin* and *yang* cutting); the 1958–59 Shanghai Animation Film Studio cut-paper shorts (jointed figures, profile acting, paper layers in parallax). Copy no studio character, no named artist's work and no real motif sheet: generate every pattern from code, and never name the references in the film.

## 1. Essence, and what it is not

Every visible thing is **a piece of paper that was cut with scissors** and laid flat on another sheet. There is no painting, no gradient shading, no outline stroke: detail, volume and expression come only from **what was cut away**. Red paper is the hero material; grounds are paper too (a light paper by day, a deep dyed paper by night). Characters are **jointed cut-outs** (head, torso, upper and lower limbs pinned at rivets) animated in hard 12 fps steps.

Not shadow puppetry: no light behind a screen, no translucent dyed hide, no rods. Here the paper is **front-lit and opaque**; backlight is a special event you save for the moment that needs it. Not flat vector art (no strokes, no gradients), not a silhouette film (every shape's interior is cut).

## 2. Materials & rendering

- **Paper grain:** a neutral-grey texture in `soft-light` inside each piece (dye mottling, fibres, specks), then the piece's alpha restored with `destination-in`, so holes stay holes.
- **Cut edge:** every silhouette is a polyline with a slight low-frequency wobble (hand-cut), a 1 px light rim upper-left and a dark rim lower-right (the cut face). Architecture and machines use straight segments + wobble, never smoothing.
- **Paper thickness:** each piece casts a tight soft shadow on the layer below; stacked folded paper shows 2–6 offset darker edges.
- **Figures: red block + yin lines.** Every figure piece gets an **inset contour** (a thin slit a few units inside the outline): the classic double outline, which also separates red-on-red overlaps (an arm over a coat).
- **Folk cutting vocabulary** (`demo/motifs.js`): sawtooth rows (fur, grass, tiles, fringe), serrated edges, crescents (scales, quilting), swirls (joints), clouds, rosettes, plum, coin, tapered slits.
- **No floating islands.** A closed ring cut would drop its centre out of real paper. Eyes are two crescents (upper and lower lid) that leave bridges, plus a pupil *hole*.
- Faces never morph: expressions are **swappable face pieces** (smile, surprise, fear, determined, asleep).
- **The rosette (团花)** is designed as one 45° wedge and mirrored 8× (D4); other folds give 2×, 4× or 6×. Alternate rings of *yang* cut (band cut away, red lines left) and *yin* cut (lines cut out of a red field). Fold seams leave faint crease lines: keep them, they are true to the craft.
- **Light:** front-lit scenes use the paper as is. Night: `frame × lightmap` + warm pools, then **emissive** backlit pieces (light × paper transmission via `multiply`; holes at full light), a two-level bloom and optional rays. Keep bloom low enough that the pattern stays legible at the centre.
- **Projected pattern:** a piece's hole mask, squashed onto the ground and added with `lighter`; on a character, masked by its layer alpha over a solid warm spot, so cut features still read as holes.

## 3. Colour logic

- **China red** (around `#d2201f`, range `#c8102e`–`#d7261e`) is the hero material. Depth and role are shown by **paper tones one step apart**, not by shading: near pieces one step brighter, far pieces one step darker, an antagonist or a heavy object one step deeper.
- **Ground and hero must be different paper families.** If background and hero are both red, the silhouettes stop popping. At night, all background layers are one dark dyed family and only the pieces that matter to the story are red; by day, a light paper ground with red and pale-red layers.
- **Gold foil** is an accent kept for one late moment (a sun, a title, a coin); never a second main colour.
- Examples of ground families: indigo night papers (far layers lighter blue, near darker); a warm rice-paper day with pale-red far hills; a jade-green or black paper for a story that isn't festive. Choose from the topic.

## 4. Type & subtitles

- **Subtitles are a paper strip in the world**, e.g. a red banner (横批) darker than the picture's reds so cream text holds, serrated edges, swallow-tail ends; a sturdy OFL serif (e.g. Fraunces SemiBold) around 44 px, low, with a paper shadow. It drops in on two 12 fps steps, like a couplet being pasted. Hold ≥ max(1.8 s, speech + 0.7 s); never overlap.
- **Titles** are cut-out letters (*yang*-cut, counters are real holes) popping in letter by letter on 12 fps steps, with sawtooth border strips and a seal cut by code.
- Small credits may be printed ink on paper.

## 5. Motion quality

- **Characters step at 12 fps** (pose sampled at `floor(t·12)/12`); **camera, light, weather, flames and flying pieces move on ones** at 24 fps.
- Rigs pin pieces at rivets (neck, shoulders, elbows, hips, knees, jaws, tails). Hard poses, tiny eases, 1-frame overshoots ("pop" = 1.15× for one step). Weight comes from **size and camera shake**.
- In profile, a raised near arm crosses the face: keep hands forward of the face or let a prop cover them.
- **Folding:** the flap is split into ~16 strips; each is compressed by cosθ and enlarged along the fold by `1 + 0.28·height` (fake perspective), darkened as it stands up, in a lighter back colour past 90°, with a growing shadow and a crease after. About half a second per fold, each on a hit.
- **Cutting:** the pattern is revealed through a mask of circles along the scissor path; the offcut drops once the outer edge is passed; blades open and close on a subdivision of the beat; scraps flutter out and land.
- **Unfolding:** successive unfolds a fraction of a second apart, each flap swinging from folded to flat with ease-out (the "pa!" snap), then a scale bump and warm flash on the accent.

## 6. Camera grammar

A vocabulary, not a route. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Extreme close-up tracking the scissor tip | making; attention to craft | a beginning of work; a precise act; a signature |
| Flat front view, locked | the cut-out as an emblem | a title; a statement; a family portrait |
| Slow pan across paper layers (parallax) | a world laid out | a village, a route, a timeline |
| Low wide, a shape standing up from the ground layer | scale, threat | a storm; a rival; a deadline arriving |
| Top-down tabletop | the craft as plot | folding, cutting, assembling, sorting |
| Push toward a lit piece, pull back to many | one act spreading | influence; a network lighting up |
| Page turn / sheet peel | time or place changing | day to night; before and after; chapters |
| Pull back to an object in a room | the film was a thing someone made | memory; a gift; a tradition |
| Rotation around a rosette's centre | order, repetition | a cycle; a team |

Framing: layers stay parallel to the screen; depth comes from parallax and paper tones, never from perspective. Transitions are paper actions (fold, page turn, peel, a sheet flying off, a cut through the frame); no dissolves.

## 7. Sound palette

- **Foley follows the material:** scissors = metallic shear sweep (2.5–9 kHz) + a short ring + a fibre crack; folds = swish + crease tap; unfold = sharp snap; heavy steps = *cardboard* thud, not flesh; paper peel; pasting = a palm pat; match strike, puff; firecrackers = dense clicks 20–60 ms apart with low booms.
- **Instruments:** a bright Chinese chamber ensemble, not piano and strings and not the opera percussion of shadow puppetry: pipa (tremolo on long notes), zheng (`dan_tranh`: broken chords, glissandi, tremolo), erhu (glides), dizi (flute), sheng or yangqin colours, woodblock, small and big gong, frame drum. Pentatonic modes.
- Options: one snip = one beat subdivision; a rising zheng run, one note per thing that appears; a frame-drum heartbeat for weight; one big gong saved for one accent; total silence for a held breath.
- **Voice:** warm storyteller, few lines. Duck music ≈ 9 dB and foley ≈ 3 dB under the voice; keep impacts out of voice windows. Folk names may need an `asr` alias in `lines.json`.
- Mix to −14 LUFS, **no film grain** (the paper fibres are the texture).

## 8. Native moves

A menu: use the ones your story needs.

- **Fold – cut – unfold.** Fold a sheet 2/4/8 times; one cut becomes many. Put the unfold on a strong beat. *Fits content like:* one teacher, many students; a single design mass-produced; one seed becoming a field.
- **Holes are light.** A cut-out lit from behind glows deep red, every hole glows, and the pattern is projected onto the world. *Fits content like:* an idea shining through a person; a lighthouse; a window at night in a story about home.
- **Symmetry replicates.** A mirrored motif peels off and multiplies (rosette → window flowers → fireworks). *Fits content like:* a franchise; cell division; a song spreading through a crowd.
- **Scraps have a future.** The bits that fall while cutting come back later (as snow, confetti, stars). *Fits content like:* recycling; leftover time; small failures that add up.
- **Everything is one flat sheet.** Things share the same cuts, so a ridge can stand up and be a creature, or a wave become a road. *Fits content like:* a landscape that becomes a map; a factory that turns out to be one machine; a zoom out to the made object.
- **Mirrored pair.** Two figures cut from one folded sheet. *Fits content like:* twins; a partnership; before/after of the same person.

## 9. Pitfalls of the medium

- **Red on red** reads as one blob → different ground family, near/far paper tones, inset contours for overlaps.
- **Darkening a layer through the light map** also darkens what covers it → tint the layer itself (multiply + restore alpha).
- **A flat cos-squashed flap reads as a sliding card**, not a fold → strips with fake perspective, darken as it stands up, show the back colour.
- **Cut reveal shows the uncut stack through the holes** → stack thickness inside the "uncut" mask only; the cut part gets its own offset copies.
- Scissors pointing backwards → the blade axis follows the direction of travel, the rivet a little behind the cutting point.
- Blank frames between shots → overlap outgoing and incoming paper actions.
- Engine traps (`put()` transforms, piece boxes, test pages) are in DEMO.md build notes.

## 10. Engine

In `demo/`: `paper.js` (paper textures, piece builder: fill, cut, inset, edge, grain, shadows, transmission), `motifs.js` (folk pattern library), `rig.js` (2D affine rig helpers), `tuanhua.js` (8-fold rosette from one wedge × D4), `light.js` (night lightmap, backlit pieces, bloom, rays, masked projected light), `fold.js` (fold – cut – unfold sequence), `hud.js` (subtitle banner, cut-letter text); `?test=` pages draw model sheets from the real engine. A first test not in the demo: a bicycle from `paper.js` pieces (`sawRow` spokes), wheels riveted in `rig.js`, rolling on 12 fps steps.

## 11. Variation space

You decide the structure, the cast (or none), the sets, the paper families, the opening, the ending, the camera path, the pacing and which native moves carry the story. All far from our demo:

- Structures: **a year of twelve cuts** (a zodiac or calendar wheel, one wedge per month, rotating); **an assembly line** (a product built piece by piece from cut parts, each part a pattern); **a letter** (a folded message unfolds panel by panel, each panel a scene).
- Openings: **a finished pattern** (a full rosette, then one piece falls out and walks away); **an empty ground** (a blank sheet, one fold crease appears); **a crowd of cut figures** already dancing, parallax full.
- Endings: **refold** (the world folds back into a small square that is handed to someone); **scraps settle** (every offcut drifts down into a new pattern); **backlit only** (the lights go off except behind one cut piece, which projects the last image on the wall).

---

How our demo was made (story, shots, score, end card, build): [DEMO.md](DEMO.md). Read it after your treatment exists.
