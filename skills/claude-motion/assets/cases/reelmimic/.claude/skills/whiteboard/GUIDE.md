# Whiteboard engine — drawing & animation guide

Read this whole file before drawing anything. It covers the look, the rules that make a whiteboard explainer read
well, the complete API, the characters, and the review loop. Open the model sheets first:
`docs/kit.jpg` (icons, strokes, fills, handwriting), `docs/faces.jpg` (all 16 expressions, Bo + Mochi),
`docs/poses.jpg` (views, walk cycle, jump, props) and `docs/demo-sheet.jpg` (the 10 s demo, `template/src/scenes/demo.js`).

---

## 1. The look

A clean, warm whiteboard / sketch-note explainer. An off-white board with a faint speckle, soft eraser swirls and
the ghosts of old writing; black marker outlines that draw themselves on at a steady hand pace; a cartoon right hand
with a marker (the marker's colour = the ink being drawn) following the pen tip; a few accent colours; handwritten
titles; colouring-in with a broad marker or highlighter that is slightly off-register with the line.

- **Palette.** `INK.black` for every outline and most text. Accents `INK.blue`, `INK.red`, `INK.orange`, `INK.green`
  (plus `purple`, `grey`, `yellow`, `pink`). Highlighters `HL.yellow/pink/green/blue/orange` (translucent, multiply).
  One board area = black + 1–2 accents. Colour means something (red = problem, green = good, blue = the product…).
- **One marker.** Lines are `WB.w` = 9 px at zoom 1 (details 0.6–0.8×, emphasis 1.4×). Icons and characters scale,
  line weight doesn't — that's what makes it look like one person drew the whole board.
- **Surfaces.** `bg: {kind: 'white'}` (default whiteboard), `'paper'` (ruled cream notebook, optional red `margin`
  x), `'grid'` (squared paper). `frame: [x,y,w,h]` draws the physical board (aluminium frame, marker tray, wall
  around) — great for a first establishing shot that then pushes in.
- **Drawn, not placed.** Everything appears through the hand: `drawOn` for strokes, `writeOn` for text. The only
  things that move after being drawn are the characters (and props they carry), the camera, and small effects
  (emotes, rays, hearts).
- **Flat 2D.** No 3D, no perspective tricks. Depth by overlap and size only.

## 2. Timing: reads and the hand

A whiteboard video is a sequence of drawings, and each drawing is a *read*. The viewer watches the pen, so the pen
leads the eye — use that.

- **Pace.** Drawing speed is about 1,500–2,500 px of line per second for simple icons, text ≈ 7–10 characters/s
  (`writeOn('Got an idea?', …, .15, 1.0)` = 12 chars in 0.85 s). A character (Bo) takes 1.0–1.3 s. Faster reads as
  "sped up" (fine for filler), slower drags.
- **One read at a time.** Don't draw two things at once unless they're one idea (`{ all: true }` draws all strokes
  of a list in parallel — for rays, sparkles, motion lines).
- **Hold after drawing.** Give each finished drawing 0.3–0.8 s before the next starts, longer for the key point.
- **The hand covers the lower right** of the pen tip, and its forearm runs to the bottom-right corner. Never let it
  sit over a reaction. Order: draw → the hand leaves (automatically, ~0.6 s after the last `drawOn` if nothing follows
  within ~1.1 s) → the character acts. In the demo, Mochi reacts only after "Share it!" is written and the hand is gone.
- **Hand travel.** Between drawings less than 1.1 s apart the hand glides (lifted, on an arc) from the end of one to
  the start of the next; otherwise it exits bottom-right and re-enters 0.6 s before the next drawing. Plan drawing
  starts so this looks deliberate (left → right, top → bottom, like a person writing).
- **Let the last read land.** End with ≥ 0.4 s with no hand in frame.

## 3. Shots, the board and the camera

```js
// src/scenes/my_video.js
(() => {
  function intro(t, lt, dur) {                    // t = video time, lt = time in this shot, dur = shot length
    wbBegin(lt, { cam: [[0, [700, 480, 1.12]], [1.1, [700, 480, 1.08]], [2.1, [1170, 560, 1]]] });
    …draw in WORLD coordinates…
    camEnd();                                     // then SCREEN-space transitions
    eraseWipe(seg(lt, dur - .75, dur), { rows: 3 });
  }
  shots([[0, intro] /*, [5.5, next] */]);
  wbCaptions([[.4, 5, '每個*好點子*，都從一筆開始']]);
})();
```

- `wbBegin(lt, o)` sets the drawing clock (`WB.clock = lt`, so all `a,b` times in `drawOn`/`writeOn` are shot-local),
  starts the camera and paints the board. `o.cam` is `[cx, cy, zoom]` or keyframes `[[t, [cx, cy, zoom]], …]`
  (eased; `o.ease` to change); `o.drift` (px, default 6) adds a barely-there float so the frame is never dead.
- **The big board.** World coordinates are free: lay ideas out across a board several screens wide, and move the
  camera between them ("slide to the next part of the board") inside ONE shot. That is the signature whiteboard
  transition. Zoom 1.0–1.15 for working shots, 0.8–0.9 to reveal a finished diagram, `frame` board at ~0.5 for an
  establishing view.
- **New board = new shot**, joined by `eraseWipe` (end of the old shot), `pageFlip` (start of the new shot) or a
  camera pan that ends on empty board.
- `camEnd()` is called automatically after the shot function if you didn't; call it yourself before screen-space
  effects (`eraseWipe`, `pageFlip`, anything in screen pixels).

## 4. Strokes

A drawing is an array of strokes (nested arrays and `null`/`false` are fine; they're flattened). Builders return a
stroke or an array; spread arrays with `...`.

| builder | notes |
|---|---|
| `S.line(x1,y1,x2,y2,o)` | slight bow + wobble |
| `S.path(pts,o)` | smooth curve through points; `o.closed`, `o.sharp:[i…]` corners, `o.straight` polyline |
| `S.circle(cx,cy,rx,ry,o)` | hand circle: starts upper-left, overshoots (`turns` 1.06), `o.cw` |
| `S.ring(cx,cy,rx,ry)` | loose loop around a word (1.14 turns, spirals) |
| `S.arc(cx,cy,r,a0,a1)`, `S.dot(x,y,r)` | |
| `S.rect(x,y,w,h,o)` | one continuous stroke, `o.r` rounded |
| `S.arrow(x1,y1,x2,y2,o)` | curved shaft (`o.bend`, fraction of length; negative bends the other way) + head (`o.head` px) |
| `S.underline(x,y,w,o)` | `o.double` adds a shorter second line |
| `S.wave/zigzag/spiral` | |
| `S.bubble(cx,cy,rx,ry,[tx,ty])` | speech bubble with tail |
| `S.box(x,y,w,h,{tail:[tx,ty], r})` | callout box, tail from the bottom edge |
| `S.cloud(cx,cy,rx,ry,{bumps})` | thought cloud |
| `S.heart(cx,cy,w)`, `S.star(cx,cy,r)`, `S.check(x,y,s)`, `S.cross(x,y,s)` | |
| `S.rays(cx,cy,r1,r2,n,{a0,a1})` | emphasis lines around a point (fan with a0..a1) |
| `S.sparkle(x,y,s)`, `S.speed(x,y,len,ang,n,gap)` | twinkle, motion lines |
| `S.fill(poly, {col, alpha, mode, shift, z, cost})` | coloured-in shape (see below) |
| `hatch(poly, {angle, gap, col, w, zig})` | quick parallel hatching (or one zigzag scribble with `zig`) |
| `scribble(poly, {col, w, gap})` | highlighter scribble fill |
| `hilite(x,y,w,h,{col})` | highlighter bar behind text (use `writeOn`'s box) |
| `polyCircle(cx,cy,rx,ry)`, `polyRect(x,y,w,h,r)` | polygons for fills/hatching |
| `place(strokes, x, y, ang, scale)`, `tint(strokes, col)`, `layer(strokes, z)` | transform / recolour / reorder |

Common options: `col`, `w` (width), `z` (paint order, default 0), `alpha`, `key` (wobble seed), `wob` (wobble px, 0 =
none), `hl: true` (highlighter stroke).

**Fills.** `S.fill` is the "coloured in with a broad marker" look: the marker texture, a little off-register
(`shift:[dx,dy]`). `mode:'ink'` (default) multiplies, so black lines under it still show and colours darken where they
overlap; `mode:'cover'` is opaque (use it to hide lines behind a shape, e.g. a head over a body). Default `z` is −1 so
fills sit under outlines while being revealed LAST (colour-in after the outline). When drawn on, a fill is revealed by
a slanted sweep and the hand zigzags across it.

**Wobble seeds.** Each builder seeds its wobble from its coordinates, so a static drawing is stable. A stroke that
MOVES (a prop in a hand, anything whose coordinates change per frame) must get a fixed `key`, or its wobble changes
every frame (shimmer). `ICON.*` take `{key}`; characters and props handle it.

### drawOn / ink

```js
drawOn(strokes, a, b, o) → { p, done, tip }
```
Reveals `strokes` in array order between `a` and `b` (shot-local seconds) by arc length, with a short pen-lift between
strokes (`o.gap`, px of travel), eased slightly. Paints in `z` order. Options: `hand:false` (no hand for this one),
`all:true` (all strokes at once), `x,y` offset, `alpha` (fade a finished drawing), `t` (clock override).
**Call it every frame of the shot** — before `a` it paints nothing but still tells the hand what's coming.
`ink(strokes, {alpha})` paints fully, no hand.

To remove a drawing mid-shot: `eraseRect(x, y, w, h, a, b)` (world) scrubs that area with the eraser and restores
the board surface (paper lines included), or fade it with `{alpha}` (less whiteboard-like).

## 5. Handwriting

```js
const box = writeOn('Save time\n省時間', x, y, a, b, { size: 110, col: INK.blue, align: 'left'|'center'|'right', lh: 1.22, weight: 700 })
// box = { x, y, w, h, cx, cy, x2, y2, base, p, done, tip }
```
`x,y` = baseline start of the first line (or its centre / right end with `align`). Each character is revealed by a
slanted clip sweeping left → right while the hand bobs like it's forming letters; characters sit on a slightly uneven
baseline with a small tilt (`jitter: 0` for neat). Time per character follows its width (spaces are quick).

Fonts: **Kalam 700** for Latin, **LXGW WenKai TC 700** for CJK (both Google Fonts, loaded in `studio.html`; Klee One /
cursive as fallback). Emphasis patterns: `hilite(box.x, box.y, box.w, box.h)` behind a word, `S.underline(box.x,
box.y2 + 4, box.w)`, `S.ring(box.cx, box.cy, box.w/2 + 30, box.h/2 + 20)` around it, an arrow into it.
`textBox(text, x, y, o)` measures without drawing (for layout).

## 6. Icons

`ICON.<name>(cx, cy, size = 140, { col, key, rot, rays })` → strokes, centred, `size` ≈ height. `col` = accent fill.
bulb (`rays:true`), clock, coin, money, heart, check, cross, checkbox, phone, house, star, chart, gear, mail, search,
target, cloud, trophy, person. Make new ones the same way (see the `B(...)` definitions in `whiteboard.js`): build at
the origin in 0..100 units, outline strokes + one `S.fill`, return via `place`.

## 7. The hand

Scenes never draw the hand. Each `drawOn`/`writeOn` records where its pen is; after the shot, `ENGINE.end` draws one
hand at the active pen tip (or gliding / entering / leaving as described in §2). The marker cap and nib take the
colour of the ink being drawn; a highlighter stroke shows a highlighter colour.
- `WB.hand = false` hides it for the rest of the frame (set per shot), `{hand:false}` per call.
- `handAt(x, y, {tool:'marker'|'eraser', col})` forces the hand to a world point this frame (pointing, hovering).
- `WB.sleeve` = shirt colour, `WB.handScale` (0.85) = size. It scales mildly with camera zoom.
- The eraser (`eraseWipe`, `eraseRect`) uses the same hand holding a board eraser.

## 8. Characters (`src/cast.js`)

Two originals, both drawn with the same marker lines, so they can be drawn on like any drawing and then act.

- **Bo** — `bo(x, y, u, o)`: a round-headed kid, black mop of hair with one curl on top, orange shirt (`o.shirt`),
  noodle arms and legs with round mitten hands and black shoes. ~10.5u tall (head r 2.35u). Front, 3/4 and side views.
- **Mochi** — `mochi(x, y, u, o)`: a round white cat with one orange ear and an orange-tipped tail, whiskers, pink
  nose. ~7.8u tall sitting (front), a loaf on four legs in side view (`view ≥ .5`), which can walk. Its front legs are
  its "arms" (raise them to wave or hold); in side view it carries `hold.R` in its mouth.

`x, y` = ground point between the feet. Sizes: wide shot u 15–25, medium u 30–45, close-up u 60–90.

Options (both): `face` (EXPR name) · `look: [lx, ly]` (−1..1) · `view` 0 front … 1 side (continuous for Bo: 0.5 = 3/4)
· `flip` (face left) · `sq` squash (+) / stretch (−) · `dy` lift in u (up is negative) · `tilt` · `arm: [[ang, bend],
[ang, bend]]` (degrees; index 0 = screen-left arm in front view, far arm in side view; 0 = hanging, + = outward /
forward and up, 170 = straight up; bend + lifts the forearm) · `leg` (Bo) · `walk` (phase in cycles) · `hold: {L, R}`
(a `PROPS` name or `fn(x, y, u, key) → strokes`, grip at the hand) · `emote` ('!', '?', 'zzz', 'hearts', 'sweat',
'anger', 'sparkle', 'lines', 'swirl'; '-' suppresses the expression's own) · `draw: [a, b]` (drawn on with the hand,
outline first, colour last) · `hand:false` · `blink` (force) / `noBlink` · `t` (time for blinks/idles) · `id` (wobble
seed; give copies different ids) · `strokesOnly` (build without drawing, to measure: `bo(…, {strokesOnly:true}).hand.R`).

Returns `{ hand: { L, R }, head, top, strokes }` in world coordinates — attach effects, place the next drawing, or
make a prop wait exactly where a hand will be (the demo pre-draws the bulb at Bo's hand position at the top of his
jump, so the grab is seamless).

**Expressions** (`EXPR_NAMES`): neutral, happy, laugh, sad, cry, angry, surprised, scared, love, sleepy, thinking,
wink, proud, confused, excited, dizzy. Each has eyes/brows/mouth + an optional effect (tears, anger mark, sweat drop,
floating hearts, zzz, ?, !, sparkles). Add new ones to `EXPR`.

**Acting helpers**
- `mood(lt, [[0,'thinking'], [3.0,'surprised', .55], [3.35,'excited']])` → `{face, sq, dy, blink}`: each change gets
  a blink on the swap and a take (anticipation squash → stretch → settle). Spread `sq`/`dy` into the pose (add them to
  a jump's).
- `jump(lt, t0, t1, h)` (kit) → `{dy, sq}`: crouch 0.12 s before `t0`, arc, landing squash with wobble.
- `take(lt, t0, amt)` (kit), `spring`, `backOut`, `kf(lt, keys, easing)` to animate `arm` angles.
- `stroll(lt, t0, t1, x0, x1, u)` → `{x, walk, flip, moving}`: pass `x` and `walk` (null when standing) with `view: 1`.
- Blinks are automatic (~every 3.4 s, per `id`).

**Props** (`PROPS`): bulb, bulbOn (with rays), phone, coin, heart, star, flag, balloon, book, cup, fish, marker, sign
(blank board on a stick — `writeOn` onto it). They're upright, gripped at the hand.

Rules for characters: never draw their parts in a scene (use options or extend `cast.js`); limbs are single noodle
strokes from inside the torso, so they always stay attached; change faces through `mood()`, not by swapping between
frames; push poses (arms really up, real crouches) — subtle reads as nothing at this line weight.

## 9. Transitions

- **Camera pan across the board** (in-shot): keyframe `cam` from one area to the next; start drawing in the new area
  as the camera settles. Best for continuing an argument.
- **Eraser wipe** `eraseWipe(p, {rows: 3, ghost: .06})` — screen space, at the end of a shot, `p = seg(lt, dur - .75,
  dur)`. The hand scrubs the whole board in zigzag passes; a faint ghost of the old drawing stays (real whiteboards do
  that). The next shot starts on a clean board.
- **Page flip** `pageFlip(p)` — screen space, at the START of the next shot after `camEnd()`, `p = seg(lt, 0, .9)`.
  The previous shot's last frame curls away from the bottom-right corner, with a shadow and paper back. Suits the
  `paper`/`grid` notebook boards. Start drawing on the new page as the flap clears (≈ p 0.7).
- **Erase one area** `eraseRect(x, y, w, h, a, b)` (world) to swap a piece of the diagram.
- Every seam gets one; the first shot can open on the empty board with the hand entering, the last ends on a held
  finished board.

## 10. Captions

`wbCaptions([[a, b, 'text with *accent* words'], …], {accent, size, y})` installs `window.overlayHook`: a white card
with a dark outline, handwritten font (CJK ok), pops in with a small overshoot. `*word*` is coloured (`INK.orange`
default). Or call `wbCaption(c, text, o)` from your own overlay hook. Keep captions short (≤ 16 CJK chars / 40 Latin)
and keep drawings out of the bottom ~130 px while a caption is on screen.

## 11. Review loop

You can't see motion by reading code. Render and open every image with Read:
```bash
node render.mjs --sheet=0.5,1.5,2.5,3.5,4.5 --cols=5 --w=384 --out=out/check/shot.jpg
node render.mjs --strip=3.5:4.4 --cols=8 --w=240 --out=out/check/jump.jpg
node render.mjs --sheet=3.2,4.6 --crop-at=1340,640,560,560 --w=560 --out=out/check/face.jpg
```
Check:
- **Look**: unmistakably whiteboard? one line weight? accents meaningful and few? anything tiny, clipped, muddy?
- **Reads**: every drawing has time to be drawn AND held; the hand never covers an action or reaction; the pen
  order is natural (left→right, top→bottom); the final frame is hand-free.
- **Characters**: on-model, big enough, limbs attached, props touching the hand, faces changed via `mood()`,
  anticipation before jumps, landing squash.
- **Stability**: in a strip, static drawings must not shimmer (missing `key` on moving strokes), the hand must not
  jump between frames (always call future `drawOn`s every frame).
- **Seams**: transitions at every cut; captions readable at phone size (a 480 px sheet is roughly a phone).
Fix, re-render, look again.

## 12. Known pitfalls

- A `drawOn` wrapped in `if (lt > a)` makes the hand pop in instead of entering; call it unconditionally.
- Two overlapping `drawOn` intervals: the hand follows the most recently started one; the other keeps drawing
  "by itself". Chain them instead.
- Fill `cost` (drawing time) is from its bounding box; set `{cost}` to speed up / slow down colouring-in.
- `writeOn` text needs its characters in the loaded font: text coming from outside the scene files → put it in
  `window.WB_TEXT` (before boot) so the CJK slices get fetched.
- Very large zoom (> 2) makes lines fat: build close-ups with a larger `u`/size at zoom ≈ 1 instead.
- `pageFlip` renders the previous shot inside the current one; keep that previous shot free of screen-space effects
  in its last frame, and don't flip from a shot that itself ends in `eraseWipe`.
- Performance: 20–60 ms/frame; the first frame of a render builds textures/sprites (~150 ms). Thousands of strokes
  per frame (dense hatching over big areas) slow it down — prefer `S.fill` / `scribble`.
