# Pixel-art engine — the full guide

Read this before drawing anything. It covers the look, the complete API with examples, the character system, the
review loop and the pitfalls. The animation principles and "reads" timing method from painted-animation's
`ANIMATION_GUIDE.md` apply unchanged (anticipation → action → follow-through, one read at a time, transitions at every
seam, nothing still); this guide covers what is specific to pixel art.

Model sheets: `docs/model-faces.png` (16 expressions × 2 characters), `docs/model-views.png` (views, walk frames,
jump keys, props in hands), `docs/kit-sheet.png` (palettes, emotes, weather, light), `docs/demo-sheet.jpg`.
Regenerate them with `node render.mjs --loop=faces|views|kit|wipes --stills=0.5 --out=out/sheets`.

---

## 1. The look

Modern indie pixel art, not 1985: a limited but rich palette, hue-shifted ramps, crisp selective outlines, dithered
skies and light, parallax depth, sprites animating on 12s while the camera glides.

- **Resolution:** 480×270 art pixels, ×4 nearest-neighbour to 1920×1080 (`ENGINE.crisp = true`). One art pixel =
  4 screen px. Why not 384×216 ×5: faces need 2–3 px eyes and 3–5 px mouths, and two characters plus a tree and sky
  need room; at 480×270 a character is 40–65 px tall (160–260 screen px) and still reads as pixel art on a phone.
- **Palettes:** `PALS.day`, `PALS.dusk`, `PALS.night` (~30–36 colours each, organised as ramps, dark → light). Every
  palette has the same keys, so a scene can swap palettes and keep working:
  `ink paper rim sky cloud far mid grass earth stone wood light sun accent cool` (+ `charTint` = how characters are
  tinted to sit in the light: none by day, warm at dusk, blue at night).
- **Shading = walking a ramp.** `shade(c, -1)` is the next darker colour of c's ramp, `shade(c, +1)` the next lighter;
  past the ramp's end it hue-shifts (shadows toward blue-violet, lights toward warm). Outlines, inner lines, lights and
  shadows all use this, so everything stays on-palette. Register your own ramps with `regRamp(['#..', ...])`.
- **Selective outlines:** sprite passes add a 1-px outline in a darker hue of the adjacent fill, never flat black.
- **Dithering:** ordered 4×4 Bayer (`BAY4`) anchored to the layer, so patterns move with their layer and never swim.
  Use it for sky seams, glows, shadows, fades. Quantise densities (`qd(d)`) so dithers come in clean bands.
- **No anti-aliasing, no smooth gradients, no rotation of sprites, no non-integer scaling.** Rotation-like changes are
  new drawings (views, poses). Zoom only by integer punch-in.
- **Motion on steps:** sprite poses, walk frames, blinks, emotes, weather: 12 fps (`st(t)`), or 8/6/4 fps for slower
  things. Camera and positions are smooth but snapped to whole art pixels.

## 2. Frame structure

```js
(() => {                                     // src/scenes/my_shot.js
  useText('你好！Hello!');                    // every caption string, so its glyphs are loaded before rendering
  function shot(t, lt, dur) {                 // t = video time, lt = time in shot
    pal('dusk');                              // palette FIRST (ENGINE.begin resets to day)
    const s = st(t);                          // 12 fps sprite time for poses
    camAt(lerp(240, 300, ease(seg(t, 0, 3))), 135);   // world point at screen centre (snapped)
    sky(P.sky, { soft: .5 });                 // back → front
    sunDisc(360, 180, 16, { par: .2 });
    clouds(t, { y: 60, par: .2 });
    hills(200, { c: P.far[0], rim: P.far[1], par: .3 });
    city(214, { c: P.mid[1], lit: .3, par: .45 });
    ground(x => 225, { tufts: .5 });
    footShadow(220, 225, 11);
    pip(220, 225, { ...act(s, [[0, 'happy'], [1.5, 'surprised']]), t: s, view: 'q' });
    if (lt > 2) punch(2, 230, 190);           // medium shot (call before transitions)
    screenSpace();
    dissolve(1 - seg(lt, 0, .4));             // transitions last
  }
  shots([[0, shot]]);
  window.overlayHook = (c, t) => say(c, t, 1.0, 3.0, '你好！Hello!', { name: 'PIP' });
})();
```

A shot paints the whole frame. Order = back to front. There's no persistent state; everything is computed from `t`.

## 3. Coordinates, camera, layers

- World units are art pixels. `camAt(cx, cy)` puts world (cx, cy) at screen centre, rounded to whole pixels.
- `layer(f, fy = f)`: parallax factor for what follows (0 = glued to screen, 1 = world). Background helpers take a
  `par` option and restore `layer(1)` afterwards. Vertical parallax of hills/forests is `par * .6`.
