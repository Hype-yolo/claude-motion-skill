# Paper cut-out engine: the guide

Read this whole file before drawing. It covers the look, the full API with examples, the puppet system, how to review
and the known pitfalls. For storytelling craft (reads, timing, anticipation, one read at a time, transitions at every
seam, "something happens in every shot") follow `.claude/skills/painted-animation/template/ANIMATION_GUIDE.md` — it
applies here unchanged, except that this engine **does** allow captions (via `captionTrack`).

Model sheets: `docs/expressions.jpg` (all 13 expressions, both puppets, both views), `docs/poses.jpg` (holding,
walking, jumping), `docs/demo-sheet.jpg` (the demo). Re-render them any time:
`node render.mjs --loop=faces --sheet=0 --cols=1 --w=1600 --out=out/check/faces.jpg` (and `--loop=poses`).

---

## 1. The look

A tabletop stop-motion film made of paper. Everything on screen is a cut or torn piece of real-looking paper lying on
the layer below, lit by a warm lamp from the top-left and photographed a frame at a time.

- **Materials** (`mat`): `paper` construction paper (default: mottled, fibres), `card` smooth cardstock (whites, eyes,
  labels, clouds), `kraft` brown fibre paper with specks (trunks, sticks, paths, boxes), `felt` fuzzy (rugs, animals,
  cosy things), `tissue` see-through and multiplies over what's under it (glows, water, cheeks, sun cores, glass),
  `corr` corrugated card (boxes, buildings, signs), `wood` (the table itself). Textures are generated once in
  `ENGINE.setup` and cached per colour.
- **Edges.** Scissor cuts are slightly faceted and wobbly (deterministic per `seed`). Torn edges (`torn:`) get a jagged
  line and a lighter fibrous rim — use them for hills, grounds, water, labels and anything "ripped out of a magazine".
- **Depth is shadow.** Each piece drops a soft warm shadow down-right; `depth` sets how far above the layer below it
  floats (offset + blur). Stack layers from back to front: backdrop (0) → far hills .3–.8 → set pieces ~1 → puppets
  1–1.3 → things lifted off the page 1.5–3. Parallax with `layer(k)`.
- **Palette** `PC.*`: construction-paper colours (`cream sky mint sage leaf grass forest teal orange tangerine mustard
  yellow lemon red tomato rose pink blush peach lilac violet plum navy blue kraft cork brown bark ink …`). Use hex
  colours only (`mixCol(a, b, k)` to blend). Avoid pure black and white — use `PC.ink`, `PC.white` (warm).
- **Photographed finish** (automatic, `ENGINE.end`): warm lamp falloff/vignette, a soft warm spot top-left, per-step
  exposure flicker and a light grain that changes each step. Tune with `PAPER.vignette / flicker / grain / shadow`
  (0 turns off).
- **Stop-motion.** Puppets and props move in steps of `PAPER.fps` (12/s) — use `sm(lt)` for every pose. Each puppet
  piece shifts a hair per step (`PAPER.jit`, set automatically ≈ u/50 px) like hand-placed paper. Set dressing is glued
  (no jitter) but can `sway()` in steps. Camera: smooth (motion-control rig) or `stepped` (hand-nudged).
- **No 3D projection.** Turns use the drawn `front` / `3q` views; depth is overlap, scale, shadow and parallax only.

## 2. Structure of a video

```
studio.html → src/config.js, src/kit.js, fonts, src/cutout.js, src/cast.js, src/scenes/<shot>.js …
```

```js
// src/scenes/meadow.js
(() => {
  function meadow(t, lt, dur) {                       // t = video time, lt = time in shot, dur = shot length
    const st = sm(lt);                                // the stop-motion clock: use it for all poses
    paperCam(lt, [[0, [960, 540, 1]], [dur, [930, 560, 1.12]]]);            // slow push-in (smooth)
    backdrop(PC.sky, { to: 'rgba(255,240,210,.35)' });
    layer(.3, () => { sun(1560, 190, 85); cloud(420, 210, 300, { hang: 'string', seed: 1 }); });
    layer(.6, () => hills(960, 720, 3800, 110, PC.mint, { seed: 3 }));
    hills(960, 920, 3800, 50, PC.leaf, { seed: 5 });
    const m = moods(lt, [[0, 'neutral'], [1.2, 'surprised']]);
    const J = pom(800, 960, 64, { view: '3q', ...m, look: [.6, -.4], armR: [100, 10], holdR: 'balloon' });
    if (st >= 1.2) emote('!', J.top[0], J.top[1] - 20, 40, st - 1.2);
    layer(1.25, () => grass(400, 1010, 900, 60, PC.grass, 3));             // foreground plane
    camEnd();                                          // transitions are screen-space: after camEnd
    trTear(t, seg(sm(lt), 0, .7));                     // this shot tears in over the previous one
  }
  shots([[4.25, meadow]]);
})();
```

