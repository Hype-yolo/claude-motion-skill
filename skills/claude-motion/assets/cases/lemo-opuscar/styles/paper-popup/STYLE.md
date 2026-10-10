# Paper Pop-up Book — Style Prompt

> A pop-up book on a real desk becomes a stage: flat cut-paper actors with white borders perform in front of paper sets that spring up from the page, under real lamp light and a real macro lens.
> References (grammar only): the *Paper Mario* series (flat cut-paper actors with a white border in a 3D diorama, bubbles that type on with blips, action ratings); Robert Sabuda / Matthew Reinhart pop-up books (layered V-folds, pieces rising back to front, pull-tabs); macro "tiny world on a real desk" photography. Never copy their characters, logos, UI or music, and never name them in the film.

## 1. Essence, and what it is not

Two worlds in one frame. **The real world** at human scale: a photoreal surface lit by an HDRI room, a few real objects, a macro lens (shallow focus, warm practical light, soft contact shadows). **The paper world**: a hardcover book in that room; when it opens, one board stands up as the **backdrop** and the lower page is the ground. Every set piece is a **flat cut-paper card** that lies on the page and **pops up** around its bottom edge. Characters are cut paper too: a few centimetres tall, flat, with a thick off-white border, a grey cardboard edge and grain.

What sells it is the **mismatch of scale and material**: flat, saturated, outlined paper cartoons under real light, casting cut-out-shaped shadows and going soft in real lens blur. Keep the paper graphic; let light and lens make it real.

Not a papercut silhouette film (no one-colour lace, no backlight), not a 3D cartoon (nothing modelled round), not claymation (paper hinges, folds, curls and slides; it never squishes).

## 2. Materials & rendering

- **Real units** (metres): page 0.3–0.5 m wide, actors 3–5 cm, near plane a few mm, so HDRI, shadows and depth of field behave like a real macro shot.
- **Cut-paper finish**: Canvas2D art with a dark ink outline; its silhouette dilated (drawn at many angles on several rings, recoloured `source-in`) into a grey cardboard edge offset slightly down (thickness) and a wide off-white border; a shared paper grain on top (`source-atop`).
- **Drawing**: one dark-brown ink (never black), thick outline + thinner detail line, round joins; shading = one hard **crescent** (fill with shade, refill shifted with base); wobbly shapes (low-harmonic noise), never perfect geometry; simple faces.
- **Pop-up pieces**: planes with art on the front and plain paper on the back (same alpha); `alphaTest` + `alphaToCoverage`; a custom depth material with the alpha map so **the shadow is the cut-out silhouette**. Anything "3D" is several flat cards (front/back layers, triangles hinged on a keel).
- **The book** is modelled: cloth cover with foil title (roughness/metalness map), page block with edge lines, a curling leaf.
- **Real world**: HDRI environment and softly blurred background, real wood or fabric, a few CC0 props. **Neutral tone mapping** (ACES shifts paper colours).
- **Depth of field by hand**: CoC = aperture × (1/focus − 1/z), spiral gather that keeps far samples off a sharp foreground (stock bokeh looks fake at this scale); then light bloom, vignette, warmth.

## 3. Colour logic

- Saturated children's-book colour, **never neon**; the real world stays natural and slightly warm so paper pops against it.
- **One dominant hue family per spread**, so a page turn is also a colour change; a few accents (a red, a yellow, a gold) recur across spreads to stitch the book together.
- Ink dark brown, border off-white, card backs plain paper.
- Unfinished or "outside the story" pages lose colour: graphite on cream. Night is a change of the paper art; the real lamp keeps its warmth.

Examples of spread families: green meadow under sky blue; pink-and-lilac market with mint accents; ochre desert with a turquoise oasis.

## 4. Type & subtitles

- Rounded OFL faces: a rounded sans for subtitles, bubbles, signs (e.g. Fredoka); a chunky display face for cover, banners, action words (e.g. Lilita One); a storybook serif for taglines (e.g. IM Fell English); a playful Chinese face (e.g. ZCOOL KuaiLe) with the Latin face in its stack.
- **Narration subtitles**: bottom centre, ~40 px, cream with a thick dark-brown outline and soft shadow, second language smaller below. Hold ≥ max(1.8 s, speech + 0.6 s).
- **Speech bubbles** live in the paper world: white card, ink outline, tail projected each frame to the speaker; pop in with overshoot, type on with blips.
- **Titles are paper objects**: a cardboard sign dropping on strings and swinging; the cover itself is the film title. Action words (italic display, gradient, double stroke, rays) sparingly, like a game rating.
- Subset Chinese fonts to the characters used; re-subset after every text change.

## 5. Motion quality

- On ones (60 fps suits the smooth macro camera), all a pure function of `t`. Paper moves stiffly; life comes from easing: `back()` overshoot for pop-ups, springs for things on strings, squash and stretch on characters.
- **Pop-ups rise back to front** (delay grows with distance from the reader), far pieces lying back, near ones folding forward face-down; they fold down in the same order.
- Plants and light props sway a few hundredths of a radian around their base.
- **Characters are flat cards redrawn per quantized pose** (walk phase, arms, eyes, mouth, look, blink); walk phase follows distance walked, so feet don't slide.
- **Turning around = a `scale.x` flip** between front and back drawings; never `rotation.y`. Jumps: parabolic arcs, squash at both ends, a paper puff on landing.
- **Page turn**: a many-segment strip whose bend is integrated along its length, so it curls like paper.
- Never moves: the room.

## 6. Camera grammar