- `screenSpace()`: screen pixels (HUD, transitions). `scr(x, y)` world → screen of the current layer.
- `shake(t, amt)` → `[dx, dy]` integer offsets on 12s; add to `camAt`.
- `punch(z, x, y)`: integer zoom (2 or 3) around a world point: the art pixels simply get bigger. Use it as a
  **medium shot** for acting; cut to it on an action or a take. `--crop-at` in render.mjs follows it.
- `clip(x, y, w, h)` / `noclip()`: world-rect clip for everything drawn.
- `measure(fn)`: runs a draw call with drawing disabled and returns its result — e.g. where a character's hand will
  be at another time: `const h = measure(() => juno(x, y, poseAt(3.8))).hands[1]`.

## 4. Primitives (world coords; `c` = '#hex' or u32; `d` = dither density 0..1, default solid)

| call | what |
|---|---|
| `fill(c)` | whole buffer |
| `px(x, y, c)` | one pixel |
| `rect(x, y, w, h, c, d)` | rectangle |
| `line(x0, y0, x1, y1, c, w)` | Bresenham line, `w` = round brush width |
| `pline(pts, c, w)` / `curve(pts, c, w)` | polyline / smooth curve through points (strings, tails, ropes) |
| `disc(cx, cy, r, c, d)` / `oval(cx, cy, rx, ry, c, d)` | filled circle (diameter 2r+1) / ellipse, pixel-centred |
| `ring(cx, cy, r, c, w)` | circle outline |
| `poly(pts, c, d)` | scanline polygon (vertices snapped) |
| `ball(cx, cy, rx, ry, c)` | 3-tone shaded ball (dark crescent bottom-right, highlight top-left) |
| `sprite(rows, map, x, y, { ax, ay, flip, z })` | sprite from a string grid; `'.'` transparent; anchor bottom-centre |
| `tile(kind, x, y)` / `tilemap(rows, legend, x0, y0)` | 16-px tiles generated from the palette: grass dirt brick plank water stone |
| `tinyText(s, x, y, c, { z, align, shadow })` | 3×5 in-world pixel font (A–Z 0–9 !?.-:/) for signs, scores, SFX |

```js
const HOUSE = ['..rrrr..', '.rrrrrr.', 'rrrrrrrr', '.wwwwww.', '.wddwgw.', '.wddwww.'];
sprite(HOUSE, { r: P.accent[1], w: P.paper, d: P.wood[1], g: P.light[1] }, 300, 200);
```

**Outlined sprite passes.** Anything that should look like a game object (props, trees, characters) is drawn inside a
sprite pass; the pass composites it with an automatic 1-px outline in a darker hue of each edge's fill:

```js
beginSpr();                 // or outlined(() => { ... })
oval(100, 150, 8, 6, '#e24a5e');
part();                     // new part: it gets an inner line where it overlaps earlier parts
rect(96, 146, 3, 3, '#fff8e8');
part(false);                // new part without inner line (faces, highlights)
endSpr({ tint: null });     // opts: k (outline shade, −2), inner (−2), tint ['#hex', k] (default P.charTint), z, ax, ay, flash
```

## 5. Backgrounds (parallax, back → front)

| call | notes |
|---|---|
| `sky(stops, { soft, par, y0, y1 })` | banded vertical gradient with dithered seams; `stops` default `P.sky` |
| `sunDisc(x, y, r, { par, moon, halo, cols })` | sun/moon with banded dithered halo |
| `stars(t, { n, seed, par, y1 })` | twinkling on 6s, big ones cross-shaped |
| `clouds(t, { y, dy, n, par, speed, size, seed, cols })` | flat-bottomed puff clouds, 3 tones, drifting |
| `hills(base, { c, rim, amp, freq, seed, par, bumps, bumpW })` | rolling silhouette with lit rim; `bumps` = tree-canopy lumps |
| `forest(base, { c, rim, par, gap, hmin, hmax, seed })` | pine silhouettes |
| `city(base, { c, lit, win, par, hmin, hmax, seed })` | skyline; `lit` 0..1 fraction of lit windows (dusk/night) |
| `ground(topY(x), { c, tufts, flowers, deep, par })` | grassy ground following a height function; lit edge, tufts, dithered depth |
| `tree(x, y, { h, r, t, seed })` | big outlined leafy tree swaying on 4s; returns canopy |
| `bush(x, y, w, { berries })` | outlined bush |

Depth rules: farther = paler/bluer (`P.far`), smaller parallax, no outline; nearer = more contrast, outlines. Give
every silhouette a 1-px lit `rim` on the side of the light.

## 6. Light, weather, particles

