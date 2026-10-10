// sheets.js: model sheets as standalone loops (studio.html?loop=faces | views | kit). Render one with
//   node render.mjs --loop=faces --stills=0.5 --out=out/sheets
(() => {
  const bg = () => { sky(['#2a2a48', '#34345a'], { soft: .3 }); };
  const floor = (y) => { rect(0, y, LW, 1, '#4a4a78'); };

  // every expression, front view, for both characters
  LOOPS.faces = t => {
    pal('day'); camAt(); bg();
    [58, 118, 180, 262].forEach(floor);
    EXPR_NAMES.forEach((f, i) => {
      const cx = 30 + (i % 8) * 60;
      const r = Math.floor(i / 8);
      const yp = 58 + r * 60, yj = 180 + r * 82;
      pip(cx, yp, { t, face: f, seed: i, blink: false, emote: EXPR[f].emote, emoteAge: 1 });
      juno(cx, yj, { t, face: f, seed: i, blink: false });
      tinyText(f, cx, yj + 3, '#b0b0d8', { align: 'center' });
    });
  };
  LOOPS.faces.len = 2;

  // views, walk cycle frames, jump keys, arms holding props
  LOOPS.views = t => {
    pal('day'); camAt(); bg();
    const views = ['front', 'q', 'side', 'back'];
    views.forEach((v, i) => { floor(70); pip(30 + i * 34, 70, { t, view: v, face: 'happy', blink: false }); floor(160); juno(34 + i * 34, 160, { t, view: v, face: 'happy', blink: false }); });
    views.forEach((v, i) => { pip(170 + i * 34, 70, { t, view: v, face: 'happy', flip: true, blink: false }); });
    // walk frames
    for (let k = 0; k < 6; k++) { pip(300 + k * 30, 70, { t, view: 'side', face: 'happy', walk: k / 6, blink: false }); }
    for (let k = 0; k < 6; k++) { juno(185 + k * 24, 160, { t, view: 'side', face: 'neutral', walk: k / 6, blink: false }); }
    tinyText('walk x6', 390, 76, '#b0b0d8', { align: 'center' });
    // jump keys: crouch, stretch, apex, land
    const J = [[.18, 0, false], [-.18, -14, true], [-.05, -22, true], [.22, 0, false]];
    J.forEach(([sq, dy, air], i) => juno(350 + i * 32, 160, { t, face: i === 0 ? 'determined' : i === 3 ? 'happy' : 'excited', sq, dy, air, view: 'q', arm: i === 0 ? [ARM.low, -.2] : [ARM.low, ARM.high], blink: false }));
    floor(250);
    // props in hands
    pip(40, 250, { t, face: 'happy', arm: [ARM.low, .9], hold: [null, (x, y) => PROP.balloon(x, y)] });
    pip(90, 250, { t, face: 'love', arm: [.4, .4], hold: [null, (x, y, a) => PROP.flower(x, y, a)] });
    juno(150, 250, { t, face: 'happy', view: 'q', arm: [ARM.down, .6], bend: [.2, .8], hold: [null, (x, y) => PROP.lantern(x, y)] });
    juno(210, 250, { t, face: 'smug', view: 'side', arm: [ARM.down, 1.0], bend: [.2, .3], hold: [null, (x, y, a) => PROP.umbrella(x, y + 2, { h: 22 })] });
    juno(270, 250, { t, face: 'excited', view: 'front', arm: [1.1, 1.1], bend: [.3, .3], hold: [null, (x, y) => PROP.kite(x, y - 9, { hang: true, t })] });
    pip(330, 250, { t, face: 'surprised', view: 'q', arm: [ARM.low, .3], hold: [null, (x, y) => PROP.mug(x + 1, y + 1)] });
    juno(390, 250, { t, face: 'shy', view: 'q', arm: [ARM.low, .2], bend: [.2, .6], hold: [null, (x, y) => PROP.letter(x + 3, y)] });
    pip(445, 250, { t, face: 'determined', view: 'side', arm: [ARM.low, .6], hold: [null, (x, y) => PROP.star(x + 2, y - 5)] });
  };
  LOOPS.views.len = 2;

  // palettes, emotes, weather, light, transitions
  LOOPS.kit = t => {
    camAt();
    ['day', 'dusk', 'night'].forEach((p, i) => {
      pal(p); const x0 = i * 160;
      clip(x0, 0, 160, 120);
      const s = P.sky; for (let y = 0; y < 120; y++) { const k = y / 120 * (s.length - 1), a = Math.floor(k); for (let x = x0; x < x0 + 160; x++) px(x, y, dith(x, y, k - a) ? s[Math.min(s.length - 1, a + 1)] : s[a]); }
      glow(x0 + 120, 40, 18, P.sun[0], .7); disc(x0 + 120, 40, 7, P.sun[1]);
      noclip();
      palColours(P).forEach((c, j) => rect(x0 + 4 + (j % 16) * 9, 92 + Math.floor(j / 16) * 9, 8, 8, c));
      tinyText(p, x0 + 6, 4, P.ink);
    });
    pal('day');
    rect(0, 120, LW, 150, '#2a2a48');
    const em = ['!', '?', '!?', 'heart', 'sweat', 'anger', 'dots', 'note', 'bulb', 'star', 'spiral', 'zzz'];
    em.forEach((k, i) => emote(k, 8 + i * 39, 150, { age: t + 1 }));
    // weather boxes
    const box = (x, fn) => { rect(x, 160, 110, 100, '#1c2a4a'); clip(x, 160, 110, 100); fn(x); noclip(); };
    box(4, x => { pal('night'); rain(t, { n: 60 }); pal('day'); });
    box(122, x => { snow(t, { n: 60 }); });
    box(240, x => { sparkles(t, x + 10, 170, 90, 80, { n: 12 }); });
    box(358, x => { glow(x + 55, 210, 40, '#ffb44a', 1); disc(x + 55, 210, 4, '#fff3b0'); fireflies(t, x + 5, 170, 100, 80); });
  };
  LOOPS.kit.len = 2;

  // transitions (loop time 0..4: dissolve, iris, diamonds, blocks at k = frac)
  LOOPS.wipes = t => {
    pal('day'); camAt(); sky(); hills(200, { c: P.mid[1] }); ground(x => 230);
    const k = frac(t), i = Math.floor(t) % 4;
    [() => dissolve(k), () => iris(k, 240, 150, { shape: 'diamond' }), () => diamonds(k), () => blocks(k)][i]();
  };
  LOOPS.wipes.len = 4;
})();