One virtual macro camera keyed as position / target / fov / aperture / focus with monotone-cubic interpolation; a new key list = a hard cut. A vocabulary, not a route. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Eye-level macro track, shallow focus | being inside the story at the actors' size | a walk; a conversation; a chase |
| Pull up to a 3/4 view of the spread | the mechanism, the map | a page turn; a new setting; a plan |
| Descending dolly from human height | entering the book's scale | an arrival; zooming into one part of a system |
| Push-in on a face | feeling | a wish; a fear; a decision |
| Reverse shot from inside the book to the blurred room | the world beyond the page is huge | curiosity; an outside threat; a reader watching |
| Rack focus paper ↔ real object | paper and reality touch | cause and effect; a real product in a paper story |
| Top-down over the open spread | a board game, a diagram | a route; two sides of the gutter compared |
| Locked frame on a pull-tab | the trick is the event | before/after; a count |
| Rising crane leaving the book small | scale, distance | aftermath; a summary; time passing |

Actors in focus, room objects as soft foreground or background; keep near pop-ups out of the lens path. Transitions: page turns, a book closing and reopening, a hard cut on a paper sound; never a video dissolve inside the book.

## 7. Sound palette

- **Paper foley is the signature**: page swish, cardboard thump, pop-up snap (short sine sweep + crinkle), fold and crease, pull-tab slide, footsteps as tiny taps with crinkle, slat flaps, string-drop tinks; the book's spine creak and closing thump. All synthesizable from the page's event list.
- **Character voices as typing blips**: one waveform and pitch range per character, a blip every other letter.
- **Narration**: one warm storyteller, picture-book sentences; pronunciations kept apart from displayed text.
- **Music**: whimsical, acoustic or toy-like: music box, pizzicato strings, clarinet, glockenspiel, ukulele, toy piano, brushes. Options: a warmer cue for anything in the real room; a bar-aligned internal edit of a library track so its ending lands on a picture event; a pull-tab's clicks setting a cue's pulse.
- **Ambience**: room tone and a clock for the room; one bed per spread for the paper world.
- **Silence** = the book held still with only room tone; before a turn that matters, or a hesitation.
- **Mix**: voice high-passed, compressed, well above music; music ducked under speech with smooth release; limit SFX per channel; −14 LUFS.

## 8. Native moves

A menu: use the ones your story needs.

- **The book opens**: creak, the board swings up, the world pops up back to front. *Fits content like:* a project launch; a first school day; a recipe book.
- **Page turn = scene change**: old pieces fold down as new ones spring up. *Fits content like:* stages of a process; a farm's seasons; chapters of a biography.
- **Pull-tab mechanisms**: flipping slats, a sun on a stick, sliding strips, a hinged door, pieces on strings. *Fits content like:* a forecast; old way/new way; a lock opening.
- **Paper as character**: crumpled, smoothed, refolded, torn, taped. *Fits content like:* a mistake becoming a lesson; recycling; a rejected draft becoming the design.
- **The edge of the page**: crossing between paper and the room, either way. *Fits content like:* a character stepping into a phone on the desk; a real object entering the story; a drawing coming true.
- **The real object plays a part**: a lamp as a sun, a mug as a tower. *Fits content like:* a product at home; the reader's presence; real clock time.
- **Typed bubbles and ratings**. *Fits content like:* a tutorial; a quiz; a small victory.

## 9. Pitfalls of the medium

- `rotation.y` shows a card edge-on, then its blank back → `scale.x` flip. Negative scale also swaps front/back materials → draw mirrored props instead.
- A one-plane container hides its contents → back card + front card, contents between.
- Near-lens foreground pop-ups fill the frame with blur → move them or close the aperture.
- Rectangle shadows kill the illusion → alpha-mapped depth material on every card; tight shadow bias and a big shadow map against acne on thin cards.
- A turning page goes black facing away from lights → emissive map = colour map.
- ACES shifts paper colours → Neutral.
- Headless Chrome falls back to software WebGL → GPU ANGLE flags; ES modules need HTTP.
- Redrawing character canvases each frame → redraw only on pose change.
- Chinese subsets miss new characters and Latin glyphs → re-subset; Latin face in the stack.

## 10. Engine

In `demo/` (three.js r170 + Canvas2D): `paper.js` (cut finish, grain, crescent, blobs), `cutmesh.js` (cut mesh with paper back and cut-out shadow, strings, particles), `book.js` (`setOpen(θ)`, `setLeaf(u)` curling page), `art.js` (drawings at a fixed px/m), `actors.js` (posable flat characters, a foldable plane), `sets.js` (spreads, back-to-front pop scheduling), `post.js` (hand DOF → bloom → vignette), `hud.js` (subtitles, bubbles, banners), `lib.js` (easing, `back`, `spring`, `track`), `render.mjs` (stills / events / video). API table and a minimal new-spread example: DEMO.md "Engine reference".

## 11. Variation space

You decide the book, the room, the characters (or none), the spreads and mechanisms, the opening, the ending, the camera path and each spread's palette. All far from our demo:

- Structures: **the almanac** (one spread per month or stage, each pull-tab left running so the book fills with motion); **two books facing each other**, characters trading objects across the gap; **one spread pulled again and again**, each pull a step of how something is made.
- Openings: **mid-turn** (a page already curling, we land in chapter three); **inside the gutter** (low along the fold as the first piece rises over the lens); **a mechanism alone** (a tab slides by itself before any character appears).
- Endings: **the book closes** (pieces fold in reverse, a puff of air, stillness); **one piece stays up** (everything folds but the card that is the point); **the shelf** (the camera finds this book among many).

---

How our demo was made (story, shots, score, end card, build): [DEMO.md](DEMO.md). Read it after your treatment exists.
