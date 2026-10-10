# anime-cel — drawing & animation guide

Read this whole file before drawing. It covers the look, the full API with examples, the character system, how to
review, and known pitfalls. `template/src/scenes/demo.js` is a complete worked example (10 s, three shots).

---

## 1. The look

Modern TV anime (a clean slice-of-life / school series), not chibi, not manga screentone.

- **Characters have line art; backgrounds don't.** Character lines are filled tapered polygons: thicker on the outer
  silhouette and on the side away from the light, thin and tapered inside (folds, hair strands, lashes). One line
  colour per character (`D.line`: warm brown for Hina, indigo for Ren) — never pure black.
- **Cel shading = base + one hard shadow + a rim highlight.** The shadow is where the shape, pushed toward the light,
  no longer covers it (`cel()`), so every limb/lock gets a crescent on its far side. Set the light per shot with
  `setTOD()` (which sets `LIGHT`) or `setLight(x, y)` (vector TOWARD the light, screen space).
- **Faces**: big eyes (iris gradient, pupil, two catch-lights toward the light, thick upper lash that flicks out,
  thin lower lash, lid shadow), tiny nose tick, small mouth, blush with hatch lines. Hair casts a hard shadow on the
  forehead. Brows are drawn over the bangs, as anime does.
- **Backgrounds are painted shapes**: vertical-gradient skies, cumulus clouds with a hard lavender underside and a
  bright rim, simplified buildings in one-point perspective, sakura trees, utility poles and wires. No outlines.
- **Compositing**: a soft bloom and light vignette are added in `ENGINE.end` (`GRADE = { bloom, vignette }`, reset
  every frame; a shot may change it).
- **Anime effects** are graphic, not realistic: radial focus lines, parallel speed lines, 2–3 frame inverted impact
  frames, star sparkles, petals, smear lines, a flat pink/colour BG with focus lines for an emotional beat.

## 2. Timing and staging (what makes it read as anime)

- **On twos.** Characters change drawing 12×/s: pass `t: onTwos(lt)` and compute poses from `onTwos(lt)`. Cameras,
  particles and effects stay smooth (use `lt`/`t`).
- **Moving holds.** Anime holds poses; keep a little life (blinks via `autoBlink`, hair `sway`, a slow camera push),
  but don't wobble everything.
- **Snap + hold.** Anticipation (small opposite move, 4–8 frames) → the action in 2–4 frames (with `smearLines`) →
  overshoot/settle with `spring()` → hold so the read lands. See shot B of the demo.
- **Reactions**: expression change on a drawing via `faceAt()` (adds a 1-frame blink and a pop you can add to `sq`),
  plus `take()` for the body. Big reactions: cut to a close-up with `impactFrame` for 2–3 frames + `dramaticZoom`.
- **Emotional beat BG**: at the peak, cut the background to a flat radial gradient + `focusLines` (demo shot B).
- **Reads** (from the painted-animation guide, still true): one read at a time, lead the eye, let the reads set the
  shot length, give every seam a transition.

## 3. Characters (`src/cast.js`)

```js
const info = hina(x, y, u, {
  t: ta,                    // time for blinks, hair wind, talk (use onTwos)
  turn: .5,                 // -1 profile left · -.5 3/4 left · 0 front · .5 3/4 right · 1 profile right
  headTurn, bodyTurn,       // override either (e.g. body 3/4, head to camera)
  face: 'surprised',        // EXPR name or an expression object (see below)
  look: [.3, .2],           // eye direction -1..1
  blink: 1,                 // 0..1 override (default autoBlink)
  mouth: 'a', talk: true,   // mouth override, or auto lip-flap
  armL: [25, 95, 'hold'],   // [shoulder°, elbow°, hand, wrist°, forearm length ×, flipThumb]
  armR: [8, 10, 'open'],
  legL: [20, 10], legR: [-10, 30],   // [hip°, knee°]
  walk: phase, run: phase,  // cycles (phase 0..1 per two steps); walkAmt / runAmt blend them out
  lean: 10, bend: 5, tilt: -8,  // body lean°, spine bend°, head tilt°
  sq: .1, dy: -.3,          // squash (+) / stretch (−), vertical offset in head units
  sway: [.1, 0],            // secondary motion of hair/skirt/ribbon/tie (head units), see follow()
  fx: ['sweat'],            // extra face marks: sweat vein steam gloom sparkles
  blush: .6,
  prop: { hand: 'L', draw: PROPS.envelope, rot: -60, s: 1, at: [0, 0] },
  armsOver: false,          // draw arms over the head (hand to cheek, etc.)
  stance: 'contra',         // default when standing: weight on one leg (hip up + out), shoulders counter-tilt, S-curve
                            // spine, relaxed free knee, arms hang with 'relax' hands. 'straight' turns it off.
  weight: 'R', contra: 1,   // weight leg (default per design: Hina R, Ren L) and strength 0..1
  ground: false,            // don't snap the lowest foot to y (sitting, flying, bust)
});
info.head / info.handL / info.handR / info.footL / info.footR   // screen points for props, cameras, effects
```