A shot paints the whole frame. Use one file per shot; scenes only call the library and the cast.

## 3. API reference (`src/cutout.js`)

### Time & randomness
- `sm(lt, fps = PAPER.fps)` — stepped time (hold each pose for 1/12 s). `onStep`, `onTwos`, `seg`, `kf`, `ease*`,
  `spring`, `jump`, `take`, `arcPt`, `hash`, `rnd(key)` come from kit.js.
- `sway(key, amp, freq)` — stepped sine for set dressing (trees, flags, dangling things); phase from `key`.
- `fbm1(x, seed)` — smooth 1D noise 0..1.

### Shapes (`SH`) — dense outlines in local px around (0,0)
| call | notes |
|---|---|
| `SH.ellipse(rx, ry)`, `SH.circle(r)` | |
| `SH.rect(w, h)`, `SH.round(w, h, r)` | centred |
| `SH.poly([[x,y],…])` | straight edges, sharp corners |
| `SH.smooth([[x,y,corner?],…])` | closed Catmull-Rom curve through the points — the general organic tool |
| `SH.capsule(len, r0, r1)` | limb from (0,0) down to (0,len) with round ends; rotate with `rot` |
| `SH.blob(r, n, amt, seed)` | lumpy circle (foliage, bushes) |
| `SH.cloud(w, h, seed)` | scalloped top, flat bottom; origin at bottom centre |
| `SH.leaf(len, w)` | from (0,0) up to (0,-len) |
| `SH.heart(s)`, `SH.star(r1, r2, n)`, `SH.drop(r)`, `SH.tri(w, h)` | |
| `SH.band(r, th, a0, a1)` | curved strip (smiles, brows, rainbows, tails); angles in deg, 0 = right, 90 = down |
| `SH.zig(w, h, n, seed)` | zig-zag top strip (grass, fringe); base at y=0 |
| `SH.hills(w, h, n, seed, down)` | rolling top edge around y=0, extends `down` px |
| `clipHalf(shape, nx, ny, c)` | keep the part where nx·x + ny·y ≤ c (eyelids, bibs, half moons) |
| `xform(shape, dx, dy, sx, sy)` | move/scale a shape |

### The piece
`piece(shape, o)` draws one cut-out. Options:
`x, y` position · `rot` degrees · `sx, sy` scale (mirror with -1) · `col` hex · `mat` material · `depth` shadow height
(default 1) · `seed` (cut wobble, texture offset, jitter — give every distinct piece its own) · `torn: true | 'top' |
'bottom' | 'left' | 'right' | 'sides'` · `tornAmp` (px, default 5) · `rim` colour of the torn core · `wob` scissor
wobble px · `alpha` · `jit` per-step jitter px (default `PAPER.jit`) · `edge: false` (no thin edge line).

Other primitives: `brad(x, y, r)` brass split pin · `thread(pts, { col, w })` string with a faint shadow ·
`popUp(k, x, y, fn)` draws `fn` unfolding from a hinge line at y (pop-up book elements; k 0 → 1) ·
`mat(col, kind)` / `matPat(col, kind, seed)` the texture patterns · `setShadow(depth)` / `noShadow()`.

### Camera & depth
- `paperCam(lt, keys, { stepped, fps, ease })` — keys `[[t, [cx, cy, zoom, rotDeg]], …]` in shot time; calls
  kit's `camBegin`. End with `camEnd()`.
- `layer(k, fn)` — parallax plane inside the camera: `k < 1` far (moves and zooms less), `k > 1` foreground.
- `backdrop(col, { to, mat, par })` — screen-filling sheet; `to` = gradient colour toward the bottom; `par` how much
  it slides with the camera (default .15).
- `table({ col })` — the wooden table (seen around flip cards / pop-up pages).

### Set dressing
`hills(x, y, w, h, col, { bumps, seed, depth, torn, tornAmp, mat, down })` ·
`grass(x, y, w, h, col, seed)` · `tree(x, y, s, { cols, trunk, seed, sway, fruit })` → `{ top, fruit: [[x,y]…], sway }`
(`fruit: [[dx, dy]…]` offsets from the crown centre ×s; hang props there) · `bush(x, y, s, { cols, seed })` ·
`flower(x, y, s, col, { center, stem, seed, sway })` · `cloud(x, y, w, { col, hang: 'string' | 'stick', bob, seed,
depth })` · `sun(x, y, r, { col, col2, rays, spin })` · `house(x, y, s, { wall, roof, door, win })` ·
`stripes(x, y, w, h, n, cols)` · `bunting(x0, y0, x1, y1, n, cols, { sag })` ·
`confetti(lt, x, y, { t0, n, cols, spread, power, size, seed })`.

