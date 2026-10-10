# Pictogram Motion — our demo

One example among many. Don't reuse its story, arc, shots, props or timings.

Demo: *Aichi-Nagoya 2026 — All 43 Sports* (EN-JP version, 163.6 s, 1920×1080 @ 60 fps, 150 BPM, 70 sport cards, no narration) · `pictogram-motion.mp4` · source in [`demo/`](demo/) (local, not published) · engine: Canvas2D (`engine.js` + `scenes.js` + `poses/*.js`), headless Chrome frame capture, numpy-synthesised score.


> **Rights note.** The demo is a fan-made promo for a real event, the 20th Asian Games Aichi-Nagoya 2026. The event name (AICHI-NAGOYA 2026 / THE 20TH ASIAN GAMES), the slogan (IMAGINE ONE ASIA / ここで、ひとつに。), the emblem-like red-sun-and-rings mark drawn in code, the five-colour palette and its colour names, and the grid pattern language all follow the organiser's identity. They belong to the organiser (Aichi-Nagoya Asian Games Organising Committee / Olympic Council of Asia). `demo/ref/` holds official images downloaded from the Games' website for reference only. They are never drawn into the film and must not be redistributed. **Any other film made from this code must replace all event-specific elements** (see [Replacing the event elements](#replacing-the-event-elements)).

## Story & structure

A fan promo listing every sport of a multi-sport games, one card per sport, on the beat. How the demo used the style's native powers:

| Native power | Story use |
|---|---|
| **One card = one item** | Any list of 20–80 things: every event of a games, every tool in a kit, every station of a process. The count is the hook ("ALL 43 SPORTS"). |
| **Chapters = colours** | Group the list into 5–7 families. Each family gets a palette hue, so the viewer always knows where they are. |
| **Pictogram action** | Every item needs one *verb* that reads in 1.6 s (throw, jump, swing, pedal). If an item has no body action, give it a prop action (a gear turns, a cup pours). |
| **Pace ladder** | Normal cards are 4 beats (1.6 s). Sub-families become 2-beat rapid-fire runs (4 swim strokes, 4 cycling disciplines, the racket sports), which gives the film a second tempo without changing BPM. |
| **Long take** | The first and biggest chapter is one sideways camera move down a track: 14 stations one screen apart, with a whip-pan on each beat-cut. Use it for the "hero" family. |
| **Grand finale grid** | All items come back as a 9×5 icon wall, flip in, turn one colour, collapse into a single sun, then the slogan and the end card. |

**Story shape (demo):** heartbeat cold open (a red dot pulsing on ink, rings drawing around it) → title slam on a full five-colour pattern → three count-ups (43 SPORTS / 469 EVENTS / 16 DAYS) → "ON YOUR MARKS… SET…" with half a beat of silence → 7 chapters, 70 cards → icon-wall finale → slogan → end card → fade to black over the music's ring-out.

Adapting a topic: list the items; group them into 5–7 chapters; give every item a one-beat verb; pick one chapter for the long take; choose which runs go 2-beat; write a two-line slogan for the finale.

### The demo's look, as built

A **catalogue film**: a set of N items (sports, products, features, dishes, steps) is shown one card at a time, fast, on the beat. Each card = **one pictogram doing one action + a huge title + a second-language line + a mono index "07 / 43"**. Cards are grouped into chapters. Each chapter owns one colour of a five-colour palette. A chapter card with a full-bleed pattern opens each group.

The recognisable ingredients are:
1. **The grid pattern** ("core graphic"): a 180 px square grid. Big discs and half-discs span cells. About half of the cells carry a small motif (fish-scale waves, dot scales, triangle scales, striped sunset, gear/sun wheel, crescent, concentric arcs, checker, gradient quarter-disc…). The pattern uses **5 tones of one hue**, and **whole rows are cut and shifted sideways**. The row shift is the signature: it drives the backgrounds, the chapter beats and the main transitions.
2. **The pictogram athlete**: flat, faceless, built from rounded bars with a disc head. The near-side limbs are drawn in the foreground colour and the far-side limbs in a colour 42 % mixed toward the background. Props are just as geometric: discs, rings, capsules, straight lines.
3. **Type as architecture**: a 900-weight grotesk title (Inter Tight) set 150–330 px tall, and a heavy CJK line (Noto Sans JP) under it. Small DM Mono meta text sits in the corners, as on a broadcast HUD.

The mood is premium sports-broadcast identity: flat colour, no gradients except one soft light sweep, no outlines, no textures except a very light film grain.

## Shots

| # | Section | Camera / picture | Native move / note |
|---|---|---|---|
| 1 | Cold open | Locked frame: a red dot pulsing on ink like a heartbeat, rings drawing around it | the only `oBack` ease |
| 2 | Title | Slam on a full five-colour pattern; rows transition out | row-shift reveal |
| 3 | Count-ups | 43 SPORTS / 469 EVENTS / 16 DAYS, one bar each | count-up slam |
| 4 | "ON YOUR MARKS… SET…" | Locked; half a beat of silence before the first chapter | silence before a big hit |
| 5 | Athletics (chapter 1) | The long take: 14 stations one screen apart, whip on every cut | long take down a track |
| 6 | Chapters 2–7 | Locked cards, layouts A/B/C/M rotated per chapter, 2-beat runs for swim strokes, cycling and rackets | chapter = colour; pace ladder |
| 7 | Finale | 9×5 icon wall flips in, turns one colour, zooms to 0.9, tiles collapse into one red sun | icon wall; many become one |
| 8 | Slogan + end card | Sun and rings rise and shrink; slogan, title, dates, colour bars, credit line; fade to black over the ring-out | see End card |

The camera exists only in the **long take** (`trackScene`). There, 14 stations are laid one screen width apart. The camera drifts at 42 px/s and on every cut whips one full screen (`E.ioExp` from 0.14 s before the beat to 0.24 s after). Two background rows of 360 px motif cells scroll at parallax 0.28 and 0.42. The deep-red track (y 780) has cream lane lines, and dashes roll faster for running events (`RUNNING` speeds). An event spec (`100M`, `4×100M`, `7.26 KG`…) is painted on the track, sheared −0.35, at 12 % cream. Everywhere else the frame is locked and flat; energy comes from the row shifts, transitions and figure actions.

Intro and finale "camera": the finale wall zooms to 0.9 with 10 px gutters, then every tile collapses to the centre and a red sun grows out of it. The end card's sun and rings rise from the centre to y 330 as they shrink to 0.62×.

## Score structure

- **No narration.** The film is carried by type and music. The subtitle file is a title-card track only (see End card).
- **Score**: original, fully synthesised in `demo/music/music.py` (numpy + scipy; no samples). "Wadaiko × electronic", 150 BPM 4/4, D *miyako-bushi* (D Eb G A Bb) over D minor harmony, 101 bars = 161.6 s plus a 2 s ring-out. Instruments are synthesised: odaiko / nagado / shime taiko, *ka* rim clicks, kick, clap, snare, hats, shaker, crash, plus foley-like hits (splash, drop, pok, clank, crack). Shamisen and koto are Karplus-Strong plucks (`ks_render`, koto with pitch bends); there are also a synth bass, pads, detuned-saw chord stabs, risers and a drone.
- **Picture-locked by data**: `music.py` reads `music/timeline.json` (exported from `edl.js`). Every shot start gets an accent chosen by chapter (`card_accent`: splashes for aquatics, *pok* for rackets, odaiko + stab for combat, clank for power…). Chapter and finale starts get a `big_hit`, **preceded by a half-beat of silence** (drums and bass muted). The report checks each of the 79 shot onsets to within ±15 ms (demo: 79/79 pass, offsets ≤ 0.2 ms).
- **Master**: stems `music_bed.wav` + `sfx.wav`, a 2:1 glue compressor and a limiter, at −14 LUFS integrated and ≤ −1 dBTP (demo: −14.11 LUFS, −1.12 dBTP). `music/report.txt` holds loudness, band energy, onset and gap checks. Render time is about 30 s.
- **Section layout is hard-coded** in `compose()` (`EXPECTED = dict(intro=0, ath=12, …, finale=89)` in bars). If the EDL changes, the assert fires. For a new film, re-write `compose()` for the new chapter bars (hand it to a music sub-agent with `timeline.json` and this section) and keep `card_accent`, `big_hit` and the report as they are.

## Palette & props

**Canvas**: 1920×1080, grid `G.CELL = 180` (10.7 columns × 6 rows). Everything snaps to that grid: the chapter band is 2 rows tall, transitions cut by 180 px rows or 240 px columns, and the finale wall is 9×5.

**Palette** (`engine.js` → `G.PAL`; each hue has five tones `t[0]` darkest → `t[4]` lightest; `t[2]` is the base). The demo's values were sampled from the official core graphic:

| key | demo name | t[0] | t[1] | **t[2] base** | t[3] | t[4] | fg (type & figure) |
|---|---|---|---|---|---|---|---|
| red | Jonetsu Red | `#c21d15` | `#d22419` | **`#e83220`** | `#ec5a26` | `#f07a45` | cream `#fbf6ec` |
| purple | Kakitsubata Purple | `#231a6e` | `#2c2084` | **`#4e3a93`** | `#644d9d` | `#7a62a9` | cream |
| green | Shinrin Green | `#006d35` | `#008440` | **`#079a3e`** | `#2da547` | `#68b15d` | cream |
| gold | Kinshachi Gold | `#b48900` | `#c69b00` | **`#d5b102`** | `#debc2f` | `#e7d16c` | dark `#211904` |
| ochre | Dento Ocher | `#946a2e` | `#ac7d38` | **`#c18e46`** | `#d2a55c` | `#e0bf84` | dark `#1e1409` |
| ink | Sumi | `#0f0c15` | `#16121d` | **`#1e1a27`** | `#2a2535` | `#3a3447` | cream, accent = gold |

Cream `G.CREAM = #fbf6ec`, ink `G.INK = #15111c`. **Gold and ochre take dark type and dark figures**; the others take cream. `G.CYCLE = ['red','purple','green','gold','ochre']` is the rotation used by multi-colour chapters and the intro pattern. On cards the pattern is drawn at `spread 0.42` (low contrast, so the type reads), and at `spread 0.95` on chapter cards (full contrast).

**The pattern** (`G.pattern(palKey, seed, {spread, density})`): fill with `t[1]`. On each grid node, 34 % of the time place a disc of radius `CELL` in a random tone, and 16 % of the time a `t[3]` disc with a `t[0]` half-radius disc inside it. Then a fraction `density` of the cells get one of 14 motifs (`G.motif` kinds 0–13): quarter-disc, half-disc, disc + dot, striped sunset, *seigaiha* fish-scale waves, dot-scale disc, triangle scales, concentric arcs, sun wheel / gear, checker, crescent, S-wave, gradient quarter-disc, fading bars. Each motif is rotated by a random multiple of 90°. The canvas is 3 cells wider than the screen, so any row can shift ±1 cell. **All the motifs are generic geometry.** Do not draw event mascots, landmarks or products into cells.

**Pictogram figure** (`G.joints` + `G.drawFigure`): the unit is body height = 1 and the origin is the hip. Segment lengths are torso 0.30, neck 0.045, head radius 0.082, upper arm 0.16, forearm 0.15, thigh and shin 0.225. Widths are torso 0.145, arm 0.076, leg 0.094, all with round caps. The draw order is far leg, far arm (colour `far` = fg mixed 42 % toward the background), then torso, near leg, near arm, head (fg). A second person (opponent or partner) is drawn behind in `far2` (60 % mix). In cards the figure stands on a **sun disc** (r 360–380 px, tone `t[1]` on light-fg hues, `t[4]` on gold/ochre, `t[3]` on ink) with one slow 9 % white light sweep across it.

**Card layouts** (`layoutOf(s)`, rotated per chapter by an order string such as `ball: 'ACBAB'`):
- **A**: text block left (x 130, baseline 610); disc and figure right (centre 1290, or 1370 for horizontal swimmers); a 300 px outline index number bottom-right at 20 % opacity.
- **M**: mirror of A (figure left at 640, text right-aligned at 1800).
- **B**: the title **fills the frame** (330 px, colour `t[1]`/`t[4]` "ghost" tone, a single line fitted to 1760 px). The disc and figure sit *over* the title. A bottom info bar has the JP name at 80 px, the EN name at 44 px and the mono meta right-aligned. 2-beat racket runs always use B.
- **C**: a solid 820 px left panel (`t[0]` or `t[4]`) that wipes in, with a 90 px hairline grid at 10 % and the text block on it; the pattern, disc and figure are on the right (1370).

**Type** (`demo/fonts/`, all OFL):
- Title: Inter Tight 900, 170 px (150 in C, 160 on the track), letter-spacing −0.02 em, auto-fitted with `G.fitFont` to 820 px.
- Second language: Noto Sans JP 900 at 92 px (EN-JP) or Noto Sans SC 900 (ZH version, with an extra JP line at 28 px/500).
- Meta: DM Mono 500 22 px, letter-spacing 3 px, e.g. `ATHLETICS   01 / 43`. Tags: a mono chip (`5×5 · 3×3`, `NEW` in red).
- HUD (every card and chapter): DM Mono 17 px in all four corners (event line top-left, chapter top-right) and a **43-tick progress bar** at the bottom. The current item is a tall 4 px tick; done items are at 75 %, the rest at 28 %.

**Grain**: added only at mux time (`noise=c0s=4:c0f=t+u`). The canvas itself is clean.

### Motion, as built

- **Grid of time**: 150 BPM, 1 beat = 0.4 s, 1 bar = 1.6 s. Every shot starts on a beat (`edl.js`), and every key action in a pose lands on an integer beat `u` (release, contact, landing).
- **Easing**: `E.oExp` (exponential ease-out) for almost every entrance; `E.ioExp` for whip-pans and wipes; `E.o5`/`E.o3` for panels and discs; `E.oBack` only for the intro's first dot.
- **Type entrance**: `G.maskText` slides each line up from below a clip rectangle (title over 0–0.5 s, JP line at +0.08 s, tag at +0.2 s). Meta lines type on (`G.typeText`, no caret). 2-beat cards compress all timings by 0.7.
- **Figure assembly**: for the first 0.42 s (0.28 s on 2-beat cards) the figure layer is cut into 54 px horizontal bands that start offset alternately left and right by 90–250 px and slide into register (`stageFigure(..., asm)`). This echoes the pattern's row shift.
- **Backgrounds breathe**: odd rows drift right and even rows drift left at 26 px/s, plus a fixed sine offset per row. On chapter cards every row **jumps a quarter-cell on each beat of the second bar** (beats 4–7), in time with the drums.
- **Chapter card**: a 2-row solid band grows from the centre (`E.o5`). A 330 px outline chapter numeral rises into it, and the title and JP line slide up. Hairlines sit above and below the band.
- **Transitions** (`transType`, window 0.12 s before to 0.26 s after the cut): `rows` (6 rows slide in alternating directions, used into every chapter and out of the intro), `cols` (8 columns drop or rise, used after chapter cards and in 2-beat runs), `slide` (racket runs: a push with a thin shadow edge), `quarter` (quarter-discs grow from cell corners, used into the finale), `iris` (a circle opens from the previous card's figure centre, with a shrinking ring), `flip` (an 11×6 grid of tiles flips over). Normal cards rotate `['quarter','rows','iris','flip','cols'][ci % 5]`. Inside the athletics long take there is **no** transition: the camera whips instead.
- **Motion blur only where it moves**: `isFast(t)` is true in the transition windows, and then `G.renderFrame` averages 5 sub-frames over a 0.5/60 s shutter. Static card frames render once.

## End card

- The type on the cards *is* the text layer; nothing extra is burned in. `pictogram-motion.srt` lists the title cards (intro lines, chapter titles, each card "01/43  ATHLETICS — SPRINT / 短距離", slogan, end card), generated from the EDL by `demo/srt.cjs`.
- **Bilingual rule**: EN is always the big title. The second language is chosen by `?lang=`: `ej` puts Japanese in the big second line (`s.jpBig || s.jp`) and drops the small JP line; the default (ZH) puts Chinese big and Japanese small.
- **End sequence (demo)**: cream end card, red sun + five-colour rings → **IMAGINE ONE ASIA / ここで、ひとつに。** (the official slogan) → **AICHI-NAGOYA 2026**, the dates, five colour bars and the credit line → fade to black (the last 1.3 s) → 2 s black tail over the music's ring-out.
- **Credit line**: our library's demo ends with "LemoLab × Claude Opus 5.5". It sits on the end card, centred under the five colour bars: `G.maskText(ctx, 'LemoLab × Claude Opus 5.5', W / 2, 1000, F.mono(24), rgba(G.INK, 0.6), inv(0.6, 1.2, l), { ls: '4px', align: 'center' })` in `finaleScene` (right after the colour-bar loop). It slides up 0.6 s after the end card lands (just after the bars), holds for about 3.5 s and fades out with the card. It is quieter than the date line, so it never competes with the title. This sign-off belongs to this library's demo only; a user's film carries no LemoLab credit and no copy of this card (take the line out of `finaleScene` when you adapt the code).

## Build notes

```
styles/pictogram-motion/demo/
  index.html      loads fonts + edl.js + engine.js + poses/*.js + scenes.js; exposes window.render(t), DUR, READY
  edl.js          edit decision list: every intro/chapter/card/finale shot with beats, names (EN/ZH/JP), pose, flags
  engine.js       G: easing, rng, palette, grid pattern + motifs, pictogram skeleton, text helpers
  poses/          base.js (pose API + props G.P) + one file per chapter: ath aqua ball combat power nature asia (70 poses)
  scenes.js       intro, chapter card, card layouts A/B/C/M, athletics long take, finale, HUD, transitions, motion blur
  render.mjs      headless-Chrome frame renderer (stills / video, N workers → seg_*.mp4 + list.txt)
  shot.mjs        quick JPEG stills (+ --sheet contact sheet via sheet.py)
  lab.mjs lab.html   pose check sheets; lab.mjs also screenshots cover.html / cover34.html (4:3 and 3:4 posters)
  mux.sh          concat segments → 2 s tail → grain → + music.wav → mp4
  srt.cjs         title-card .srt from the EDL
  music/          music.py (score), export_timeline.cjs (EDL → timeline.json), timeline.json, report.txt
  fonts/          Inter Tight, Noto Sans SC, Noto Sans JP, DM Mono (OFL)
  ref/            official reference images (NOT used by the film, do not publish)
```

All commands run from `styles/pictogram-motion/demo/`. Node uses the repo's `node_modules/playwright-core`, and Chrome is found by `core/render/browser.mjs` (the playwright headless shell or `PLAYWRIGHT_CHROME`). **The language defaults to EN-JP.**

```sh
cd styles/pictogram-motion/demo

# 1. Edit → timeline for the music (re-run after every change to edl.js)
node music/export_timeline.cjs                       # → music/timeline.json

# 2. Score (≈30 s; writes music/music_bed.wav, sfx.wav, music.wav, report.txt)
../../../.venv/bin/python music/music.py
grep "shots pass" music/report.txt                  # expect 79/79

# 3. Pose check sheets and stills while working
node lab.mjs stills/lab_ath.png "p=sprint,hurdles,relay&n=8&beats=4"
node shot.mjs 24.8 63.2 104.9 153 --sheet            # EN-JP stills → stills/t_*.jpg + stills/sheet.jpg
LANGQ=zh node shot.mjs 63.2                          # Chinese version still

# 4a. Render — EN-JP (default): 9696 frames → out_ej/seg_*.mp4
node render.mjs video 12                             # 12 workers ≈ 2 min on an M-series Mac; use 2–3 when sharing the machine
./mux.sh                                             # → ../pictogram-motion.mp4 (163.6 s, 9816 frames)

# 4b. Render — Chinese version
LANGQ=zh node render.mjs video 12                    # → out/seg_*.mp4
OUTDIR=out ./mux.sh                                  # → out/pictogram-motion_zh.mp4

# Partial re-render (e.g. only the ending): START/END in seconds, into a separate folder
START=148.1333 END=161.6 OUTDIR=out_tail node render.mjs video 2

# 5. Subtitles and posters
node srt.cjs                                         # → ../pictogram-motion.srt
node lab.mjs stills/cover_ej.png "lang=ej" cover.html      # 2880×2160 poster
node lab.mjs stills/cover34_ej.png "lang=ej" cover34.html  # 2160×2880 poster
```

How the two language versions differ: the only switch is the URL query `?lang=ej`. `render.mjs` and `shot.mjs` add it from `LANGQ` (default `ej`); `scenes.js` reads it into `G.EJ` and changes the second-language lines (intro title, count-up labels, ON YOUR MARKS, cards, chapter cards, end card). `render.mjs` writes EN-JP segments to `out_ej/` and ZH to `out/`; `mux.sh` reads `OUTDIR` (default `out_ej`). Picture timing and music are identical.

`render.mjs` pipes JPEG-100 screenshots into ffmpeg (`libx264 -crf 12`) per worker; `mux.sh` re-encodes the joined film at `-preset slow -crf 14`, 60 fps, GOP 120, AAC 320k, with a 2 s cloned tail so the music's ring-out plays over black.

Pitfalls we hit (several are tied to this demo's props):

- **Figure environments ate the type.** Water surfaces, ramps, fences and nets belong to the figure layer and spread into the text column. Fix: `stageFigure` renders into its own buffer and applies a `destination-in` gradient mask (`{x0|x1|y1, f}`) that fades the layer to zero 90–120 px before the text area.
- **Gold and ochre need dark type and dark figures** (`fg #211904 / #1e1409`), and their disc is the *lighter* tone `t[4]`. Cream on gold fails contrast.
- **The ink chapter's disc vanished** at `t[1]`. Use `t[3]` for the sun disc on ink.
- **Pattern canvases are big** (2520×1260 each, and every card uses a new seed). Cache them, but cap the cache: `G.pattern` keeps an LRU of about 10 entries. An unbounded cache eats memory fast when 12 browsers render at once.
- **zsh loops**: in `while read line` loops the variable does not word-split. Use `${=line}` when passing lists of times to `node shot.mjs`.
- **Horizontal poses** (swimming) need the stage moved right (`wide`: disc at 1370, text max width 700) or the arms cross the title.
- **Official identity**: the demo imitates a real event's identity closely. That is fine for a fan piece but not for a style library; see [Replacing the event elements](#replacing-the-event-elements).

## Engine reference

### `engine.js` (window.G)

| API | What it does |
|---|---|
| `G.E.{lin,io,o2,o3,i3,io3,oExp,iExp,ioExp,oBack,o5}` | easings (input clamped 0..1) |
| `G.clamp, G.lerp, G.inv(a,b,x)` | `inv` = normalised progress of x between a and b, clamped; used for every timing |
| `G.rng(seed)` | deterministic mulberry-style RNG |
| `G.PAL[key]`, `G.CYCLE`, `G.CREAM`, `G.INK`, `G.mix(a,b,t)`, `G.rgba(hex,a)` | palette and colour helpers |
| `G.pattern(pk, seed, {spread=1, density=0.5, cell=180})` | returns a cached pattern canvas (3 cells wider than the screen) |
| `G.drawPattern(ctx, pat, offs(row)→px, {oy})` | draws the pattern with a per-row horizontal offset (clamped ±1 cell) |
| `G.motif(ctx, kind 0–13, x, y, size, [bg, main, sub, accent], rng)` | one patterned cell |
| `G.joints(pose)` → `{hip, neck, sho, head, up, aL, aR, lL, lR}` | skeleton from a pose object |
| `G.drawFigure(ctx, J, nearCol, farCol)` | draw the pictogram (unit = body height) |
| `G.keyPose(keys, u, loop?)`, `G.lerpPose(a,b,t)` | keyframed poses in beats; each key `{b, ...angles, e:'easing'}` |
| `G.runCycle(phase, k, {lean})`, `G.walkCycle(phase, k)` | procedural gait (phase in cycles) |
| `G.fitFont(ctx, text, 'en'/'zh'/'jp', weight, px, maxW, ls)` | shrink font size to fit |
| `G.maskText(ctx, text, x, y, font, col, p, {align, ls, dir})` | mask slide-up entrance, p 0→1 |
| `G.typeText(ctx, text, x, y, font, col, p, {align, ls, caret})` | typewriter |
| `G.hair(ctx, x, y, w, col, p, lw)` | hairline wipe |

**Pose angle convention**: `rot` = whole body (positive = pitch forward); `torso` = upper-body lean; `head` = nod. Limbs are measured from "straight down = 0°", with forward = 90°, overhead = 180° and backward negative. Arms are in torso space and legs in body space. `aR2` and `lR2` (forearm, shin) are absolute in the same frame, not relative to the upper segment. R = near side (bright), L = far side (dim). `x, y` move the hip.

### Pose definitions (`poses/*.js`, contract in `poses/base.js`)

```js
POSES.name = {
  pose: (u) => ({...}),            // or keys: [...] + loop: beats   (u = beats since the card started)
  back:  (ctx, J, u, C) => {},      // props/environment behind the figure (unit = body height, origin = hip)
  front: (ctx, J, u, C) => {},      // props in front (ball, racket, bow)
  second: (u) => ({...}), secondX: [dx, dy], secondFace: -1,   // opponent / partner, drawn in C.far2
  fig: { s, x, y },                 // scale/offset inside the stage
  iconU: 0.6,                       // which beat to freeze for the finale icon wall
};
// C = { fg, far, far2, acc, bg, line } from G.colorsFor(pk, discColour)
// props: G.P.ball, G.P.racket, G.P.stick, G.P.ground, G.P.speed (speed lines), G.P.arc (flight arc)
```
Check poses with `node lab.mjs out.png "p=a,b,c&n=8&beats=4&pal=red"`: each row is one pose sampled at n moments over `beats`.

### `edl.js`

`chapter(id, no, en, zh, jp, palKey)` adds an 8-beat chapter card. `card(n, en, zh, jp, pose, {beats=4, sub, fam, jpBig, track, water, racket, family})` adds one item. `fam: true` means the big title is `sub` and `en` becomes the small family line. `track: true` puts a card into the long take (all track cards must be consecutive). `racket: true` gives 2-beat B-layout cards with slide transitions. `palKey 'multi'` rotates `G.CYCLE` per card. Intro and finale are `{kind:'intro'|'finale', beats: 48}`. The script computes `b0, t0, dur`, then `EDL.DUR` = total beats × 0.4 s.

### `scenes.js`

`G.renderFrame(ctx, t)` → `frame()` finds the shot by binary search, decides whether t is inside a transition window, renders A and B into offscreen buffers and composites them, then draws the HUD. Key functions: `cardScene` (layouts via `layoutOf`), `chapterScene`, `trackScene` (`trackCam`, `stationX`, `SPEC`, `RUNNING`), `introScene`, `finaleScene` (`GRID 9×5`, `rings()`), `hud`, `transType` / `composite`, `stageFigure(ctx, poseName, u, C, x, y, scalePx, asm, mask)`, `patBg`, `multiBg`, `textBlock`, `sun`, `bigNumber`.

### Minimal example — a new card and a new pose

```js
// poses/nature.js (or a new poses/xxx.js added to index.html)
POSES.kite = {
  iconU: 1,
  keys: [
    { b: 0, torso: -6, aR1: 150, aR2: 160, aL1: 20, aL2: 40, lR1: 10, lL1: -12 },
    { b: 1, torso: -12, aR1: 170, aR2: 175, aL1: 30, aL2: 60, lR1: 18, lL1: -20, e: 'oExp' }, // tug on the beat
  ],
  loop: 2,
  front: (ctx, J, u, C) => {                     // string + diamond kite, all geometry
    const h = J.aR[2], k = [h[0] + 0.55, h[1] - 0.75 + 0.04 * Math.sin(u * Math.PI)];
    G.seg(ctx, h, k, 0.01, C.line);
    G.poly(ctx, [[k[0], k[1] - 0.12], [k[0] + 0.08, k[1]], [k[0], k[1] + 0.12], [k[0] - 0.08, k[1]]], C.acc);
  },
};
// edl.js, inside a chapter
card(44, 'KITE FLYING', '放风筝', '凧揚げ', 'kite', { sub: 'NEW' });   // n = index shown as "44 / N"; update the total (see below)
```
Then: `node lab.mjs stills/lab_kite.png "p=kite&n=8&beats=4"` → `node music/export_timeline.cjs` → (update `compose()` if chapters moved) → `node shot.mjs <t>` → render.

### Replacing the event elements

| What | Where | Replace with |
|---|---|---|
| Event name, edition, host city, dates | `scenes.js` 372–373, 398–407, 417, 539–541, 562–566; `cover.html` 94–114; `cover34.html` 90–113 | your own title and date line |
| Slogan "IMAGINE ONE ASIA / ここで、ひとつに。/ 在这里，合而为一" | `scenes.js` 534–536; covers | your own two-line slogan |
| Emblem-like mark (red sun + five rings, `rings()`, `RINGS`) | `scenes.js` 341–352, intro 356–375, finale 509–531 | an original mark, e.g. your own shape built from the grid motifs |
| Palette names (Jonetsu Red, Kakitsubata Purple, Shinrin Green, Kinshachi Gold, Dento Ocher) and hexes | `engine.js` `PAL` (lines 45–51); the name is printed on chapter cards (`scenes.js` 246) | a custom five-hue set with 5 tones each; keep the dark-fg rule for light hues |
| Item list, counts "/ 43", 43 HUD ticks, "469 EVENTS / 16 DAYS", finale "2026" tile | `edl.js`; `scenes.js` 118, 184, 414–418, 512, 570 | your list and numbers (derive from `CARDS` instead of hard-coding 43) |
| Chapter layout in the score | `music/music.py` `EXPECTED` + `compose()` | re-composed sections |
| Official reference images | `demo/ref/` | never ship; collect your own references |

Keep the grammar: the grid pattern with row shifts, pictogram athletes, the bilingual mask-slide type, the HUD with index and progress, beat-locked cards with a pace ladder, one long take, and the icon-wall finale.
