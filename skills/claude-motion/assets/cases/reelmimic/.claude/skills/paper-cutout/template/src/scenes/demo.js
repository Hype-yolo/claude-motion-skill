// demo.js — "The Apple" (11 s, 3 shots). Pom jumps for an apple, then gives it to Lulu.
//   A 0.00–4.25  pop-up page in · meadow establishing push-in · Pom looks up, decides, crouch → jump → grab → land, laughs
//   B 4.25–8.00  torn-paper reveal · Lulu walks in, sad · Pom offers the apple · Lulu: surprised → love
//   C 8.00–11.0  flip-card turn · close two-shot, Lulu holds the apple, both laugh, confetti · caption · sheet slides over
(() => {
  // ---------------- A: the apple tree ----------------
  const PX = 780, PY = 965, PU = 64, TX = 1180, TY = 950, TS = 1.4;
  const J0 = 2.2, J1 = 2.75, GRAB = 2.5;
  // where Pom's right hand is at the top of the jump: hang the apple exactly there
  let APPLE = null;
  const reach = st => ({ view: '3q', ...jumpPose(st, J0, J1, 5), armR: [135, 12], armL: [-120, -10] });
  function appleSpot() { if (!APPLE) { const j = pom(PX, PY, PU, { ...reach(GRAB), dry: true, jit: 0 }); APPLE = j.hand[1]; } return APPLE; }

  function shotA(t, lt, dur) {
    const st = sm(lt);
    paperCam(lt, [[0, [960, 540, 1]], [1.7, [930, 540, 1.1]], [dur, [905, 545, 1.15]]]);
    backdrop(PC.sky, { to: 'rgba(255,240,210,.35)' });
    layer(.25, () => { sun(1560, 190, 85); cloud(420, 210, 300, { hang: 'string', seed: 1 }); cloud(1180, 150, 230, { hang: 'string', seed: 2 }); });
    layer(.5, () => hills(960, 700, 3800, 120, PC.mint, { seed: 3, bumps: 3 }));
    layer(.75, () => { hills(960, 790, 3800, 90, PC.sage, { seed: 4, bumps: 4 }); bush(260, 820, .9, { seed: 2, cols: [PC.forest, PC.grass] }); });
    hills(960, 925, 3800, 50, PC.leaf, { seed: 5, bumps: 2 });
    // the tree shakes when the apple is pulled off it
    const shake = st >= GRAB ? spring(st, GRAB, 5, 22) * 5 : 0;
    const tr = tree(TX, TY, TS, { seed: 2, sway: sway('treeA', .8, .35) + shake, fruit: [[140, -40], [30, 110]] });
    tr.fruit.forEach(([fx, fy], i) => PROPS.apple(fx, fy + 20, (i ? -8 : 10) + shake * 2, 40));
    const ap = appleSpot();
    if (st < GRAB) { thread([[ap[0] + 6, ap[1] - 110], [ap[0] + 2, ap[1] - 30]], { col: PC.bark, w: 4 }); PROPS.apple(ap[0], ap[1] - 6, sway('hang', 4, .5), 44); }
    // Pom: look up → decide → crouch, jump, grab → land → laugh with the apple held high
    const m = moods(lt, [[0, 'neutral'], [1.45, 'determined'], [2.85, 'laugh']]);
    const air = st >= J0 - .3 && st < J1 + .35, jp = jumpPose(st, J0, J1, 5);
    let o = { view: '3q', ...m, look: [.5, -.9], tilt: -8 };
    if (st < 1.45) o.tilt = lerp(0, -10, ease(seg(st, .7, 1.1)));
    if (air) { o = { ...o, ...jp, sq: jp.sq + m.sq, look: [.3, -1] }; if (st >= J0) { o.armR = [135, 12]; o.armL = [-120, -10]; } }
    if (st >= J1 + .35) { const k = ease(seg(st, J1 + .35, J1 + .7)); o.armR = [lerp(80, 145, k), lerp(10, -5, k)]; o.armL = [lerp(-80, -25, k), 10]; o.look = [0, -.3]; o.tilt = lerp(0, -6, k); }
    if (st >= GRAB) o.holdR = { prop: 'apple', s: .72, dy: -.3 };
    const J = pom(PX, PY, PU, o);
    if (st >= 3.0) emote('sparkle', J.hand[1][0] + 40, J.hand[1][1] - 60, 34, st - 3.0);
    // foreground: grass and flowers on a nearer plane
    layer(1.25, () => { grass(400, 1010, 900, 60, PC.grass, 3); grass(1500, 1015, 1000, 70, PC.forest, 4); flower(1320, 1000, 1.2, PC.rose, { seed: 1 }); flower(560, 1005, 1, PC.yellow, { seed: 2, center: PC.orange }); flower(1650, 1000, 1.1, PC.lilac, { seed: 3 }); });
    camEnd();
    trBook(t, seg(sm(lt), 0, 1.0));
  }

  // ---------------- B: the gift ----------------
  const LW = { stride: 1.05, rate: 2.25 }, W0 = .1, W1 = 2.0, LX0 = 2020, LX1 = 1330;
  function shotB(t, lt, dur) {
    const st = sm(lt);
    paperCam(lt, [[0, [1000, 600, 1.14]], [dur, [1010, 600, 1.2]]], { stepped: true, fps: 6 });
    backdrop(PC.sky, { to: 'rgba(255,236,205,.45)' });
    layer(.3, () => { cloud(1500, 180, 260, { hang: 'string', seed: 4 }); cloud(700, 240, 200, { hang: 'string', seed: 5 }); });
    layer(.55, () => hills(960, 760, 3800, 110, PC.mint, { seed: 7, bumps: 2 }));
    layer(.8, () => { house(330, 830, 1.05, { roof: PC.tomato, door: PC.teal }); bunting(470, 560, 1250, 470, 8, [PC.red, PC.yellow, PC.teal, PC.pink], { sag: 70 }); tree(1640, 840, .8, { seed: 5, fruit: [] }); });
    hills(960, 915, 3800, 40, PC.leaf, { seed: 8, bumps: 2 });
    piece(SH.hills(3800, 30, 2, 9, 200), { x: 960, y: 985, col: PC.sand, mat: 'kraft', torn: 'top', depth: .6, seed: 9 });   // the path
    // Lulu walks in from the right, sad; stops; surprised → love when she sees the apple
    const k = seg(st, W1 - .15, W1 + .1), walking = st < W1;
    const lx = lerp(LX0, LX1, clamp((st - W0) / (W1 - W0)));
    const wc = walkCycle(st - W0, LW), lm = moods(lt, [[0, 'sad'], [2.45, 'surprised'], [2.95, 'love']]);
    let lo = { view: '3q', flip: true, ...lm, look: [.2, .4], tilt: 6 };
    if (walking) lo = { ...lo, ...wc, lean: 3 };
    else { lo.footL = [0, 0]; lo.footR = [0, 0]; lo.armL = [-8, 6]; lo.armR = [8, -6]; }
    if (st >= 2.45) { lo.look = [.6, .2]; lo.tilt = 0; }
    if (st >= 2.95) { const h = ease(seg(st, 2.95, 3.15)); lo.armL = [lerp(-8, -140, h), lerp(6, -96, h)]; lo.armR = [lerp(8, 140, h), lerp(-6, 96, h)]; lo.tilt = -6; }   // hands to her cheeks
    const JL = lulu(lx, 985, 38, lo);
    // Pom offers the apple
    const off = ease(seg(st, 2.05, 2.35)), pm = moods(lt, [[0, 'happy'], [2.05, 'happy'], [2.95, 'laugh']]);
    const JP = pom(640, 990, 56, { view: '3q', ...pm, look: [.8, -.1], lean: lerp(0, 7, off), armR: [lerp(25, 95, off), lerp(15, -5, off)], armL: [-20, 10], holdR: { prop: 'apple', s: .75, dy: -.3 } });
    if (st >= 2.45 && st < 2.95) emote('!', JL.top[0] + 20, JL.top[1] - 30, 42, st - 2.45);
    if (st >= 2.95) emote('heart', JL.top[0] - 10, JL.top[1] - 40, 40, st - 2.95);
    layer(1.3, () => { grass(300, 1080, 900, 70, PC.forest, 6); flower(1780, 1075, 1.3, PC.yellow, { seed: 7 }); });
    camEnd();
    trTear(t, seg(sm(lt), 0, .75));
  }

  // ---------------- C: sharing ----------------
  function shotC(t, lt, dur) {
    const st = sm(lt);
    paperCam(lt, [[0, [960, 540, 1]], [dur, [960, 555, 1.07]]]);
    backdrop(PC.peach);
    // sun-burst rays behind them, ticking round
    const rot = sm(lt) * 4;
    for (let i = 1; i < 18; i += 2) { const a = (i / 18 * 360 + rot) * D2R, a2 = ((i + .5) / 18 * 360 + rot) * D2R; piece(SH.poly([[0, 0], [Math.cos(a) * 1500, Math.sin(a) * 1500], [Math.cos(a2) * 1500, Math.sin(a2) * 1500]]), { x: 960, y: 560, col: PC.tangerine, depth: .3, seed: 3000 + i, edge: false, jit: 0 }); }
    piece(SH.circle(210), { x: 960, y: 560, col: PC.lemon, depth: .6, seed: 3100, jit: 0 }); piece(SH.circle(150), { x: 960, y: 560, col: PC.white, mat: 'card', depth: .4, seed: 3101, jit: 0 });
    const pm = moods(lt, [[0, 'happy'], [.55, 'laugh']]), lm = moods(lt, [[0, 'love'], [.7, 'laugh']]);
    const bounce = Math.abs(Math.sin(st * Math.PI * 2.2)) * -.15;
    pom(640, 1170, 92, { view: '3q', ...pm, dy: pm.dy + (st > .55 ? bounce : 0), armR: [120, 20], armL: [-40, 10], look: [.7, 0], tilt: -4 });
    lulu(1290, 1175, 60, { view: '3q', flip: true, ...lm, dy: lm.dy + (st > .7 ? bounce * .8 : 0), armR: [100, 40], armL: [-30, 10], holdR: { prop: 'apple', s: .85, dy: -.3 }, look: [.6, 0], tilt: 5 });
    confetti(lt, 960, 700, { t0: .6, n: 46, power: 1.1 });
    confetti(lt, 500, 800, { t0: .85, n: 20, seed: 2, spread: 70, power: .8 });
    camEnd();
    trFlip(t, seg(sm(lt), 0, .8));
    sheetOut(seg(sm(lt), dur - .6, dur), { col: PC.cream });
  }

  shots([[0, shotA], [4.25, shotB], [8.0, shotC]]);
  captionTrack([
    [.55, 2.0, '蘋果樹下', { style: 'letters', y: 150, size: 110 }],
    [8.8, 10.3, '一起分享吧！', { style: 'label', size: 76 }],
  ]);
})();
