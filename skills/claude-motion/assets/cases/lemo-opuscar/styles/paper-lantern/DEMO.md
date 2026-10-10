# Paper-cut Lightbox — our demo

One example among many. Don't reuse its story, arc, shots, props or timings.

Demo: *一个月饼的相思 · A Mooncake's Longing* (121.8 s) · `paper-lantern.mp4` · source in [`demo/`](demo/) · engine: three.js 0.170 (WebGL, SSAA 2×, VSM soft shadows, custom DoF + bloom compositor), Canvas2D-drawn paper layers, headless Chrome frame capture.


**The demo narration is Mandarin Chinese** (edge-tts `zh-CN-XiaoxiaoNeural`) with Chinese subtitles. The library default is English with Kokoro (`core/tts/`); "Score structure" and "Engine reference" show how to switch. The demo runs 2 minutes; 45–120 s all work in this style.

## Story & structure

The film opens on the real lightbox on a table and pushes into it. The box cavity is **0.56 × 0.33 m, 0.16 m deep**. The film is bookended by the **real world**: a walnut table in a dark room, the lit lightbox in a wooden frame, a tea set and a plate of real mooncakes lit by the box's spill light. The first shot pushes from the room into the box; the last pulls back out.

How the demo used the medium's powers:

| Native power | Story use |
|---|---|
| **Light turns on** | The opening is literally switching the lamp on: moon, then far layers, then windows light up one by one. "Lights coming on" = a story beginning, a home, someone waiting. |
| **Depth = distance** | Stacked layers of mountains, rivers, cities make *distance* visible. Journeys, longing, "far away" stories are native. |
| **Silhouettes** | People are black cut-outs with a few jointed parts (an arm, a sleeve). Faceless figures read as everyone — good for folk tales, family, festivals. |
| **Windows** | A lit window with a silhouette inside is the strongest image this style has. Two lit windows sharing one moon is the demo's thesis shot. |
| **Paper text** | Titles, letters and poems are paper too: vertical brush calligraphy on a cut strip, revealed column by column, with a red seal. |
| **The box itself** | Pulling out to the real table at the end says "this was a keepsake / a story told at home". |

