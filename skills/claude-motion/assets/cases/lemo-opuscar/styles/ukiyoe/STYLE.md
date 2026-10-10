# Ukiyo-e — Style Prompt

> Edo-period woodblock prints brought to life: flat colour blocks, carved ink lines, bokashi skies, paper you can feel, and a camera that moves over the print like an unrolling handscroll.
> References (grammar only): Hokusai's *Thirty-six Views* (one constant subject placed differently each time; bold geometric cropping); Hiroshige's *Fifty-three Stations* and *Hundred Famous Views* (small figures, rain lines, extreme foreground framing); the anime *Mononoke* (2007) (print texture alive in motion, flat layers sliding, seals as screen language). Never reproduce a specific famous print (no copy of *The Great Wave*, *Red Fuji*, *Sudden Shower over Ōhashi*), and never copy their characters or compositions.

## 1. Essence, and what it is not

Every shot is **a complete woodblock print**: a sheet of washi, a thin double ink border, flat areas of colour printed from separate blocks, a black key-block line on top, a vertical title cartouche and a red seal. The world is flat on purpose. Depth comes from stacked horizontal layers, mist bands and bold cropping, never from perspective rendering, lighting or shading.

What makes it read as *printed* rather than *vector*:
- **Paper** is always visible: warm washi, long fibres, slight edge ageing.
- **Each colour is its own block**, slightly **out of register** (1.5–2.5 px) with the key line.
- Large colour areas show **woodgrain** and **baren rubbing** (uneven ink density, circular streaks) and fine **goma-zuri** specks.
- **Bokashi**, hand-wiped gradients, in skies and water.

Not a flat vector illustration with a paper overlay (no woodgrain, no misregistration), not Chinese ink wash (no bleeding washes, colour is printed, not painted), not anime cel shading (no light and shadow on forms).

## 2. Materials & rendering