- `glow(x, y, r, c, k, { bands })` — dithered radial light in banded rings (lamps, sun halos, magic).
- `light(x, y, r, k, { ry })` — brightens what's already drawn 1–2 steps along its own ramp (lamp pools, windows,
  spotlight). Best way to light a scene while staying on palette. `shadowAt(x, y, rx, ry, k)` does the reverse
  (contact shadows; `footShadow(x, y, w)` for characters). `vignette(k)` dithered darker corners.
- `rain(t, { n, slant, ground, par })` (streaks + splashes at `ground` y), `snow(t, { n })`,
  `sparkles(t, x, y, w, h, { n, c, c2 })` (4-point twinkles), `fireflies(t, x, y, w, h)`, `birds(t, { x, y, n })`,
  `petals(t)`, `puff(age, x, y, { n, c, spread })` dust on landings.
- `emote(kind, x, y, { age, bubble })` — RPG emote balloon that pops in over steps (burst → overshoot → settle), kinds:
  `! ? !? heart sweat anger dots note bulb star spiral zzz`. Characters draw their own via `emote`/`emoteAge`.

## 7. Transitions (after the shot is drawn; screen space; punch-aware)

| call | look |
|---|---|
| `dissolve(k, c)` | 8×8 Bayer dither fade to colour (k 0 → 1) |
| `iris(k, x, y, { shape: 'circle'|'diamond'|'square', c, edge })` | closes around a world point (k 0 open → 1 closed) |
| `diamonds(k, { dir: 'right'|'left'|'up'|'down'|'center', size, c })` | classic diamond-tile wipe |
| `blocks(k, { dir, size, stagger })` | chunky stair-stepped slide |
| `crossDither(k, drawA, drawB)` | dither dissolve between two full drawings |

Wipe out with `diamonds(seg(t, a, b), { dir: 'right' })` and in with `diamonds(1 - seg(t, b, c), { dir: 'left' })`, so
the motion continues across the cut.

## 8. Captions and text

Text lives on the overlay (full res) and is rasterised on a pixel grid: glyphs are drawn at native size on a tiny
canvas, alpha-thresholded, outlined by one pixel and scaled up ×2 nearest-neighbour. CJK runs use DotGothic16 at 24 px
(fallback Noto Sans TC, thresholded so it still reads as pixels); Latin runs use Press Start 2P at 16 px.

```js
useText('謝謝你！Thank you!PIP');                        // at load time
window.overlayHook = (c, t) => {
  say(c, t, 7.35, 9.3, '謝謝你！Thank you!', { name: 'PIP', cps: 16 });   // RPG box, typewriter, blinking ▼
  // pxText(c, 'GAME OVER', 960, 200, { k: 3 });                        // free pixel text
};
```

One line at a time, ≤ ~20 CJK characters. The box covers the bottom ~20 % of the frame while visible.

## 9. Characters (`src/cast.js`)

Two original characters, drawn procedurally in pixels each frame (no bitmaps):

- **Pip** — a round 40-px sprout-spirit: cream body, green two-leaf sprout, red knitted scarf with a fluttering tail,
  stubby feet, little nub arms, big 3×4 eyes, brows.
- **Juno** — a tall 65-px kid: navy bob with fringe and a springy cowlick, yellow A-line raincoat, navy trousers, red
  boots, two-segment arms (elbows), 2×4 eyes.

```js
const info = juno(x, y, {          // (x, y) = ground point between the feet
  t: s,                            // time for blink / idle / tears (default: frame time)
  face: 'happy',                   // or spread act(...)
  view: 'front' | 'q' | 'side' | 'back', flip: false,
  look: [1, -1],                   // pupils: +x toward facing, −y up
  sq: 0, dx: 0, dy: 0,             // squash (+) / stretch (−), offsets (px)
  arm: [a0, a1], bend: [b0, b1],   // radians; 0 = straight out, + up, − down. front: [left, right]; side/q: [back, front]
  hold: [null, (hx, hy, ang) => PROP.kite(hx, hy - 9, { hang: true, t: s })],
  walk: phase,                     // 6-frame walk cycle (use walkTo)
  air: true,                       // tuck legs mid-jump
  drag: -1..1, wind: -1..1,        // secondary motion: hair / sprout / scarf
  emote: 'heart', emoteAge: 0.4, emoteSide: 1,
  tint: ['#hex', k] | null, z: 1, flash: 0, seed: 0, blink: true,
});
// info = { head: [x,y], top: [x,y], hands: [[x,y], [x,y]], face: [x,y] }
```

- **Sizes:** Pip ≈ 40 px (27 wide), Juno ≈ 65 px. At 1× they suit wide shots; use `punch(2)` for acting.
- **Views:** front, q (3/4), side (profile), back — all face right; `flip` mirrors. Turns are view swaps on a step,
  ideally hidden under an action (landing, take).