- **Proportions** (head units): Hina upper arm 1.02, forearm .9, hand .54; Ren 1.12 / .97 / .6 — fingertips reach
  mid-thigh when the arm hangs. Hands are ≈ the face's length. Sleeves taper shoulder → pinched elbow (creases on
  the inner side, more as it bends) → looser forearm → a cuff band (Hina ribbed, Ren blazer cuff + shirt cuff).
  A straight arm parallel to the picture plane always reads long: bend the elbow 10–20° and foreshorten the forearm
  (`arm[4]` ≈ .8) when reaching toward someone.
- **Shoulders follow the arms**: raising an arm lifts that shoulder and pushes it out/forward automatically.
- **Units & sizes.** `u` = head height in px. Hina is ≈5.6u tall, Ren ≈5.9u. Full body in frame u≈110–150, knees-up
  u≈180–260, bust/close-up use `bust(DESIGNS.ren, x, y, u, o)` with u≈380–600 where (x, y) is the head centre.
- **Angles.** Measured from straight down. With `|turn| > .3` (3/4 or side) positive = forward in the facing
  direction; in front view positive = outward from the body. Elbow adds to the shoulder angle. Knee positive bends
  the shin back. The near arm when facing right is `armL` (screen-left in the front view).
- **Hands**: `'open' 'relax' 'fist' 'point' 'peace' 'spread' 'hold' 'grip' 'pocket'`. `relax` = a hanging hand seen
  from the side (fingers curled) — use it for arms at rest instead of a flat `open`. `pocket` = the hand is in the
  trouser pocket (no hand drawn; aim the wrist at the hip, e.g. `armL: [14, -40, 'pocket']`, Ren's default stance). `hold` pinches a flat prop that extends past the
  fingertips (thumb in front); `grip` puts a handle inside the curled fingers.
- **Props**: `PROPS.envelope / book / phone / can / flower` (draw fn `(s, line)` in hand-local units, origin = grip).
  Write new ones the same way: build `Path2D`s and draw them with `drawGroup([...], line, lw)` for outline + cel.
- **Expressions** (`EXPR`, 19): neutral smile happy laugh sad cry angry rage surprised shocked scared love sleepy
  deadpan xd embarrassed smug determined dizzy. Each is `{ eye: {type, open, squint, iris, tilt, look, wet, shake},
  brow: {raise, ang}, mouth, blush, fx }`. Eye types: open happy(^^) closed tight xd(≥<) dot line white(shock)
  sparkle half swirl. Mouths: neutral smile grin wide open o cat frown wavy line set grit shout wail + talk a i u e o n.
  Make variants inline: `face: { ...EXPR.smile, blush: 1, fx: ['sweat'] }`.
- **Helpers**: `faceAt(t, keys)` (expression timeline with blink + pop), `autoBlink(t, seed)`, `talk(t, seed)`,
  `follow(t, f, k, w, amt)` (spring follow-through of any function of time — pass the character's x in head units to
  get hair lag), `walkPose/runPose(phase)`, `stroll(t, t0, t1, x0, x1, u)`.
- **Secondary motion**: the scene computes `sway` (e.g. `[-v / u * .05 + follow(t, tt => X(tt) / u, 5, 12), 0]`).
  Hair tips, the skirt hem, ribbon tails and tie follow it.

### How a character is built (for adding new ones)

- `DESIGNS.<name>`: `weight` (default weight leg), `pocketArm`, `kneeIn` (how much the relaxed knee turns in:
  .6 girlish, .2 boyish), colours, eye shape (`eyeU` upper lid / `eyeL` lower lid control points in eye-local coords,
  `eyeW/eyeH/eyeY/eyeR`, `lash`, `spikes`, `crease`, `irisS`), face (`chinY`, `jawW`, `faceW`, `mouthY`), body
  proportions (`hipH`, `thigh`, `shin`, `ua`, `fa`, `hl`, `torso` rows `[height, half-width]`, `armW`, `legW`),
  `clothes` (branch in `drawTorso` / `drawLeg` / sleeves) and `hairStyle`.
- `HAIR.<style>`: `front` locks (drawn over the face) and `back` locks (behind head/body; they move to the front
  layer when the head turns them toward the viewer), each `{ p: [[azimuth°, y, radius], …root→tip], w, flex }` on a
  skull sphere; `hairline` heights (front, 45°, temple, 135°, nape); `specY` for the angel ring. Keep root radii
  inside the skull (≤ .5) or they poke out of the silhouette.
- The head: skull sphere + a face outline morphing through front / 3/4 / profile keys (`FACE_KEYS`), features placed
  by azimuth on the sphere (eyes, brows, nose, mouth, ears), everything clipped to the face so the far eye hides
  naturally. Body: a posed skeleton; limbs are `tubePts` along smoothed centre-lines, grouped with `drawGroup` so
  every group has ONE outer outline (joints never show seams except intended clothing seams).
- Draw order: back hair → far arm → legs → neck (with the jaw's cast shadow) → skirt/torso/collar/bow → near arms →
  face → front hair → eyes/brows → face marks.

## 4. Drawing library (`src/anime.js`)

| function | purpose |
|---|---|
| `crPts(P, closed, n)` | Catmull-Rom through points (`[x,y,w]` keeps widths; `[x,y,w,true]` = sharp corner) |
| `ink(P, w, col, TAPER.x, {raw, closed, caps})` | tapered line as one filled polygon (`TAPER.both soft head tail flat lash`) |
| `tubePts(P)` / `ribbonPts(C, wf)` | outline of a tube/ribbon along a centre-line |
| `cel(path, base, shade, hi, d, r)` | cel fill: hard shadow depth d, rim highlight r |
| `drawGroup(parts, line, lw)` | union-outlined group; part = `{path, b, s, h, d, r, lw, join, noLine, clip, after}` |
| `polyPath, smooth, shifted, union, ellPts, heart` | path helpers |
| `setTOD(name)`, `tone(hex)`, `TOD` | time of day: day morning evening night (sky, clouds, light, character tint) |
| `SET.street / classroom / rooftop (cam, t, o)` | painted sets with parallax; leave the camera open. `cam = {x, y, zoom, rot}` in set coords (centre 960,540; street ground ≈ y 900–1000) |
| `skyLayer(cam, t, {clouds, sun, moon, wind})`, `cloud(x,y,w,h,seed)`, `sakuraTree`, `pole`, `wire`, `windowGrid`, `paintPoly` | build new sets |
| `layer(key, w, h, fn)` / `blit(c, x, y)` | cache a static painting (pure: same every frame) |
| `focusLines(t, cx, cy, {r, n, w, col})` | radial concentration lines (boil on twos) |
| `speedLines(t, ang, {rect, n, len, w, col})` | parallel streaks |
| `impactFrame(k, 'invert'|'mono'|'red', {x, y, t})` | impact flash frame (hold 2–3 frames) |
| `flash(k, col)` | full-frame flash |
| `dramaticZoom(t, t0, amt, shake)` → `{zoom, dx, dy}` | snap zoom with overshoot + decaying shake |
| `smear(fn, from, to, n)`, `smearLines(x0,y0,x1,y1,spread,col)` | multiples and motion lines |
| `blurBand(y, h, {blur, n, t})` | motion-blurred band of the current frame (BG streak) |
| `sparkle(x,y,r,a)`, `sparkles(t,x,y,R,n,seed,minR)`, `petals(t, {n, size, wind, kind:'sakura'|'leaf', rect})` | particles |
| `slashWipe(p, {cols, ang})`, `irisWipe(p, cx, cy, {shape:'circle'|'star', col})` | transitions (cover 0→.5, reveal .5→1) |
| `subtitle(c, txt, {y, size, alpha, fg, line})` | anime subtitle in `overlayHook` |

Kit (shared, `src/kit.js`): `shots`, `seg`, `kf`, `ease/easeIn/easeOut/backOut/elasticOut`, `spring`, `jump`, `take`,
`arcPt`, `onTwos`, `onStep`, `pulse`, `hash`, `rnd`, `camBegin/camEnd/toScreen`, `shakeXY`, `mixCol`, `LOOPS`.

### A shot skeleton

```js
(() => {
  function shot(t, lt, dur) {
    setTOD('evening');
    const ta = onTwos(lt), cam = { x: 960 + 40 * ease(seg(lt, 0, dur)), y: 560, zoom: 1.2 };
    SET.rooftop(cam, t, { sun: [1500, 640] });                       // camera is now open (world coords)
    const f = faceAt(ta, [[0, 'neutral'], [1.4, 'surprised'], [2.2, 'smile']]), tk = take(ta, 1.4);
    const r = ren(1100, 990, 130, { t: ta, turn: -.5, face: f.face, blink: f.blink ?? autoBlink(ta, 3), sq: f.sq + tk.sq, talk: ta > 2.2 });
    hina(780, 990, 130, { t: ta, turn: .5, face: 'happy', armL: [40, 60, 'hold'], prop: { hand: 'L', draw: PROPS.can, rot: 90 } });
    camEnd();
    petals(t, { n: 20 });
    if (lt > 1.4 && lt < 1.4 + 3 / 24) impactFrame(1, 'invert', { x: r.head[0], y: r.head[1], t });
    if (lt < .3) flash(1 - lt / .3);
    if (lt > dur - .35) slashWipe(seg(lt, dur - .35, dur) * .5);
  }
  shots([[0, shot]]);
  window.overlayHook = (c, t) => { if (t > 2.2 && t < 3.6) subtitle(c, '夕陽好美喔。'); };
  window.EXTRA_FONTS.push(['800 58px "M PLUS Rounded 1c"', '夕陽好美喔。']);
})();
```

## 5. Review loop

You can't see it from code. For every shot: a key-frame sheet, a strip of each key action/transition, and full-res
stills (`--stills`) of every face that carries a read. The model-sheet loops (`--loop=faces_hina|faces_ren|turns|
bodies|hands|sets|fx|motion|close_hina|close_ren`; `motion` = stances + walk + run) are the fastest way to check a change to the rig. Check:

- **Faces**: eyes the same size/shape on both sides (front), far eye narrower and clipped (3/4), lash line
  confident, catch-lights on the light side in both eyes, mouth small, brows readable, hair shadow on the forehead.
- **Silhouette**: hair reads as clumps with pointed tips, no stray lobes/stubs outside the skull; limbs continuous;
  hands attached; props touching the hand.
- **Motion**: on twos, anticipation → snap → overshoot → hold; nothing constant-speed; no twinning of arms.
- **Staging**: the read is clear at 390 px wide (phone), characters big enough, one read at a time.
- **Seams**: every cut has a transition or is a deliberate cut on action / impact cut.

## 6. Known pitfalls

- A lock whose root radius is > .5 or whose last two control points coincide makes a lobe/stub on the silhouette.
- Catmull-Rom through duplicated points overshoots (lobes). Don't repeat points; mark corners with `[x,y,w,true]`.
- Two-point `ink()` calls are auto-densified; still prefer ≥ 3 points for curves.
- Screen-space effects called inside a scaled `G.save()` (e.g. a split-screen panel) ignore that transform.
- Profile views are the weakest angle (see limits); prefer 3/4 for acting, profile for walking/running.
- `impactFrame` / `blurBand` copy the whole canvas: use them sparingly (a few ms each).
- Fonts load from Google Fonts at render time (needs network); push caption text to `EXTRA_FONTS`.

## 7. Limits (honest)

- It reads as anime, but as a clean "digital TV-anime model sheet" rather than a key-animator's drawing: line
  weight varies by light side and taper, not by hand pressure; no hand-drawn wobble or per-shot redraws.
- Turns are geometric (sphere-projected features + morphing outline), so extreme angles (profile, looking up/down)
  are stiffer than a drawn model; there is no up/down head pitch beyond small `tilt`/look.
- Hands are simplified mitten-with-fingers shapes; the torso has one silhouette per body turn (no twisting).
- No back view; no sitting pose helper (use `ground:false` + leg angles).