- **The sheet is the frame**: the print fills the screen at zoom 1, inside a thick + thin ink border, with a paper margin beyond. Sheets can sit on a long mounting scroll (darker tan paper, a roller at one end), so the camera can travel from print to print.
- **Blocks**: draw each colour group into its own offscreen canvas, cached once (key lines; blues; greens / secondary; reds / figures). Composite each with a small fixed registration offset (1.5–2.5 px, a different direction per block).
- **Texture every colour block**: woodgrain (`source-atop`, strongest in sky and water) → baren streaks → goma-zuri specks (both `destination-out`); the key block gets specks only; light paper fibres over the finished sheet so paper shows through the ink. Big dynamic fills get the same textures inside their clip. Woodgrain = iso-lines of a warped noise field; baren = blurred circular arcs + zigzag streaks (recipe and alphas in [DEMO.md](DEMO.md#palette--props)).
- **Bokashi** is generated per pixel: a gradient whose top edge wanders by low-frequency noise per column (±20–30 px). Never strips of `fillRect` (vertical seams).
- **Line**: key lines 2.4–3 px; large contours are variable-width filled strokes, tapered at both ends, with ±20–35 % low-frequency width jitter. Distant things get a grey key line or none.
- **Motifs of the medium**: mist as long rounded flat bands (suyari-gasumi) fading at both ends; pines with flat-topped **needle pads**; fields as high, flat, parallel layers whose cross lines are **parallel and slanted**, never converging; rain as two sets of fine straight lines at slightly different angles under a sumi bokashi sky; water as banded blues with bokashi between bands, foam and spray left as paper.
- **Seal**: characters cut out of red, chipped edges. **Figures** are small in the landscape (roughly 80–130 px at full sheet), flat, with a clear silhouette; faces in a few strokes.

## 3. Colour logic

- **A pigment set, not a colour wheel**: 6–9 flat hues, each printed from its own block, over the paper ground. No gradients except bokashi, no shading on forms.
- **Sumi key line** over everything; **paper is the white** (no white pigment for foam, snow, mist, blank sky).
- **One dominant hue family** carries sky and water (in the 19th-century prints, Prussian blue); **red is rare**: seals, a sun, one garment or tab.
- Far layers pale and low-contrast, near layers saturated with dark key lines.
- Examples, one per film: an indigo-and-beni landscape (Prussian blue, pale blue, beni red, ochre, greens, sumi, as in our demo); a bijin-ga interior (pale pink, mauve, grey-green, lacquer black, a mica-grey ground); an autumn surimono (persimmon, ochre, grey-green, deep brown, one blue).

## 4. Type & subtitles

- **Subtitle = a horizontal cartouche**: a cream slip with a thick + thin ink border and a small red seal at the left; Shippori Mincho (500) in sumi, centred near the bottom. It "prints" in with the reveal mask and fades out. Hold ≥ max(1.8 s, speech + 0.6 s). It covers the bottom ~150 px: keep ground lines and figures above it.
- **View cartouche**: vertical cream slip, thick + thin border, a pale tab with the series title, the view title below in a brush font (e.g. Yuji Syuku), a seal beside: the "full stop" of each view. Titles live on the print as cartouches and seals, never as floating type.

## 5. Motion quality

- Prints are still. **Most of the frame does not move**; each view has one or two small actions (steam, rain, a lantern, a falling leaf).
- **Figures and nature step at 8 fps**; rain and fast water at **12 fps**; **the camera moves on ones (24 fps)**. A stepped camera judders.
- **Printing reveal**: each block appears over ~0.3 s with a diagonal baren sweep with a noisy edge, sliding 5–6 px into registration as it lands (pure noise looks like mould).
- Cartouches drop in (fade + a short slide); a seal *stamps* (scale ~1.35 → 1 in 0.2 s).
- A native move needs a **held beat of about a second** to be read; a peak flashed in under a second reads as noise.

## 6. Camera grammar

The camera moves *over* prints and between them; it never rotates in 3D space inside one. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Locked frame on one sheet | Reading a print on a wall | a place; a portrait; a still moment |
| Handscroll slide, right → left through the mounting gap (shorter slides = urgency) | Travel, the next station | a journey; a sequence of steps; a race |
| Very slow push toward a framing device (a window, a fan, a gate) | Attention narrowing | discovery; longing; a detail that matters |
| Tilt past the border into the mount | Something larger than the print | a flood; a rumour; a giant |
| Pull-back from one sheet to many | The series seen whole | a summary; a timeline; a collection |
| Crash-zoom into the texture (grain, specks, fibres) | The medium itself becomes the image | a dream; a breakdown; a memory dissolving |
| Pan across a triptych (three sheets side by side) | One scene too wide for one sheet | a procession; a battle; a festival |
| Hard cut to a blank sheet | Ma (間), a held breath | aftermath; a pause before a decision |

Framing: bold cropping and extreme foreground elements (a branch, a post, a lantern crossing the frame) are native; depth by stacking, never by perspective. Allowed transitions: scroll slides, printing reveals, a wash back to paper, a cut to blank. No cross-dissolves, no 3D flips.

## 7. Sound palette

- **Japanese instruments, not piano and pads**: shamisen (`core/audio/pluck.py shamisen`, with sawari buzz), shakuhachi, koto, taiko and shime-daiko, kotsuzumi / ōtsuzumi calls, hyōshigi (wooden clappers), a small bell.
- **Modes**: miyako-bushi (in scale), yō, ritsu; long breathy tones with a slide into each note and *meri* drops at phrase ends suit the shakuhachi; the shamisen can hold a pulse or an ostinato.
- **Techniques, as options**: absolute silence as *ma* (cut reverb tails too); a single sawari note left ringing; free-rhythm breath phrases against a steady pulse; clappers that accelerate (the kabuki curtain call); a taiko heartbeat that tightens into a roll; a koto glissando for a turn of season; a drum call (*kakegoe*) before an entrance.
- **Foley follows the material**: paper (baren rub = band-passed noise with a slow circular modulation; scroll slide; seal = low thump + tacky peel), wood (block set down, hollow steps), glass (wind chime), water, birds and insects of the season.
- **Voice**: calm, few short lines, like a poem written beside the print. Duck music ~8 dB under voice, ambience ~4 dB. Loudness −14 LUFS; `mux.sh` grain **0** (the paper is the grain).

## 8. Native moves

A menu: use the ones your story needs.

- **A series of views.** One constant subject in different compositions; the story is told by *where it sits in the frame* each time. *Fits content like:* one building through a century; a product in five homes; the same street in four seasons.
- **The handscroll.** Scenes don't cut; the camera slides right to left and the next print arrives. *Fits content like:* a supply chain; the stations of a pilgrimage; the steps of a recipe.
- **Printing, block by block.** Key line first, then each colour lands slightly off and snaps into register. *Fits content like:* a building going up; an idea taking shape; a character being "made" for the story.
- **Paper is the white.** Foam, snow, mist and blank sky are unprinted paper; white can flood the frame and wash the print back to a blank sheet. *Fits content like:* a snowfall that erases a town; forgetting; a clean start.
- **The frame is an object.** Border, cartouche and seal are physical; something big enough breaks out of the border into the mount. *Fits content like:* a festival that can't be contained; a legend; a runaway success.
- **Alternate impressions.** The same key block reprinted with different colour blocks (day → night, spring → winter). *Fits content like:* before and after; a city lit at night; two lives in one house.
- **The triptych.** A scene split across three sheets that join. *Fits content like:* three generations; a panorama of a harbour; a debate between three voices.

## 9. Pitfalls of the medium

- Bokashi from `fillRect` strips leaves vertical seams → build it per pixel.
- Too much speckle or fibre makes dark areas look like sandpaper or scratched film → specks α ≈ 0.3, fibres α ≈ 0.09.
- A perspective grid for fields looks digital → parallel, slanted, flat layering.
- Pine clusters drawn as half-discs look like parasols → flat pads with needle fans.
- Offset curves self-intersect at tight bends → build inner lines from the gentle side of the contour; force control points x-monotonic.
- Breaking out of the print must escape **both** the sheet clip and the frame clip.
- A seal drawn with `multiply` vanishes on dark ground → `source-over` there.

## 10. Engine

In `demo/`: `print.js` (paper, woodgrain, baren, specks, blocks, bokashi, carved lines, reveal masks, cartouche, seals: the reusable core), `nature.js` (mountains, pines, rocks, rain, birds), `wave.js` (banded water, fractal claws, spray), `traveler.js` (flat figure rig), `views.js` (prints as cached blocks + per-frame `paint()`), `main.js` (camera, scroll, reveal, subtitles), `music/score.py`. Instrument recipes and commands: [DEMO.md](DEMO.md#build-notes).

## 11. Variation space

You decide the constant subject (or none), the number of views, the characters, the opening, the ending, the camera path, the pacing and the pigment set. All far from our demo:

- Structures: **alternate impressions** (one key block of a single street, reprinted for dawn, rain, festival night and snow); **a triptych unfolding** (three sheets revealed one at a time, the story only readable when all three join); **a print being made** (the carver's blocks, one per shot, each block's colour telling one chapter).
- Openings: **a close crop** (an extreme foreground detail, a lantern or a sleeve, fills the sheet; the pull-back finds the print); **the bare block** (carved wood inked, the paper laid on, the baren rubs; lifted to reveal the first print); **the mount first** (a closed scroll unrolls to its first sheet).
- Endings: **a seal alone** (the print fades back to paper, only the red seal remains); **the album closes** (sheets stack like pages, the cover lands); **the last print left unfinished** (key line only, colour blocks never land).

---

How our demo was made (story, shots, score, end card, build): [DEMO.md](DEMO.md). Read it after your treatment exists.