### Props (`PROPS`) — drawn around a grip point
`PROPS.apple | balloon | flower | star | gift | letter (x, y, ang, s, col?)`. `s` ≈ size unit (a character's u × .6–.9).
Add new props in the same style: a function of `(x, y, ang, s)` made of `piece()` calls with fixed seeds.

### Transitions (screen space, after `camEnd()`)
Called by the **incoming** shot over its first frames with `k` going 0 → 1 (use stepped time:
`seg(sm(lt), 0, .7)`). They re-render the previous shot live via `prevFrame(t)`, so **the previous shot must not
draw an out-transition of its own**.

| call | what you see | good for |
|---|---|---|
| `trBook(t, k)` | the new scene stands up off the page from a bottom hinge (table behind for the first shot) | the opening, "once upon a time", new chapter |
| `trTear(t, k, { seed, rot })` | the old frame tears down a ragged line; the halves pull apart | a change of place, a surprise |
| `trFlip(t, k, { tilt })` | the old frame is a card that flips over on the table; its back is the new shot | time skip, "meanwhile", close-ups |
| `trSlide(t, k, { dir })` | the new shot on a sheet slides over the old one | fast continuity, lists |
| `sheetIn(k)` / `sheetOut(k, { col, dir })` | a plain paper sheet with a torn edge slides off / over | the very start / the very end |

### Captions
`captionTrack([[t0, t1, text, opts], …])` (call once per file; tracks accumulate). `opts.style`:
- `'label'` (default): ink text on a torn white card label with a bit of tape — subtitles, speech. `size` 72.
- `'letters'`: every glyph cut out of coloured paper with a white margin, popping in one by one — titles, shouts.
  `size` 96, `cols` palette, `y` 150.
Both pop in and out on the stop-motion step, sit above the grain, and use the CJK font stack
`"Chiron GoRound TC", "Zen Maru Gothic", "Noto Sans TC"`. All caption text is preloaded in `ENGINE.setup`. Keep lines
short (≤ 12 CJK chars) and ≥ 70 px so they read at phone width.

## 4. Puppets (`src/cast.js`)

Jointed paper puppets: every part is its own piece (so it casts a shadow on the part behind), joined by brass brads at
shoulders, elbows, hips and knees. Arms are forward kinematics; legs are 2-bone IK to planted feet, so crouches bend
the knees and feet never slide or detach.

### The two demo characters
- **Pom** — `pom(x, y, u, opts)`: round orange critter with pointy ears, cream muzzle, tuft, curled tail, teal
  overalls, red boots. ~8.5u tall. Medium shot u 55–75; close-up 85–110. Stubby arms: raised hands reach beside the
  head (angle ~135°), never above it.
- **Lulu** — `lulu(x, y, u, opts)`: tall girl puppet, navy bob with bun, mustard coat with brass buttons, rose scarf
  (swings behind), lilac tights, red shoes. ~15u tall. Medium shot u 34–42; close-up 55–70.

### Options (both)
| option | meaning |
|---|---|
| `face` | expression name (below) or an object `{ eye, lid, low, tilt, brow:[lift, ang], mouth, cheek, pupil, pupilY, tears, sweat, vein }`; `faceMix` overrides fields |
| `view` | `'front'` or `'3q'` (three-quarter, facing screen-right). `flip: true` mirrors (face left) |
| `look` | `[lx, ly]` −1..1 pupil direction (or a number) |
| `blink` | extra lid 0..1 (auto-blink always runs, desynced per puppet; `blink: false` disables it) |
| `armL`, `armR` | `[shoulder, elbow]` degrees: 0 hangs down, +90 points to the facing side, ±180 up, −90 back. Elbow adds to the shoulder angle. In 3q, `armL` is the far arm (drawn behind the body, slightly darker) |
| `footL`, `footR` | `[dx, dy]` in u from the rest spot (dy < 0 lifts) — IK bends the knees |
| `sq` | squash (+: hips drop, knees bend, torso widens) / stretch (−) |
| `dy` | whole-puppet vertical offset in u (jumps; up negative) |
| `lean`, `tilt` | torso lean, head tilt (degrees, + toward the facing side) |
| `holdL`, `holdR` | prop in the hand: `'apple'`, `{ prop: 'apple', s: .7, dy: -.3, ang, col }` or `(x, y, ang, u) => …`. Drawn between palm and thumb |
| `jit` | per-step jitter px (default ≈ u/50; 0 locks the pose) |
| `seed` | variant seed (desyncs blinks/jitter of two copies of the same puppet) |
| `dry` | measure only: returns joints, draws nothing |

Returns joints in world px: `{ hand: [L, R], elbow, shoulder, foot, head, top, mouth }` — aim props, emotes, eye-lines
and hand-offs at these. Use `dry: true` to find where a hand WILL be (the demo hangs the apple exactly where Pom's hand
is at the top of his jump).

### Expressions (`EXPR`)
`neutral happy laugh sad cry angry surprised scared love sleepy wink determined shy` — built from layered paper:
white card eye + pupil + highlight, eyelid pieces in skin colour (upper `lid`, lower `low`, slant `tilt`), strip brows,
blush circles, replacement mouths (`flat set small smile grin open frown o wail grit wobble`), `^ ^` / `> <` / heart
eyes, tissue tears and sweat, anger vein. Add a new one by adding an entry to `EXPR`.

### Helpers
- `moods(lt, [[t, face], …])` → `{ face, blink, sq, dy }`. Replacement-animation change: the eyes blink shut on the
  swap step, with a little take for big emotions. Spread it in, and ADD its `sq`/`dy` if you also jump.
- `walkCycle(lt, { rate, stride, lift, swing, lean, phase })` → `{ footL, footR, armL, armR, dy, lean }` (stepped).
  Move the puppet at `walkSpeed(o) * u` px/s to keep planted feet from sliding. Use `view: '3q'` (+ `flip` to go left).
- `jumpPose(lt, t0, t1, h)` → crouch with arms back (anticipation) → stretch, arms up, feet tucked → land squash and
  settle (follow-through). Override `armR` in the air for a reach.
- `emote(kind, x, y, s, age)` — `'!' '?' heart sweat zzz anger sparkle note`, pops in on steps. Put it at `J.top`.

### Making a new character
Copy the `POM` or `LULU` definition: joint layout per view (`front`, `'3q'`: hips, feet, shoulders, neck, head in u
from the hip centre), limb lengths/radii, colours, `footShape`, and three draw functions — `back` (behind everything:
tails, scarf ends), `body` (torso and clothes, drawn in the body frame), `head` (ears/hair behind, head, then
`drawFace(F, u, e, …)`, then noses/fringes on top). Put a `face` spec (eye positions/sizes, lid/cheek colours, mouth
position, 3/4 `turn` shift). Then `const myChar = (x, y, u, o) => puppet(DEF, x, y, u, o)`. Use user-provided designs
the same way: trace their shapes into `SH.smooth` control points.

## 5. Reviewing

Do the painted-animation review loop: sheets per shot, strips of every key motion and transition, crops of every
face and hand. Specific to this look, check:
- **It reads as paper:** fibres visible at full res, edges faceted/torn, every layer has a shadow, nothing flat-vector.
- **Depth order:** far things smaller, paler, less shadow; the puppet clearly separated from its background.
- **Joints:** limbs connect at brads in every frame (strip the action); held props sit in the hand between palm and
  thumb; feet on the ground line (use the same `y` for puppet and ground).
- **Stop-motion feel:** poses change on steps (pairs of identical frames at 24 fps) but set pieces don't jitter;
  nothing drifts smoothly that should be stepped (unless it's a camera move).
- **Faces:** expression changes through `moods()`, eyes aimed at what matters (`look`), expressions readable in a
  480 px-wide sheet.
- **Captions:** readable at 480 px width, not covering faces.

## 6. Known pitfalls

- Everything must be a pure function of `t` (frames render in parallel). No `Math.random()`, no accumulators.
- Re-using a `seed` for two copies of the same shape gives identical cuts; vary it.
- Animating a shape's *size* re-cuts its edge every frame (shimmer). Scale with `sx/sy`, `popUp`, or the camera.
- A shot that is followed by `trTear/trFlip/trBook/trSlide` keeps running past its end (the next shot renders it at
  the current time) — keep its last pose valid for `lt > dur`, and don't draw an out-transition in it.
- Transitions and `backdrop` work in screen space; call transitions after `camEnd()`.
- Tissue multiplies: a light tissue over a saturated colour goes dark/muddy — use `card`/`paper` for light spots over
  strong colours.
- Pom's arms can't reach above his head; stage reaches to the side or give him a prop that extends his reach.
- Very large pieces (> 1500 px) are fine but keep `depth` modest (< .5) or the shadow halo gets heavy.
- Captions: fonts load from Google Fonts at page load (network needed then); glyphs missing in Chiron GoRound TC fall
  back to Zen Maru Gothic / Noto Sans TC.