**Story shape (proven in the demo):** room → lamp on → push into the box, title → origin (grandma's kitchen, the mooncake is pressed) → a bit of culture (a Ming-dynasty scroll quote) → the absence (an empty seat) → the journey (train across layered mountains, a myth told on the way, a box passing the other way) → arrival in the far city → the letter → **the twist: the other box was going the other way** (mutual longing — two windows, one moon) → a classical poem → pull out of the box, "中秋快乐".

Adapting any topic: find the **two places** and the **one light** they share (a moon, a lighthouse, a window). Build each place as a layer stack; build one travel sequence between them; end with both lit at once.

## Shots

| Beat | Camera |
|---|---|
| Opening | Room wide (z 1.45) on the dark box → lamp on → 7 s ease-in-out push through the frame to z ≈ 0.56, then keep creeping in. Focus pulls from the front layer to the village. |
| In-box shots | Nearly frontal, slow dolly in/out (`aim(cam, [px,py,pz, tx,ty,tz], t)`), hand-held micro-drift `hand ≈ .0006 m`. Aperture 12–26 (in `post()`), focus on the story layer so foreground reeds and back mountains soften. |
| Top-down inserts | The mooncake press and the open gift box are shot as flat top-down layer stacks (same engine, different set). |
| Train | Lateral travel: layers scroll at speeds proportional to depth (parallax). |
| Ending | Push inside the box, then a pull back out to the table (z 0.5 → 1.08), tea set enters frame, title 「中秋快乐」 fades in inside the box, credits under it, 1.2 s fade to black. |

Motion as built in the demo:

- **Everything moves like paper on a stick**: layers slide (x/y), rotate about a pivot (`ax/ay` anchor = joint), scale in from 0 along one axis ("written out"), or light up. No squash and stretch, no morphing.
- **Jointed figures**: a body sheet + a separate arm sheet anchored at the shoulder (`GRAN_SHOULDER`, `GIRL_SHOULDER`, `SUSHI_SHOULDER` in `people.js`); animate `rotation.z` only.
- **Light cues are the big motion**: lamp-on sequence in S01 — moon (0.5–3.2 s) → sky → each layer's translucency staggered by 0.42 s → key light → windows → lanterns flicker (`1 + .06·sin(7.3t)·sin(3.1t)`).
- **Text reveal**: paper strips grow from their anchor edge (`reveal()` in `s13_note.js` scales the mesh *and* the texture repeat so glyphs are not squashed), timed to the spoken word.
- **Hard action beats land on whisper word times**: the wooden mould slams on 「啪」(`E.word('L04', 13)`), the 「圆」 character flashes on its word, the light arcs grow from 「互」.
- **Transitions**: 0.5–1.2 s dissolves between shots (`in: { type: 'dissolve', dur }`), an `iris` mode exists (circular wipe from `center`). The signature transition is a **near-plane auspicious-cloud curtain** (`cloudCurtain()` in `s17_sushi.js`) closing over the last 1.2 s of a shot and opening on the next — the two halves must meet exactly at their front edges.

## Score structure

**Voice (demo, Mandarin):** `edge-tts`, voice `zh-CN-XiaoxiaoNeural`, rate `+10%`, pitch `-2Hz` (`demo/tts.py`); per-line `rate` overrides in `script.json` (L01 `+5%`, quoted letters `+2%`, the poem L23 **`-12%`**, closing line `-6%`). Output is trimmed at 2 % of peak (20 ms pre-roll, 120 ms tail) → 48 kHz mono `vo/<id>.wav` + `vo/dur.json`.
- **Polyphonic characters**: feed TTS a homophone via a `say` field and keep the real text for subtitles: 「相思的"相"」→ `say: 原来，相思的香，是互相的香。` (TTS otherwise reads xiàng).
- **Proof**: `demo/asr.py` (faster-whisper **medium**, zh) prints OK/DIFF per line; DIFFs that are homophones or numerals (八月十五 → 8月15, 她 → 他) are fine — listen to the rest.
- **Word timings**: `demo/words.py <ids…>` → `vo/words.json` (whisper word timestamps). Shots read them via `E.word(id, k)`; **k is a whisper token index, not a character index** (whisper groups 「我们」 as one token) — print the list and count.

**Voice (English, library default):** write `lines.json` with `{id, text, voice, speed}`, run `core/tts/tts.py` (Kokoro, e.g. `bf_emma` / `af_heart`, speed ≈ .9) into `demo/vo/`, then `core/tts/asr_check.py` which writes `vo/dur.json` and a compatible `vo/words.json` (English word indices). Put the same ids/text into `script.json`. See "Switching to English" under Engine reference for the subtitle-split change.

**Music:** Kevin MacLeod — **"Ripples"** (guzheng, 0 → ~37 s) handing over to **"Nu Flute"** (dizi + strings) with a 4.5 s crossfade; both CC BY 4.0 (incompetech.com). The handover is solved backwards so Nu Flute's own 70 s swell lands on the poem: `T_FLU = C.L23.at − 70 + .3`. Nu Flute −3.3 dB relative. 2 s fade in, 3 s fade out. Why these: pentatonic, no drums (percussive energy < 0.02) — see `demo/music/MUSIC.md` for the librosa analysis and the rejected candidates.

**Mix (`demo/mix.py`):** voice → downsampled-envelope compressor (−22 dB, 3:1) → HP 70 Hz → RMS −18 dB; music RMS −27.5 dB with **5.5 dB ducking** under speech (0.25 s smoothed envelope); procedural foley at −24…−34 dB: switch click + rising shimmer (lamp on), wooden-mould thud + puff, chimes on reveals, paper rustles, lid thud, train bed (rumble + 0.62 s "clack-clack"), whoosh for the passing train and cloud curtain, city hum, a bite crunch. Everything is placed from `out/timeline.json` (line starts) and `vo/words.json`. Peak-limited to −1 dBFS; the final mux normalises to **−14 LUFS** (two-pass loudnorm in `core/render/mux.sh`).

## Palette & props

**Units and layout.** Everything is in metres, y up. Box cavity `BOX = { w: .56, h: .33, d: .16 }` (`src/room.js`). Layers sit at z from about **−0.14 (sky) to 0 (front)**; in-box camera at z ≈ 0.3–0.56 with fov 26°. Full-bleed layers inside the box are `.558 × .328` — **never larger than the cavity**, or they poke through the wooden frame in the room shots.

**Layer stack for a night exterior (S01):**
| z | Layer | Colour | backlight `trans` |
|---|---|---|---|
| −.135 | sky gradient (unlit, `skyPanel`) + stars | `#0a1330 → #172a58 → #2e4478 → #43598a` | — |
| −.125 | moon disc + additive halo | `#fffaf0 / #fff0cf / #f7dca4` | — |
| −.112 | auspicious clouds (祥云) | `#c3cbe8` | .9 |
| −.098 | far karst mountains, carved contour slits | `#6a86c2` | .7 |
| −.080 | mid mountains | `#3f5a92` | .45 |
| −.062 | village (江南 houses) + emissive windows | `#5a70a6` walls / `#1b284f` roofs, glow `#ffb862` | .25 |
| −.046 | river + moon trail (emissive) | `#22325e`, trail `#e9cf96` | .3 |
| −.030 | osmanthus tree + bridge, emissive blossoms | `#17224a`, flowers `#d9a24a` | .12 |
| −.014 | foreground bank + reeds | `#0e1532` | .05 |
| +.004 | hanging lanterns (emissive) | `#0d1328`, glow `#ff8a48` | .05 |

Rule: **back layers bright + translucent, front layers dark + opaque**. Interiors use the same ladder in warm browns (kitchen wall `#b08058`, props `#6e3b1f`, figure `#2e170d`, lamp glow `#ffc878`); the far city uses violets (`#2a2456`, windows `#e8cc90`).

**Accents:** seal red `#b3302a`, gold title paper `#f1dbac` / `#f3d998`, box red `#9e2a20`, a single blue box `#2a4f7a` for the granddaughter's reply.

**Paper finish** (`finish()` in `src/paper.js`): tiled fibre grain (`GRAIN`, 512², α .9, `source-atop`), top rim band `rgba(255,236,200,.35)` shifted 3 px, bottom shade `rgba(0,0,0,.28)` shifted 3 px. Canvas resolution `PPM = 5200` px/m.

**Backlight shader** (`paperMat()`): `emissive += albedo × lightCol × trans × uLit × fall × (.35 + 1.3·cloud)`, `fall = mix(.22, 1, exp(−d²/R²))` around the per-shot light point `uLight` (usually the moon). `cloud` is a tiled pulp-mottle texture (`CLOUD()`). Emissive windows come from a second Canvas (`glowDraw`, white = light) scaled by `glow` and gated by `uGlowLit` (0→1 to "switch on").

**Fonts** (`demo/fonts/`, OFL): Ma Shan Zheng `FONT.brush` for titles/poems, Zhi Mang Xing `FONT.xing` for running script, Long Cang `FONT.hand` for the child's handwriting, Noto Serif SC `FONT.song` for subtitles and credits.

**Real-world set** (`lightbox()` in `src/room.js`): extruded walnut frame (Poly Haven `american_walnut_veneer`, tint `#8a6a52`), black paper lining inside, walnut table, dark radial wall `#2a2018 → #0a0806`, a `RectAreaLight` spill `#ffc98a` (intensity 6–7) at the box mouth, hemisphere fill `.25`, Poly Haven `tea_set_01` (teapot, cup, saucer, plate) and two procedural 3D mooncakes (cylinder + bump-mapped face from `cakeFace`).

## Titles, subtitles & end card

- Burned-in DOM subtitle (`#sub` in `index.html`): Noto Serif SC 500, 40 px, `#fbf3e4`, letter-spacing .06em, 74 px from the bottom, soft black shadow; fades in 0.15 s before the line, out 0.3 s after. Lines longer than 21 characters split at the comma nearest the middle; trailing punctuation is dropped and inner `，。：` become full-width spaces.
- **Lines that appear as paper in the picture are not subtitled** (`"sub": false` in `script.json`): grandma's letter (L17) and the poem (L23). Don't show the same words twice.
- Title: vertical Ma Shan Zheng on a paper strip inside the box (「一个月饼 / 的相思」) with a red seal 「中秋」, fading in after the second line.
- End card: 「中秋快乐」 paper title inside the box + red seal 「团圆」; the credit block (`#credit`, 19 px, two lines: music / assets / fonts) fades in 0.6 s after the last line.
- **Sign-off (this library's demo only):** our demo's end card carries **"LemoLab × Claude Opus 5.5"** as a **paper-cut strip inside the lightbox**, not as overlay text: `sign` sheet in `src/shots/s18_finale.js` — `w .26, h .02`, centred at `y −.1515` on the dark foreground bank, `z −.024` (in front of the bank layer, near the final focus plane), `text(…, .0115, FONT.song, { fill: '#f3d998', weight: 600 })`, `trans .3`, `shadow/recv: false`. It fades in over `tT + 1.0 → tT + 2.0` (1 s after 「中秋快乐」 starts, ≈116.6–117.6 s) and stays to the end, so it reads as part of the lamp while the credit block sits on the table below. It belongs to the library's own demos: a user's film carries no LemoLab credit, no strip like this and no copy of this end card.
- `paper-lantern.srt` holds all 25 lines (including the two in-picture ones) at their spoken times.

## Pitfalls we hit (demo record)

- **`destination-out` cut-outs need an opaque fillStyle**: set `x.fillStyle = '#000'` (or any opaque colour) before punching holes; a transparent or glow-white fill leaves the hole half-cut. `props.js` `cut(x, fn)` does it for you.
- **VSM shadows leak light bleeding / self-shadow halos**: layers that must not take part (titles, lanterns in front, light arcs, curtains) need **both** `shadow: false` **and** `recv: false`.
- **Additive glows**: a transparent radial-gradient `CanvasTexture` shows a visible square edge. Use the analytic `ShaderMaterial` falloff (`burst()` in `paper.js`) for light spilling out of an opened box.
- **Near-plane cloud curtain**: compute the closing position so the two curtains' **front edges** touch (`±.035` offset in `s16_mutual.js`), otherwise a slit of the old shot shows through.
- **Layers bigger than the cavity** poke through the wooden frame in room shots — keep full-bleed sheets ≤ `.558 × .328`.
- **Grade uniforms were sticky (fixed 2026-09-26)**: v1 of `Pipe.final()` only wrote `lift`/`gain` when a shot's `grade()` returned them, so a shot without them inherited the previous shot's values and the result depended on which frame a render worker started on — the first release (`paper-lantern_v1.mp4`) had visible grade pops at the worker boundaries 60.9 s (S09) and 101.5 s (S16). Now every missing grade key falls back to `GRADE0` (`post.js`: lift `[0, .005, .018]` cool night default, gain `[1.03, 1, .95]`), so renders are identical for any worker count. Night exteriors rely on the defaults; interiors must return their warm `lift` explicitly (S08 was fixed this way).
- Whisper medium mishears Chinese homophones (八月 → 8月, 她 → 他, 婵娟 → 禅绢); judge DIFFs by ear, not by string match.
- Headless Chrome must run with GPU flags (`--use-angle=gl --enable-gpu --ignore-gpu-blocklist`, `render/browser.mjs`); SwiftShader is ~6× slower.

## Build notes

```
styles/paper-lantern/demo/
  index.html        page: canvas + #sub + #credit, importmap → /node_modules/three (repo root is the static server root)
  script.json       lines: {id, text, rate?, say?, sub?}
  tts.py asr.py words.py   edge-tts → vo/*.wav + dur.json; whisper proof; word timings → vo/words.json
  src/main.js       timeline (GAP table), shot scheduler (lazy build / dispose), dissolves, subtitles, credits, window.render(t)
  src/shots/index.js   shot list, each start anchored to a line: start: L('L06') - .5
  src/shots/sNN_*.js   one module per shot: build(E) → { S, update(t), post(t), grade(t) }
  src/paper.js stage.js post.js room.js art.js people.js props.js lib.js   engine (see Engine reference)
  render/still.mjs video.mjs cues.mjs   stills, parallel video render, export out/timeline.json
  mix.py            voice + music + foley → out/mix.wav
  music/            candidate tracks + MUSIC.md (only km_Ripples.mp3 and km_Nu_Flute.mp3 are used)
```

All commands from the repo root (`Lemo-Opuscar/`). Python = `.venv/bin/python`; `edge-tts` must be on `PATH` (user-level `pip install edge-tts`; it is not in `.venv`).

```sh
D=styles/paper-lantern/demo
# 1. voice (Mandarin demo) — delete vo/<id>.mp3 or set "redo": true to regenerate a line
python3 $D/tts.py                          # → $D/vo/<id>.wav, $D/vo/dur.json
.venv/bin/python $D/asr.py                 # OK / DIFF per line (≈1.5 min, whisper medium, CPU)
.venv/bin/python $D/words.py L01 L02 … L25 # → $D/vo/words.json (pass ALL ids: it rewrites the file)
#    English instead: .venv/bin/python core/tts/tts.py $D/lines_en.json $D/vo && .venv/bin/python core/tts/asr_check.py $D/lines_en.json $D/vo

# 2. timeline + review stills (any number of times, seconds)
node $D/render/cues.mjs                    # → $D/out/timeline.json (DUR, line cues C, shot plan P)
node $D/render/still.mjs 5 12.5 62.5 116 --out $D/out/review          # add --q '?ssaa=1' for fast previews
#    core renderer works too: node core/render/still.mjs $D 12.5 --out $D/out/review
#    debug: ?sheet (character sheet), ?nolit=1 (backlight off), ?hide=clouds,far (S01 layers)

# 3. mix
.venv/bin/python $D/mix.py                 # → $D/out/mix.wav   (optional arg: other output path)

# 4. render video (≈90 s for 3653 frames with 6 workers on an M-series Mac; ≈3 min with 2)
node $D/render/video.mjs --workers 6       # → $D/out/video.mp4 (segments written next to the output; any worker count gives the same frames)

# 5. mux: two-pass loudnorm −14 LUFS, 30 fps, no grain
sh core/render/mux.sh $D/out/video.mp4 $D/out/mix.wav styles/paper-lantern/paper-lantern.mp4 30 0
```

Review loop: stills of every shot at its key word time → sheet (`ffmpeg … tile=6x5`) → fix → only then the full render. Check the room shots (first 10 s, last 8 s) at full SSAA; they carry the "it's a real object" illusion.

## Engine reference

**Page contract** (`src/main.js`): exposes `window.READY`, `window.DUR`, `window.render(t)` (deterministic per frame), `window.CUES` (line cues), `window.PLAN` (shot table). Query `?ssaa=N` (default 2).

**Timeline**: lines start at 2.6 s; each line lasts its `dur.json` length followed by `GAP[id]` seconds (`GAP` table in `main.js`, e.g. `L02: 4.2` for the title beat, `L25: 5.0` for the ending). Shots are anchored to lines in `src/shots/index.js`; changing a voice line re-times everything automatically.

**Shot context `E`** (passed to `build`): `dur`, `T0`, `C` (all cues), `env` (PMREM room env map), `W` (words), `cue(id)` / `cueEnd(id)` (line start/end in shot-local seconds), `word(id, k)` (shot-local start of whisper token k).

| Module | Key API | Notes |
|---|---|---|
| `paper.js` | `sheet({ U, w, h, draw, glowDraw?, glow, glowCol, trans, z, x, y, ax, ay, shadow, recv, finish, ppm, bumpDraw? })` | One paper layer. `draw(x, k)` paints in metres (origin centre, y up). `glowDraw` paints the emissive map (white = light, black = mask). `trans` = backlight translucency. `ax/ay` = pivot. Returns a Mesh; `m.material.userData.u` has `uTrans`, `uGlowLit`, `uClip` (circle clip `[cx, cy, r, inside?]`). |
| | `skyPanel({ w, h, z, stops, stars, starMinY, gain })` | Unlit gradient back panel. |
| | `moon({ x, y, z, r, gain, halo, haloGain, art? })`, `setMoon(m, k)` | Disc + additive halo; `k` = brightness 0…1+. |
| | `text(x, s, px, py, size, font, o)`, `vtext(…)` | Text in metre space (vertical for `vtext`). |
| | `burst(w, h, col)` → `m.userData.set(k)` | Analytic additive glow. |
| | `paint(w, h, draw, ppm)`, `finish(c, o)`, `tex(c)`, `PPM`, `GRAIN`, `CLOUD()` | Low-level canvas helpers. |
| `stage.js` | `stage({ light, lightR, lightCol, key, keyCol, keyPos, keyTarget, keyAngle, amb, ambCol, shadowR, fov, bg })` → `{ scene, U, cam, key, amb, add(...) }` | Scene + top LED spot (VSM, 2048², radius 10) + ambient + backlight uniforms `U`. |
| | `aim(cam, [px,py,pz, tx,ty,tz], t, { hand, handF, roll, fov })` | Camera with hand-held drift. |
| | `dispose(scene)` | Called by the scheduler when a shot leaves. |
| `post.js` | `Pipe.shot(scene, cam, { focus, aper, maxCoc, bloom: { strength, radius, threshold } }, target)` | MSAA4 half-float → CoC → 96-tap gather DoF → UnrealBloom. `focus` = distance in metres. |
| | `Pipe.final({ mixB, mode, center, expo, fade, vig, sat, contrast, lift, gain })` | Dissolve / iris, grade, vignette, neutral tone map, sRGB. Keys a shot omits fall back to `GRADE0` every frame. |
| `room.js` | `await lightbox(S, E, { spill, spillCol })` → `{ g, frame, spill, table, props }`, `BOX` | Real-world box, table, tea set, mooncakes. Textures load from `/core/assets/polyhaven/`. |
| `art.js` | `karst`, `ridge`, `xiangyun`, `waves`, `waterTop`, `osmanthus`, `pine`, `willow`, `reeds`, `jiangnanHouse(x, o, g)`, `pavilion`, `lantern(x, o, g)`, `mooncake`, `FONT` | Paper-cut motifs; functions with `g` draw their windows into the glow canvas. |
| `people.js` | `grannyStand/Sit`, `girlStand/Sit`, `childStand`, `sushi`, `change` (Chang'e), `rabbit`, `arm(x, s, a, b)`, `spline`, `ribbon`, `*_SHOULDER` | Silhouette figures, scale `s` = height in m. |
| `props.js` | `cut(x, fn)`, `roundWindow`, `steamers`, `stove`, `jar`, `bowl`, `teapot`, `pendant`, `calendar`, `table`, `chair`, `boxFront`, `label`, `cake3q` | Interior props. |
| `lib.js` | `ss`, `seg`, `eio`, `eo`, `ei`, `back`, `spring`, `lerp`, `clamp`, `mulberry`, `vnoise`, `track`, `env` | Deterministic helpers. |

**Minimal shot** (a moonlit hill with one lit window; add it to `SHOTS()` as `{ id: 'S99', start: L('L05') - .3, in: { type: 'dissolve', dur: .8 }, build: s99.build }`):

```js
import { sheet, skyPanel, moon, setMoon } from '../paper.js';
import { karst, jiangnanHouse } from '../art.js';
import { stage, aim } from '../stage.js';
import { seg, ss, eio, lerp } from '../lib.js';

export function build(E) {
  const MN = [.08, .07, -.13];
  const S = stage({ light: MN, lightR: .15, lightCol: '#ffe2ae', key: 1.0, amb: .3, ambCol: '#7d90c8', keyCol: '#d6dcff' });
  const { U } = S;
  S.add(skyPanel({ w: .56, h: .33, z: -.14, stops: [[0, '#0a1330'], [1, '#43598a']], stars: 200 }));
  const mn = S.add(moon({ x: MN[0], y: MN[1], z: MN[2], r: .035 }));
  S.add(sheet({ U, w: .558, h: .328, z: -.1, trans: .7, draw: x => { x.fillStyle = '#6a86c2';
    karst(x, { x0: -.28, x1: .28, base: -.03, peaks: [[-.15, .06, .03], [.1, .05, .025]], carve: .0005 }); } }));
  const house = { cx: -.05, by: -.09, w: .06, h: .03, windows: [[.012, .01, .01, .01]], wall: '#5a70a6', tile: '#1b284f' };
  const town = S.add(sheet({ U, w: .558, h: .328, z: -.06, trans: .25, glow: 2.2, glowCol: '#ffb862',
    draw: x => jiangnanHouse(x, house), glowDraw: g => jiangnanHouse(null, house, g) }));
  S.add(sheet({ U, w: .558, h: .328, z: -.02, trans: .05, draw: x => { x.fillStyle = '#0e1532'; x.fillRect(-.28, -.165, .56, .075); } }));
  const tOn = E.word('L05', 2);                        // light the window on the 3rd spoken token
  return {
    S,
    update(t) {
      setMoon(mn, ss(seg(t, 0, 1.5)));
      town.material.userData.u.uGlowLit.value = ss(seg(t, tOn, tOn + .6));
      aim(S.cam, [0, 0, lerp(.56, .48, eio(t / E.dur)), 0, 0, -.07], t);
    },
    post() { return { focus: S.cam.position.z + .06, aper: 14, maxCoc: 14, bloom: { strength: .35, radius: .6, threshold: 1.15 } }; },
    grade() { return { expo: 1.05, vig: .42, sat: 1.05, contrast: .1 }; },   // missing lift/gain → GRADE0 (cool night); interiors add lift: [.012, .006, 0]
  };
}
```

**Switching to English**: in `main.js` the subtitle splitter assumes Chinese (`st.length > 21`, split on `[，。：]`, punctuation → full-width space). For English change it to split at the `, ` nearest the middle when longer than ~42 characters and keep punctuation; set `#sub` to a Latin serif (e.g. add an OFL font such as Cormorant to `fonts/`) at ~38 px. `E.word(id, k)` then counts English words. Everything else (timeline, mix, render) is language-agnostic.
