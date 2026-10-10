# Pictogram Motion — Style Prompt

> A beat-locked flash-card film built from three things only: a **square-grid "core graphic"** of circles, half-discs and tiny patterned cells whose rows slide past each other; **geometric pictograms** made of round-capped bars and a disc head; and **bold bilingual type** that slides up out of masks. Every cut lands on a drum hit.
> References (grammar only): Otl Aicher's 1972 Munich pictograms (geometric athletes); multi-sport-games "look of the games" identity systems (a modular pattern + a colour set used for everything); Swiss sports-broadcast graphics (mono meta text, tick-bar progress). Learn the grammar; never copy any real event's pictograms, emblem, slogan, pattern artwork or colour names, and never name them in the film.

## 1. Essence, and what it is not

A **catalogue film**: N items (products, dishes, steps, species…) shown one card at a time, fast, on the beat. Each card = **one pictogram doing one action + a huge title + a second-language line + a mono index "07 / N"**. Cards group into chapters; each chapter owns one hue, opened by a full-bleed pattern card.

What makes a frame read as this style at a glance:
1. **The grid pattern**: big discs and half-discs spanning square cells, about half the cells carrying a small motif, all in **five tones of one hue**, with **whole rows cut and shifted sideways**: the signature that drives backgrounds and transitions.
2. **The pictogram figure**: flat, faceless, rounded bars and a disc head; far-side limbs mixed toward the background. Props are discs, rings, capsules, lines.
3. **Type as architecture**: a 900-weight grotesk title set very large, a heavy second-language line under it, small mono meta text in the corners like a broadcast HUD.
4. **Beat lock**: every shot starts on a beat, every key action lands on a beat.

Mood: premium broadcast identity; flat colour, light grain, one soft light sweep as the only gradient.

Not an isometric infographic (no depth, no 3D), not Swiss motion graphics (the figure and the pattern carry as much as the type), not a cartoon (figures never emote, have no faces), not a data film (numbers are labels, not charts).

## 2. Materials & rendering

- **Flat Canvas2D**, rendered clean; grain only at mux time. **One square grid** (cell ≈ 1/6 of the frame height) rules bands, transitions and walls.
- **Pattern model**: fill with a mid-dark tone; on grid nodes randomly place cell-radius discs in random tones and discs-with-inner-discs; then a fraction of cells get one motif from a library of generic geometry (quarter-discs, fish-scale waves, dot and triangle scales, concentric arcs, sun wheels, checkers, crescents…), rotated by multiples of 90°; never mascots, landmarks or logos. Draw it wider than the screen so any row can shift one cell.
- **Figure model**: unit = body height, origin at the hip; draw far limbs (mixed ~40 % toward the background), torso, near limbs, head. A second person sits behind, mixed further (~60 %).
- **Stage**: the figure stands on a large **sun disc** in a neighbouring tone, crossed by one faint light sweep.
- **Figure environments** (water, nets, ramps) live in the figure's own buffer, masked to zero before the text column.

## 3. Colour logic

- **A set of five hues + one dark neutral**, each hue in **five tones** (darkest → lightest, the middle one is the base). A chapter = one hue; a multi-hue chapter rotates through the set per card.
- Under type the pattern runs at **low contrast**; on chapter cards at **full contrast**.
- **Light hues take dark type and dark figures**, and their disc uses the lighter tone; dark hues take cream. On the dark neutral, the disc uses a lighter tone or it vanishes; its accent is one warm hue.
- One cream and one ink serve every hue. No outlines, no highlights except the sweep.
- Choose the set from the topic. Examples: warm festival (red, violet, forest green, gold, ochre); coastal (navy, teal, coral, sand, sky); kitchen (tomato, basil, saffron, aubergine, flour cream). Invent names for your hues; never borrow an event's colour names.

## 4. Type & subtitles

- Title: a 900-weight grotesk (e.g. Inter Tight), 150–330 px at 1080p, tight tracking, auto-fitted. Second language: a heavy face under it. Meta: a mono (e.g. DM Mono) ~22 px, wide tracking; tags as mono chips.
- **HUD** on every card: mono corner text and a **progress bar of N ticks** (current tall, done dimmed, rest faint), N derived from the item list.
- **Bilingual rule**: one language is always the big title; the second language is chosen per version by a switch, never by hand-editing cards.
- The card type *is* the text layer. With narration, captions are a mono line on a solid band in the chapter hue, bottom, never over the title; hold ≥ max(1.8 s, speech + 0.6 s). A card that must be read (a spec, a number) holds ≥ 1.6 s.
- Deliver an `.srt` of the title cards, generated from the edit list.

## 5. Motion quality

- **A grid of time**: pick one tempo for the film; every shot starts on a beat and every key action in a pose (release, contact, landing) lands on an integer beat.
- **Pace ladder**: normal cards last one bar; related sub-items become half-length rapid-fire runs. A second tempo comes from dividing the beat, never from changing tempo.
- Easing: exponential ease-out for entrances, exponential in-out for whips and wipes; a back ease once at most.
- **Type enters by mask slide-up**: title first, second line ~0.08 s later, tag after; meta lines type on without a caret. Short cards compress all timings.
- **Figure assembly**: the figure arrives as horizontal bands sliding into register from alternating sides.
- **Backgrounds breathe**: rows drift in alternating directions; on chapter cards they jump a quarter-cell on beats.
- **Transitions** snap to the grid: sliding rows, dropping columns, a push, quarter-discs from cell corners, an iris from the last figure, a tile flip. Rotate them; each lasts a few frames around the cut.
- **Motion blur only where things move**: sub-frame averaging inside transition and whip windows; static frames render once.

