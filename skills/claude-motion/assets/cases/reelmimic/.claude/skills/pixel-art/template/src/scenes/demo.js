// demo.js — "The Kite" (10 s, 2 shots). An example, not a template: write your own story, world and shots.
//   A 0.0–5.6  day   dither fade in · camera pans across the valley to a tree where Pip's kite is stuck · Pip hops,
//                   fails, goes sad · Juno trots in, spots it (!), crouches, JUMPS, grabs it, lands (squash, dust),
//                   offers it · Pip: surprised → love · diamond wipe out
//   B 5.6–10.0 dusk  diamond wipe in on the kite flying free in the sunset · camera tilts down the string to the pair ·
//                   Pip turns to Juno: caption "謝謝你！Thank you!" · Juno goes shy · iris closes on the two
(() => {
  useText('謝謝你！Thank you!PIP');
  const A_END = 5.6;

  // ---------------- shot A: the stuck kite ----------------
  const gA = x => 212 + 5 * Math.sin(x * .013) + 3 * Math.sin(x * .031 + 1);
  const DECEL = x => Math.sin(x * Math.PI / 2);
  const JX0 = 305, JX1 = 596, JUMP0 = 3.55, JUMP1 = 4.05, JLAND = 602, PIPX = 630, TREEX = 660;
  const junoX = t => t < 3.1 ? walkTo(t, 1.85, 3.1, JX0, JX1, 22, DECEL).x
    : lerp(JX1, JLAND, ease(seg(t, JUMP0, JUMP1)));
  const junoDy = t => jump(t, JUMP0, JUMP1, 22).dy;
  const junoPose = t => {
    const s = st(t), w = walkTo(t, 1.85, 3.1, JX0, JX1, 22, DECEL), x = junoX(t), j = jump(s, JUMP0, JUMP1, 22);
    const air = s > JUMP0 && s < JUMP1;
    const face = act(s, [[0, 'neutral'], [3.12, 'surprised', { look: [1, -1] }], [3.4, 'determined', { look: [1, -1], emote: null, take: 0 }], [4.15, 'happy', { look: [1, 0], take: .6 }]]);
    // arms: swing while walking, ready at crouch, reach forward-up in the air, hold the kite up, then offer it to Pip
    let arm = [ARM.down, ARM.down], bend = [.25, .25];
    if (s > 3.4 && s < JUMP0) arm = [-1.0, -1.0];                       // crouch: arms back
    if (s >= JUMP0 && s < 4.2) { arm = [kf(s, [[JUMP0, -.2], [JUMP0 + .15, .5], [4.1, -.6]]), kf(s, [[JUMP0, .4], [JUMP0 + .12, 1.05]], easeOut)]; bend = [.4, .55]; }
    if (s >= 4.2) { arm = [ARM.down, kf(s, [[4.2, .9], [4.5, -.35]], easeOut)]; bend = [.25, kf(s, [[4.2, .3], [4.5, .5]])]; }
    return { x, y: gA(x), view: s < 3.12 ? 'side' : s < 3.4 ? 'q' : s < 4.2 ? 'front' : 'side', walk: w.walk, dy: Math.round(j.dy), sq: j.sq + (face.sq || 0) * (air ? 0 : 1), air: air && s > JUMP0 + .05 && s < JUMP1 - .06, arm, bend, face, drag: clamp(-vel(junoDy, s) / 120, -1, 1) };
  };
  const GRAB = 3.8, CLOSE_A = 2.95, CLOSE_B = 7.2;
  // where the kite hangs in the tree = Juno's hand at the jump apex (measured, so the grab always connects)
  let K = null;
  const kiteHome = () => K || (K = measure(() => { const p = junoPose(GRAB); return juno(p.x, p.y, { ...p.face, ...p, face: p.face.face, t: GRAB }).hands[1]; }));

  function shotA(t, lt) {
    pal('day');
    const s = st(t), cx = lerp(250, 572, ease(seg(t, 0, 1.7)));
    const [shx, shy] = t > JUMP1 && t < JUMP1 + .2 ? shake(t, 1.2) : [0, 0];
    camAt(cx + shx, 135 + shy);
    const close = t >= CLOSE_A;          // cut on action (Juno arriving) to a 2× medium shot
    sky(P.sky, { soft: .45 });
    sunDisc(70, 42, 11, { par: 0 });
    clouds(t, { y: 46, n: 6, par: .12, speed: 4, dy: 36 });
    hills(176, { c: P.far[0], rim: P.far[1], amp: 16, freq: .009, par: .18, seed: 2 });
    hills(196, { c: P.mid[0], rim: P.mid[1], amp: 10, freq: .015, par: .4, seed: 5, bumps: .9, bumpW: 11 });
    forest(206, { c: P.mid[0], rim: P.mid[1], par: .62, gap: 11, hmin: 14, hmax: 26, seed: 3 });
    birds(t, { x: 150, y: 70, n: 3, par: .3, speed: 14, c: '#3a4a7a' });
    ground(gA, { flowers: [P.accent[2], P.light[1], '#fff8e8'], tufts: .4 });
    bush(TREEX + 46, gA(TREEX + 46) + 1, 26);
    tree(TREEX, gA(TREEX) + 1, { h: 62, r: 46, t, seed: 4 });
    bush(470, gA(470) + 1, 20, { berries: P.accent[1] });

    // Pip: two failed hops reaching up → sad → surprised → love (hearts) + a happy hop
    const pj = t < 1.62 ? jump(s, 1.25, 1.5, 7) : t < 3 ? jump(s, 1.68, 1.93, 8) : jump(s, 4.95, 5.25, 9);
    const pf = act(s, [[0, 'determined', { look: [1, -1], emote: null }], [2.05, 'sad', { look: [1, -1] }], [4.38, 'surprised', { look: [1, 0] }], [4.72, 'love', { look: [1, 0] }]]);
    const reach = (t > 1.1 && t < 2.05) ? [1.1, 1.3] : t > 4.72 ? [.5 + .3 * Math.sin(s * 9), .9] : t > 4.38 ? [ARM.low, .2] : [ARM.low, ARM.low];
    footShadow(PIPX, gA(PIPX), 11 + Math.round(pj.dy * .2));
    pip(PIPX, gA(PIPX), { ...pf, t: s, flip: true, view: 'q', emoteSide: 1, dy: Math.round(pj.dy), sq: pj.sq + pf.sq, air: pj.dy < -2, arm: reach, drag: clamp(-vel(u => (u < 1.62 ? jump(u, 1.25, 1.5, 7) : jump(u, 1.68, 1.93, 8)).dy, s) / 60, -1, 1), seed: 3 });

    // Juno
    const p = junoPose(t), held = s >= GRAB;
    const home = kiteHome();
    if (!held) PROP.kite(home[0] + Math.round(Math.sin(s * 3) * .6), home[1] - 9, { hang: true, t: s, tilt: -.25 + .05 * Math.sin(s * 5), tail: [.3, 1] });
    if (t >= 1.85) {
    footShadow(p.x, gA(p.x), 12 + Math.round(p.dy * .25));
    juno(p.x, p.y, { ...p.face, ...p, face: p.face.face, t: s, seed: 1, hold: [null, held ? (hx, hy) => PROP.kite(hx + Math.round(8 * seg(s, 4.2, 4.5)), hy - 9 + Math.round(1 * seg(s, 4.2, 4.5)), { hang: true, t: s, tilt: s < 4.3 ? -.25 : lerp(-.25, .2, seg(s, 4.25, 4.55)), tail: [-.4, 1] }) : null] });
    }
    if (!held) sparkles(t, home[0] - 10, home[1] - 20, 20, 18, { n: 3, seed: 2 });
    puff(t - JUMP1, p.x, gA(p.x));
    if (t > 4.72) sparkles(t, PIPX - 12, gA(PIPX) - 58, 30, 26, { n: 5, seed: 7 });

    if (close) punch(2, 604 + shx, 170 + shy);
    // transitions: pixel dissolve in, diamond wipe out
    screenSpace();
    dissolve(1 - seg(t, 0, .45));
    diamonds(seg(t, 5.2, A_END), { dir: 'right', size: 22 });
  }

  // ---------------- shot B: flying it together at sunset ----------------
  const gB = x => 232 - 20 * Math.exp(-(((x - 210) / 150) ** 2));
  const PX_ = 222, JXB = 190;
  function shotB(t, lt) {
    pal('dusk');
    const s = st(t), tilt = ease(seg(t, 6.1, 7.35)), cx = lerp(292, 236, tilt), cy = lerp(62, 150, tilt);
    camAt(cx, cy);
    sky(P.sky, { soft: .5, par: .25, y0: -60, y1: 250 });
    sunDisc(340, 176, 17, { par: .2 });
    clouds(t, { y: 70, n: 7, par: .22, speed: 3, dy: 70, seed: 9, size: 1.1 });
    birds(t - 5.6, { x: 120, y: 60, n: 4, par: .5, speed: 16, c: P.ink });
    hills(196, { c: P.far[0], rim: P.far[1], amp: 14, freq: .01, par: .3, seed: 8 });
    city(214, { c: P.mid[1], lit: .3, par: .45, hmin: 12, hmax: 46, seed: 4, win: P.light[1] });
    hills(222, { c: P.mid[0], rim: P.rim, amp: 8, freq: .018, par: .65, seed: 3, bumps: .8, bumpW: 10 });
    ground(gB, { tufts: .5, flowers: [P.accent[2], P.light[1]] });
    fireflies(t, 80, 190, 280, 30, { n: 7 });

    // the kite, bobbing in the wind high above; the string runs down to Pip's spool
    const kx = 330 + Math.round(6 * Math.sin(s * 1.3)), ky = 34 + Math.round(4 * Math.sin(s * 2.1 + 1));
    const pf = act(s, [[5.6, 'laugh', { look: [1, -1] }], [7.25, 'happy', { look: [-1, 0], emote: null }]], { emoteFrom: 1 });
    const turned = s >= 7.25;
    const hand = measure(() => pip(PX_, gB(PX_), { ...pf, t: s, view: 'q', flip: turned, arm: [ARM.low, turned ? .5 : .8], hold: [null, null] })).hands[1];
    const kbr = PROP.kite ? [kx, ky] : null;
    curve([hand, [lerp(hand[0], kx, .5) + 4, lerp(hand[1], ky, .5) + 14], [kx, ky + 1]], '#ffe8cc');
    PROP.kite(kx, ky, { s: 9, t: s, tilt: .18 + .1 * Math.sin(s * 2.3), tail: [-.55, .85] });
    sparkles(t, kx - 22, ky - 14, 44, 34, { n: 6, seed: 4, c: P.sun[2], c2: P.light[1] });

    // Juno cheers, then goes shy when thanked
    const jf = act(s, [[5.6, 'laugh', { look: [1, -1] }], [7.9, 'shy', { look: [1, 0], emote: 'heart' }]], { emoteFrom: 1 });
    const jj = jump(s, 6.5, 6.8, 6);
    footShadow(JXB, gB(JXB), 12);
    juno(JXB, gB(JXB), { ...jf, t: s, view: s < 7.9 ? 'front' : 'q', dy: Math.round(jj.dy), sq: jj.sq + jf.sq, arm: s < 7.9 ? [1.0 + .15 * Math.sin(s * 8), 1.05 + .15 * Math.sin(s * 8 + 2)] : [ARM.low, ARM.low + .4], bend: s < 7.9 ? [.5, .5] : [.2, 1.2], seed: 5, wind: .6 });
    footShadow(PX_, gB(PX_), 11);
    pip(PX_, gB(PX_), { ...pf, t: s, view: 'q', flip: turned, arm: [ARM.low, turned ? .5 : .8], hold: [null, (x, y) => PROP.spool(x, y)], wind: .8, seed: 2 });

    screenSpace();
    if (t >= CLOSE_B) punch(2, (PX_ + JXB) / 2 + 2, gB(PX_) - 34);
    diamonds(1 - seg(t, A_END, 6.0), { dir: 'left', size: 22 });
    layer(1);
    iris(seg(t, 9.3, 9.95), (PX_ + JXB) / 2 + 2, gB(PX_) - 30, { c: P.ink });
  }

  shots([[0, shotA], [A_END, shotB]]);
  window.overlayHook = (c, t) => { say(c, t, 7.35, 9.3, '謝謝你！Thank you!', { name: 'PIP' }); };
})();