- **Expressions (16):** neutral, happy, excited, laugh, love, shy, smug, sad, cry, angry, determined, surprised, scared,
  confused, thinking, sleepy. Each = eyes + mouth (+ brows, blush, tears, tint) + an idle motion + a default emote.
  Eye kinds: open shine sad angry half wide tiny happy closed sleepy squeeze heart dot (pairs allowed, e.g.
  `['open', 'half']`). Mouths: flat smile grin laugh O o frown wavy cat smug wail grit side pout. Add expressions to
  `EXPR`.
- **Acting:** `act(s, [[t0, 'sad'], [2.4, 'surprised', { look: [1, 0] }], [2.8, 'love']], { emoteFrom, take })` →
  squash + blink just before each change, face swap, a take (stretch + hop) settling with overshoot, emote pop. Key
  overrides: `take` (0 = no take), `emote` (null removes), `emoteHold`, any option like `look`.
- **Walking:** `walkTo(t, t0, t1, x0, x1, stride, easing)` → `{ x, walk, moving }`: phase = distance / stride, so feet
  don't slide. Use `view: 'side'`. Pass smooth `t` for x and `st(t)` for pose.
- **Jumping:** kit `jump(s, t0, t1, h)` → `{ dy, sq }` with anticipation squash, stretch and landing squash; add
  `air: true` mid-flight, `drag: clamp(-vel(u => jump(u, t0, t1, h).dy, s) / 120, -1, 1)` for hair follow-through,
  `puff(t - t1, x, y)` + `shake` on landing.
- **Holding props:** `hold: [back/left fn, front/right fn]`; the fn draws at the hand (world coords) inside the same
  sprite pass, so the prop gets the character's outline and the hand is drawn over its handle. Props:
  `PROP.kite(x, y, { s, tilt, tail, hang, t })`, `spool`, `lantern`, `flower(x, y, ang)`, `balloon`, `mug`, `letter`,
  `star`, `umbrella`. Anything not in a hand (a kite in the sky) is drawn separately; attach strings with
  `info.hands[i]` or `measure()`.
- **Arms:** `ARM.down −1.3, low −.7, out 0, up 1.25, high 1.45`. Chibi arms reach about head height: raise both arms in
  front view for "reach up" (hands beside the head). In side view an arm above ~0.6 rad crosses the face.
- **New characters:** copy `pip()` / `juno()` — a rig (`_rig`), a sprite pass, parts in back-to-front order (back arm,
  legs, body, head, face `part(false)`, front arm), a face config (eye / mouth / blush positions per view) handed to
  `_face`. Keep new colours in registered ramps (base at index 2 so the outline = index 0).

## 10. Review loop (do it for real)

```bash
node render.mjs --sheet=0.3,1.3,2.3,3.2,3.55,3.85 --cols=4 --w=480 --out=out/check/a.jpg   # key frames
node render.mjs --strip=3.3:4.3 --cols=8 --w=240 --out=out/check/jump.jpg                   # every frame of an action
node render.mjs --sheet=4.6 --crop=780,380,700,560 --w=700 --out=out/check/face.jpg          # full-res detail
node render.mjs --strip=3.3:4.3 --crop-at=610,160,700,700 --out=out/check/follow.jpg         # follow a world point
```

Check, like an art director:
- **Pixel purity:** any blur, mixed pixel sizes inside one shot (other than a deliberate punch), stray anti-aliased
  edges, colours off-palette, flat-black outlines?
- **Read:** are the characters big enough (punch in for acting)? Does each read get its time? Emote bubbles not
  covering faces (`emoteSide`)?
- **Motion:** anticipation → action → follow-through visible in the strip? feet planted while walking? no pops when
  views/props swap (grab points computed with `measure`)?
- **Contacts:** props touching hands, strings attached, feet on the ground (`y = ground(x)`), contact shadows.
- **Transitions** at every seam and in/out of the film; caption box not hiding the action.

## 11. Known pitfalls

- Names: pixel.js/cast.js declare many short globals (`P C st px rect line disc poly sky ground tree …`). Wrap scene
  code in an IIFE and don't redeclare them.
- `pal()` must be called at the top of every shot (begin resets to `day`); `P.charTint` tints characters per palette.
- `punch()` and transitions operate on the low-res buffer at the end of the shot: call `punch` before transitions.
- A cached tile or text image depends on the palette/string, not on time: don't try to animate them via cache keys.
- `ball`/`oval`/`disc` centre on a pixel (odd sizes); for even sizes use `rect`/`poly`.
- Very long captions overflow the text canvas (~60 CJK chars); split them.
- Captions need network access for Google Fonts on first load (studio.html `<link>`); without it the fallback is a
  system font (still thresholded to pixels).