## 6. Camera grammar

Mostly a locked flat frame; energy comes from row shifts, transitions and figure actions. When the camera moves, it moves along the grid. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Locked flat frame | clarity, the card as a poster | any item; a spec that must be read |
| Lateral track with a one-screen whip per beat | one continuous family, momentum | a line of stations; a production line; a route |
| Slow drift along a row | calm, browsing | a gallery; a menu; a slower chapter |
| Vertical scroll by grid rows | ranking, depth, descent | a top-ten; floors of a building; ocean depths |
| Push into one motif cell until it becomes the next frame | zooming into a part | an ingredient inside a dish; a city inside a map |
| Pull back to a tiled wall of items | the whole set at once | a summary; "all of them"; a comparison |
| Tiles collapsing to one point | many become one | a merger; a shared goal; a count reaching zero |
| Split screen along a grid line | two items side by side | versus; before/after; two versions |

Framing: text and figure never overlap (one text column, one stage); horizontal poses move the stage outward. The HUD stays in the corners. Allowed transitions are the grid ones in §5; never dissolves, 3D camera moves, handheld shake or depth of field.

## 7. Sound palette

- **Type and music can carry the film alone**; a voice is optional, calm, one line per chapter at most.
- **Percussion is the spine**: choose a drum family that suits the topic (frame drums, taiko, marching snares, steel pans, body percussion, an electronic kit) plus rim clicks, claps, shakers and crashes.
- Colour instruments on top: Karplus-Strong plucks (any lute, koto or harp-like voice, with pitch bends), mallets (marimba, glockenspiel), detuned-saw chord stabs, a synth bass, pads, risers and a drone.
- **Per-family accents**: every shot onset gets a hit chosen by chapter (a splash, a pok, a clank, a crack, a whoosh, a sizzle): foley reads the chapter's matter.
- **Picture-locked by data**: the score reads the edit list's shot times and places accents there; check every onset to ±15 ms.
- **Silence as a tool**: half a beat of drums-and-bass-muted before a big hit, or one whole bar stripped to a single ticking sound under a count.
- Mix: glue compressor and limiter, −14 LUFS, ≤ −1 dBTP.

## 8. Native moves

A menu: use the ones your film needs.

- **One card = one item.** The count is the hook ("ALL N"). *Fits content like:* every tool in a workshop; every station of a subway line; every dish of a regional cuisine.
- **Chapter = colour.** Families become hues so the viewer always knows where they are. *Fits content like:* instrument sections of an orchestra; food groups; departments of a company.
- **One verb per item.** One body action readable in a bar, or a prop action (a gear turns, a cup pours). *Fits content like:* yoga poses; kitchen techniques; jobs on a construction site.
- **Pace ladder run.** A sub-family at double speed. *Fits content like:* four knife cuts; the bones of a hand; weekday routines.
- **Long take down a track.** Stations one screen apart, the camera whipping on each cut. *Fits content like:* the steps of a recipe; checkpoints of a marathon; stages of a rocket launch.
- **Count-up slam.** A big number rolls to its value on a bar. *Fits content like:* tonnes recycled; members of a club; years of a company.
- **Icon wall.** All pictograms return as a grid and turn one colour. *Fits content like:* a summary of a year; a periodic table of habits; a team roster.

## 9. Pitfalls of the medium

- Figure environments spread into the text column → render the figure layer into its own buffer and fade it out with a gradient mask before the text.
- Cream on light hues fails contrast → dark type and dark figures on light hues; their disc is the lighter tone.
- The sun disc vanishes on the dark neutral → use a lighter tone for it.
- Pattern canvases are large and seeded per card → cache with a bounded LRU; an unbounded cache runs out of memory with parallel renderers.
- Horizontal poses (swimming, lying, crawling) cross the title → move the stage outward and narrow the text column.
- Imitating a real identity too closely → your own palette, mark and slogan from the grid motifs.

## 10. Engine

In `demo/`: `engine.js` (`G.pattern`, `G.motif`, `G.joints` / `G.drawFigure`, `G.keyPose`, `G.maskText`, easings), `poses/base.js` (pose contract, props `G.P`), `edl.js` (edit list in beats), `scenes.js` (layouts, transitions, HUD, motion blur), `lab.mjs` (pose sheets), `music/music.py` (picture-locked score with onset report). API table, pose convention and a minimal example: [DEMO.md](DEMO.md#engine-reference).

## 11. Variation space

You decide the items, grouping, verbs, palette, chapter order, any long take, the pace ladder, opening, ending, music and voice. All far from our demo:

- Structures: **a countdown** (items ranked from N to 1, the camera scrolling down rows, the pace speeding up as the list shortens); **a day in pictograms** (one figure, one card per hour, the palette moving from dawn to night hues); **an assembly** (each card adds one part to a single growing pictogram machine seen in the corner).
- Openings: **a single motif cell** (one cell fills the frame and splits into the grid); **mid-action** (the first pictogram is already running when the type slams in); **a blank grid** (hairlines draw the grid on the beat before any colour appears).
- Endings: **one card held long** (the last item stays while the pattern rows stop, one by one); **the figure walks off** (the last pictogram exits the frame and the HUD ticks out); **reverse assembly** (the grid disassembles into rows that slide off-screen, leaving cream).

---

How our demo was made (story, shots, score, end card, build, engine reference): [DEMO.md](DEMO.md). Read it after your treatment exists.
